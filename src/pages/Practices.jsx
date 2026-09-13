import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSeason } from "../lib/season";
import { C, font, h2, inp, sBtn } from "../theme";

export default function Practices() {
  const { season } = useSeason();
  const [players, setPlayers] = useState([]);
  const [practices, setPractices] = useState([]);
  const [attendance, setAttendance] = useState([]); // all rows for this season's practices
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(null);

  const load = async () => {
    if (!season) return;
    const [{ data: p }, { data: pr }] = await Promise.all([
      supabase.from("players").select("*").eq("active", true),
      supabase.from("practices").select("*").eq("season_id", season.id).order("practice_on", { ascending: false }),
    ]);
    const ps = (p || []).sort((a, b) => Number(a.number) - Number(b.number));
    setPlayers(ps);
    setPractices(pr || []);
    const ids = (pr || []).map((x) => x.id);
    const { data: att } = ids.length ? await supabase.from("attendance").select("*").in("practice_id", ids) : { data: [] };
    setAttendance(att || []);
  };
  useEffect(() => { load(); }, [season?.id]);

  const create = async () => {
    const { data, error } = await supabase.from("practices").insert({ season_id: season.id, practice_on: date, notes }).select().single();
    if (error) { alert(error.message); return; }
    if (players.length) {
      await supabase.from("attendance").insert(players.map((p) => ({ practice_id: data.id, player_id: p.id, present: true })));
    }
    setNotes("");
    load();
  };

  const toggle = async (row) => {
    setAttendance((a) => a.map((x) => (x.id === row.id ? { ...x, present: !x.present } : x)));
    await supabase.from("attendance").update({ present: !row.present }).eq("id", row.id);
  };

  const remove = async (pr) => {
    if (!confirm(`Delete practice on ${pr.practice_on}?`)) return;
    await supabase.from("practices").delete().eq("id", pr.id);
    setPractices((p) => p.filter((x) => x.id !== pr.id));
  };

  return (
    <div style={{ padding: "0 14px 32px" }}>
      <div style={h2}>NEW PRACTICE</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button onClick={create} disabled={!season?.active} style={{ ...sBtn, background: C.ink, color: C.chalk, opacity: season?.active ? 1 : .4 }}>Add</button>
      </div>
      {!season?.active && <p style={{ fontSize: 12, color: C.amber, margin: "6px 0 0" }}>Archived season — switch to the active one to add practices.</p>}

      <div style={h2}>PRACTICES</div>
      {practices.length === 0 && <p style={{ fontSize: 13, color: C.slate }}>None recorded yet.</p>}
      {practices.map((pr) => {
        const rows = attendance.filter((a) => a.practice_id === pr.id);
        const present = rows.filter((a) => a.present).length;
        const isOpen = open === pr.id;
        return (
          <div key={pr.id} style={{ borderTop: `1px solid ${C.mist}`, padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setOpen(isOpen ? null : pr.id)}>
              <span style={{ fontFamily: font.display, fontWeight: 400, fontSize: 18 }}>{pr.practice_on}</span>
              <span style={{ fontSize: 13, color: C.slate, flex: 1 }}>{pr.notes}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{present}/{rows.length}</span>
              <button onClick={(e) => { e.stopPropagation(); remove(pr); }} aria-label="Delete practice" style={{ border: 0, background: "transparent", color: C.slate }}>✕</button>
            </div>
            {isOpen && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {players.map((p) => {
                  const row = rows.find((a) => a.player_id === p.id);
                  if (!row) return null;
                  return (
                    <button key={p.id} onClick={() => toggle(row)} className="chip" style={{
                      border: `2px solid ${row.present ? C.win : C.mist}`, background: row.present ? "transparent" : "rgba(224,31,45,.12)",
                      color: row.present ? C.ink : C.slate, borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 700, minWidth: 64 }}>
                      #{p.number} {p.name}
                      <div style={{ fontSize: 10, fontWeight: 800, opacity: .8, marginTop: 2 }}>{row.present ? "PRESENT" : "ABSENT"}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
