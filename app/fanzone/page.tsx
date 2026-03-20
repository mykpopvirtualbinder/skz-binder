"use client";

import React, { useState } from "react";
import Header from "../components/header";
import { 
  Heart, MessageCircle, Repeat2, Share, 
  Image as ImageIcon, Sparkles, MoreHorizontal 
} from "lucide-react";
import type { CSSProperties } from "react";

// --- TIPOS ---
type Post = {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  content: string;
  likes: number;
  comments: number;
  reposts: number;
  time: string;
  isLiked?: boolean;
};

// --- DATOS DE PRUEBA (Luego vendrán de Supabase) ---
const MOCK_POSTS: Post[] = [
  {
    id: "1",
    author: "Ch-An-a",
    handle: "@chana_stays",
    avatar: "https://ui-avatars.com/api/?name=Ch&background=8C659C&color=fff",
    content: "¡Chicas! Acabo de abrir mi álbum de ATEEZ y me ha tocado la POB de Seonghwa que llevaba MESES buscando. 😭✨ ¡Estoy temblando! ¿A alguien más le ha sonreído la suerte hoy?",
    likes: 124,
    comments: 12,
    reposts: 5,
    time: "Hace 10 min",
    isLiked: true,
  },
  {
    id: "2",
    author: "FelixTheCat",
    handle: "@felix_sunshine",
    avatar: "https://ui-avatars.com/api/?name=FLX&background=F3C7DA&color=8C659C",
    content: "Recordatorio amistoso de ponerle doble sleeve a vuestras photocards favoritas. El otro día casi se me estropea una de Hyunjin por llevarla en la funda del móvil sin proteger bien. 💔",
    likes: 89,
    comments: 4,
    reposts: 22,
    time: "Hace 1 hora",
  }
];

export default function FanZonePage() {
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
  const [newPost, setNewPost] = useState("");

  const handlePost = () => {
    if (!newPost.trim()) return;
    const post: Post = {
      id: Date.now().toString(),
      author: "Mi Perfil", // Esto lo cogeremos de useGlobal() luego
      handle: "@mi_usuario",
      avatar: "https://ui-avatars.com/api/?name=Me&background=e2b86b&color=fff",
      content: newPost,
      likes: 0,
      comments: 0,
      reposts: 0,
      time: "Ahora mismo",
    };
    setPosts([post, ...posts]);
    setNewPost("");
  };

  const toggleLike = (id: string) => {
    setPosts(posts.map(p => {
      if (p.id === id) {
        return { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 };
      }
      return p;
    }));
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFDF5", display: "flex", flexDirection: "column", color: "#2F2740" }}>
      
      {/* CABECERA CORPORATIVA UNIFICADA */}
      <Header />

      <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "40px 20px" }}>
        
        {/* CONTENEDOR CENTRAL (Estilo Feed de Twitter) */}
        <div style={{ width: "100%", maxWidth: "650px", display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <Sparkles size={24} color="#8C659C" />
            <h1 className="tan-font" style={{ fontSize: "32px", color: "#8C659C", margin: 0 }}>FAN ZONE</h1>
          </div>

          {/* CAJA DE CREAR PUBLICACIÓN */}
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "24px", border: "1px solid #F3C7DA", boxShadow: "0 10px 20px rgba(140, 101, 156, 0.05)" }}>
            <div style={{ display: "flex", gap: "15px" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "#ffd9e6", flexShrink: 0, overflow: "hidden" }}>
                <img src="https://ui-avatars.com/api/?name=Me&background=e2b86b&color=fff" alt="Me" style={{ width: "100%", height: "100%" }} />
              </div>
              <div style={{ flex: 1 }}>
                <textarea 
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="¿Qué photocard has conseguido hoy? ¡Cuéntaselo al fandom!" 
                  rows={3} 
                  style={{ width: "100%", padding: "10px", border: "none", backgroundColor: "transparent", outline: "none", resize: "none", fontSize: "16px", fontWeight: 500, color: "#444" }} 
                />
                <div style={{ borderTop: "1px solid #F3DCE7", paddingTop: "15px", marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button style={{ background: "none", border: "none", color: "#8C659C", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", fontWeight: 700 }}>
                    <ImageIcon size={20} /> <span style={{ fontSize: "14px" }}>Foto</span>
                  </button>
                  <button 
                    onClick={handlePost}
                    disabled={!newPost.trim()}
                    style={{ background: newPost.trim() ? "#8C659C" : "#d1bdcc", color: "white", border: "none", padding: "10px 24px", borderRadius: "99px", fontWeight: 900, cursor: newPost.trim() ? "pointer" : "not-allowed", transition: "all 0.2s" }}
                  >
                    Publicar
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* MURO DE PUBLICACIONES */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "60px" }}>
            {posts.map((post) => (
              <div key={post.id} style={{ backgroundColor: "white", padding: "20px 25px", borderRadius: "24px", border: "1px solid #F3C7DA", display: "flex", gap: "15px", boxShadow: "0 5px 15px rgba(140, 101, 156, 0.04)", transition: "transform 0.2s", cursor: "pointer" }} className="post-hover">
                
                {/* Avatar */}
                <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "#ffd9e6", flexShrink: 0, overflow: "hidden", border: "2px solid #FFFDF5" }}>
                  <img src={post.avatar} alt={post.author} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                
                {/* Contenido */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 900, color: "#8C659C", fontSize: "16px" }}>{post.author}</span>
                      <span style={{ color: "#b17eac", fontSize: "14px", fontWeight: 600 }}>{post.handle} · {post.time}</span>
                    </div>
                    <button style={{ background: "none", border: "none", color: "#d1bdcc", cursor: "pointer", padding: "0 5px" }}><MoreHorizontal size={20} /></button>
                  </div>
                  
                  <p style={{ color: "#444", fontSize: "15px", lineHeight: "1.5", margin: "0 0 15px 0", whiteSpace: "pre-wrap", fontWeight: 500 }}>
                    {post.content}
                  </p>
                  
                  {/* Botones de acción */}
                  <div style={{ display: "flex", justifyContent: "space-between", maxWidth: "450px", color: "#b17eac" }}>
                    <button style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13px", transition: "color 0.2s" }} className="action-btn"><MessageCircle size={18} /> {post.comments > 0 ? post.comments : ''}</button>
                    <button style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13px", transition: "color 0.2s" }} className="action-btn-green"><Repeat2 size={18} /> {post.reposts > 0 ? post.reposts : ''}</button>
                    <button onClick={(e) => { e.stopPropagation(); toggleLike(post.id); }} style={{ background: "none", border: "none", color: post.isLiked ? "#e2b86b" : "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13px", transition: "color 0.2s" }} className="action-btn-red"><Heart size={18} fill={post.isLiked ? "#e2b86b" : "none"} /> {post.likes > 0 ? post.likes : ''}</button>
                    <button style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13px", transition: "color 0.2s" }} className="action-btn"><Share size={18} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

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

      {/* ESTILOS GLOBALES Y EFECTOS HOVER */}
      <style jsx global>{`
        @font-face { font-family: 'TanTangkiwood'; src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype'); }
        .tan-font { font-family: 'TanTangkiwood', sans-serif !important; }

        .post-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(140, 101, 156, 0.1) !important;
        }

        .action-btn:hover { color: #8C659C !important; }
        .action-btn-green:hover { color: #8db8ff !important; } /* Un azulito simulando el verde de repost */
        .action-btn-red:hover { color: #e2b86b !important; }
      `}</style>

    </div>
  );
}