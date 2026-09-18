"use client";

import React from "react";
import { ShoppingBag, Truck, AlertCircle, RefreshCw, Mail } from "lucide-react";
import { useGlobal } from "../context/GlobalContext";

import Footer from "../components/footer";

export default function MarketRulesPage() {
  const { t } = useGlobal(); // 👈 Inicializamos traducciones

  return (
    <div style={{ 
      minHeight: "100vh", 
      backgroundColor: "var(--bg-main)", 
      display: "flex", 
      flexDirection: "column", 
      color: "var(--text-main)",
      transition: "background-color 0.3s ease" 
    }}>
      
      <main className="legal-page" data-nav="market" style={{ width: "100%", maxWidth: "900px", margin: "24px auto", padding: "0 40px", flex: 1 }}>
        
        {/* TITULAR GIGANTE */}
        <div style={{ marginBottom: "60px" }}>
          <h1 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "64px", lineHeight: "0.8", margin: 0 }}>
            {t("market_rules.title_1")}<br />
            <span style={{ fontSize: "40px" }}>{t("market_rules.title_2")}</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "14px", marginTop: "20px", letterSpacing: "2px", textTransform: "uppercase" }}>
            {t("market_rules.subtitle")}
          </p>
        </div>

        {/* SECCIONES EDITORIALES */}
        <div style={{ display: "flex", flexDirection: "column", gap: "50px" }}>
          
          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <ShoppingBag size={20}/> {t("market_rules.wts_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t('market_rules.wts_desc')}
            </p>
            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid var(--color-border)" }}>
                   <p style={{ fontWeight: 800, color: "var(--color-primary)", margin: 0 }}>
                     {t("market_rules.wts_payments")}
                   </p>
                   <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>
                     {t('market_rules.wts_payments_desc')}
                   </p>
                </div>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid var(--color-border)" }}>
                   <p style={{ fontWeight: 800, color: "var(--color-primary)", margin: 0 }}>
                     {t("market_rules.wts_faithful")}
                   </p>
                   <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>
                     {t('market_rules.wts_faithful_desc')}
                   </p>
                </div>
            </div>
          </section>

          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <RefreshCw size={20}/> {t("market_rules.wtt_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t('market_rules.wtt_desc')}
            </p>
          </section>

          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Truck size={20}/> {t("market_rules.shipping_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t('market_rules.shipping_desc')}
            </p>
          </section>

          <section style={{ backgroundColor: "var(--bg-soft)", padding: "40px", borderRadius: "24px", border: "1px solid var(--color-border)" }}>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertCircle size={20}/> {t("market_rules.security_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t('market_rules.security_desc')}
            </p>
          </section>
        </div>

        {/* FIRMA FINAL CON SOBRECITO */}
        <div style={{ marginTop: "80px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "13px", letterSpacing: "1px", marginBottom: "20px", textTransform: "uppercase" }}>
            {t("market_rules.doubts")}
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