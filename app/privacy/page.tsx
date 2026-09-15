"use client";

import React from "react";
import { ShieldCheck, Lock, Eye, Cookie, Mail } from "lucide-react";
import { useGlobal } from "../context/GlobalContext";

import Footer from "../components/footer";

export default function PrivacyPolicy() {
  const { t } = useGlobal(); // 👈 Añadimos el traductor

  return (
    <div style={{ 
      minHeight: "100vh", 
      backgroundColor: "var(--bg-main)", 
      display: "flex", 
      flexDirection: "column", 
      color: "var(--text-main)",
      transition: "background-color 0.3s ease"
    }}>
      
      <main className="legal-page" style={{ width: "100%", maxWidth: "900px", margin: "24px auto", padding: "0 40px", flex: 1 }}>
        
        {/* TITULAR EDITORIAL */}
        <div style={{ marginBottom: "60px" }}>
          <h1 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "64px", lineHeight: "0.8", margin: 0 }}>
            {t("privacy.title_1")}<br />
            <span style={{ fontSize: "40px" }}>{t("privacy.title_2")}</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "14px", marginTop: "20px", letterSpacing: "2px", textTransform: "uppercase" }}>
            {t("privacy.subtitle")}
          </p>
          <p style={{ color: "var(--color-primary)", fontWeight: 800, fontSize: "13px", marginTop: "10px" }}>
            {t("privacy.last_update")}
          </p>
        </div>

        {/* SECCIONES DE POLÍTICA */}
        <div style={{ display: "flex", flexDirection: "column", gap: "50px" }}>
          
          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <ShieldCheck size={20}/> {t("privacy.data_title")}
            </h2>
            <p style={{ fontSize: "15px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t('privacy.data_desc')}
            </p>
          </section>

          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Lock size={20}/> {t("privacy.security_title")}
            </h2>
            <p style={{ fontSize: "15px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t('privacy.security_desc')}
            </p>
          </section>

          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Eye size={20}/> {t("privacy.use_title")}
            </h2>
            <p style={{ fontSize: "15px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t('privacy.use_desc')}
            </p>
          </section>

          <section style={{ backgroundColor: "var(--bg-soft)", padding: "30px", borderRadius: "24px", border: "1px solid var(--color-border)" }}>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Cookie size={20}/> {t("privacy.cookies_title")}
            </h2>
            <p style={{ fontSize: "15px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t('privacy.cookies_desc')}
            </p>
          </section>

          <section>
             <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px" }}>
               {t("privacy.rgpd_title")}
             </h2>
             <p style={{ fontSize: "15px", lineHeight: "1.8", color: "var(--text-main)" }}>
               {t('privacy.rgpd_desc')}
             </p>
          </section>
        </div>

        {/* FIRMA FINAL CON SOBRECITO */}
        <div style={{ marginTop: "80px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "13px", letterSpacing: "1px", marginBottom: "20px", textTransform: "uppercase" }}>
            {t("privacy.doubts")}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ height: "1px", flex: 1, backgroundColor: "var(--color-border)" }}></div>
            <a 
              href="mailto:info@mykpopbinder.com" 
              className="tan-font"
              style={{ 
                display: "flex", alignItems: "center", gap: "10px", color: "var(--color-primary)", 
                textDecoration: "none", fontWeight: 900, fontSize: "14px", letterSpacing: "1px" 
              }}
            >
              <Mail size={18} strokeWidth={2.5} />
              <span>INFO@MYKPOPBINDER.COM</span>
            </a>
            <div style={{ height: "1px", flex: 1, backgroundColor: "var(--color-border)" }}></div>
          </div>
        </div>

      </main>

     <Footer />

      <style jsx global>{`
        @font-face { font-family: 'TanTangkiwood'; src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype'); }
        .tan-font { font-family: 'TanTangkiwood', sans-serif !important; }
      `}</style>
    </div>
  );
}