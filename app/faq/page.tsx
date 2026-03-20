"use client";

import React, { CSSProperties, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Plus, Minus, Mail } from "lucide-react";
import Header from "../components/header";

export default function FAQPage() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqs = [
    {
      q: "¿Qué significan las siglas WTS, WTT y OTW?",
      a: "Son términos estándar en el coleccionismo: WTS (Want To Sell) para venta; WTT (Want To Trade) para intercambio; y OTW (On The Way) para cartas compradas en camino."
    },
    {
      q: "¿Cómo añado una carta que no está en la base de datos?",
      a: "Utiliza la función 'PC Personalizada'. Podrás subir tus propias fotos y completar los detalles manualmente para que tu binder luzca perfecto."
    },
    {
      q: "¿Es seguro comprar en el Market?",
      a: "My Kpop Binder facilita la conexión entre usuari@s. Recuerda que el envío y el estado de la carta son responsabilidad del vendedor; recomendamos siempre pedir pruebas de vídeo."
    },
    {
      q: "¿Qué ventajas tiene el plan Premium?",
      a: "Desbloquea binders ilimitados, formatos de cuadrícula exclusivos (como el 1x1 gigante) y diseños de portadas premium para tu colección."
    },
    {
      q: "¿Cómo marco a mis 'Bias' para que aparezca el corazón?",
      a: "Configura tus favorit@s en la sección 'Me'. Una vez elegidos, sus cartas brillarán con un corazón rosa automáticamente en todo el sitio."
    }
  ];

  // --- ESTILOS COMPARTIDOS (COHERENCIA TOTAL) ---
  const menuBtnStyle: CSSProperties = { background: "transparent", border: "none", padding: "10px 14px", textAlign: "left", borderRadius: 10, cursor: "pointer", fontWeight: 900, color: "#8C659C", fontSize: 14 };
  const footerColumnTitle: CSSProperties = { fontSize: "13px", color: "#8C659C", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px", display: "block" };
  const footerLinkStyle: CSSProperties = { fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px", display: "block" };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFDF5", display: "flex", flexDirection: "column", color: "#2F2740" }}>
      
     <Header />

      {/* CONTENIDO PRINCIPAL EDITORIAL */}
      <main style={{ width: "100%", maxWidth: "900px", margin: "80px auto", padding: "0 40px", flex: 1 }}>
        
        {/* TÍTULO */}
        <div style={{ marginBottom: "60px" }}>
          <h1 className="tan-font" style={{ color: "#8C659C", fontSize: "64px", lineHeight: "0.8", margin: 0 }}>
            HELP<br /><span style={{ fontSize: "40px" }}>& RESOURCES</span>
          </h1>
          <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "14px", marginTop: "20px", letterSpacing: "2px", textTransform: "uppercase" }}>
            Guía esencial para tod@s l@s coleccionistas
          </p>
        </div>

        {/* LISTA DE PREGUNTAS (LETRA 16PX) */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} style={{ borderBottom: "1px solid #F3DCE7" }}>
                <button 
                  onClick={() => toggleFAQ(index)} 
                  style={{ 
                    width: "100%", padding: "28px 0", display: "flex", justifyContent: "space-between", 
                    alignItems: "center", background: "none", border: "none", cursor: "pointer", textAlign: "left"
                  }}
                >
                  <span style={{ 
                    fontWeight: 800, color: isOpen ? "#8C659C" : "#2F2740", 
                    fontSize: "16px", transition: "color 0.2s ease" 
                  }}>
                    {faq.q}
                  </span>
                  {isOpen ? <Minus size={16} color="#8C659C" /> : <Plus size={16} color="#b17eac" />}
                </button>
                
                <div style={{ 
                  maxHeight: isOpen ? "200px" : "0", opacity: isOpen ? 1 : 0,
                  transition: "all 0.4s ease-in-out", paddingBottom: isOpen ? "28px" : "0",
                  overflow: "hidden"
                }}>
                  <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.8", maxWidth: "650px", margin: 0 }}>
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* CIERRE CON SOBRECITO */}
        <div style={{ marginTop: "80px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "13px", letterSpacing: "1px", marginBottom: "20px", textTransform: "uppercase" }}>
            ¿Tienes alguna otra duda?
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ height: "1px", flex: 1, backgroundColor: "#F3DCE7" }}></div>
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
            <div style={{ height: "1px", flex: 1, backgroundColor: "#F3DCE7" }}></div>
          </div>
        </div>

      </main>

      {/* FOOTER CORPORATIVO DE 4 COLUMNAS */}
      <footer style={{ width: "100%", backgroundColor: "white", borderTop: "1px solid #F3DCE7", padding: "60px 80px 30px 80px", display: "flex", flexDirection: "column", gap: "40px", marginTop: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "40px", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <span className="tan-font" style={{ color: "#b17eac", fontSize: "24px", letterSpacing: "1px" }}>MY KPOP BINDER</span>
            <p style={{ fontSize: "14px", color: "#8C659C", fontWeight: 600, maxWidth: "250px", lineHeight: "1.5" }}>
              Tu rincón digital para organizar, comprar y tradear tus photocards favoritas de la forma más eficiente.
            </p>
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