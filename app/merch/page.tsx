"use client";
import Header from "../components/header";
import React, { useState } from "react";
import { 
  Search, 
  Library, 
  Trophy, 
  CheckCircle2, 
  Bookmark, 
  User, 
  Star, 
  Filter,
  Info,
  Sparkles
} from "lucide-react";




// --- TIPOS ---
type MerchItem = {
  id: string;
  name: string;
  category: string;
  group: string;
  imageUrl: string;
  status: "collected" | "wishlist" | "none";
  rarity: "Común" | "Limitado" | "Evento" | "Tour Exclusive";
};

// --- DATOS DE EJEMPLO (Estilo Binder) ---
const INITIAL_MERCH: MerchItem[] = [
  { id: "m1", name: "Skzoo Plushie (Wolf Chan)", category: "Peluches", group: "Stray Kids", imageUrl: "https://images.unsplash.com/photo-1559449182-ad6df3087771?q=80&w=400&auto=format&fit=crop", status: "collected", rarity: "Común" },
  { id: "m2", name: "Lightstick Oficial Ver. 2", category: "Lightsticks", group: "ATEEZ", imageUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&auto=format&fit=crop", status: "wishlist", rarity: "Común" },
  { id: "m3", name: "Sudadera World Tour 'Dominate'", category: "Ropa", group: "Stray Kids", imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=400&auto=format&fit=crop", status: "none", rarity: "Tour Exclusive" },
  { id: "m4", name: "Llavero Acrílico Magic Island", category: "Accesorios", group: "TXT", imageUrl: "https://images.unsplash.com/photo-1610418338520-410714777507?q=80&w=400&auto=format&fit=crop", status: "collected", rarity: "Evento" },
  { id: "m5", name: "Tote Bag Logo Rosa", category: "Accesorios", group: "TWICE", imageUrl: "https://images.unsplash.com/photo-1544816153-097307343015?q=80&w=400&auto=format&fit=crop", status: "none", rarity: "Común" },
  { id: "m6", name: "Lightstick Special Edition", category: "Lightsticks", group: "Stray Kids", imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop", status: "none", rarity: "Limitado" }
];

export default function MerchPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [merchList, setMerchList] = useState<MerchItem[]>(INITIAL_MERCH);

  const categories = ["Todos", "Peluches", "Lightsticks", "Ropa", "Accesorios"];

  const toggleStatus = (id: string, newStatus: "collected" | "wishlist" | "none") => {
    setMerchList(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, status: item.status === newStatus ? "none" : newStatus };
      }
      return item;
    }));
  };

  const filteredMerch = merchList.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.group.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "Todos" || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const collectedCount = merchList.filter(i => i.status === 'collected').length;
  const progressPercent = Math.round((collectedCount / merchList.length) * 100);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFDF5", display: "flex", flexDirection: "column", color: "#2F2740" }}>
      
      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}>
        
        {/* TÍTULO SECCIÓN (Estilo Fan Zone) */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "25px" }}>
          <Sparkles size={24} color="#8C659C" />
          <h1 className="tan-font" style={{ fontSize: "32px", color: "#8C659C", margin: 0 }}>MERCH BINDER</h1>
        </div>

        {/* DASHBOARD DE PROGRESO */}
        <section style={{ backgroundColor: "white", padding: "25px 35px", borderRadius: "24px", border: "1px solid #F3C7DA", marginBottom: "40px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 10px 20px rgba(140, 101, 156, 0.05)" }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "16px", margin: "0 0 10px 0" }}>
              Has completado el <span style={{ color: "#e2b86b", fontSize: "20px" }}>{progressPercent}%</span> de tu colección oficial.
            </p>
            <div style={{ width: "100%", maxWidth: "400px", height: "10px", backgroundColor: "#f4ebf8", borderRadius: "99px", overflow: "hidden" }}>
              <div style={{ width: `${progressPercent}%`, height: "100%", backgroundColor: "#8C659C", borderRadius: "99px", transition: "width 0.5s ease" }} />
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "42px", fontWeight: 900, color: "#8C659C", lineHeight: 1 }}>{collectedCount}/{merchList.length}</div>
            <span style={{ fontSize: "12px", fontWeight: 900, color: "#b17eac", textTransform: "uppercase" }}>Items conseguidos</span>
          </div>
        </section>

        {/* FILTROS Y BÚSQUEDA */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "5px" }}>
            {categories.map(cat => (
              <button 
                key={cat} 
                onClick={() => setActiveCategory(cat)}
                style={{ 
                  padding: "10px 20px", borderRadius: "99px", border: "1px solid #F3C7DA", 
                  backgroundColor: activeCategory === cat ? "#8C659C" : "white", 
                  color: activeCategory === cat ? "white" : "#8C659C", 
                  fontWeight: 800, cursor: "pointer", transition: "all 0.2s"
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ position: "relative" }}>
            <Search size={18} color="#8C659C" style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)" }} />
            <input 
              type="text" 
              placeholder="Buscar item..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "12px 20px 12px 40px", borderRadius: "99px", border: "1px solid #F3C7DA", outline: "none", fontWeight: 700, width: "250px", backgroundColor: "white" }} 
            />
          </div>
        </div>

        {/* GRID DE ITEMS (Estilo Biblioteca/Binder) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "25px", paddingBottom: "80px" }}>
          {filteredMerch.map(item => (
            <div key={item.id} style={{ 
              backgroundColor: "white", borderRadius: "24px", overflow: "hidden", 
              border: "1px solid #F3C7DA", display: "flex", flexDirection: "column", 
              boxShadow: "0 5px 15px rgba(140, 101, 156, 0.04)", transition: "all 0.3s ease",
              opacity: item.status === 'none' ? 0.75 : 1,
              filter: item.status === 'none' ? 'grayscale(0.3)' : 'none'
            }}>
              <div style={{ width: "100%", height: "240px", position: "relative" }}>
                <img src={item.imageUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {item.status === 'collected' && (
                  <div style={{ position: "absolute", inset: 0, border: "6px solid #8C659C", borderRadius: "24px", pointerEvents: "none" }} />
                )}
                <div style={{ position: "absolute", top: "12px", left: "12px", background: "white", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 900, color: "#8C659C" }}>
                  {item.group}
                </div>
              </div>

              <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column", gap: "15px" }}>
                <h3 style={{ color: "#2F2740", fontWeight: 900, fontSize: "16px", margin: 0, lineHeight: "1.2" }}>{item.name}</h3>
                
                <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                  <button 
                    onClick={() => toggleStatus(item.id, 'collected')}
                    style={{ 
                      flex: 1, padding: "10px", borderRadius: "12px", border: "none", 
                      backgroundColor: item.status === 'collected' ? "#8C659C" : "#f4ebf8", 
                      color: item.status === 'collected' ? "white" : "#8C659C", 
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", fontWeight: 800, fontSize: "13px"
                    }}
                  >
                    <CheckCircle2 size={16} /> {item.status === 'collected' ? 'Tengo' : 'Lo tengo'}
                  </button>
                  <button 
                    onClick={() => toggleStatus(item.id, 'wishlist')}
                    style={{ 
                      padding: "10px", borderRadius: "12px", border: "none", 
                      backgroundColor: item.status === 'wishlist' ? "#e2b86b" : "#fdf4e6", 
                      color: item.status === 'wishlist' ? "white" : "#e2b86b", 
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                  >
                    <Bookmark size={18} fill={item.status === 'wishlist' ? "white" : "none"} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* FOOTER CORPORATIVO (4 COLUMNAS - Basado en tu Fan Zone) */}
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

      {/* ESTILOS GLOBALES - Corregido para evitar advertencias de React */}
      <style dangerouslySetInnerHTML={{ __html: `
        @font-face { font-family: 'TanTangkiwood'; src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype'); }
        .tan-font { font-family: 'TanTangkiwood', sans-serif !important; }
      ` }} />
    </div>
  );
}