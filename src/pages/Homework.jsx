import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { C, font, h2, sBtn } from "../theme";

export default function Homework() {
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [openJersey, setOpenJersey] = useState(null);

  const load = async () => {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("players").select("*").eq("active", true),
      supabase.from("smarts_sessions").select("*").order("created_at", { ascending: false }),
    ]);
    setPlayers((p || []).sort((a, b) => Number(a.number) - Number(b.number)));
    setSessions(s || []);
  };
  useEffect(() => { load(); }, []);

  const weeks = useMemo(() => [...new Set(sessions.map((s) => s.week_epoch))].sort((a, b) => b - a), [sessions]);
  const weekLabel = Object.fromEntries(sessions.map((s) => [s.week_epoch, s.week_label]));

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
      const points = weeklyBest.reduce((a, b) => a + (b || 0), 0);
      return { ...r, weeksDone: wk.size, plays: r.sessions.length, best, weeklyBest, points };
    }).sort((a, b) => b.weeksDone - a.weeksDone || b.points - a.points);
  }, [players, sessions, weeks]);

  const remove = async (id) => {
    if (!confirm("Remove this result?")) return;
    await supabase.from("smarts_sessions").delete().eq("id", id);
    setSessions((ss) => ss.filter((s) => s.id !== id));
  };

  return (
    <div style={{ padding: "0 14px 32px" }}>
      <div style={h2}>HOMEWORK</div>
      <p style={{ fontSize: 13, color: C.slate, margin: "0 0 10px" }}>
        {weeks.length} week{weeks.length === 1 ? "" : "s"} recorded. Weeks = distinct homework weeks completed. Points = sum of each week's best score. Tap a row for detail.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr style={{ color: C.slate, fontSize: 11, letterSpacing: 1, textAlign: "right" }}>
          <th style={{ textAlign: "left", padding: "4px 0" }}>PLAYER</th><th>WEEKS</th><th>PLAYS</th><th>BEST</th><th>POINTS</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <RowBlock key={r.jersey} r={r} open={openJersey === r.jersey} onToggle={() => setOpenJersey(openJersey === r.jersey ? null : r.jersey)}
              weeks={weeks} weekLabel={weekLabel} onRemove={remove} />
          ))}
        </tbody>
      </table>
      {sessions.length === 0 && <p style={{ fontSize: 13, color: C.slate }}>No homework results yet. Scores appear here as soon as a player finishes a round.</p>}
      <button onClick={load} style={{ ...sBtn, marginTop: 12 }}>Refresh</button>
    </div>
  );
}

function RowBlock({ r, open, onToggle, weeks, weekLabel, onRemove }) {
  return (
    <>
      <tr onClick={onToggle} style={{ borderTop: `1px solid ${C.mist}`, textAlign: "right", cursor: "pointer", opacity: r.plays ? 1 : .5 }}>
        <td style={{ textAlign: "left", padding: "7px 0" }}><b>#{r.jersey}</b> {r.name}</td>
        <td style={{ fontFamily: font.display, fontWeight: 800, fontSize: 18 }}>{r.weeksDone}<span style={{ color: C.slate, fontSize: 12 }}>/{weeks.length}</span></td>
        <td>{r.plays}</td>
        <td>{r.best || ""}</td>
        <td style={{ fontFamily: font.display, fontWeight: 800, fontSize: 18, color: C.grass }}>{r.points || ""}</td>
      </tr>
      {open && (
        <tr><td colSpan={5} style={{ padding: "0 0 10px" }}>
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
