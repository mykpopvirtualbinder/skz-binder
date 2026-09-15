"use client";

import React from "react";
import { useGlobal } from "../context/GlobalContext";

const footerColumnTitle: React.CSSProperties = { 
  fontSize: "13px", 
  color: "var(--color-primary)", 
  fontWeight: 900, 
  textTransform: "uppercase", 
  marginBottom: "15px", 
  display: "block" 
};

const footerLinkStyle: React.CSSProperties = { 
  fontSize: "12px", 
  color: "var(--text-muted)", 
  textDecoration: "none", 
  fontWeight: 500, 
  marginBottom: "8px", 
  display: "block",
  transition: "opacity 0.2s"
};

export default function Footer() {
  // Añadimos 'profile' para que el Footer reaccione a los cambios de tema e idioma en tiempo real
  const { profile, t } = useGlobal(); 

  return (
    <footer style={{ 
      width: "100%", 
      backgroundColor: "var(--bg-card)", 
      borderTop: "1px solid var(--color-border)", 
      padding: "40px 20px", 
      marginTop: "auto",
      display: "flex",
      flexDirection: "column",
      gap: "40px",
      transition: "background-color 0.3s ease"
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
          <span className="tan-font" style={{ color: "var(--text-muted)", fontSize: "24px", letterSpacing: "1px" }}>
            {t('footer.brand')}
          </span>
          <p style={{ fontSize: "14px", color: "var(--color-primary)", fontWeight: 600, maxWidth: "250px", lineHeight: "1.5" }}>
            {t('footer.description')}
          </p>
        </div>

        {/* Columna 2: Legal */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={footerColumnTitle}>{t('footer.legal_title')}</span>
          <a href="/terms" style={footerLinkStyle}>{t('footer.terms')}</a>
          {/* ¡ARREGLADO! Ahora sí lleva a las páginas correctas */}
          <a href="/community-rules" style={footerLinkStyle}>{t('footer.community_rules')}</a>
          <a href="/copyright" style={footerLinkStyle}>{t('footer.copyright_notice')}</a>
        </div>

        {/* Columna 3: Marketplace */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={footerColumnTitle}>{t('footer.market_title')}</span>
          <a href="/market-rules" style={footerLinkStyle}>{t('footer.market_rules')}</a>
          <a href="/anti-scam" style={footerLinkStyle}>{t('footer.anti_scam')}</a>
          <a href="/privacy" style={footerLinkStyle}>{t('footer.privacy')}</a>
        </div>

        {/* Columna 4: Soporte */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={footerColumnTitle}>{t('footer.support_title')}</span>
          <a href="/faq" style={footerLinkStyle}>{t('footer.faq')}</a>
          <a href="/report" style={{ ...footerLinkStyle, fontWeight: 900, textDecoration: "underline", color: "var(--color-primary)" }}>
            {t('footer.report_abuse')}
          </a>
          <a href="mailto:info@mykpopbinder.com" style={footerLinkStyle}>info@mykpopbinder.com</a>
        </div>
      </div>

      {/* Fila Inferior */}
      <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "20px", textAlign: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>
          © {new Date().getFullYear()} {t('footer.copyright_text')}
        </span>
      </div>
    </footer>
  );
}