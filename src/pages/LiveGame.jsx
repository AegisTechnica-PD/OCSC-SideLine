import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { FORMATIONS, DEFAULT_FORMATION, slotsFor, labelOf, mmss, minuteOf, clockSeconds, lineupFromEvents, minutesFromEvents } from "../lib/game";
import { C, font, sBtn, swatch } from "../theme";

export default function LiveGame() {
  const { id } = useParams();
  const nav = useNavigate();
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [picker, setPicker] = useState(null); // { type: 'goal'|'save'|'card', step: 'scorer'|'assist', scorer }
  const [tab, setTab] = useState("pitch");

  // ---- load + realtime ----
  useEffect(() => {
    const load = async () => {
      const [{ data: g }, { data: p }, { data: e }] = await Promise.all([
        supabase.from("games").select("*").eq("id", id).single(),
        supabase.from("players").select("*").eq("active", true),
        supabase.from("game_events").select("*").eq("game_id", id).order("second").order("id"),
      ]);
      setGame(g); setPlayers((p || []).sort((a, b) => Number(a.number) - Number(b.number))); setEvents(e || []);
    };
    load();
    const ch = supabase.channel(`game-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${id}` }, (p) => setGame(p.new))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${id}` },
        (p) => setEvents((ev) => (ev.some((x) => x.id === p.new.id) ? ev : [...ev, p.new])))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "game_events" },
        (p) => setEvents((ev) => ev.filter((x) => x.id !== p.old.id)))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [id]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // ---- derived ----
  const secs = clockSeconds(game, now);
  const running = !!game?.clock_started_at;
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const formation = game?.formation || DEFAULT_FORMATION;
  const lineup = useMemo(() => lineupFromEvents(events, formation), [events, formation]);
  const mins = useMemo(() => minutesFromEvents(events, secs), [events, secs]);
  const onPitch = new Set(Object.values(lineup).filter(Boolean));
  const bench = players.filter((p) => !onPitch.has(p.id));
  const slotOf = (pid) => slotsFor(formation).find((id) => lineup[id] === pid) || null;
  const tag = (pid) => `#${byId[pid]?.number ?? "?"}`;

  if (!game) return <div style={{ padding: 14, color: C.slate }}>Loading…</div>;

  // ---- writes ----
  const add = async (rows) => {
    const payload = rows.map((r) => ({ game_id: id, second: secs, half: game.half, ...r }));
    const { data } = await supabase.from("game_events").insert(payload).select();
    if (data) setEvents((ev) => [...ev, ...data.filter((d) => !ev.some((x) => x.id === d.id))]);
  };
  const patchGame = async (patch) => {
    setGame((g) => ({ ...g, ...patch }));
    await supabase.from("games").update(patch).eq("id", id);
  };
  const toggleClock = () => running
    ? patchGame({ elapsed_seconds: secs, clock_started_at: null })
    : patchGame({ clock_started_at: new Date().toISOString() });
  const halftime = async () => {
    await add([{ type: "half", meta: { label: game.half === 1 ? "Halftime" : "Back to 1st half" } }]);
    await patchGame({ elapsed_seconds: secs, clock_started_at: null, half: game.half === 1 ? 2 : 1 });
  };
  const finish = async () => {
    if (!confirm("Finish game? Clock stops and it moves to Results.")) return;
    await add([{ type: "final" }]);
    await patchGame({ elapsed_seconds: secs, clock_started_at: null, finished: true });
    nav(`/games/${id}`);
  };
  const undo = async () => {
    const last = [...events].sort((a, b) => a.id - b.id).pop();
    if (!last) return;
    await supabase.from("game_events").delete().eq("id", last.id);
    setEvents((ev) => ev.filter((x) => x.id !== last.id));
    if (last.type === "goal") patchGame({ goals_for: Math.max(0, game.goals_for - 1) });
    if (last.type === "opp_goal") patchGame({ goals_against: Math.max(0, game.goals_against - 1) });
  };

  const changeFormation = async (f) => {
    if (f === formation) return;
    const keep = new Set(slotsFor(f));
    const displaced = Object.entries(lineup).filter(([sid, pid]) => pid && !keep.has(sid)).map(([, pid]) => pid);
    if (displaced.length && !confirm(`${displaced.length} player${displaced.length > 1 ? "s" : ""} will move to the bench. Switch to ${f}?`)) return;
    if (displaced.length) await add(displaced.map((pid) => ({ type: "off", player_id: pid, meta: { reason: "formation" } })));
    await patchGame({ formation: f });
    setSelected(null);
  };

  // ---- lineup taps ----
  const tapPlayer = (pid) => {
    if (picker) return pick(pid);
    if (!selected) return setSelected(pid);
    if (selected === pid) return setSelected(null);
    const a = slotOf(selected), b = slotOf(pid);
    if (a && b) add([{ type: "move", player_id: pid, position: a }, { type: "move", player_id: selected, position: b }]);
    else if (a && !b) add([{ type: "off", player_id: selected }, { type: "on", player_id: pid, position: a }]);
    else if (!a && b) add([{ type: "off", player_id: pid }, { type: "on", player_id: selected, position: b }]);
    setSelected(null);
  };
  const tapSlot = (sid) => {
    const occ = lineup[sid];
    if (occ) return tapPlayer(occ);
    if (!selected) return;
    const a = slotOf(selected);
    add([{ type: a ? "move" : "on", player_id: selected, position: sid }]);
    setSelected(null);
  };

  // ---- event picker (goal / save / card) ----
  const startPick = (type) => { setSelected(null); setPicker({ type, step: "scorer" }); };
  const pick = async (pid) => {
    if (picker.type === "goal" && picker.step === "scorer") return setPicker({ type: "goal", step: "assist", scorer: pid });
    if (picker.type === "goal") {
      const rows = [{ type: "goal", player_id: picker.scorer }];
      if (pid && pid !== picker.scorer) rows.push({ type: "assist", player_id: pid });
      await add(rows); await patchGame({ goals_for: game.goals_for + 1 });
    } else {
      await add([{ type: picker.type, player_id: pid }]);
    }
    setPicker(null);
  };
  const oppGoal = async () => { await add([{ type: "opp_goal" }]); await patchGame({ goals_against: game.goals_against + 1 }); };

  const hint = picker
    ? picker.step === "assist" ? "Assist? Tap a player, or skip." : `${picker.type === "goal" ? "Who scored?" : picker.type === "save" ? "Who saved it?" : "Who got the card?"} Tap a player.`
    : selected ? `Holding ${tag(selected)} — tap a player to swap, or an empty spot to place.` : "Tap a player, then tap where she goes.";

  const log = [...events].sort((a, b) => b.id - a.id).map((e) => ({
    id: e.id, t: `${e.half}H ${minuteOf(e.second)}'`,
    text: e.type === "on" ? `${tag(e.player_id)} on at ${labelOf(e.position)}`
      : e.type === "off" ? `${tag(e.player_id)} off`
      : e.type === "move" ? `${tag(e.player_id)} to ${labelOf(e.position)}`
      : e.type === "goal" ? `GOAL ${tag(e.player_id)}`
      : e.type === "assist" ? `assist ${tag(e.player_id)}`
      : e.type === "opp_goal" ? `${game.opponent || "Opponent"} scored`
      : e.type === "save" ? `Save ${tag(e.player_id)}`
      : e.type === "card" ? `Card ${tag(e.player_id)}`
      : e.type === "half" ? e.meta?.label : e.type === "final" ? "Full time" : e.type,
  }));

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* score + clock */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px 8px" }}>
        <button onClick={toggleClock} className="chip" style={{
          fontFamily: font.display, fontWeight: 400, fontSize: 30, letterSpacing: 1, lineHeight: 1, border: 0, borderRadius: 8,
          padding: "6px 12px", background: running ? C.red : C.ink, color: running ? C.ink : C.chalk, minWidth: 120 }}>
          {mmss(secs)}
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, opacity: .8, marginTop: 2 }}>{running ? "PAUSE" : "START"} · {game.half === 1 ? "1ST" : "2ND"}</div>
        </button>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: font.display, fontWeight: 400, fontSize: 34, lineHeight: 1 }}>{game.goals_for}–{game.goals_against}</div>
          <div style={{ fontSize: 11, color: C.slate, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.home ? "vs" : "at"} {game.opponent || "TBD"}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={halftime} style={sBtn}>{game.half === 1 ? "Halftime" : "1st half"}</button>
          <button onClick={finish} style={{ ...sBtn, color: C.red }}>Finish</button>
        </div>
      </div>

      {/* event buttons */}
      <div style={{ display: "flex", gap: 6, padding: "0 14px 8px" }}>
        {picker ? (
          <>
            <span style={{ ...sBtn, background: C.amber, color: C.ink, border: 0, flex: 1, textAlign: "center" }}>{hint}</span>
            {picker.step === "assist" && <button onClick={() => pick(null)} style={sBtn}>No assist</button>}
            <button onClick={() => setPicker(null)} style={sBtn}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => startPick("goal")} style={{ ...sBtn, background: C.amber, color: C.ink, border: 0, fontFamily: font.display, fontSize: 17, fontWeight: 400, letterSpacing: 1 }}>GOAL</button>
            <button onClick={oppGoal} style={sBtn}>Opp goal</button>
            <button onClick={() => startPick("save")} style={sBtn}>Save</button>
            <button onClick={() => startPick("card")} style={sBtn}>Card</button>
            <button onClick={undo} disabled={!events.length} style={{ ...sBtn, marginLeft: "auto", opacity: events.length ? 1 : .4 }}>Undo</button>
          </>
        )}
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 6, padding: "0 14px 6px" }}>
        {["pitch", "log"].map((v) => (
          <button key={v} onClick={() => setTab(v)} style={{ border: 0, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 600,
            background: tab === v ? C.ink : "transparent", color: tab === v ? C.chalk : C.slate }}>
            {v === "log" ? `Log (${events.length})` : "Pitch"}
          </button>
        ))}
        <select value={formation} onChange={(e) => changeFormation(e.target.value)} aria-label="Formation"
          style={{ marginLeft: "auto", background: C.deep, color: C.ink, border: `1.5px solid ${C.mist}`, borderRadius: 6, padding: "4px 6px", fontSize: 13, fontWeight: 800, fontFamily: font.body }}>
          {Object.entries(FORMATIONS).map(([k, f]) => <option key={k} value={k}>{k} · {f.size}v{f.size}</option>)}
        </select>
      </div>
      {!picker && <div style={{ fontSize: 12, color: C.slate, padding: "0 14px 6px" }}>{hint}</div>}

      {tab === "pitch" ? (
        <>
          <Pitch rows={FORMATIONS[formation].rows} lineup={lineup} byId={byId} mins={mins} selected={selected} onSlot={tapSlot} highlight={!!picker} />
          <div style={{ padding: "12px 14px 4px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: font.display, fontWeight: 400, fontSize: 18, letterSpacing: 1 }}>BENCH</span>
            <span style={{ fontSize: 12, color: C.slate }}>{bench.length} available</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 14px" }}>
            {bench.length === 0 && <div style={{ fontSize: 13, color: C.slate }}>Everyone's on the pitch.</div>}
            {bench.map((p) => <Chip key={p.id} player={p} mins={mins[p.id] || 0} selected={selected === p.id} onTap={() => tapPlayer(p.id)} />)}
          </div>
        </>
      ) : (
        <div style={{ padding: "0 14px" }}>
          {log.length === 0 && <p style={{ fontSize: 13, color: C.slate }}>Nothing yet. Subs and goals show up here with the clock.</p>}
          {log.map((e) => (
            <div key={e.id} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.mist}`, fontSize: 14 }}>
              <span style={{ fontFamily: font.display, fontWeight: 400, fontSize: 16, minWidth: 54, color: C.slate }}>{e.t}</span>
              <span>{e.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Pitch({ rows, lineup, byId, mins, selected, onSlot, highlight }) {
  const line = "2px solid rgba(250,250,248,.28)";
  return (
    <div style={{ margin: "0 10px", background: C.grass, borderRadius: 12, padding: "14px 8px 10px", position: "relative", border: `1px solid ${C.mist}`,
      backgroundImage: `repeating-linear-gradient(0deg, ${C.grass} 0 20%, ${C.grassDeep} 20% 40%)` }}>
      <div style={{ position: "absolute", inset: 8, border: line, borderRadius: 4, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: "30%", right: "30%", bottom: 8, height: 44, border: line, borderBottom: 0, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: "30%", right: "30%", top: 8, height: 44, border: line, borderTop: 0, pointerEvents: "none" }} />
      <div style={{ display: "grid", rowGap: 10, position: "relative" }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: "flex", justifyContent: "center", gap: row.length >= 4 ? 5 : 8 }}>
            {row.map((sid) => {
              const pid = lineup[sid];
              const p = pid ? byId[pid] : null;
              const wide = row.length >= 4;
              return (
                <button key={sid} onClick={() => onSlot(sid)} className="chip" style={{
                  flex: `0 1 ${row.length === 1 ? 33 : row.length === 2 ? 40 : 100 / row.length}%`, minWidth: 0,
                  border: pid && selected === pid ? `3px solid ${C.amber}` : highlight && pid ? `2px solid ${C.amber}` : pid ? "2px solid rgba(250,250,248,.18)" : "2px dashed rgba(250,250,248,.35)",
                  background: pid ? "#27272C" : "rgba(250,250,248,.05)", color: C.ink, borderRadius: 10,
                  padding: wide ? "6px 2px 5px" : "6px 4px 5px", minHeight: 64, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                  {p ? (<>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontFamily: font.display, fontWeight: 400, fontSize: wide ? 26 : 30, lineHeight: 1, color: C.amber }}>{p.number}</span>
                      {swatch(p.headband) && <span title={p.headband} style={{ width: 10, height: 10, borderRadius: 5, background: swatch(p.headband), border: "1px solid rgba(250,250,248,.5)" }} />}
                    </span>
                    <span style={{ fontSize: wide ? 11 : 12, fontWeight: 700, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || "—"}</span>
                    <span style={{ fontSize: 10, opacity: .7 }}>{Math.floor((mins[pid] || 0) / 60)}′</span>
                    <span style={{ fontSize: wide ? 8 : 9, letterSpacing: .5, opacity: .6, marginTop: 2, textAlign: "center", lineHeight: 1.1 }}>{labelOf(sid).toUpperCase()}</span>
                  </>) : (
                    <span style={{ fontSize: wide ? 10 : 11, fontWeight: 700, letterSpacing: .5, opacity: .85, textAlign: "center", lineHeight: 1.15 }}>{labelOf(sid)}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ player, mins, selected, onTap }) {
  return (
    <button onClick={onTap} className="chip" style={{
      border: selected ? `3px solid ${C.amber}` : `2px solid ${C.ink}`, background: C.ink, color: C.chalk, borderRadius: 10,
      padding: "6px 10px", minWidth: 72, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontFamily: font.display, fontWeight: 400, fontSize: 26, lineHeight: 1, color: C.amber }}>{player.number}</span>
        {swatch(player.headband) && <span title={player.headband} style={{ width: 10, height: 10, borderRadius: 5, background: swatch(player.headband), border: "1px solid rgba(0,0,0,.35)" }} />}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{player.name || "—"}</span>
      <span style={{ fontSize: 10, opacity: .7 }}>{Math.floor(mins / 60)}′</span>
    </button>
  );
}
