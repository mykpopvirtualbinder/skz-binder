"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/header";
import Footer from "../components/footer";
import { supabase } from "@/lib/supabase";

const inputStyle: React.CSSProperties = { 
  width: "100%", 
  padding: "12px", 
  borderRadius: "12px", 
  border: "1px solid #F3DCE7", 
  outline: "none", 
  fontSize: "14px", 
  background: "#FFFDF5", 
  textAlign: "center"
};

export default function LoginPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Lógica para conectar el botón con Supabase
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      alert("Error: " + error.message);
      setLoading(false);
    } else {
      router.push("/me");
    }
  };

  const handleResetPassword = async () => {
    const emailToReset = prompt("Introduce tu email para recuperar la contraseña:");
    if (!emailToReset) return;

    if (typeof supabase !== "undefined") {
      const { error } = await supabase.auth.resetPasswordForEmail(emailToReset, {
        redirectTo: `${window.location.origin}/update-password`, 
      });
      if (error) alert("Error: " + error.message);
      else alert("¡Email enviado! Revisa tu bandeja de entrada. ✨");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#FFFDF5" }}>
      <Header />
      <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
        <div style={{ 
          background: "white", 
          padding: isMobile ? "30px 20px" : "40px", 
          borderRadius: "30px", 
          border: "1px solid #F3DCE7", 
          width: "100%", 
          maxWidth: "400px", 
          textAlign: "center" 
        }}>
          
          <h2 className="tan-font" style={{ color: "#8C659C", fontSize: isMobile ? "24px" : "30px", margin: "0 0 5px 0" }}>
            ¡Annyeonghaseyo!
          </h2>
          <p style={{ color: "#b17eac", fontSize: "18px", fontWeight: 800, margin: "0 0 15px 0" }}>
            안녕하세요
          </p>
          
          {/* Vinculamos la función handleLogin aquí */}
          <form 
            onSubmit={handleLogin} 
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <input 
              type="email" 
              placeholder="Tu email" 
              style={inputStyle} 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="Tu contraseña" 
              style={inputStyle} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            <button type="submit" className="tan-font" disabled={loading} style={{ 
              background: "#B17EAC", color: "white", border: "none", 
              padding: "12px", borderRadius: "15px", marginTop: "10px",
              fontSize: isMobile ? "16px" : "18px", cursor: "pointer",
              boxShadow: "0 4px 10px rgba(177, 126, 172, 0.2)",
              opacity: loading ? 0.7 : 1
            }}>
              {loading ? "CARGANDO..." : "INICIAR SESIÓN"}
            </button>
          </form>

          <p style={{ marginTop: "20px", fontSize: "13px", color: "#8C659C" }}>
            ¿Aún no tienes cuenta? <br/>
            <span 
              onClick={() => router.push('/register')} 
              style={{ color: "#B17EAC", fontWeight: 900, cursor: "pointer", textDecoration: "underline" }}
            >
              Regístrate aquí
            </span>
          </p>

          <button 
            type="button"
            onClick={handleResetPassword}
            style={{ fontSize: "12px", color: "#8C659C", background: "none", border: "none", cursor: "pointer", marginTop: "10px" }}
          >
            ¿Has olvidado tu contraseña?
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}