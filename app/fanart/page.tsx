"use client";

import React, { useState } from "react";
import Header from "../components/header";
import { 
  Heart, MessageCircle, Sparkles, Plus, Image as ImageIcon, Paintbrush
} from "lucide-react";
import type { CSSProperties } from "react";

// --- TIPOS ---
type FanArtPost = {
  id: string;
  artist: string;
  avatar: string;
  imageUrl: string;
  title: string;
  likes: number;
  comments: number;
};

// --- DATOS DE PRUEBA VISUALES ---
const MOCK_ART: FanArtPost[] = [
  {
    id: "1",
    artist: "@decotoploaders",
    avatar: "https://ui-avatars.com/api/?name=DT&background=8C659C&color=fff",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=500&auto=format&fit=crop", // Imagen abstracta estética de prueba
    title: "Toploader NewJeans Vibes 🐰",
    likes: 342,
    comments: 28,
  },
  {
    id: "2",
    artist: "@stay_crafts",
    avatar: "https://ui-avatars.com/api/?name=SC&background=ffd9e6&color=8C659C",
    imageUrl: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=500&auto=format&fit=crop",
    title: "Mi binder pintado a mano 🎨",
    likes: 512,
    comments: 45,
  },
  {
    id: "3",
    artist: "@moa.art",
    avatar: "https://ui-avatars.com/api/?name=MA&background=e2b86b&color=fff",
    imageUrl: "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=500&auto=format&fit=crop",
    title: "Llavero de resina TXT 💙",
    likes: 128,
    comments: 5,
  },
  {
    id: "4",
    artist: "@atina_crea",
    avatar: "https://ui-avatars.com/api/?name=AC&background=8db8ff&color=fff",
    imageUrl: "https://images.unsplash.com/photo-1506806732259-39c2d0268443?q=80&w=500&auto=format&fit=crop",
    title: "Polcos vintage de ATEEZ 🏴‍☠️",
    likes: 890,
    comments: 112,
  }
];

export default function FanArtPage() {
  const [artworks, setArtworks] = useState<FanArtPost[]>(MOCK_ART);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFDF5", display: "flex", flexDirection: "column", color: "#2F2740" }}>
      
      {/* CABECERA CORPORATIVA */}
      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "60px 40px" }}>
        
        {/* TÍTULO Y BOTÓN DE SUBIR */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px", borderBottom: "1px solid #F3C7DA", paddingBottom: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <Paintbrush size={28} color="#8C659C" />
              <h1 className="tan-font" style={{ fontSize: "42px", color: "#8C659C", margin: 0 }}>FAN ART</h1>
            </div>
            <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "16px", margin: 0 }}>
              Inspírate y comparte tus toploaders, binders y manualidades con la comunidad.
            </p>
          </div>
          
          <button style={{ background: "#8C659C", color: "white", border: "none", padding: "14px 28px", borderRadius: "99px", fontWeight: 900, fontSize: "15px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 10px 20px rgba(140, 101, 156, 0.2)" }}>
            <Plus size={20} strokeWidth={3} /> Subir mi Arte
          </button>
        </div>
        {/* GRID DE FOTOS (Estilo Pinterest/Instagram) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "30px", paddingBottom: "60px" }}>
          {artworks.map((art) => (
            <div key={art.id} className="art-card" style={{ backgroundColor: "white", borderRadius: "24px", overflow: "hidden", border: "1px solid #F3C7DA", display: "flex", flexDirection: "column", boxShadow: "0 5px 15px rgba(140, 101, 156, 0.05)", transition: "all 0.3s ease", cursor: "pointer" }}>
              
              {/* IMAGEN DEL FAN ART */}
              <div style={{ width: "100%", height: "280px", position: "relative", overflow: "hidden", backgroundColor: "#f0f0f0" }}>
                <img src={art.imageUrl} alt={art.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} className="art-img" />
              </div>

              {/* INFO Y BOTONES */}
              <div style={{ padding: "20px" }}>
                <h3 style={{ color: "#8C659C", fontWeight: 900, fontSize: "16px", margin: "0 0 15px 0", lineHeight: "1.3" }}>{art.title}</h3>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <img src={art.avatar} alt={art.artist} style={{ width: "30px", height: "30px", borderRadius: "50%", border: "2px solid #ffd9e6" }} />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#b17eac" }}>{art.artist}</span>
                  </div>
                  
                  <div style={{ display: "flex", gap: "10px", color: "#8C659C" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 800 }}>
                      <Heart size={16} /> {art.likes}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 800 }}>
                      <MessageCircle size={16} /> {art.comments}
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          ))}
        </div>
      </main>

      {/* FOOTER CORPORATIVO UNIFICADO */}
      <footer style={{ width: "100%", backgroundColor: "white", borderTop: "1px solid #F3DCE7", padding: "60px 80px 30px 80px", display: "flex", flexDirection: "column", gap: "40px", marginTop: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "40px", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <span className="tan-font" style={{ color: "#b17eac", fontSize: "24px", letterSpacing: "1px" }}>MY KPOP BINDER</span>
            <p style={{ fontSize: "14px", color: "#8C659C", fontWeight: 600, maxWidth: "250px", lineHeight: "1.5" }}>Tu rincón digital para organizar, comprar y tradear tus photocards favoritas de la forma más eficiente.</p>
            <span style={{ fontSize: "12px", color: "#b17eac", fontWeight: 700, marginTop: "10px" }}>© 2026 My Kpop Binder. Hecho por fans para fans.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "13px", color: "#8C659C", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px" }}>LEGAL</span>
            <a href="/terms" style={{ fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px" }}>Términos y Condiciones</a>
            <a href="/community-rules" style={{ fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px" }}>Normas de la Comunidad</a>
            <a href="/copyright" style={{ fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px" }}>Aviso de Copyright</a>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "13px", color: "#8C659C", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px" }}>MARKETPLACE</span>
            <a href="/market-rules" style={{ fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px" }}>Reglas del Mercado</a>
            <a href="/anti-scam" style={{ fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px" }}>Política Anti-Fraude</a>
            <a href="/privacy" style={{ fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px" }}>Privacidad y Cookies</a>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "13px", color: "#8C659C", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px" }}>SOPORTE</span>
            <a href="/faq" style={{ fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px" }}>Preguntas Frecuentes</a>
            <a href="/report" style={{ fontSize: "12px", color: "#b17eac", textDecoration: "underline", fontWeight: 900, marginBottom: "8px" }}>Reportar Abuso (DSA)</a>
            <a href="mailto:info@mykpopbinder.com" style={{ fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px" }}>info@mykpopbinder.com</a>
          </div>
        </div>
      </footer>

      {/* ESTILOS GLOBALES */}
      <style jsx global>{`
        @font-face { font-family: 'TanTangkiwood'; src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype'); }
        .tan-font { font-family: 'TanTangkiwood', sans-serif !important; }

        .art-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 30px rgba(140, 101, 156, 0.15) !important;
        }

        .art-img {
          transition: transform 0.4s ease;
        }

        .art-card:hover .art-img {
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}