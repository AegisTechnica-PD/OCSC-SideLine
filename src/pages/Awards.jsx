import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSeason } from "../lib/season";
import { seasonTotals, mmss, VIDEO_CLICK_BONUS } from "../lib/game";
import { C, font, h2, inp, sBtn } from "../theme";

export default function Awards() {
  const { season } = useSeason();
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [videoClicks, setVideoClicks] = useState([]);
  const [practices, setPractices] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [awards, setAwards] = useState([]);
  const [draft, setDraft] = useState({ title: "", winner: "" });

  const load = async () => {
    if (!season) return;
    const [{ data: p }, { data: g }, { data: s }, { data: vc }, { data: pr }, { data: aw }] = await Promise.all([
      supabase.from("players").select("*").eq("active", true),
      supabase.from("games").select("*").eq("season_id", season.id),
      supabase.from("smarts_sessions").select("*").eq("season_id", season.id),
      supabase.from("video_clicks").select("*").eq("season_id", season.id),
      supabase.from("practices").select("*").eq("season_id", season.id),
      supabase.from("awards").select("*").eq("season_id", season.id).order("created_at"),
    ]);
    const ps = (p || []).sort((a, b) => Number(a.number) - Number(b.number));
    setPlayers(ps); setGames(g || []); setSessions(s || []); setVideoClicks(vc || []); setPractices(pr || []); setAwards(aw || []);
    const gameIds = (g || []).map((x) => x.id);
    const { data: e } = gameIds.length ? await supabase.from("game_events").select("*").in("game_id", gameIds) : { data: [] };
    setEvents(e || []);
    const practiceIds = (pr || []).map((x) => x.id);
    const { data: att } = practiceIds.length ? await supabase.from("attendance").select("*").in("practice_id", practiceIds) : { data: [] };
    setAttendance(att || []);
  };
  useEffect(() => { load(); }, [season?.id]);

  const totals = useMemo(() => seasonTotals(players, games, events), [players, games, events]);

  const hwPoints = useMemo(() => {
    const byJersey = {};
    for (const s of sessions) byJersey[s.jersey] = (byJersey[s.jersey] || 0) + s.score;
    for (const v of videoClicks) byJersey[v.jersey] = (byJersey[v.jersey] || 0) + VIDEO_CLICK_BONUS;
    return Object.fromEntries(players.map((p) => [p.id, byJersey[p.number] || 0]));
  }, [players, sessions, videoClicks]);

  const attendancePct = useMemo(() => {
    const totalSessions = practices.length + games.length;
    if (!totalSessions) return {};
    const gameAttendees = {}; // game_id -> Set(player_id) — anyone who got any pitch time
    for (const e of events) {
      if (e.type !== "on") continue;
      (gameAttendees[e.game_id] ||= new Set()).add(e.player_id);
    }
    const out = {};
    for (const p of players) {
      const presentPractices = attendance.filter((a) => a.player_id === p.id && a.present).length;
      const presentGames = games.filter((g) => gameAttendees[g.id]?.has(p.id)).length;
      out[p.id] = Math.round(((presentPractices + presentGames) / totalSessions) * 100);
    }
    return out;
  }, [players, attendance, practices, games, events]);

  const leaderboard = (getVal, min = 1, limit = 3) => players
    .map((p) => ({ p, v: getVal(p) }))
    .filter((r) => r.v >= min)
    .sort((a, b) => b.v - a.v)
    .slice(0, limit);

  const categories = [
    { title: "Golden Boot", sub: "most goals", rows: leaderboard((p) => totals[p.id]?.goals || 0), fmt: (v) => `${v} goal${v === 1 ? "" : "s"}` },
    { title: "Playmaker", sub: "most assists", rows: leaderboard((p) => totals[p.id]?.assists || 0), fmt: (v) => `${v} assist${v === 1 ? "" : "s"}` },
    { title: "Iron Wall", sub: "most saves", rows: leaderboard((p) => totals[p.id]?.saves || 0), fmt: (v) => `${v} save${v === 1 ? "" : "s"}` },
    { title: "Iron Woman", sub: "most outfield minutes — goalkeeper time doesn't count", rows: leaderboard((p) => totals[p.id]?.outfieldSeconds || 0), fmt: (v) => mmss(v) },
    { title: "Between the Posts", sub: "most minutes in goal", rows: leaderboard((p) => (totals[p.id]?.seconds || 0) - (totals[p.id]?.outfieldSeconds || 0)), fmt: (v) => mmss(v) },
    { title: "Homework Hero", sub: "most homework points", rows: leaderboard((p) => hwPoints[p.id] || 0), fmt: (v) => `${v} pts` },
    { title: "Ever Present", sub: "practices + games attended, whole roster", rows: leaderboard((p) => attendancePct[p.id] || 0, (practices.length + games.length) ? 0 : 999, players.length), fmt: (v) => `${v}%` },
  ].filter((c) => c.rows.length);

  const addAward = async () => {
    if (!draft.title.trim() || !draft.winner.trim()) return;
    await supabase.from("awards").insert({ season_id: season.id, title: draft.title.trim(), winner: draft.winner.trim() });
    setDraft({ title: "", winner: "" });
    load();
  };
  const removeAward = async (id) => { await supabase.from("awards").delete().eq("id", id); setAwards((a) => a.filter((x) => x.id !== id)); };

  return (
    <div style={{ padding: "0 14px 32px" }}>
      <div style={h2}>SEASON AWARDS{season ? ` · ${season.name.toUpperCase()}` : ""}</div>
      <p style={{ fontSize: 13, color: C.slate, margin: "0 0 10px" }}>
        Auto leaderboards from this season's games, homework, and attendance — ties show more than one name. Ever Present counts practices plus any game she got on the pitch for at all, even a minute; a game she attended but never played in won't count since there's no separate check-in for that yet. Add your own picks below for anything a stat can't capture.
      </p>

      {categories.length === 0 && <p style={{ fontSize: 13, color: C.slate }}>Not enough recorded yet to show leaders.</p>}
      {categories.map((c) => (
        <div key={c.title} style={{ marginBottom: 14, borderTop: `1px solid ${C.mist}`, paddingTop: 10 }}>
          <div style={{ fontFamily: font.display, fontWeight: 400, fontSize: 18, color: C.amber }}>{c.title}</div>
          <div style={{ fontSize: 12, color: C.slate, marginBottom: 6 }}>{c.sub}</div>
          {c.rows.map((r, i) => (
            <div key={r.p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "2px 0" }}>
              <span>{c.rows.length <= 3 ? (i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉") : `${i + 1}.`} #{r.p.number} {r.p.name}</span>
              <span style={{ fontWeight: 700 }}>{c.fmt(r.v)}</span>
            </div>
          ))}
        </div>
      ))}

      <div style={{ ...h2, marginTop: 24 }}>YOUR AWARDS</div>
      <p style={{ fontSize: 13, color: C.slate, margin: "0 0 8px" }}>Free-form — hustle award, most improved, whatever you want to hand out.</p>
      {awards.map((a) => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 14 }}>
          <span style={{ flex: 1 }}><b>{a.title}</b> — {a.winner}</span>
          <button onClick={() => removeAward(a.id)} aria-label="Remove award" style={{ border: 0, background: "transparent", color: C.slate }}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <input style={{ ...inp, flex: "1 1 160px" }} placeholder="Award name" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <input style={{ ...inp, flex: "1 1 160px" }} placeholder="Winner" value={draft.winner} onChange={(e) => setDraft({ ...draft, winner: e.target.value })} />
        <button onClick={addAward} style={sBtn}>Add</button>
      </div>
    </div>
  );
}
