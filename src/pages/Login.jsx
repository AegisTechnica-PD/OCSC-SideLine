import { useState } from "react";
import { supabase } from "../lib/supabase";
import { C, inp, sBtn } from "../theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    setErr("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setErr(error.message); else setSent(true);
  };

  return (
    <div style={{ padding: "24px 14px" }}>
      <p style={{ fontSize: 14, color: C.slate, marginTop: 0 }}>Coaches sign in with an email link. No password.</p>
      {sent ? (
        <p style={{ fontSize: 15 }}>Link sent to <b>{email}</b>. Open it on this phone.</p>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inp, flex: 1 }} type="email" inputMode="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <button style={{ ...sBtn, background: C.ink, color: C.chalk }} onClick={send}>Send link</button>
        </div>
      )}
      {err && <p style={{ color: C.red, fontSize: 13 }}>{err}</p>}
    </div>
  );
}
