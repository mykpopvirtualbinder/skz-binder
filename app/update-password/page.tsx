"use client";
import React, { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Header from "../components/header";
import Footer from "../components/footer";

export default function UpdatePasswordPage() {
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
        alert("La sesión ha caducado. Por favor, solicita un nuevo correo de recuperación. 🔑");
        router.push("/login");
      } else {
        alert("Error: " + error.message);
      }
    } else {
      alert("¡Contraseña actualizada! ✨ Ya puedes entrar.");
      router.push("/login");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#FFFDF5" }}>
      <Header />
      <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
        <div style={{ background: "white", padding: "40px", borderRadius: "30px", border: "1px solid #F3DCE7", width: "100%", maxWidth: "400px", textAlign: "center" }}>
          <h2 className="tan-font" style={{ color: "#8C659C", fontSize: "30px", marginBottom: "10px" }}>Nueva Contraseña</h2>
          <p style={{ color: "#b17eac", fontSize: "14px", fontWeight: 700, marginBottom: "25px" }}>Introduce tu nueva clave para recuperar el acceso.</p>
          
          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <input 
              type="password" 
              placeholder="Nueva contraseña" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid #F3DCE7", textAlign: "center", outline: "none" }}
              required 
            />
            <button className="tan-font" disabled={loading} style={{ background: "#B17EAC", color: "white", border: "none", padding: "12px", borderRadius: "15px", cursor: "pointer", fontWeight: 900 }}>
              {loading ? "ACTUALIZANDO..." : "CAMBIAR CONTRASEÑA"}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}