"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { User, AlertTriangle, ShieldCheck, Mail, FileWarning } from "lucide-react";
import type { CSSProperties } from "react";
import Header from "../components/header";
import Footer from "../components/footer";
// --- CONSTANTES DE ESTILO ---
const menuBtnStyle: CSSProperties = { background: "transparent", border: "none", padding: "10px 14px", textAlign: "left", borderRadius: 10, cursor: "pointer", fontWeight: 900, color: "#8C659C", fontSize: 14 };
const footerColumnTitle: CSSProperties = { fontSize: "13px", color: "#8C659C", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px", display: "block" };
const footerLinkStyle: CSSProperties = { fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px", display: "block" };

export default function ReportPage() {
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
            REPORTING<br /><span style={{ fontSize: "40px" }}>& COMPLIANCE</span>
          </h1>
          <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "14px", marginTop: "20px", letterSpacing: "2px", textTransform: "uppercase" }}>
            Canal oficial de denuncias bajo el reglamento dsa
          </p>
          <p style={{ color: "#8C659C", fontWeight: 800, fontSize: "13px", marginTop: "10px" }}>Última actualización: 17/3/2026</p>
        </div>

        {/* SECCIONES */}
        <div style={{ display: "flex", flexDirection: "column", gap: "50px" }}>
          
          <section>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <ShieldCheck size={20}/> 1. REGLAMENTO DE SERVICIOS DIGITALES
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444" }}>
              My Kpop Binder cumple con el Reglamento de Servicios Digitales (DSA) de la Unión Europea. Adoptamos medidas proactivas para prevenir la difusión de contenido ilegal y permitir a tod@s l@s usuari@s reportar infracciones de forma sencilla y transparente.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <FileWarning size={20}/> 2. ¿QUÉ PUEDES REPORTAR?
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444", marginBottom: "20px" }}>
              Cualquier actividad que ponga en riesgo la seguridad de la comunidad o infrinja la ley puede ser notificada:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid #F3C7DA" }}>
                   <p style={{ fontWeight: 800, color: "#8C659C", margin: 0 }}>FRAUDE EN EL MARKET</p>
                   <p style={{ fontSize: "14px", color: "#666" }}>Intentos de estafa, engaños en pagos o artículos nunca enviados.</p>
                </div>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid #F3C7DA" }}>
                   <p style={{ fontWeight: 800, color: "#8C659C", margin: 0 }}>CONTENIDO ILEGAL</p>
                   <p style={{ fontSize: "14px", color: "#666" }}>Material ofensivo, discriminatorio o que vulnere la propiedad intelectual.</p>
                </div>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid #F3C7DA" }}>
                   <p style={{ fontWeight: 800, color: "#8C659C", margin: 0 }}>FALSIFICACIONES</p>
                   <p style={{ fontSize: "14px", color: "#666" }}>Suplantación de identidad o venta de artículos fanmade como oficiales.</p>
                </div>
            </div>
          </section>

          <section style={{ backgroundColor: "#FFF9FB", padding: "40px", borderRadius: "24px", border: "1px solid #F3DCE7" }}>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              3. REVISIÓN Y SANCIONES
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444" }}>
              Tras recibir un reporte, nuestro equipo evalúa el caso de forma humana. Dependiendo de la gravedad, las acciones pueden ir desde una advertencia o eliminación de contenido hasta la <strong>suspensión permanente</strong> de la cuenta por fraude o reincidencia.
            </p>
          </section>
        </div>

        {/* CIERRE CON SOBRECITO */}
        <div style={{ marginTop: "80px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "13px", letterSpacing: "1px", marginBottom: "20px", textTransform: "uppercase" }}>
            ¿Tienes alguna otra duda o reporte?
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