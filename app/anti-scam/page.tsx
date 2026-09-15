"use client";

import React from "react";
import { ShieldCheck, AlertOctagon, Ban, Mail } from "lucide-react";
import type { CSSProperties } from "react";
import Footer from "../components/footer";
import { useGlobal } from "../context/GlobalContext";

// --- ESTILOS CORPORATIVOS TEMATIZADOS ---
const footerColumnTitle: CSSProperties = { 
  fontSize: "13px", 
  color: "var(--color-primary)", 
  fontWeight: 900, 
  textTransform: "uppercase", 
  marginBottom: "15px", 
  display: "block" 
};

const footerLinkStyle: CSSProperties = { 
  fontSize: "12px", 
  color: "var(--text-muted)", 
  textDecoration: "none", 
  fontWeight: 500, 
  marginBottom: "8px", 
  display: "block" 
};

export default function AntiScamPage() {
  const { t, profile } = useGlobal();
  
  // --- AÑADE ESTO ---
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  // ------------------

  return (
    <div style={{ 
      minHeight: "100vh", 
      backgroundColor: "var(--bg-main)", 
      display: "flex", 
      flexDirection: "column", 
      color: "var(--text-main)",
      transition: "background-color 0.3s ease" // Suavizamos el cambio de color
    }}>
      
      <main className="legal-page" style={{ width: "100%", maxWidth: "900px", margin: "24px auto", padding: "0 40px", flex: 1 }}>
        
        {/* TITULAR GIGANTE TRADUCIDO */}
        <div style={{ marginBottom: "60px" }}>
<h1 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "clamp(32px, 8vw, 64px)", lineHeight: "0.8", margin: 0 }}>            {t('anti_scam.title_part1')}<br />
            <span style={{ fontSize: "40px" }}>{t('anti_scam.title_part2')}</span>
          </h1>
          <p style={{ 
            color: "var(--text-muted)", 
            fontWeight: 700, 
            fontSize: "14px", 
            marginTop: "20px", 
            letterSpacing: "2px", 
            textTransform: "uppercase" 
          }}>
            {t('anti_scam.subtitle')}
          </p>
          <p style={{ color: "var(--color-primary)", fontWeight: 800, fontSize: "13px", marginTop: "10px" }}>
            {t('anti_scam.last_updated')}
          </p>
        </div>

        {/* SECCIONES TEMATIZADAS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "50px" }}>
          
          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <ShieldCheck size={20}/> {t('anti_scam.section1_title')}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t('anti_scam.section1_text')}
            </p>
          </section>

          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertOctagon size={20}/> {t('anti_scam.section2_title')}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)", marginBottom: "20px" }}>
              {t('anti_scam.section2_text')}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid var(--color-border)" }}>
                   <p style={{ fontWeight: 800, color: "var(--color-primary)", margin: 0 }}>{t('anti_scam.fake_title')}</p>
                   <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>{t('anti_scam.fake_text')}</p>
                </div>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid var(--color-border)" }}>
                   <p style={{ fontWeight: 800, color: "var(--color-primary)", margin: 0 }}>{t('anti_scam.no_shipping_title')}</p>
                   <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>{t('anti_scam.no_shipping_text')}</p>
                </div>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid var(--color-border)" }}>
                   <p style={{ fontWeight: 800, color: "var(--color-primary)", margin: 0 }}>{t('anti_scam.damage_title')}</p>
                   <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>{t('anti_scam.damage_text')}</p>
                </div>
            </div>
          </section>

          <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: "40px" }}>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Ban size={20}/> {t('anti_scam.section3_title')}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t('anti_scam.section3_text')}
            </p>
          </section>
        </div>

        {/* FIRMA FINAL */}
        <div style={{ marginTop: "80px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "13px", letterSpacing: "1px", marginBottom: "20px", textTransform: "uppercase" }}>
            {t('anti_scam.report_question')}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ height: "1px", flex: 1, backgroundColor: "var(--color-border)" }}></div>
           <a 
  href="mailto:info@mykpopbinder.com" 
  style={{ 
    display: "flex", 
    alignItems: "center", 
    gap: "10px", 
    color: "var(--color-primary)", 
    textDecoration: "none", 
    fontWeight: 900, 
    fontSize: "13px", 
    letterSpacing: "1px" 
  }}
>
  <Mail size={18} strokeWidth={2.5} />
  <span className="tan-font">INFO@MYKPOPBINDER.COM</span>
</a>
            <div style={{ height: "1px", flex: 1, backgroundColor: "var(--color-border)" }}></div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}