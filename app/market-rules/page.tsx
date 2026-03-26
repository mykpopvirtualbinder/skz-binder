"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { User, ShoppingBag, Truck, AlertCircle, RefreshCw, Mail } from "lucide-react";
import type { CSSProperties } from "react";
import Header from "../components/header";
import Footer from "../components/footer";
// --- ESTILOS CORPORATIVOS ---
const menuBtnStyle: CSSProperties = { background: "transparent", border: "none", padding: "10px 14px", textAlign: "left", borderRadius: 10, cursor: "pointer", fontWeight: 900, color: "#8C659C", fontSize: 14 };
const footerColumnTitle: CSSProperties = { fontSize: "13px", color: "#8C659C", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px", display: "block" };
const footerLinkStyle: CSSProperties = { fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px", display: "block" };

export default function MarketRulesPage() {
  const router = useRouter();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFDF5", display: "flex", flexDirection: "column", color: "#2F2740" }}>
      
      <Header />

      {/* CONTENIDO PRINCIPAL EDITORIAL */}
      <main style={{ width: "100%", maxWidth: "900px", margin: "80px auto", padding: "0 40px", flex: 1 }}>
        
        {/* TITULAR GIGANTE */}
        <div style={{ marginBottom: "60px" }}>
          <h1 className="tan-font" style={{ color: "#8C659C", fontSize: "64px", lineHeight: "0.8", margin: 0 }}>
            MARKET<br /><span style={{ fontSize: "40px" }}>RULES</span>
          </h1>
          <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "14px", marginTop: "20px", letterSpacing: "2px", textTransform: "uppercase" }}>
            Normas de convivencia para un mercado mágico
          </p>
        </div>

        {/* SECCIONES EDITORIALES */}
        <div style={{ display: "flex", flexDirection: "column", gap: "50px" }}>
          
          <section>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <ShoppingBag size={20}/> 1. COMPRAVENTA (WTS)
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444" }}>
              My Kpop Binder actúa únicamente como un intermediario tecnológico para facilitar el contacto entre fans. Es fundamental mantener la transparencia en cada trato.
            </p>
            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid #F3C7DA" }}>
                   <p style={{ fontWeight: 800, color: "#8C659C", margin: 0 }}>GESTIÓN DE PAGOS</p>
                   <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>Se realizan de forma externa o mediante pasarelas seguras. La plataforma puede aplicar comisiones técnicas por el servicio.</p>
                </div>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid #F3C7DA" }}>
                   <p style={{ fontWeight: 800, color: "#8C659C", margin: 0 }}>DESCRIPCIÓN FIEL</p>
                   <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>El vendedor debe indicar claramente el estado de la carta: daños, arañazos o marcas de fabricación.</p>
                </div>
            </div>
          </section>

          <section>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <RefreshCw size={20}/> 2. INTERCAMBIOS (WTT)
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444" }}>
              Los intercambios son acuerdos directos entre usuari@s. Para tu seguridad, recomendamos pedir siempre vídeos de comprobación (proofs) del estado de las photocards antes de cerrar el acuerdo.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Truck size={20}/> 3. ENVÍOS Y LOGÍSTICA
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444" }}>
              Tanto el empaquetado como el transporte físico son responsabilidad exclusiva de l@s usuari@s involucrad@s. My Kpop Binder no se hace responsable de pérdidas por parte de empresas de mensajería o discrepancias tras el envío.
            </p>
          </section>

          <section style={{ backgroundColor: "#FFF9FB", padding: "40px", borderRadius: "24px", border: "1px solid #F3DCE7" }}>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertCircle size={20}/> 4. SEGURIDAD
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444" }}>
              Cualquier intento de fraude, venta de falsificaciones o engaño resultará en la expulsión inmediata de la comunidad. Velamos por un entorno seguro para tod@s.
            </p>
          </section>
        </div>

        {/* FIRMA FINAL CON SOBRECITO */}
        <div style={{ marginTop: "80px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "13px", letterSpacing: "1px", marginBottom: "20px", textTransform: "uppercase" }}>
            ¿Dudas sobre una transacción?
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ height: "1px", flex: 1, backgroundColor: "#F3C7DA" }}></div>
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
            <div style={{ height: "1px", flex: 1, backgroundColor: "#F3C7DA" }}></div>
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