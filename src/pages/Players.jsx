import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { seasonTotals, mmss } from "../lib/game";
import { C, font, inp, sBtn, h2, swatch } from "../theme";
import { useSeason } from "../lib/season";

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [totals, setTotals] = useState({});
  const [draft, setDraft] = useState({ number: "", name: "" });
  const { season, reload } = useSeason();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!season) return;
    const [{ data: p }, { data: g }] = await Promise.all([
      supabase.from("players").select("*").order("number"),
      supabase.from("games").select("*").eq("season_id", season.id),
    ]);
    const ids = (g || []).map((x) => x.id);
    const { data: e } = ids.length ? await supabase.from("game_events").select("*").in("game_id", ids) : { data: [] };
    const ps = (p || []).sort((a, b) => Number(a.number) - Number(b.number));
    setPlayers(ps);
    setTotals(seasonTotals(ps, g || [], e || []));
  };
  useEffect(() => { load(); }, [season?.id]);

  const save = async (p, patch) => {
    setPlayers((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    await supabase.from("players").update(patch).eq("id", p.id);
  };
  const add = async () => {
    if (!draft.number) return;
    await supabase.from("players").insert(draft);
    setDraft({ number: "", name: "" });
    load();
  };

  return (
    <div style={{ padding: "0 14px 32px" }}>
      <div style={h2}>ROSTER</div>
      <p style={{ fontSize: 13, color: C.slate, margin: "0 0 10px" }}>Edits save as you type. Headband is the color used to ID her on video — use plain names like <i>neon yellow</i> or <i>royal blue</i> and a swatch appears. Untick Active to keep history but hide her from the bench.</p>
      {players.map((p) => (
        <div key={p.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", opacity: p.active ? 1 : .5 }}>
          <input value={p.number} inputMode="numeric" onChange={(e) => save(p, { number: e.target.value })}
            style={{ ...inp, width: 58, textAlign: "center", fontFamily: font.display, fontWeight: 400, fontSize: 20 }} />
          <input value={p.name} placeholder="Name" onChange={(e) => save(p, { name: e.target.value })} style={{ ...inp, flex: 1 }} />
          <span style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
            <span aria-hidden style={{ width: 14, height: 14, borderRadius: 7, flex: "none", background: swatch(p.headband) || "transparent", border: `1.5px solid ${swatch(p.headband) ? "rgba(250,250,248,.5)" : C.mist}` }} />
            <input value={p.headband || ""} placeholder="Headband" onChange={(e) => save(p, { headband: e.target.value })} style={{ ...inp, width: "100%", minWidth: 0 }} />
          </span>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={p.active} onChange={(e) => save(p, { active: e.target.checked })} /> Active
          </label>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={draft.number} placeholder="#" inputMode="numeric" onChange={(e) => setDraft({ ...draft, number: e.target.value })}
          style={{ ...inp, width: 58, textAlign: "center" }} />
        <input value={draft.name} placeholder="New player name" onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ ...inp, flex: 1 }} />
        <button onClick={add} style={sBtn}>Add</button>
      </div>

      <div style={h2}>SEASON{season ? ` · ${season.name.toUpperCase()}` : ""}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ color: C.slate, fontSize: 11, letterSpacing: 1, textAlign: "right" }}>
            <th style={{ textAlign: "left", padding: "4px 0" }}>PLAYER</th><th>GP</th><th>MIN</th><th>G</th><th>A</th><th>SV</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => { const t = totals[p.id] || {}; return (
            <tr key={p.id} style={{ borderTop: `1px solid ${C.mist}`, textAlign: "right" }}>
              <td style={{ textAlign: "left", padding: "6px 0" }}><b>#{p.number}</b> {p.name}</td>
              <td>{t.games || 0}</td>
              <td style={{ fontFamily: font.display, fontWeight: 400, fontSize: 16 }}>{mmss(t.seconds || 0)}</td>
              <td>{t.goals || 0}</td><td>{t.assists || 0}</td><td>{t.saves || 0}</td>
            </tr>
          ); })}
        </tbody>
      </table>

      <div style={{ ...h2, marginTop: 28 }}>START A NEW SEASON</div>
      <p style={{ fontSize: 13, color: C.slate, margin: "0 0 8px" }}>
        Archives the current season — every game, minute, and homework result stays viewable from the season picker — and starts a fresh one at zero. Roster, numbers, and headbands carry over.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New season name, e.g. Spring 2027" style={{ ...inp, flex: 1 }} />
        <button disabled={!newName.trim() || busy} onClick={startSeason}
          style={{ ...sBtn, background: newName.trim() ? C.ink : "transparent", color: newName.trim() ? C.chalk : C.ink, opacity: newName.trim() ? 1 : .5 }}>
          {busy ? "Starting…" : "Start season"}
        </button>
      </div>
      {season && !season.active && (
        <p style={{ fontSize: 13, color: C.amber, margin: "10px 0 0" }}>You're viewing an archived season. Switch to the active one in the header to start a new one.</p>
      )}
    </div>
  );

  async function startSeason() {
    if (!season?.active) return;
    if (!confirm(`Archive "${season.name}" and start "${newName.trim()}"?`)) return;
    setBusy(true);
    const a = await supabase.from("seasons").update({ active: false, ended_on: new Date().toISOString().slice(0, 10) }).eq("id", season.id);
    const b = a.error ? a : await supabase.from("seasons").insert({ name: newName.trim(), active: true });
    setBusy(false);
    if (b.error) { alert(`Couldn't start season: ${b.error.message}`); return; }
    setNewName("");
    await reload();
  }
}
