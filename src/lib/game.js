// Shared game logic: formation, clock, and replaying events into state.

export const SLOTS = [
  { id: "ST", label: "Striker", row: 0, col: 1 },
  { id: "LM", label: "Left Midfielder", row: 1, col: 0 },
  { id: "CM", label: "Center Midfielder", row: 1, col: 1 },
  { id: "RM", label: "Right Midfielder", row: 1, col: 2 },
  { id: "DM", label: "Defensive Midfielder", row: 2, col: 1 },
  { id: "LD", label: "Left Defender", row: 3, col: 0 },
  { id: "CD", label: "Center Defender", row: 3, col: 1 },
  { id: "RD", label: "Right Defender", row: 3, col: 2 },
  { id: "GK", label: "Goalkeeper", row: 4, col: 1 },
];
export const slotById = Object.fromEntries(SLOTS.map((s) => [s.id, s]));
export const labelOf = (sid) => slotById[sid]?.label ?? sid;

export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
export const minuteOf = (s) => Math.floor(s / 60) + 1;

/** Current clock seconds for a game row. */
export function clockSeconds(game, now = Date.now()) {
  if (!game) return 0;
  const base = game.elapsed_seconds || 0;
  if (!game.clock_started_at) return base;
  return base + Math.floor((now - new Date(game.clock_started_at).getTime()) / 1000);
}

/** Replay events -> lineup {slotId: playerId|null}. */
export function lineupFromEvents(events) {
  const lineup = Object.fromEntries(SLOTS.map((s) => [s.id, null]));
  for (const e of events) {
    if (e.type === "on" || e.type === "move") {
      // clear the player from any other slot, then place
      for (const k of Object.keys(lineup)) if (lineup[k] === e.player_id) lineup[k] = null;
      if (e.position) lineup[e.position] = e.player_id;
    } else if (e.type === "off") {
      for (const k of Object.keys(lineup)) if (lineup[k] === e.player_id) lineup[k] = null;
    }
  }
  return lineup;
}

/** Seconds on the pitch per player, given events and the current clock. */
export function minutesFromEvents(events, nowSeconds) {
  const onSince = {};
  const total = {};
  const sorted = [...events].sort((a, b) => a.second - b.second || a.id - b.id);
  for (const e of sorted) {
    if (e.type === "on") {
      if (onSince[e.player_id] == null) onSince[e.player_id] = e.second;
    } else if (e.type === "off") {
      if (onSince[e.player_id] != null) {
        total[e.player_id] = (total[e.player_id] || 0) + (e.second - onSince[e.player_id]);
        delete onSince[e.player_id];
      }
    } else if (e.type === "final") {
      for (const pid of Object.keys(onSince)) {
        total[pid] = (total[pid] || 0) + (e.second - onSince[pid]);
        delete onSince[pid];
      }
    }
  }
  for (const pid of Object.keys(onSince)) {
    total[pid] = (total[pid] || 0) + Math.max(0, nowSeconds - onSince[pid]);
  }
  return total;
}

/** Season totals across many games. */
export function seasonTotals(players, games, events) {
  const byGame = {};
  for (const e of events) (byGame[e.game_id] ||= []).push(e);
  const out = Object.fromEntries(players.map((p) => [p.id, { games: 0, seconds: 0, goals: 0, assists: 0, saves: 0, cards: 0 }]));
  for (const g of games) {
    const evs = byGame[g.id] || [];
    const end = clockSeconds(g);
    const secs = minutesFromEvents(evs, end);
    for (const [pid, s] of Object.entries(secs)) {
      if (!out[pid]) continue;
      out[pid].seconds += s;
      if (s > 0) out[pid].games += 1;
    }
    for (const e of evs) {
      const t = out[e.player_id];
      if (!t) continue;
      if (e.type === "goal") t.goals++;
      if (e.type === "assist") t.assists++;
      if (e.type === "save") t.saves++;
      if (e.type === "card") t.cards++;
    }
  }
  return out;
}
