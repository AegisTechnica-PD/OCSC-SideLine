import { C, h2 } from "../theme";
// Drop the existing Soccer Smarts component in here and export it as default.
// This route is public (no sign-in) so the parent link keeps working.
export default function SoccerSmarts() {
  return (
    <div style={{ padding: "0 14px 32px" }}>
      <div style={h2}>SOCCER SMARTS</div>
      <p style={{ fontSize: 14, color: C.slate }}>Paste the Soccer Smarts component into <code>src/pages/SoccerSmarts.jsx</code>. Weekly seeds can read from the database later.</p>
    </div>
  );
}
