"use client";

import React, { useState } from "react";
import Header from "../components/header";
import { 
  Repeat, DollarSign, Search, Filter, Sparkles, 
  ArrowRightLeft, Tag, Heart, MessageCircle, AlertCircle
} from "lucide-react";
import type { CSSProperties } from "react";

// --- TIPOS ---
type MarketAd = {
  id: string;
  type: "wtt" | "wts";
  user: string;
  handle: string;
  avatar: string;
  pcImage: string;
  pcName: string;
  group: string;
  price?: number; // Para WTS
  lf?: string;    // Looking For (Para WTT)
  time: string;
  isWishlistMatch?: boolean; // Para avisar al usuario "¡Esto está en tu wishlist!"
};

// --- DATOS DE PRUEBA (Anuncios automáticos del sistema) ---
const MOCK_MARKET: MarketAd[] = [
  {
    id: "1", type: "wtt", user: "HyunLover", handle: "@hyun_stay",
    avatar: "https://ui-avatars.com/api/?name=HL&background=8C659C&color=fff",
    pcImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop", 
    pcName: "Hyunjin Maxident POB", group: "Stray Kids",
    lf: "Cualquier equivalente de Lee Know o Felix 🥺", time: "Hace 5 min",
    isWishlistMatch: true
  },
  {
    id: "2", type: "wts", user: "KpopStoreES", handle: "@kpopstore_es",
    avatar: "https://ui-avatars.com/api/?name=KS&background=e2b86b&color=fff",
    pcImage: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=200&auto=format&fit=crop",
    pcName: "Seonghwa Outlaw Selfie", group: "ATEEZ",
    price: 12, time: "Hace 12 min"
  },
  {
    id: "3", type: "wtt", user: "MoaForever", handle: "@txt_moa",
    avatar: "https://ui-avatars.com/api/?name=MF&background=ffd9e6&color=8C659C",
    pcImage: "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=200&auto=format&fit=crop",
    pcName: "Yeonjun Blue Hour R", group: "TXT",
    lf: "Soobin Blue Hour R o AR", time: "Hace 1 hora"
  },
  {
    id: "4", type: "wts", user: "SellMyPCs", handle: "@sellmypcs",
    avatar: "https://ui-avatars.com/api/?name=SM&background=8db8ff&color=fff",
    pcImage: "https://images.unsplash.com/photo-1506806732259-39c2d0268443?q=80&w=200&auto=format&fit=crop",
    pcName: "Nayeon Formula of Love", group: "TWICE",
    price: 8, time: "Hace 2 horas"
  }
];

export default function MarketPage() {
  const [tab, setTab] = useState<"wtt" | "wts">("wtt");
  const [search, setSearch] = useState("");

  const filteredAds = MOCK_MARKET.filter(ad => ad.type === tab && ad.group.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFDF5", display: "flex", flexDirection: "column", color: "#2F2740" }}>
      
      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: "1000px", margin: "0 auto", padding: "60px 40px" }}>
        
        {/* TÍTULO Y BUSCADOR */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <Sparkles size={28} color="#8C659C" />
              <h1 className="tan-font" style={{ fontSize: "42px", color: "#8C659C", margin: 0 }}>MARKETPLACE</h1>
            </div>
            <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "16px", margin: 0 }}>
              Encuentra tu missing PC. Nuestro sistema te avisa si alguien tiene tu wishlist.
            </p>
          </div>

          <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={18} color="#8C659C" style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type="text" 
                placeholder="Buscar grupo o idol..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "12px 20px 12px 40px", borderRadius: "99px", border: "1px solid #F3C7DA", outline: "none", fontWeight: 700, width: "250px" }} 
              />
            </div>
            <button style={{ background: "white", border: "1px solid #F3C7DA", padding: "12px", borderRadius: "50%", cursor: "pointer", color: "#8C659C" }}><Filter size={20} /></button>
          </div>
        </div>

        {/* PESTAÑAS WTT / WTS */}
        <div style={{ display: "flex", gap: "30px", marginBottom: "40px", borderBottom: "2px solid #F3DCE7", paddingBottom: "15px" }}>
          <button 
            onClick={() => setTab("wtt")}
            style={{ background: "none", border: "none", fontSize: "18px", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", color: tab === "wtt" ? "#8C659C" : "#d1bdcc", transition: "color 0.2s" }}
          >
            <ArrowRightLeft size={20} /> FOR TRADE (WTT)
          </button>
          <button 
            onClick={() => setTab("wts")}
            style={{ background: "none", border: "none", fontSize: "18px", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", color: tab === "wts" ? "#e2b86b" : "#d1bdcc", transition: "color 0.2s" }}
          >
            <Tag size={20} /> FOR SALE (WTS)
          </button>
        </div>
        {/* GRID DE ANUNCIOS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "25px", paddingBottom: "60px" }}>
          {filteredAds.length > 0 ? filteredAds.map(ad => (
            <div key={ad.id} className="ad-card" style={{ backgroundColor: "white", borderRadius: "24px", overflow: "hidden", border: "1px solid #F3C7DA", display: "flex", flexDirection: "column", boxShadow: "0 5px 15px rgba(140, 101, 156, 0.05)", transition: "all 0.3s ease", cursor: "pointer", position: "relative" }}>
              
              {/* BADGE DE WISHLIST MATCH (¡La magia del Market!) */}
              {ad.isWishlistMatch && (
                <div style={{ position: "absolute", top: "15px", left: "15px", backgroundColor: "#e2b86b", color: "white", padding: "6px 12px", borderRadius: "99px", fontSize: "12px", fontWeight: 900, display: "flex", alignItems: "center", gap: "5px", zIndex: 10, boxShadow: "0 4px 10px rgba(226, 184, 107, 0.4)" }}>
                  <AlertCircle size={14} strokeWidth={3} /> ¡EN TU WISHLIST!
                </div>
              )}

              {/* FOTO DE LA PC */}
              <div style={{ width: "100%", height: "240px", backgroundColor: "#f0f0f0", position: "relative" }}>
                <img src={ad.pcImage} alt={ad.pcName} style={{ width: "100%", height: "100%", objectFit: "cover" }} className="ad-img" />
                <div style={{ position: "absolute", bottom: "10px", right: "10px", backgroundColor: "rgba(255,255,255,0.95)", padding: "4px 12px", borderRadius: "99px", fontSize: "12px", fontWeight: 900, color: "#8C659C", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
                  {ad.group}
                </div>
              </div>

              {/* INFO DEL ANUNCIO */}
              <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "15px", flex: 1 }}>
                <h3 style={{ color: "#2F2740", fontWeight: 900, fontSize: "18px", margin: 0, lineHeight: "1.2" }}>{ad.pcName}</h3>
                
                {/* ZONA DE TRADE / VENTA */}
                <div style={{ backgroundColor: ad.type === 'wtt' ? "#f4ebf8" : "#fdf4e6", padding: "12px", borderRadius: "12px", border: `1px dashed ${ad.type === 'wtt' ? "#8C659C" : "#e2b86b"}` }}>
                  {ad.type === "wtt" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 900, color: "#8C659C", textTransform: "uppercase" }}>Looking For (LF):</span>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#444" }}>{ad.lf}</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: 900, color: "#e2b86b", textTransform: "uppercase" }}>Precio de Venta:</span>
                      <span style={{ fontSize: "20px", fontWeight: 900, color: "#e2b86b" }}>{ad.price}€</span>
                    </div>
                  )}
                </div>

                {/* USUARIO */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "10px", borderTop: "1px dashed #F3C7DA" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img src={ad.avatar} alt={ad.user} style={{ width: "36px", height: "36px", borderRadius: "50%", border: "2px solid #F3C7DA" }} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "14px", fontWeight: 800, color: "#8C659C", lineHeight: 1 }}>{ad.user}</span>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#b17eac", marginTop: "2px" }}>{ad.time}</span>
                    </div>
                  </div>
                  <button style={{ background: "#8C659C", color: "white", border: "none", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "transform 0.2s", boxShadow: "0 5px 15px rgba(140, 101, 156, 0.3)" }} className="chat-btn">
                    <MessageCircle size={18} />
                  </button>
                </div>
              </div>

            </div>
          )) : (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px", color: "#b17eac", backgroundColor: "white", borderRadius: "24px", border: "1px dashed #F3C7DA" }}>
              <Search size={48} style={{ marginBottom: "15px", opacity: 0.5 }} />
              <h3 style={{ fontSize: "20px", fontWeight: 900, color: "#8C659C" }}>No hay anuncios para tu búsqueda.</h3>
              <p style={{ fontWeight: 600 }}>¡Sé la primera en publicar uno marcando tus photocards en el Binder!</p>
            </div>
          )}
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

        .ad-card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(140, 101, 156, 0.15) !important; }
        .chat-btn:hover { transform: scale(1.1); background-color: #7a5888 !important; }
        .ad-img { transition: transform 0.3s ease; }
        .ad-card:hover .ad-img { transform: scale(1.05); }
      `}</style>

    </div>
  );
}