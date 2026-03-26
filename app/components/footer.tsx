"use client";

import React from "react";

const footerColumnTitle: React.CSSProperties = { 
  fontSize: "13px", 
  color: "#8C659C", 
  fontWeight: 900, 
  textTransform: "uppercase", 
  marginBottom: "15px", 
  display: "block" 
};

const footerLinkStyle: React.CSSProperties = { 
  fontSize: "12px", 
  color: "#b17eac", 
  textDecoration: "none", 
  fontWeight: 500, 
  marginBottom: "8px", 
  display: "block" 
};

export default function Footer() {
  return (
    <footer style={{ 
      width: "100%", 
      backgroundColor: "white", 
      borderTop: "1px solid #F3DCE7", 
      padding: "40px 20px", 
      marginTop: "auto",
      display: "flex",
      flexDirection: "column",
      gap: "40px"
    }}>
      <div style={{ 
        maxWidth: "1120px", 
        margin: "0 auto", 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", 
        gap: "40px", 
        alignItems: "start",
        width: "100%"
      }}>
        {/* Columna 1: Branding */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <span className="tan-font" style={{ color: "#b17eac", fontSize: "24px", letterSpacing: "1px" }}>
            MY KPOP BINDER
          </span>
          <p style={{ fontSize: "14px", color: "#8C659C", fontWeight: 600, maxWidth: "250px", lineHeight: "1.5" }}>
            Tu rincón digital para organizar, comprar y tradear tus photocards favoritas de la forma más eficiente.
          </p>
        </div>

        {/* Columna 2: Legal */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={footerColumnTitle}>LEGAL</span>
          <a href="/terms" style={footerLinkStyle}>Términos y Condiciones</a>
          <a href="/terms#community" style={footerLinkStyle}>Normas de la Comunidad</a>
          <a href="/terms#copyright" style={footerLinkStyle}>Aviso de Copyright</a>
        </div>

        {/* Columna 3: Marketplace */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={footerColumnTitle}>MARKETPLACE</span>
          <a href="/market-rules" style={footerLinkStyle}>Reglas del Mercado</a>
          <a href="/anti-scam" style={footerLinkStyle}>Política Anti-Fraude</a>
          <a href="/privacy" style={footerLinkStyle}>Privacidad y Cookies</a>
        </div>

        {/* Columna 4: Soporte */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={footerColumnTitle}>SOPORTE</span>
          <a href="/faq" style={footerLinkStyle}>Preguntas Frecuentes</a>
          <a href="/report" style={{ ...footerLinkStyle, fontWeight: 900, textDecoration: "underline" }}>
            Reportar Abuso (DSA)
          </a>
          <a href="mailto:info@mykpopbinder.com" style={footerLinkStyle}>info@mykpopbinder.com</a>
        </div>
      </div>

      {/* Fila Inferior */}
      <div style={{ borderTop: "1px solid #FFF5FA", paddingTop: "20px", textAlign: "center" }}>
        <span style={{ fontSize: "12px", color: "#b17eac", fontWeight: 700 }}>
          © {new Date().getFullYear()} My Kpop Binder. Hecho por fans para fans.
        </span>
      </div>
    </footer>
  );
}