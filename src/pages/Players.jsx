import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { seasonTotals, mmss } from "../lib/game";
import { C, font, inp, sBtn, h2 } from "../theme";

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [totals, setTotals] = useState({});
  const [draft, setDraft] = useState({ number: "", name: "" });

  const load = async () => {
    const [{ data: p }, { data: g }, { data: e }] = await Promise.all([
      supabase.from("players").select("*").order("number"),
      supabase.from("games").select("*"),
      supabase.from("game_events").select("*"),
    ]);
    const ps = (p || []).sort((a, b) => Number(a.number) - Number(b.number));
    setPlayers(ps);
    setTotals(seasonTotals(ps, g || [], e || []));
  };
  useEffect(() => { load(); }, []);

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
      <p style={{ fontSize: 13, color: C.slate, margin: "0 0 10px" }}>Edits save as you type. Untick Active to keep a player's history but hide her from the bench.</p>
      {players.map((p) => (
        <div key={p.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", opacity: p.active ? 1 : .5 }}>
          <input value={p.number} inputMode="numeric" onChange={(e) => save(p, { number: e.target.value })}
            style={{ ...inp, width: 58, textAlign: "center", fontFamily: font.display, fontWeight: 400, fontSize: 20 }} />
          <input value={p.name} placeholder="Name" onChange={(e) => save(p, { name: e.target.value })} style={{ ...inp, flex: 1 }} />
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

      <div style={h2}>SEASON</div>
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
    </div>
  );
}
