"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabase";
import Header from "./components/header"; 
import Footer from "./components/footer"; 
import { Sparkles, ArrowRight, Library, ShoppingBag, ShieldCheck, Heart, Search, Repeat } from "lucide-react";
import type { CSSProperties } from "react";

const featureCardStyle: CSSProperties = {
  backgroundColor: "white", padding: "40px 30px", borderRadius: "32px", border: "1px solid #F3C7DA", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "20px", transition: "transform 0.3s ease, box-shadow 0.3s ease", boxShadow: "0 10px 30px rgba(140, 101, 156, 0.05)"
};
const footerColumnTitle: CSSProperties = { fontSize: "13px", color: "#8C659C", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px", display: "block" };
const footerLinkStyle: CSSProperties = { fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px", display: "block" };

export default function LandingPage() {
  // Añade esto dentro de export default function LandingPage() {
const [isMobile, setIsMobile] = React.useState(false);

React.useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 768);
  checkMobile(); // Comprobar al cargar
  window.addEventListener("resize", checkMobile);
  return () => window.removeEventListener("resize", checkMobile);
}, []);
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          if (!error) {
            window.history.replaceState({}, document.title, "/");
            router.push("/binder"); 
          }
        });
      }
    }
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFDF5", display: "flex", flexDirection: "column", color: "#2F2740", overflowX: "hidden" }}>
      <Header />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
        
        {/* HERO */}
       <section style={{ width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "80px 20px", display: "flex", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "40px", minHeight: "75vh" }}>
        
          <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: "30px", zIndex: 10 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "#ffd9e6", color: "#8C659C", padding: "10px 20px", borderRadius: "99px", fontWeight: 900, fontSize: "14px", width: "fit-content", border: "1px solid #F3C7DA" }}>
              <Sparkles size={18} /> La revolución del coleccionismo
            </div>
            <h1 className="tan-font" style={{ fontSize: "40px", color: "#8C659C", lineHeight: "0.85", margin: 0, letterSpacing: "2px" }}>
              ORGANIZA.<br/><span style={{ color: "#e2b86b", fontSize: "clamp(40px, 8vw, 95px)" }}>TRADEA.</span><br/>COMPLETA.
            </h1>
            <p style={{ fontSize: "18px", color: "#b17eac", fontWeight: 600, lineHeight: "1.6", maxWidth: "500px", margin: 0 }}>
              Únete a la plataforma definitiva para K-Pop stans. Gestiona tus binders digitales, sube tu wishlist y encuentra el intercambio perfecto sin miedo a scams.
            </p>
            <div style={{ display: "flex", gap: "20px", marginTop: "10px", flexWrap: "wrap" }}>
              <button onClick={() => router.push('/register')} style={{ background: "#8C659C", color: "white", border: "none", padding: "18px 40px", borderRadius: "99px", fontWeight: 900, fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", boxShadow: "0 15px 30px rgba(140, 101, 156, 0.25)" }}>
                Crear mi Binder <ArrowRight size={20} strokeWidth={3} />
              </button>
              <button onClick={() => router.push('/market')} style={{ background: "#FFFDF5", color: "#8C659C", border: "2px solid #8C659C", padding: "18px 40px", borderRadius: "99px", fontWeight: 900, fontSize: "16px", cursor: "pointer" }}>
                Explorar Market
              </button>
            </div>
          </div>
        {/* Contenedor de las cartas */}
<div style={{ 
  flex: 1, 
  position: "relative", 
  height: isMobile ? "350px" : "550px", // Más bajito en móvil para que no empuje el resto
  display: "flex", 
  justifyContent: "center", 
  alignItems: "center",
  marginTop: isMobile ? "40px" : "0px"
}}>
  {/* El brillo rosa de fondo */}
  <div style={{ 
    position: "absolute", 
    width: isMobile ? "250px" : "450px", 
    height: isMobile ? "250px" : "450px", 
    background: "radial-gradient(circle, #ffd9e6 0%, rgba(255,217,230,0) 70%)", 
    zIndex: 1
  }}></div>

  {/* Carta 1: WISHLIST */}
  <div className="float-anim-1" style={{ 
    position: "absolute", 
    zIndex: 2, 
    transform: isMobile 
      ? "rotate(-8deg) translateX(-40px)" // Menos desplazamiento para que no se salga
      : "rotate(-12deg) translateX(-60px) translateY(20px)" 
  }}>
    <div style={{ 
      width: isMobile ? "130px" : "220px", // Escala reducida en móvil
      height: isMobile ? "180px" : "310px", 
      backgroundColor: "#e2b86b", 
      borderRadius: "18px", 
      border: isMobile ? "3px solid white" : "6px solid white",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white", padding: "10px", textAlign: "center" 
    }}>
      <Search size={isMobile ? 24 : 40} strokeWidth={2.5} />
      <span className="tan-font" style={{ fontSize: isMobile ? "16px" : "28px", marginTop: "10px" }}>WISHLIST</span>
    </div>
  </div>

  {/* Carta 2: WTT Match */}
  <div className="float-anim-2" style={{ 
    position: "absolute", 
    zIndex: 3, 
    transform: isMobile 
      ? "rotate(6deg) translateX(50px)" 
      : "rotate(8deg) translateX(70px) translateY(-30px)" 
  }}>
    <div style={{ 
      width: isMobile ? "140px" : "240px", 
      height: isMobile ? "200px" : "340px", 
      backgroundColor: "#8C659C", 
      borderRadius: "18px", 
      border: isMobile ? "3px solid white" : "6px solid white", 
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white", padding: "10px", textAlign: "center" 
    }}>
      <Repeat size={isMobile ? 28 : 48} strokeWidth={2.5} />
      <span className="tan-font" style={{ fontSize: isMobile ? "18px" : "32px", marginTop: "10px" }}>WTT</span>
    </div>
  </div>
</div>
        </section>

        {/* FEATURES */}
        <section style={{ width: "100%", backgroundColor: "white", borderTop: "1px solid #F3DCE7", borderBottom: "1px solid #F3DCE7", padding: "100px 40px" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "70px" }}>
              <h2 className="tan-font" style={{ color: "#8C659C", fontSize: "54px", margin: "0 0 15px 0" }}>TODO EN UN SOLO LUGAR</h2>
              <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "16px", maxWidth: "600px", margin: "0 auto" }}>Olvídate de las hojas de cálculo interminables y los hilos caóticos en redes sociales. Diseñado por y para coleccionistas.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "30px" }}>
              <div className="feature-hover" style={featureCardStyle}>
                <div style={{ background: "#ffd9e6", padding: "18px", borderRadius: "20px", color: "#8C659C" }}><Library size={32} strokeWidth={2.5}/></div>
                <h3 style={{ color: "#8C659C", fontWeight: 900, fontSize: "22px", margin: 0 }}>Binder Digital Interactivo</h3>
                <p style={{ color: "#666", lineHeight: "1.6", fontWeight: 500, margin: 0 }}>Arrastra, suelta y organiza tus photocards por grupos, álbumes y eras. Lleva tu colección en el bolsillo a todas partes.</p>
              </div>
              <div className="feature-hover" style={featureCardStyle}>
                <div style={{ background: "#fcf0d9", padding: "18px", borderRadius: "20px", color: "#e2b86b" }}><ShoppingBag size={32} strokeWidth={2.5}/></div>
                <h3 style={{ color: "#e2b86b", fontWeight: 900, fontSize: "22px", margin: 0 }}>Marketplace Global</h3>
                <p style={{ color: "#666", lineHeight: "1.6", fontWeight: 500, margin: 0 }}>Compra (WTS) o intercambia (WTT) con usuarios de todo el mundo. Nuestro algoritmo cruza tus repetidas con tu wishlist mágicamente.</p>
              </div>
              <div className="feature-hover" style={featureCardStyle}>
                <div style={{ background: "#eaf2ff", padding: "18px", borderRadius: "20px", color: "#8db8ff" }}><ShieldCheck size={32} strokeWidth={2.5}/></div>
                <h3 style={{ color: "#8db8ff", fontWeight: 900, fontSize: "22px", margin: 0 }}>Protección Anti-Scam</h3>
                <p style={{ color: "#666", lineHeight: "1.6", fontWeight: 500, margin: 0 }}>Sistema de verificación de usuarios, reportes respaldados por la DSA y un muro de confianza para tradear con total tranquilidad.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CALL TO ACTION */}
        <section style={{ width: "100%", padding: "120px 40px", display: "flex", justifyContent: "center", alignItems: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #8C659C 0%, #b17eac 100%)", zIndex: 0 }}></div>
          <div style={{ position: "absolute", top: "-50%", left: "-10%", width: "800px", height: "800px", background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 60%)", borderRadius: "50%", zIndex: 1 }}></div>
          <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: "800px" }}>
            <h2 className="tan-font" style={{ color: "white", fontSize: "60px", margin: "0 0 20px 0", lineHeight: 1 }}>¿LISTA PARA ORDENAR TU COLECCIÓN?</h2>
            <p style={{ color: "#fcedf4", fontSize: "18px", fontWeight: 600, marginBottom: "40px", lineHeight: "1.6" }}>
              Crea tu cuenta gratis en menos de 1 minuto y empieza a añadir tus primeras photocards al binder. El K-pop está a punto de ser mucho más organizado.
            </p>
            <button onClick={() => router.push('/register')} style={{ background: "white", color: "#8C659C", border: "none", padding: "20px 50px", borderRadius: "99px", fontWeight: 900, fontSize: "18px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "12px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
              Comenzar Ahora <Heart size={20} fill="#8C659C" />
            </button>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer style={{ width: "100%", backgroundColor: "white", borderTop: "1px solid #F3DCE7", padding: "40px 20px", display: "flex", flexDirection: "column", gap: "40px", marginTop: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "40px", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <span className="tan-font" style={{ color: "#b17eac", fontSize: "24px", letterSpacing: "1px" }}>MY KPOP BINDER</span>
            <p style={{ fontSize: "14px", color: "#8C659C", fontWeight: 600, maxWidth: "250px", lineHeight: "1.5" }}>Tu rincón digital para organizar, comprar y tradear tus photocards favoritas de la forma más eficiente.</p>
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

        @keyframes float1 {
          0% { transform: rotate(-12deg) translateX(-60px) translateY(20px); }
          50% { transform: rotate(-10deg) translateX(-60px) translateY(0px); }
          100% { transform: rotate(-12deg) translateX(-60px) translateY(20px); }
        }

        @keyframes float2 {
          0% { transform: rotate(8deg) translateX(70px) translateY(-30px); }
          50% { transform: rotate(10deg) translateX(70px) translateY(-10px); }
          100% { transform: rotate(8deg) translateX(70px) translateY(-30px); }
        }

        .float-anim-1 { animation: float1 6s ease-in-out infinite; }
        .float-anim-2 { animation: float2 5s ease-in-out infinite; animation-delay: 1s; }

        .feature-hover:hover {
          transform: translateY(-10px);
          box-shadow: 0 20px 40px rgba(140, 101, 156, 0.1) !important;
        }
          @media (max-width: 768px) {
  /* Forzar el título a un tamaño razonable */
  .tan-font {
    font-size: 42px !important;
    line-height: 1.1 !important;
  }
  
  /* Ajustar el Header para que no explote */
  header {
    padding: 10px !important;
    flex-direction: column !important;
  }
  
  header span.tan-font {
    font-size: 16px !important;
    padding: 5px !important;
  }

  /* Evitar que las cartas se salgan */
  .float-anim-1, .float-anim-2 {
    transform: scale(0.6) translateX(0) !important;
    position: relative !important;
    display: inline-block !important;
    margin: 10px !important;
  }
}
      `}</style>
    </div>
  );
}