"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { User, ShieldCheck, AlertOctagon, Ban, Mail } from "lucide-react";
import type { CSSProperties } from "react";
import Header from "../components/header";
// --- ESTILOS CORPORATIVOS ---
const menuBtnStyle: CSSProperties = { background: "transparent", border: "none", padding: "10px 14px", textAlign: "left", borderRadius: 10, cursor: "pointer", fontWeight: 900, color: "#8C659C", fontSize: 14 };
const footerColumnTitle: CSSProperties = { fontSize: "13px", color: "#8C659C", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px", display: "block" };
const footerLinkStyle: CSSProperties = { fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px", display: "block" };

export default function AntiScamPage() {
  const router = useRouter();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFDF5", display: "flex", flexDirection: "column", color: "#2F2740" }}>
      
     <Header />

      {/* CONTENIDO PRINCIPAL EDITORIAL */}
      <main style={{ width: "100%", maxWidth: "900px", margin: "80px auto", padding: "0 40px", flex: 1 }}>
        
        {/* TITULAR GIGANTE */}
        <div style={{ marginBottom: "60px" }}>
          <h1 className="tan-font" style={{ color: "#8C659C", fontSize: "64px", lineHeight: "0.8", margin: 0 }}>
            ANTI-SCAM<br /><span style={{ fontSize: "40px" }}>PROTECTION</span>
          </h1>
          <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "14px", marginTop: "20px", letterSpacing: "2px", textTransform: "uppercase" }}>
            Salvaguardando la magia del coleccionismo
          </p>
          <p style={{ color: "#8C659C", fontWeight: 800, fontSize: "13px", marginTop: "10px" }}>Última actualización: 17/3/2026</p>
        </div>

        {/* SECCIONES ESTILO "CHIC" */}
        <div style={{ display: "flex", flexDirection: "column", gap: "50px" }}>
          
          <section>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <ShieldCheck size={20}/> 1. NUESTRO COMPROMISO
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444" }}>
              Nuestra prioridad absoluta es garantizar un marketplace seguro para tod@s. My Kpop Binder es un espacio de confianza donde cada intercambio y venta debe realizarse bajo los más altos estándares de honestidad.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertOctagon size={20}/> 2. TOLERANCIA CERO
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444", marginBottom: "20px" }}>
              Quedan terminantemente prohibidas las siguientes acciones, que resultarán en medidas disciplinarias inmediatas:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid #F3C7DA" }}>
                   <p style={{ fontWeight: 800, color: "#8C659C", margin: 0 }}>FALSIFICACIONES</p>
                   <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>Venta o intercambio de artículos fanmade presentados como oficiales.</p>
                </div>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid #F3C7DA" }}>
                   <p style={{ fontWeight: 800, color: "#8C659C", margin: 0 }}>INCUMPLIMIENTO DE ENVÍO</p>
                   <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>No realizar el envío tras recibir el pago o el intercambio pactado.</p>
                </div>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid #F3C7DA" }}>
                   <p style={{ fontWeight: 800, color: "#8C659C", margin: 0 }}>OCULTACIÓN DE DAÑOS</p>
                   <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>Manipular fotos o descripciones para omitir defectos físicos en las cartas.</p>
                </div>
            </div>
          </section>

          <section style={{ borderTop: "1px solid #F3DCE7", paddingTop: "40px" }}>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Ban size={20}/> 3. SUSPENSIÓN PERMANENTE
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444" }}>
              Cualquier usuari@ involucrad@ en fraudes probados perderá el acceso a su cuenta de forma definitiva. La integridad de la comunidad no es negociable.
            </p>
          </section>
        </div>

        {/* FIRMA FINAL CON SOBRECITO */}
        <div style={{ marginTop: "80px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "13px", letterSpacing: "1px", marginBottom: "20px", textTransform: "uppercase" }}>
            ¿HAS DETECTADO UN FRAUDE?
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ height: "1px", flex: 1, backgroundColor: "#F3C7DA" }}></div>
            <a 
              href="mailto:info@mykpopbinder.com" 
              style={{ 
                display: "flex", alignItems: "center", gap: "10px", color: "#8C659C", 
                textDecoration: "none", fontWeight: 900, fontSize: "13px", letterSpacing: "1px" 
              }}
            >
              <Mail size={18} strokeWidth={2.5} />
              <span>INFO@MYKPOPBINDER.COM</span>
            </a>
            <div style={{ height: "1px", flex: 1, backgroundColor: "#F3C7DA" }}></div>
          </div>
        </div>

      </main>

      {/* FOOTER CORPORATIVO UNIFICADO */}
      <footer style={{ width: "100%", backgroundColor: "white", borderTop: "1px solid #F3DCE7", padding: "60px 80px 30px 80px", display: "flex", flexDirection: "column", gap: "40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "40px", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <span className="tan-font" style={{ color: "#b17eac", fontSize: "24px", letterSpacing: "1px" }}>MY KPOP BINDER</span>
            <p style={{ fontSize: "14px", color: "#8C659C", fontWeight: 600, maxWidth: "250px", lineHeight: "1.5" }}>Tu rincón digital para organizar y tradear tus photocards favoritas de la forma más eficiente.</p>
            <span style={{ fontSize: "12px", color: "#b17eac", fontWeight: 700, marginTop: "10px" }}>© 2026 My Kpop Binder. Hecho por fans para fans.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={footerColumnTitle}>LEGAL</span>
            <a href="/terms" style={footerLinkStyle}>Términos y Condiciones</a>
            <a href="/community-rules" style={footerLinkStyle}>Normas de la Comunidad</a>
            <a href="/copyright" style={footerLinkStyle}>Aviso de Copyright</a>
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