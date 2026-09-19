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
      <img src="/logo.png" alt="OC Ankle Biters" width={150} height={186}
        style={{ margin: "0 auto", display: "block", imageRendering: "auto" }} />
      <div style={{ textAlign: "center", margin: "2px 0 8px" }}>
        <div style={{ fontFamily: font.display, fontWeight: 400, fontSize: 32, letterSpacing: 1, lineHeight: 1, color: C.ink }}>
          OC ANKLE BITERS
        </div>
        <div style={{ fontFamily: font.body, fontWeight: 800, fontSize: 12, letterSpacing: 3, color: C.amber, marginTop: 5 }}>
          SIDELINE
        </div>
      </div>
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
