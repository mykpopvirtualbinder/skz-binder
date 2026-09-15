"use client";
import React, { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useGlobal } from "../context/GlobalContext"; // 👈 Añadido para el idioma

import Footer from "../components/footer";

export default function UpdatePasswordPage() {
  const { t } = useGlobal(); // 👈 Inyectamos t()
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Intentamos actualizar la contraseña
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      if (error.message.includes("session missing")) {
        alert(t("update_password.alert_session_expired"));
        router.push("/login");
      } else {
        alert(t("update_password.alert_error") + error.message);
      }
    } else {
      alert(t("update_password.alert_success"));
      router.push("/login");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-main)", transition: "background-color 0.3s ease" }}>
      
      <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
        <div style={{ background: "var(--bg-card)", padding: "40px", borderRadius: "30px", border: "1px solid var(--color-border)", width: "100%", maxWidth: "400px", textAlign: "center", boxShadow: "0 20px 40px var(--shadow-card)" }}>
          <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "30px", marginBottom: "10px" }}>
            {t("update_password.title")}
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: 700, marginBottom: "25px" }}>
            {t("update_password.subtitle")}
          </p>
          
          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <input 
              type="password" 
              placeholder={t("update_password.placeholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", textAlign: "center", outline: "none", boxSizing: "border-box", background: "var(--bg-main)", color: "var(--text-main)" }}
              required 
            />
            <button className="tan-font" disabled={loading} style={{ background: "var(--color-primary)", color: "white", border: "none", padding: "12px", borderRadius: "15px", cursor: loading ? "not-allowed" : "pointer", fontWeight: 900, opacity: loading ? 0.7 : 1, transition: "opacity 0.2s" }}>
              {loading ? t('update_password.btn_loading') : t('update_password.btn_submit')}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}