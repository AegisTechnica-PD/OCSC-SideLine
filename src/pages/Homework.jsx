import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { C, font, h2, sBtn, inp } from "../theme";
import { POSITIONS } from "./SoccerSmarts.jsx";
import { VIDEO_CLICK_BONUS } from "../lib/game";
import { useSeason } from "../lib/season";

export default function Homework() {
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [videoClicks, setVideoClicks] = useState([]);
  const [openJersey, setOpenJersey] = useState(null);
  const { season } = useSeason();

  const load = async () => {
    if (!season) return;
    const [{ data: p }, { data: s }, { data: v }] = await Promise.all([
      supabase.from("players").select("*").eq("active", true),
      supabase.from("smarts_sessions").select("*").eq("season_id", season.id).order("created_at", { ascending: false }),
      supabase.from("video_clicks").select("*").eq("season_id", season.id),
    ]);
    setPlayers((p || []).sort((a, b) => Number(a.number) - Number(b.number)));
    setSessions(s || []);
    setVideoClicks(v || []);
  };
  useEffect(() => { load(); }, [season?.id]);

  const weeks = useMemo(() => [...new Set(sessions.map((s) => s.week_epoch))].sort((a, b) => b - a), [sessions]);
  const weekLabel = Object.fromEntries(sessions.map((s) => [s.week_epoch, s.week_label]));

  const videosByJersey = useMemo(() => {
    const out = {};
    for (const v of videoClicks) out[v.jersey] = (out[v.jersey] || 0) + 1;
    return out;
  }, [videoClicks]);

  const rows = useMemo(() => {
    const byJersey = {};
    for (const s of sessions) (byJersey[s.jersey] ||= []).push(s);
    const known = players.map((p) => ({ jersey: p.number, name: p.name, sessions: byJersey[p.number] || [] }));
    const unknown = Object.keys(byJersey).filter((j) => !players.some((p) => p.number === j))
      .map((j) => ({ jersey: j, name: `(not on roster) ${byJersey[j][0].player_name}`, sessions: byJersey[j] }));
    return [...known, ...unknown].map((r) => {
      const wk = new Set(r.sessions.map((s) => s.week_epoch));
      const best = r.sessions.reduce((m, s) => Math.max(m, s.score), 0);
      // weekly best = the score that counts for the reward
      const weeklyBest = weeks.map((w) => r.sessions.filter((s) => s.week_epoch === w).reduce((m, s) => Math.max(m, s.score), null));
      const videos = videosByJersey[r.jersey] || 0;
      // Points = every play's score, plus a bonus per distinct video watched.
      const points = r.sessions.reduce((a, x) => a + x.score, 0) + videos * VIDEO_CLICK_BONUS;
      return { ...r, weeksDone: wk.size, plays: r.sessions.length, best, weeklyBest, videos, points };
    }).sort((a, b) => b.weeksDone - a.weeksDone || b.points - a.points);
  }, [players, sessions, weeks, videosByJersey]);

  const remove = async (id) => {
    if (!confirm("Remove this result?")) return;
    await supabase.from("smarts_sessions").delete().eq("id", id);
    setSessions((ss) => ss.filter((s) => s.id !== id));
  };

  return (
    <div style={{ padding: "0 14px 32px" }}>
      <div style={h2}>HOMEWORK</div>
      <p style={{ fontSize: 13, color: C.slate, margin: "0 0 10px" }}>
        {weeks.length} week{weeks.length === 1 ? "" : "s"} recorded. Weeks = distinct homework weeks completed. Vids = drill videos she tapped (+{VIDEO_CLICK_BONUS} pts each, once per video per week — a tap isn't proof she watched it, but it's the best signal we have). Points = every play's score plus video bonuses, added together. Tap a row for detail.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr style={{ color: C.slate, fontSize: 11, letterSpacing: 1, textAlign: "right" }}>
          <th style={{ textAlign: "left", padding: "4px 0" }}>PLAYER</th><th>WEEKS</th><th>PLAYS</th><th>BEST</th><th>VIDS</th><th>POINTS</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <RowBlock key={r.jersey} r={r} open={openJersey === r.jersey} onToggle={() => setOpenJersey(openJersey === r.jersey ? null : r.jersey)}
              weeks={weeks} weekLabel={weekLabel} onRemove={remove} />
          ))}
        </tbody>
      </table>
      {sessions.length === 0 && <p style={{ fontSize: 13, color: C.slate }}>No homework results yet. Scores appear here as soon as a player finishes a round.</p>}
      <button onClick={load} style={{ ...sBtn, marginTop: 12 }}>Refresh</button>

      <DrillLinks />
    </div>
  );
}

function DrillLinks() {
  const [links, setLinks] = useState([]);
  const [draft, setDraft] = useState({ position: "All", title: "", url: "" });

  const load = () => supabase.from("drill_links").select("*").order("position").order("sort")
    .then(({ data }) => setLinks(data || []));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!draft.title.trim() || !draft.url.trim()) return;
    await supabase.from("drill_links").insert(draft);
    setDraft({ position: draft.position, title: "", url: "" });
    load();
  };
  const remove = async (id) => { await supabase.from("drill_links").delete().eq("id", id); setLinks((l) => l.filter((x) => x.id !== id)); };

  const grouped = ["All", ...POSITIONS].map((pos) => ({ pos, items: links.filter((l) => l.position === pos) })).filter((g) => g.items.length);

  return (
    <div style={{ marginTop: 28 }}>
      <div style={h2}>DRILL LINKS</div>
      <p style={{ fontSize: 13, color: C.slate, margin: "0 0 10px" }}>
        Optional — add a hand-picked video here and it shows first on the Smarts done screen. Either way, every player also gets an auto-generated "Keep sharpening" search matched to her position and whatever she missed most, no maintenance needed.
      </p>
      {grouped.map((g) => (
        <div key={g.pos} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.slate, letterSpacing: 1, margin: "6px 0 4px" }}>{g.pos.toUpperCase()}</div>
          {g.items.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, padding: "4px 0" }}>
              <a href={l.url} target="_blank" rel="noreferrer" style={{ color: C.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</a>
              <button onClick={() => remove(l.id)} aria-label="Remove drill link" style={{ border: 0, background: "transparent", color: C.slate }}>✕</button>
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        <select value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} style={{ ...inp, flex: "1 1 140px" }}>
          {["All", ...POSITIONS].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={draft.title} placeholder="Title, e.g. 1v1 defending basics" onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ ...inp, flex: "2 1 200px" }} />
        <input value={draft.url} placeholder="YouTube link" onChange={(e) => setDraft({ ...draft, url: e.target.value })} style={{ ...inp, flex: "2 1 200px" }} />
        <button onClick={add} style={sBtn}>Add</button>
      </div>
    </div>
  );
}

function RowBlock({ r, open, onToggle, weeks, weekLabel, onRemove }) {
  return (
    <>
      <tr onClick={onToggle} style={{ borderTop: `1px solid ${C.mist}`, textAlign: "right", cursor: "pointer", opacity: r.plays ? 1 : .5 }}>
        <td style={{ textAlign: "left", padding: "7px 0" }}><b>#{r.jersey}</b> {r.name}</td>
        <td style={{ fontFamily: font.display, fontWeight: 400, fontSize: 18 }}>{r.weeksDone}<span style={{ color: C.slate, fontSize: 12 }}>/{weeks.length}</span></td>
        <td>{r.plays}</td>
        <td>{r.best || ""}</td>
        <td>{r.videos || ""}</td>
        <td style={{ fontFamily: font.display, fontWeight: 400, fontSize: 18, color: C.win }}>{r.points || ""}</td>
      </tr>
      {open && (
        <tr><td colSpan={6} style={{ padding: "0 0 10px" }}>
          {weeks.map((w, i) => (
            <div key={w} style={{ fontSize: 13, padding: "3px 0 3px 12px", color: r.weeklyBest[i] == null ? C.slate : C.ink }}>
              Week of {weekLabel[w]}: {r.weeklyBest[i] == null ? "—" : <b>{r.weeklyBest[i]}</b>}
            </div>
          ))}
          {r.sessions.length > 0 && <div style={{ fontSize: 11, color: C.slate, padding: "6px 0 2px 12px", letterSpacing: 1 }}>EVERY PLAY</div>}
          {r.sessions.map((s) => (
            <div key={s.id} style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "2px 0 2px 12px", alignItems: "center" }}>
              <span style={{ color: C.slate, minWidth: 92 }}>{new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {s.position === "All" ? "All" : s.position.split(" ").map((x) => x[0]).join("")}</span>
              <span><b>{s.score}</b> · streak {s.best_streak}</span>
              <button onClick={() => onRemove(s.id)} aria-label="Remove result" style={{ marginLeft: "auto", border: 0, background: "transparent", color: C.slate }}>✕</button>
            </div>
          ))}
        </td></tr>
      )}
    </>
  );
}
