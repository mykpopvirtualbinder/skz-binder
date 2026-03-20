"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { User } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { OnboardingForm } from "../me/components/OnboardingForm";
import type { CSSProperties } from "react";
import Header from "../components/header";

// --- ESTILOS DEFINIDOS ---
const menuBtnStyle: CSSProperties = { 
  background: "transparent", border: "none", padding: "10px 14px", textAlign: "left", 
  borderRadius: 10, cursor: "pointer", fontWeight: 900, color: "#8C659C", fontSize: 14 
};

const footerColumnTitle: CSSProperties = { 
  fontSize: "13px", color: "#8C659C", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px", display: "block" 
};

const footerLinkStyle: CSSProperties = { 
  fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px", display: "block" 
};

function RegisterPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      setUserId(data.user.id);
      setStep(2);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFDF5", display: "flex", flexDirection: "column" }}>
      
     <Header />

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "40px 20px" }}>
        {step === 1 ? (
          <div style={{ 
            maxWidth: 450, width: '100%', background: 'white', padding: "50px 40px", 
            borderRadius: 32, border: "1px solid #F3DCE7", boxShadow: '0 10px 40px rgba(140, 101, 156, 0.05)', textAlign: 'center' 
          }}>
            <h1 className="tan-font" style={{ color: '#8C659C', fontSize: 32, marginBottom: 10 }}>CREAR CUENTA ✨</h1>
            <p style={{ color: '#b17eac', marginBottom: 30, fontSize: 16, fontWeight: 700 }}>Únete a la comunidad de coleccionistas</p>
            
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <input 
                type="email" placeholder="Tu Email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                style={{ padding: '15px 20px', borderRadius: 15, border: '2px solid #F3DCE7', outline: 'none', color: '#8C659C', fontWeight: 600 }}
              />
              <input 
                type="password" placeholder="Contraseña" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                style={{ padding: '15px 20px', borderRadius: 15, border: '2px solid #F3DCE7', outline: 'none', color: '#8C659C', fontWeight: 600 }}
              />
              {error && <p style={{ color: '#8C659C', fontSize: 13, fontWeight: 800 }}>{error}</p>}
              
              <button 
                type="submit" disabled={loading}
                style={{ 
                  padding: '18px', borderRadius: 15, border: 'none', backgroundColor: '#ffd9e6', 
                  color: '#8C659C', fontWeight: 900, cursor: 'pointer', marginTop: 10, fontSize: 16
                }}
              >
                {loading ? "CREANDO..." : "SIGUIENTE"}
              </button>
            </form>
          </div>
        ) : (
          <OnboardingForm 
            userId={userId!} 
            onComplete={() => window.location.href = "/binder"} 
          />
        )}
      </main>

      {/* FOOTER CORPORATIVO (Clonado de tu captura aprobada) */}
      <footer style={{ width: "100%", backgroundColor: "white", borderTop: "1px solid #F3DCE7", padding: "60px 80px 30px 80px", display: "flex", flexDirection: "column", gap: "40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "40px", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <span className="tan-font" style={{ color: "#b17eac", fontSize: "24px", letterSpacing: "1px" }}>MY KPOP BINDER</span>
            <p style={{ fontSize: "14px", color: "#8C659C", fontWeight: 600, maxWidth: "250px", lineHeight: "1.5" }}>
              Tu rincón digital para organizar, comprar y tradear tus photocards favoritas de la forma más eficiente.
            </p>
            <span style={{ fontSize: "12px", color: "#b17eac", fontWeight: 700, marginTop: "10px" }}>
              © 2026 My Kpop Binder. Hecho por fans para fans.
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={footerColumnTitle}>LEGAL</span>
            <a href="/terms" style={footerLinkStyle}>Términos y Condiciones</a>
            <a href="/terms#community" style={footerLinkStyle}>Normas de la Comunidad</a>
            <a href="/terms#copyright" style={footerLinkStyle}>Aviso de Copyright</a>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={footerColumnTitle}>MARKETPLACE</span>
            <a href="/market-rules" style={footerLinkStyle}>Reglas del Mercado</a>
            <a href="/anti-scam" style={footerLinkStyle}>Política Anti-Fraude</a>
            <a href="/privacy" style={footerLinkStyle}>Privacidad y Cookies</a>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={footerColumnTitle}>SOPORTE</span>
            <a href="/faq" style={footerLinkStyle}>Preguntas Frecuentes</a>
            <a href="/report" style={{ ...footerLinkStyle, fontWeight: 900, textDecoration: "underline" }}>Reportar Abuso (DSA)</a>
            <a href="mailto:info@mykpopbinder.com" style={footerLinkStyle}>info@mykpopbinder.com</a>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @font-face { font-family: 'TanTangkiwood'; src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype'); }
        .tan-font { font-family: 'TanTangkiwood', sans-serif !important; }
      `}</style>
    </div>
  );
}

export default RegisterPage;