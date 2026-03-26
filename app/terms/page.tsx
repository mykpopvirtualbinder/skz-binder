"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Scale, Copyright, ShieldAlert, AlertTriangle, FileText, Mail } from "lucide-react";
import type { CSSProperties } from "react";
import Header from "../components/header";
import Footer from "../components/footer";

// --- ESTILOS CORPORATIVOS UNIFICADOS ---
const menuBtnStyle: CSSProperties = { background: "transparent", border: "none", padding: "10px 14px", textAlign: "left", borderRadius: 10, cursor: "pointer", fontWeight: 900, color: "#8C659C", fontSize: 14 };
const footerColumnTitle: CSSProperties = { fontSize: "13px", color: "#8C659C", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px", display: "block" };
const footerLinkStyle: CSSProperties = { fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px", display: "block" };

export default function TermsAndConditions() {
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
            TERMS<br /><span style={{ fontSize: "40px" }}>& CONDITIONS</span>
          </h1>
          <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "14px", marginTop: "20px", letterSpacing: "2px", textTransform: "uppercase" }}>
            Marco legal y de convivencia para My Kpop Binder
          </p>
          <p style={{ color: "#8C659C", fontWeight: 800, fontSize: "13px", marginTop: "10px" }}>Última actualización: 17/3/2026</p>
        </div>

        {/* LISTADO LEGAL CHIC */}
        <div style={{ display: "flex", flexDirection: "column", gap: "50px" }}>
          
          <section>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <FileText size={20}/> 1. IDENTIFICACIÓN
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444" }}>
              My Kpop Binder es una plataforma dedicada a la gestión de colecciones y la interacción entre coleccionistas. Al acceder, tod@s l@s usuari@s aceptan el presente marco legal.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px" }}>2. USO Y RESPONSABILIDAD</h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444" }}>
              El registro requiere información veraz. L@s usuari@s son responsables de la seguridad de sus cuentas. El marketplace actúa como facilitador tecnológico; las transacciones físicas son responsabilidad de las partes involucradas.
            </p>
          </section>

          <section style={{ borderTop: "1px solid #F3DCE7", paddingTop: "40px" }}>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Scale size={20}/> 3. COMMUNITY GUIDELINES
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid #F3C7DA" }}>
                   <p style={{ fontWeight: 800, color: "#8C659C", margin: 0 }}>RESPETO</p>
                   <p style={{ fontSize: "14px", color: "#666" }}>Cero tolerancia al acoso o discriminación entre miembros.</p>
                </div>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid #F3C7DA" }}>
                   <p style={{ fontWeight: 800, color: "#8C659C", margin: 0 }}>MODERACIÓN</p>
                   <p style={{ fontSize: "14px", color: "#666" }}>Nos reservamos el derecho de eliminar contenido que vulnere la paz de la comunidad.</p>
                </div>
            </div>
          </section>

          <section>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Copyright size={20}/> 4. PROPIEDAD INTELECTUAL
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444" }}>
              Las imágenes de artistas pertenecen a sus respectivos propietarios. Su uso en la plataforma es estrictamente para identificación de artículos de coleccionismo bajo el principio de uso legítimo.
            </p>
          </section>

          <section style={{ backgroundColor: "#FFF9FB", padding: "40px", borderRadius: "24px", border: "1px solid #F3DCE7" }}>
            <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <ShieldAlert size={20}/> 5. POLÍTICA ANTI-FRAUDE
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#444" }}>
              Cualquier actividad fraudulenta (scams, falsificaciones, ocultación de daños) resultará en la expulsión definitiva. Trabajamos con el estándar DSA para reportes de abuso.
            </p>
          </section>
        </div>

        {/* CIERRE CON SOBRECITO */}
        <div style={{ marginTop: "80px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "13px", letterSpacing: "1px", marginBottom: "20px", textTransform: "uppercase" }}>
            ¿Tienes alguna consulta legal?
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