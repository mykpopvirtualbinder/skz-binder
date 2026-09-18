"use client";

import React from "react";
import { useGlobal } from "../context/GlobalContext";

const footerColumnTitle: React.CSSProperties = { 
  fontSize: "13px", 
  fontWeight: 900, 
  textTransform: "uppercase", 
  marginBottom: "15px", 
  display: "block" 
};

const footerLinkStyle: React.CSSProperties = { 
  fontSize: "12px", 
  textDecoration: "none", 
  fontWeight: 500, 
  marginBottom: "8px", 
  display: "block",
  transition: "opacity 0.2s, color 0.2s"
};

export default function Footer() {
  const { t } = useGlobal(); 

  return (
    <footer className="site-footer" style={{ 
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
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <span className="tan-font site-footer-brand" data-nav="home" style={{ fontSize: "24px", letterSpacing: "1px" }}>
            {t('footer.brand')}
          </span>
          <p className="site-footer-desc" style={{ fontSize: "14px", fontWeight: 600, maxWidth: "250px", lineHeight: "1.5" }}>
            {t('footer.description')}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span className="site-footer-title" data-nav="albums" style={footerColumnTitle}>{t('footer.legal_title')}</span>
          <a href="/terms" className="site-footer-link" data-nav="albums" style={footerLinkStyle}>{t('footer.terms')}</a>
          <a href="/community-rules" className="site-footer-link" data-nav="fanzone" style={footerLinkStyle}>{t('footer.community_rules')}</a>
          <a href="/copyright" className="site-footer-link" data-nav="library" style={footerLinkStyle}>{t('footer.copyright_notice')}</a>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span className="site-footer-title" data-nav="market" style={footerColumnTitle}>{t('footer.market_title')}</span>
          <a href="/market-rules" className="site-footer-link" data-nav="market" style={footerLinkStyle}>{t('footer.market_rules')}</a>
          <a href="/anti-scam" className="site-footer-link" data-nav="merch" style={footerLinkStyle}>{t('footer.anti_scam')}</a>
          <a href="/privacy" className="site-footer-link" data-nav="fanart" style={footerLinkStyle}>{t('footer.privacy')}</a>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span className="site-footer-title" data-nav="shop" style={footerColumnTitle}>{t('footer.support_title')}</span>
          <a href="/faq" className="site-footer-link" data-nav="binders" style={footerLinkStyle}>{t('footer.faq')}</a>
          <a href="/report" className="site-footer-link site-footer-link--strong" data-nav="home" style={{ ...footerLinkStyle, fontWeight: 900, textDecoration: "underline" }}>
            {t('footer.report_abuse')}
          </a>
          <a href="mailto:info@mykpopbinder.com" className="site-footer-link" data-nav="fanart" style={footerLinkStyle}>info@mykpopbinder.com</a>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "20px", textAlign: "center" }}>
        <span className="site-footer-copy">
          © {new Date().getFullYear()} {t('footer.copyright_text')}
        </span>
      </div>
    </footer>
  );
}
