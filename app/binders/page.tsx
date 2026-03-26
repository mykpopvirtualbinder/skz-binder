"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type BinderRow = {
  id: number;
  title: string | null;
  user_id: string;
};

const MAX_FREE_BINDERS = 3;

export default function BindersPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [binders, setBinders] = useState<BinderRow[]>([]);
  const canCreate = binders.length < MAX_FREE_BINDERS;

const loadBinders = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setError(userErr.message);
      setLoading(false);
      return;
    }

    const user = userData.user;
    if (!user) {
      setError("No hay sesión. Ve a /login");
      setLoading(false);
      return;
    }

    setEmail(user.email ?? null);

    const res = await supabase
      .from("binders")
      .select("id,title,user_id")
      .eq("user_id", user.id)
      .order("id", { ascending: false });

    if (res.error) {
      setError(res.error.message);
      setLoading(false);
      return;
    }

    setBinders((res.data ?? []) as BinderRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  loadBinders();
}, [loadBinders]);

  const createBinder = async () => {
    setError(null);

    // Re-chequeo por seguridad (por si abrió 2 pestañas)
    if (binders.length >= MAX_FREE_BINDERS) {
      setError("Límite alcanzado: máximo 3 binders gratis por usuario.");
      return;
    }

    setLoading(true);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setError(userErr.message);
      setLoading(false);
      return;
    }
    const user = userData.user;
    if (!user) {
      setError("No hay sesión. Ve a /login");
      setLoading(false);
      return;
    }

    const created = await supabase
      .from("binders")
      .insert({ user_id: user.id, title: "My Binder" })
      .select("id")
      .single();

    if (created.error || !created.data?.id) {
      setError(created.error?.message ?? "No se pudo crear el binder");
      setLoading(false);
      return;
    }

    // Recargar lista
    await loadBinders();
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Mis binders</h1>

      <p style={{ color: "#444" }}>
        {email ? `Sesión OK ✅ (${email})` : "Cargando usuario..."}
      </p>

      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={createBinder}
          disabled={loading || !canCreate}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: canCreate ? "white" : "#f2f2f2",
            cursor: loading || !canCreate ? "not-allowed" : "pointer",
          }}
          title={!canCreate ? "Máximo 3 binders gratis" : ""}
        >
          + Nuevo binder
        </button>

        <span style={{ fontSize: 13, color: "#666" }}>
          {binders.length}/{MAX_FREE_BINDERS} binders gratis
        </span>
      </div>

      {error && <div style={{ marginTop: 10, color: "crimson" }}>Error: {error}</div>}

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div style={{ color: "#666" }}>Cargando...</div>
        ) : binders.length === 0 ? (
          <div style={{ color: "#666" }}>Aún no tienes binders.</div>
        ) : (
          binders.map((b) => (
            <div key={b.id} style={{ marginTop: 10 }}>
              <strong>{b.title ?? "Sin título"}</strong>{" "}
              <Link href={`/binder?binderId=${b.id}`}>→ Abrir binder</Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}