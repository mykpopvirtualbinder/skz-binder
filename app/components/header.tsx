"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { User } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useGlobal } from "../context/GlobalContext";

const menuBtnStyle: React.CSSProperties = { 
  background: "transparent", border: "none", padding: "10px 14px", 
  textAlign: "left", borderRadius: 10, cursor: "pointer", 
  fontWeight: 900, color: "#8C659C", fontSize: 14 
};

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  
  const { profile } = useGlobal(); 

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setProfileMenuOpen(false); };
    const handleClickOutside = () => { if (profileMenuOpen) setProfileMenuOpen(false); };

    window.addEventListener("keydown", handleKeyDown);
    setTimeout(() => window.addEventListener("click", handleClickOutside), 0);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [profileMenuOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("me:profile");
    router.push("/login");
  };

  return (
    <header style={{ width: "100%", backgroundColor: "#ffd9e6", padding: "15px 50px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F3C7DA", position: "sticky", top: 0, zIndex: 1100 }}>
      {/* LOGO: Va a la Landing Page (/) */}
      <div onClick={() => router.push('/')} style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
        <img src="/branding/logo.png" alt="My Kpop Binder Logo" style={{ height: 90, width: "auto", objectFit: "contain" }} />
      </div>
      
      <div style={{ flex: 1 }}></div>

      <div style={{ display: "flex", gap: "40px", alignItems: "center" }}>
        <span onClick={() => router.push('/library')} className="tan-font" style={{ color: "#b17eac", fontWeight: 900, cursor: "pointer", fontSize: 30, borderBottom: pathname?.startsWith('/library') ? "4px solid #8C659C" : "none", paddingBottom: 4 }}>BIBLIOTECA</span>
        <span onClick={() => router.push('/merch')} className="tan-font" style={{ color: "#b17eac", fontWeight: 900, cursor: "pointer", fontSize: 30, borderBottom: pathname?.startsWith('/merch') ? "4px solid #8C659C" : "none", paddingBottom: 4 }}>MERCH</span>
        <span onClick={() => router.push('/market')} className="tan-font" style={{ color: "#b17eac", fontWeight: 900, cursor: "pointer", fontSize: 30, borderBottom: pathname?.startsWith('/market') ? "4px solid #8C659C" : "none", paddingBottom: 4 }}>MARKET</span>
        <span onClick={() => router.push('/fanart')} className="tan-font" style={{ color: "#b17eac", fontWeight: 900, cursor: "pointer", fontSize: 30, borderBottom: pathname?.startsWith('/fanart') ? "4px solid #8C659C" : "none", paddingBottom: 4 }}>FANART</span>
        <span onClick={() => router.push('/fanzone')} className="tan-font" style={{ color: "#b17eac", fontWeight: 900, cursor: "pointer", fontSize: 30, borderBottom: pathname?.startsWith('/fanzone') ? "4px solid #8C659C" : "none", paddingBottom: 4 }}>FANZONE</span>

        <div style={{ position: "relative" }}>
          {/* MEDALLA DE USUARIO: Al clicar va a /me */}
          <div 
            onClick={(e) => { 
              e.stopPropagation(); 
              router.push('/me'); 
            }}
            onMouseEnter={() => setProfileMenuOpen(true)}
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", background: "white", padding: "6px 16px 6px 6px", borderRadius: "99px", border: "2px solid #F3C7DA", transition: "all 0.2s ease" }}
          >
            <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", backgroundColor: "#ffd9e6", display: "flex", alignItems: "center", justifyContent: "center" }}>
               {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="User" /> : <User size={18} color="#8C659C" />}
            </div>
            <span style={{ fontWeight: 900, color: "#8C659C", fontSize: "14px", letterSpacing: "0.5px" }}>
              {profile?.display_name || "Cargando..."}
            </span>
          </div>
          
          {/* MENÚ DESPLEGABLE */}
          {profileMenuOpen && (
            <div 
              style={{ position: "absolute", top: "100%", right: 0, paddingTop: 14, zIndex: 2000 }} 
              onClick={(e) => e.stopPropagation()} 
              onMouseLeave={() => setProfileMenuOpen(false)}
            >
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