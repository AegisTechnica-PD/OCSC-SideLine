import { useState } from "react";
import { supabase } from "../lib/supabase";
import { C, inp, sBtn } from "../theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message === "Invalid login credentials" ? "Email or password didn't match." : error.message);
  };

  return (
    <div style={{ padding: "24px 14px", display: "grid", gap: 8 }}>
      <p style={{ fontSize: 14, color: C.slate, margin: 0 }}>Coach sign-in.</p>
      <input style={inp} type="email" inputMode="email" autoComplete="username" placeholder="Email"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <input style={inp} type="password" autoComplete="current-password" placeholder="Password"
        value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} />
      <button style={{ ...sBtn, background: C.ink, color: C.chalk, opacity: busy ? .6 : 1 }} disabled={busy} onClick={signIn}>Sign in</button>
      {err && <p style={{ color: C.red, fontSize: 13, margin: 0 }}>{err}</p>}
    </div>
  );
}
