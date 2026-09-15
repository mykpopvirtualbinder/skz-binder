"use client";

import React, { useState } from "react";
import { Plus, Minus, Mail } from "lucide-react";
import Footer from "../components/footer";
import { useGlobal } from "../context/GlobalContext";

export default function FAQPage() {
  const { t } = useGlobal();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const translatedItems = t("faq.items") as any;
  const translatedQuestions = t("faq.questions") as any;
  const faqs = Array.isArray(translatedItems)
    ? translatedItems
    : (translatedQuestions && typeof translatedQuestions === "object"
        ? Object.keys(translatedQuestions)
            .filter((key) => /^q\d+$/.test(key))
            .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
            .map((qKey) => {
              const idx = qKey.slice(1);
              return {
                q: translatedQuestions[qKey],
                a: translatedQuestions[`a${idx}`] || "",
              };
            })
        : []);

  return (
    <div style={{ 
      minHeight: "100vh", 
      backgroundColor: "var(--bg-main)", 
      display: "flex", 
      flexDirection: "column", 
      color: "var(--text-main)",
      transition: "background-color 0.3s ease" 
    }}>
      
      <main className="legal-page" style={{ width: "100%", maxWidth: "900px", margin: "24px auto 40px auto", padding: "0 40px", flex: 1 }}>
        
        {/* TÍTULO */}
        <div style={{ marginBottom: "60px" }}>
          <h1 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "64px", lineHeight: "0.8", margin: 0 }}>
            {t("faq.title_part1")}<br />
            <span style={{ fontSize: "40px" }}>{t("faq.title_part2")}</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "14px", marginTop: "20px", letterSpacing: "2px", textTransform: "uppercase" }}>
            {t("faq.subtitle")}
          </p>
        </div>

        {/* LISTA DE PREGUNTAS */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {Array.isArray(faqs) && faqs.map((faq: any, index: number) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <button 
                  onClick={() => toggleFAQ(index)} 
                  style={{ 
                    width: "100%", padding: "28px 0", display: "flex", justifyContent: "space-between", 
                    alignItems: "center", background: "none", border: "none", cursor: "pointer", textAlign: "left"
                  }}
                >
                  <span style={{ 
                    fontWeight: 800, color: isOpen ? "var(--color-primary)" : "var(--text-main)", 
                    fontSize: "16px", transition: "color 0.2s ease", paddingRight: "20px"
                  }}>
                    {faq.q}
                  </span>
                  <div style={{ flexShrink: 0 }}>
                    {isOpen ? <Minus size={18} color="var(--color-primary)" /> : <Plus size={18} color="var(--text-muted)" />}
                  </div>
                </button>
                
                <div style={{ 
                  maxHeight: isOpen ? "300px" : "0", 
                  opacity: isOpen ? 1 : 0,
                  transition: "all 0.4s ease-in-out", 
                  paddingBottom: isOpen ? "28px" : "0",
                  overflow: "hidden"
                }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "15px", lineHeight: "1.8", maxWidth: "700px", margin: 0 }}>
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* CIERRE CON SOBRECITO */}
        <div style={{ marginTop: "80px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "13px", letterSpacing: "1px", marginBottom: "20px", textTransform: "uppercase" }}>
            {t("faq.contact_prompt")}
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