"use client";

import React from "react";
import { Scale, Copyright, ShieldAlert, FileText, Mail } from "lucide-react";
import { useGlobal } from "../context/GlobalContext";

import Footer from "../components/footer";

export default function TermsAndConditions() {
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
        
        {/* TITULAR GIGANTE */}
        <div style={{ marginBottom: "60px" }}>
          <h1 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "64px", lineHeight: "0.8", margin: 0 }}>
            {(t("terms.title_part1") || t("terms.title_1"))}<br />
            <span style={{ fontSize: "40px" }}>{(t("terms.title_part2") || t("terms.title_2"))}</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "14px", marginTop: "20px", letterSpacing: "2px", textTransform: "uppercase" }}>
            {t("terms.subtitle")}
          </p>
          <p style={{ color: "var(--color-primary)", fontWeight: 800, fontSize: "13px", marginTop: "10px" }}>
            {(t("terms.last_updated") || t("terms.last_update"))}
          </p>
        </div>

        {/* LISTADO LEGAL CHIC */}
        <div style={{ display: "flex", flexDirection: "column", gap: "50px" }}>
          
          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <FileText size={20}/> {t("terms.section1_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {(t("terms.section1_text") || t("terms.section1_desc"))}
            </p>
          </section>

          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px" }}>
              {t("terms.section2_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {(t("terms.section2_text") || t("terms.section2_desc"))}
            </p>
          </section>

          <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: "40px" }}>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Scale size={20}/> {t("terms.section3_title")}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid var(--color-border)" }}>
                   <p style={{ fontWeight: 800, color: "var(--color-primary)", margin: 0 }}>
                     {(t("terms.section3_sub1_title") || t("terms.respect_title"))}
                   </p>
                   <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                     {(t("terms.section3_sub1_text") || t("terms.respect_desc"))}
                   </p>
                </div>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid var(--color-border)" }}>
                   <p style={{ fontWeight: 800, color: "var(--color-primary)", margin: 0 }}>
                     {(t("terms.section3_sub2_title") || t("terms.mod_title"))}
                   </p>
                   <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                     {(t("terms.section3_sub2_text") || t("terms.mod_desc"))}
                   </p>
                </div>
            </div>
          </section>

          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Copyright size={20}/> {t("terms.section4_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {(t("terms.section4_text") || t("terms.section4_desc"))}
            </p>
          </section>

          <section style={{ backgroundColor: "var(--bg-soft)", padding: "40px", borderRadius: "24px", border: "1px solid var(--color-border)" }}>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <ShieldAlert size={20}/> {t("terms.section5_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {(t("terms.section5_text") || t("terms.section5_desc"))}
            </p>
          </section>
        </div>

        {/* CIERRE CON SOBRECITO */}
        <div style={{ marginTop: "80px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "13px", letterSpacing: "1px", marginBottom: "20px", textTransform: "uppercase" }}>
            {(t("terms.contact_question") || t("terms.doubts"))}
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