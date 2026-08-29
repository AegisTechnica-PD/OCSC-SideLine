import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { labelOf, mmss, minuteOf, clockSeconds, minutesFromEvents } from "../lib/game";
import { C, font, sBtn, h2, inp } from "../theme";

export default function GameDetail() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    Promise.all([
      supabase.from("games").select("*").eq("id", id).single(),
      supabase.from("players").select("*"),
      supabase.from("game_events").select("*").eq("game_id", id).order("second").order("id"),
    ]).then(([g, p, e]) => { setGame(g.data); setPlayers(p.data || []); setEvents(e.data || []); });
  }, [id]);

  if (!game) return <div style={{ padding: 14, color: C.slate }}>Loading…</div>;

  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const mins = minutesFromEvents(events, clockSeconds(game));
  const tag = (pid) => `#${byId[pid]?.number ?? "?"}`;
  const stat = (t) => (pid) => events.filter((e) => e.type === t && e.player_id === pid).length;
  const goals = stat("goal"), assists = stat("assist"), saves = stat("save");
  const played = players.filter((p) => mins[p.id] > 0).sort((a, b) => mins[b.id] - mins[a.id]);

  const del = async () => {
    if (!confirm("Delete this game and all its events?")) return;
    await supabase.from("games").delete().eq("id", id);
    nav("/games");
  };
  const reopen = async () => { await supabase.from("games").update({ finished: false }).eq("id", id); setGame({ ...game, finished: false }); };
  const saveNotes = async (notes) => { setGame({ ...game, notes }); await supabase.from("games").update({ notes }).eq("id", id); };

  const feed = events.filter((e) => ["goal", "assist", "opp_goal", "save", "card", "half", "final"].includes(e.type));

  return (
    <div style={{ padding: "0 14px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{game.goals_for}–{game.goals_against}</span>
        <span>
          <div style={{ fontWeight: 600 }}>{game.home ? "vs" : "at"} {game.opponent || "TBD"}</div>
          <div style={{ fontSize: 12, color: C.slate }}>{game.played_on}</div>
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {game.finished
            ? <button onClick={reopen} style={sBtn}>Reopen</button>
            : <Link to={`/games/${id}/live`} style={{ ...sBtn, textDecoration: "none", background: C.ink, color: C.chalk }}>Live</Link>}
          <button onClick={del} style={{ ...sBtn, color: C.red }}>Delete</button>
        </span>
      </div>

      <div style={h2}>MINUTES</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr style={{ color: C.slate, fontSize: 11, letterSpacing: 1, textAlign: "right" }}>
          <th style={{ textAlign: "left", padding: "4px 0" }}>PLAYER</th><th>MIN</th><th>G</th><th>A</th><th>SV</th></tr></thead>
        <tbody>
          {played.map((p) => (
            <tr key={p.id} style={{ borderTop: `1px solid ${C.mist}`, textAlign: "right" }}>
              <td style={{ textAlign: "left", padding: "6px 0" }}><b>#{p.number}</b> {p.name}</td>
              <td style={{ fontFamily: font.display, fontWeight: 600, fontSize: 16 }}>{mmss(mins[p.id])}</td>
              <td>{goals(p.id) || ""}</td><td>{assists(p.id) || ""}</td><td>{saves(p.id) || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {played.length === 0 && <p style={{ fontSize: 13, color: C.slate }}>No minutes recorded.</p>}

      <div style={h2}>KEY MOMENTS</div>
      {feed.length === 0 && <p style={{ fontSize: 13, color: C.slate }}>No goals or events logged.</p>}
      {feed.map((e) => (
        <div key={e.id} style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: `1px solid ${C.mist}`, fontSize: 14 }}>
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 16, minWidth: 54, color: C.slate }}>{e.half}H {minuteOf(e.second)}'</span>
          <span>{e.type === "goal" ? `GOAL ${tag(e.player_id)}` : e.type === "assist" ? `assist ${tag(e.player_id)}`
            : e.type === "opp_goal" ? `${game.opponent || "Opponent"} scored` : e.type === "save" ? `Save ${tag(e.player_id)}`
            : e.type === "card" ? `Card ${tag(e.player_id)}` : e.type === "half" ? e.meta?.label : "Full time"}</span>
        </div>
      ))}

      <div style={h2}>NOTES</div>
      <textarea value={game.notes} onChange={(e) => saveNotes(e.target.value)} rows={4} placeholder="What went well, what to work on."
        style={{ ...inp, width: "100%", resize: "vertical" }} />
    </div>
  );
}
