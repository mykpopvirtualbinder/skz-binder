"use client";
import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "../context/GlobalContext";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const { profile } = useGlobal(); 
  const [user, setUser] = useState<any>(null);

  // DECLARACIÓN CRÍTICA PARA EVITAR EL ERROR DE VERCEL
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1000);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    return () => {
      window.removeEventListener("resize", checkMobile);
      subscription.unsubscribe();
    };
  }, []);
  // ... el resto del código que ya tienes se mantiene igual

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfileMenuOpen(false);
    router.push("/login");
  };

  const menuBtnStyle: React.CSSProperties = { 
    background: "transparent", border: "none", padding: "10px 14px", 
    textAlign: "left", borderRadius: 10, cursor: "pointer", 
    fontWeight: 900, color: "#8C659C", fontSize: 14 
  };

  return (
    <header style={{ 
      width: "100%", backgroundColor: "#ffd9e6", 
      padding: isMobile ? "10px 15px" : "15px 50px", 
      display: "flex", flexDirection: isMobile ? "column" : "row", 
      gap: isMobile ? "10px" : "20px", justifyContent: "center", 
      alignItems: "center", borderBottom: "1px solid #F3C7DA", 
      position: "sticky", top: 0, zIndex: 1100 
    }}>
      <div onClick={() => router.push('/')} style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
        <img src="/branding/logo.png" alt="Logo" style={{ height: isMobile ? 55 : 90, width: "auto", objectFit: "contain" }} />
      </div>
      
      {!isMobile && <div style={{ flex: 1 }}></div>}

      <div style={{ 
        display: "flex", gap: isMobile ? "10px" : "20px", 
        alignItems: "center", flexWrap: "wrap", justifyContent: "center"
      }}>
        {['library', 'merch', 'market', 'fanart', 'fanzone'].map((path) => (
          <span 
            key={path}
            onClick={() => router.push(`/${path}`)} 
            className="tan-font" 
            style={{ 
              color: "#b17eac", fontWeight: 900, cursor: "pointer", 
              fontSize: isMobile ? 14 : 26, 
              borderBottom: pathname?.startsWith(`/${path}`) ? "3px solid #8C659C" : "none", 
              paddingBottom: 2 
            }}
          >
            {path === 'library' ? 'BIBLIOTECA' : path.toUpperCase()}
          </span>
        ))}

        <div style={{ position: "relative" }}>
          {/* Cambiamos la condición: Si hay sesión (user) y perfil cargado */}
          {user && profile ? (
            <div 
              onClick={(e) => { e.stopPropagation(); setProfileMenuOpen(!profileMenuOpen); }}
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", background: "white", padding: "6px 12px", borderRadius: "99px", border: "2px solid #F3C7DA" }}
            >
              <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", backgroundColor: "#ffd9e6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                 {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={16} color="#8C659C" />}
              </div>
              <span style={{ fontWeight: 900, color: "#8C659C", fontSize: "12px" }}>{profile?.display_name || "Perfil"}</span>
            </div>
          ) : (
            <button 
              onClick={() => router.push('/login')}
              className="tan-font"
              style={{ 
                background: "white", color: "#8C659C", border: "2px solid #F3C7DA", 
                padding: isMobile ? "6px 14px" : "8px 20px", borderRadius: "99px", 
                fontWeight: 900, cursor: "pointer", fontSize: isMobile ? 12 : 14
              }}
            >
              ENTRAR
            </button>
          )}

          {user && profile && profileMenuOpen && (
            <div style={{ position: "absolute", top: "100%", right: 0, paddingTop: 14, zIndex: 2000 }} onMouseLeave={() => setProfileMenuOpen(false)}>
              <div style={{ background: "white", border: "1px solid #F3C7DA", borderRadius: 16, padding: 8, width: 180, display: "flex", flexDirection: "column", gap: 4, boxShadow: "0 12px 32px rgba(140, 101, 156, 0.15)" }}>
                <button onClick={() => router.push('/me')} style={menuBtnStyle}>Mi Perfil</button>
                <button onClick={() => router.push('/binder')} style={menuBtnStyle}>Mis Binders</button>
                <div style={{ height: 1, background: "#F3DCE7", margin: "4px 0" }} />
                <button onClick={handleLogout} style={{ ...menuBtnStyle, color: "#29161f" }}>Cerrar sesión</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}