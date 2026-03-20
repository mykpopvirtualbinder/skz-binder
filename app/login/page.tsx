"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!email) {
      setMsg("Introduce un email válido");
      return;
    }

    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: "http://localhost:3000/",
  },
});

    setLoading(false);
    setMsg(error ? "Error: " + error.message : "Te he enviado un link al email ✉️");
  }

  return (
    <div style={{ padding: 24, maxWidth: 360 }}>
      <h1>Login</h1>

      <input
        type="email"
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 10, marginTop: 12 }}
      />

      <button
        onClick={signIn}
        disabled={loading}
        style={{ width: "100%", padding: 10, marginTop: 12 }}
      >
        {loading ? "Enviando…" : "Enviar link"}
      </button>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}