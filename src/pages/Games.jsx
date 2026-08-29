import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { C, font, inp, sBtn, h2 } from "../theme";

export default function Games() {
  const [games, setGames] = useState([]);
  const [draft, setDraft] = useState({ opponent: "", played_on: new Date().toISOString().slice(0, 10), home: true, half_length_min: 25 });
  const nav = useNavigate();

  useEffect(() => {
    supabase.from("games").select("*").order("played_on", { ascending: false }).then(({ data }) => setGames(data || []));
  }, []);

  const create = async () => {
    const { data, error } = await supabase.from("games").insert(draft).select().single();
    if (!error) nav(`/games/${data.id}/live`);
  };

  const del = async (g) => {
    if (!confirm(`Delete ${g.home ? "vs" : "at"} ${g.opponent || "TBD"} (${g.played_on})? This removes its minutes and events too.`)) return;
    await supabase.from("games").delete().eq("id", g.id);
    setGames((gs) => gs.filter((x) => x.id !== g.id));
  };
  const live = games.filter((g) => !g.finished);
  const past = games.filter((g) => g.finished);

  return (
    <div style={{ padding: "0 14px 32px" }}>
      <div style={h2}>NEW GAME</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input style={{ ...inp, gridColumn: "1 / -1" }} placeholder="Opponent" value={draft.opponent} onChange={(e) => setDraft({ ...draft, opponent: e.target.value })} />
        <input style={inp} type="date" value={draft.played_on} onChange={(e) => setDraft({ ...draft, played_on: e.target.value })} />
        <select style={inp} value={draft.home ? "home" : "away"} onChange={(e) => setDraft({ ...draft, home: e.target.value === "home" })}>
          <option value="home">Home</option><option value="away">Away</option>
        </select>
        <label style={{ fontSize: 13, color: C.slate, display: "flex", alignItems: "center", gap: 6 }}>Half length
          <input style={{ ...inp, width: 64 }} type="number" value={draft.half_length_min} onChange={(e) => setDraft({ ...draft, half_length_min: Number(e.target.value) })} /> min
        </label>
        <button onClick={create} style={{ ...sBtn, background: C.ink, color: C.chalk }}>Start game</button>
      </div>

      {live.length > 0 && <>
        <div style={h2}>IN PROGRESS</div>
        {live.map((g) => <Row key={g.id} g={g} to={`/games/${g.id}/live`} onDelete={() => del(g)} />)}
      </>}

      <div style={h2}>RESULTS</div>
      {past.length === 0 && <p style={{ fontSize: 13, color: C.slate }}>No finished games yet.</p>}
      {past.map((g) => <Row key={g.id} g={g} to={`/games/${g.id}`} onDelete={() => del(g)} />)}
    </div>
  );
}

function Row({ g, to, onDelete }) {
  const res = g.goals_for > g.goals_against ? "W" : g.goals_for < g.goals_against ? "L" : "D";
  const col = res === "W" ? C.grass : res === "L" ? C.red : C.slate;
  return (
    <Link to={to} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.mist}`, textDecoration: "none" }}>
      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 22, color: g.finished ? col : C.amber, minWidth: 56 }}>
        {g.goals_for}–{g.goals_against}
      </span>
      <span style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{g.home ? "vs" : "at"} {g.opponent || "TBD"}</div>
        <div style={{ fontSize: 12, color: C.slate }}>{g.played_on}{g.finished ? "" : " · live"}</div>
      </span>
      <button onClick={(e) => { e.preventDefault(); onDelete(); }} aria-label="Delete game"
        style={{ border: 0, background: "transparent", color: C.slate, fontSize: 16, padding: "4px 8px" }}>✕</button>
    </Link>
  );
}
