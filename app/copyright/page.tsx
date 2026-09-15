"use client";

import React, { useState, useEffect } from "react";
import { Copyright, Camera, Scale, Mail, Info } from "lucide-react";
import Footer from "../components/footer";
import { useGlobal } from "../context/GlobalContext";

export default function CopyrightPage() {
  const { profile, t } = useGlobal(); // Añadimos profile para reactividad del tema
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
        
        {/* TITULAR GIGANTE */}
        <div style={{ marginBottom: "60px" }}>
          <h1 className="tan-font" style={{ color: "var(--color-primary)", fontSize: isMobile ? "48px" : "64px", lineHeight: "0.8", margin: 0 }}>
            {t("copyright.title_part1")}<br />
            <span style={{ fontSize: isMobile ? "32px" : "40px" }}>
              {t("copyright.title_part2")}
            </span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "14px", marginTop: "20px", letterSpacing: "2px", textTransform: "uppercase" }}>
            {t("copyright.subtitle")}
          </p>
          <p style={{ color: "var(--color-primary)", fontWeight: 800, fontSize: "13px", marginTop: "10px" }}>
            {t("copyright.last_updated")}
          </p>
        </div>

        {/* SECCIONES EDITORIALES */}
        <div style={{ display: "flex", flexDirection: "column", gap: "50px" }}>
          
          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Copyright size={20}/> {t("copyright.section1_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t("copyright.section1_text")}
            </p>
          </section>

          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Camera size={20}/> {t("copyright.section2_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t("copyright.section2_text")}
            </p>
          </section>

          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Scale size={20}/> {t("copyright.section3_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t("copyright.section3_text")}
            </p>
          </section>

          <section style={{ backgroundColor: "var(--bg-soft)", padding: "40px", borderRadius: "24px", border: "1px solid var(--color-border)" }}>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Info size={20}/> {t("copyright.section4_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t("copyright.section4_text")}
            </p>
          </section>
        </div>

        {/* CIERRE CON SOBRECITO */}
        <div style={{ marginTop: "80px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "13px", letterSpacing: "1px", marginBottom: "20px", textTransform: "uppercase" }}>
            {t("copyright.contact_prompt")}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ height: "1px", flex: 1, backgroundColor: "var(--color-border)" }}></div>
            <a 
              href="mailto:info@mykpopbinder.com" 
              className="tan-font"
              style={{ 
                display: "flex", alignItems: "center", gap: "10px", color: "var(--color-primary)", 
                textDecoration: "none", fontWeight: 900, fontSize: "14px", letterSpacing: "1px",
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.7"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              <Mail size={18} strokeWidth={2.5} />
              <span>{t("common.contact_admin")}</span>
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