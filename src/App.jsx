import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { C, font } from "./theme";
import Login from "./pages/Login.jsx";
import Games from "./pages/Games.jsx";
import LiveGame from "./pages/LiveGame.jsx";
import GameDetail from "./pages/GameDetail.jsx";
import Players from "./pages/Players.jsx";
import SoccerSmarts from "./pages/SoccerSmarts.jsx";

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loc = useLocation();
  if (loc.pathname.startsWith("/smarts")) return <SoccerSmarts />;
  if (session === undefined) return null;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px 8px", position: "sticky", top: 0, background: C.chalk, zIndex: 5 }}>
        <div style={{ fontFamily: font.display, fontWeight: 800, fontSize: 22, letterSpacing: 1, lineHeight: 1 }}>
          OCSC<span style={{ color: C.slate, fontWeight: 600 }}> · SIDELINE</span>
        </div>
        {session && (
          <nav style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {[["/games", "Games"], ["/players", "Players"]].map(([to, label]) => (
              <NavLink key={to} to={to} style={({ isActive }) => ({
                textDecoration: "none", borderRadius: 6, padding: "6px 9px", fontSize: 13, fontWeight: 600,
                background: isActive ? C.ink : "transparent", color: isActive ? C.chalk : C.slate })}>
                {label}
              </NavLink>
            ))}
            <a href="/smarts" target="_blank" rel="noreferrer" style={{ textDecoration: "none", padding: "6px 9px", fontSize: 13, fontWeight: 600, color: C.slate }}>Smarts ↗</a>
            <button onClick={() => supabase.auth.signOut()} title="Sign out"
              style={{ border: 0, background: "transparent", color: C.slate, fontSize: 13, padding: "6px 4px" }}>Out</button>
          </nav>
        )}
      </header>

      <Routes>
        {!session ? (
          <Route path="*" element={<Login />} />
        ) : (
          <>
            <Route path="/" element={<Navigate to="/games" replace />} />
            <Route path="/games" element={<Games />} />
            <Route path="/games/:id/live" element={<LiveGame />} />
            <Route path="/games/:id" element={<GameDetail />} />
            <Route path="/players" element={<Players />} />
            <Route path="*" element={<Navigate to="/games" replace />} />
          </>
        )}
      </Routes>
    </div>
  );
}
