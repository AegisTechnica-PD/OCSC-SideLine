import { Link } from "react-router-dom";
import { C, font } from "../theme";

export default function Landing() {
  const big = {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    textDecoration: "none", borderRadius: 14, padding: "26px 16px",
    fontFamily: font.display, fontWeight: 400, letterSpacing: 1, fontSize: 30, lineHeight: 1,
  };
  return (
    <div style={{ padding: "8vh 18px 24px", display: "grid", gap: 14 }}>
      <img src="/logo.png" alt="Oregon City Soccer Club" width={128} height={128}
        style={{ margin: "0 auto", display: "block", imageRendering: "auto" }} />
      <p style={{ fontFamily: font.body, fontSize: 14, color: C.slate, textAlign: "center", margin: "0 0 6px" }}>
        Who's here?
      </p>
      <a href="/smarts" style={{ ...big, background: C.amber, color: C.ink }}>
        PLAYER
        <span style={{ fontFamily: font.body, fontSize: 13, fontWeight: 700, letterSpacing: 0, opacity: .85 }}>Soccer Smarts homework</span>
      </a>
      <Link to="/login" style={{ ...big, background: "transparent", color: C.ink, border: `2px solid ${C.mist}` }}>
        COACH
        <span style={{ fontFamily: font.body, fontSize: 13, fontWeight: 700, letterSpacing: 0, color: C.slate }}>Sign in to Sideline</span>
      </Link>
    </div>
  );
}
