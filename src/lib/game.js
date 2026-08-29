// Shared game logic: formation, clock, and replaying events into state.

// ---- positions & formations -------------------------------------------
// Canonical labels from position_cards.pdf; side/role qualifiers in parens
// only where a formation has two of the same position.
export const POSITIONS = {
  GK: "Goalkeeper",
  LD: "Left Defender", CD: "Center Defender", RD: "Right Defender",
  CDL: "Center Defender (Left)", CDR: "Center Defender (Right)",
  DM: "Defensive Midfielder", DML: "Defensive Midfielder (Left)", DMR: "Defensive Midfielder (Right)",
  LM: "Left Midfielder", CM: "Center Midfielder", RM: "Right Midfielder",
  CML: "Center Midfielder (Left)", CMR: "Center Midfielder (Right)", AM: "Center Midfielder (Attacking)",
  ST: "Striker", STL: "Striker (Left)", STR: "Striker (Right)",
};
export const labelOf = (sid) => POSITIONS[sid] ?? sid;

// rows are listed attack -> goal, matching the on-screen pitch.
export const FORMATIONS = {
  "3-4-1":   { size: 9,  rows: [["ST"], ["LM", "CM", "RM"], ["DM"], ["LD", "CD", "RD"], ["GK"]] },
  "3-3-2":   { size: 9,  rows: [["STL", "STR"], ["LM", "CM", "RM"], ["LD", "CD", "RD"], ["GK"]] },
  "3-2-3":   { size: 9,  rows: [["STL", "ST", "STR"], ["CML", "CMR"], ["LD", "CD", "RD"], ["GK"]] },
  "2-4-2":   { size: 9,  rows: [["STL", "STR"], ["LM", "CML", "CMR", "RM"], ["LD", "RD"], ["GK"]] },
  "2-3-3":   { size: 9,  rows: [["STL", "ST", "STR"], ["LM", "CM", "RM"], ["LD", "RD"], ["GK"]] },
  "4-3-1":   { size: 9,  rows: [["ST"], ["LM", "CM", "RM"], ["LD", "CDL", "CDR", "RD"], ["GK"]] },
  "4-4-2":   { size: 11, rows: [["STL", "STR"], ["LM", "CML", "CMR", "RM"], ["LD", "CDL", "CDR", "RD"], ["GK"]] },
  "4-3-3":   { size: 11, rows: [["STL", "ST", "STR"], ["CML", "DM", "CMR"], ["LD", "CDL", "CDR", "RD"], ["GK"]] },
  "4-2-3-1": { size: 11, rows: [["ST"], ["LM", "AM", "RM"], ["DML", "DMR"], ["LD", "CDL", "CDR", "RD"], ["GK"]] },
  "3-5-2":   { size: 11, rows: [["STL", "STR"], ["LM", "CML", "DM", "CMR", "RM"], ["LD", "CD", "RD"], ["GK"]] },
};
export const DEFAULT_FORMATION = "3-4-1";
export const slotsFor = (f) => (FORMATIONS[f] || FORMATIONS[DEFAULT_FORMATION]).rows.flat();

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
export function lineupFromEvents(events, formation = DEFAULT_FORMATION) {
  const lineup = Object.fromEntries(slotsFor(formation).map((id) => [id, null]));
  for (const e of events) {
    if (e.type === "on" || e.type === "move") {
      // clear the player from any other slot, then place
      for (const k of Object.keys(lineup)) if (lineup[k] === e.player_id) lineup[k] = null;
      if (e.position && e.position in lineup) lineup[e.position] = e.player_id;
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
  // A "final" only counts if nothing was logged after it (game reopened = final ignored).
  const lastId = sorted.length ? sorted[sorted.length - 1].id : null;
  for (const e of sorted) {
    if (e.type === "final" && e.id !== lastId) continue;
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
