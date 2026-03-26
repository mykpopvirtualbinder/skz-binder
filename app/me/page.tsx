"use client";
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "../components/header";
import Footer from "../components/footer";
import {
  Bell, BookOpen, Boxes, Heart, Home, MessageCircle, 
  ShieldAlert, Sparkles, User, Settings, Minus, Camera, X, Wallet, TrendingUp
} from "lucide-react";
import type { CSSProperties } from "react";
import { useGlobal } from "../context/GlobalContext"; 
// Antes era ../components/OnboardingForm
import { OnboardingForm } from "./ui/OnboardingForm";
type TabKey = "home" | "groups" | "fanzone" | "notices";

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type WallPost = {
  id: string;
  text: string;
  createdAt: string;
  authorName?: string;
  authorAvatar?: string | null;
};

// Helpers para analíticas
const unitTypeFromMember = (memberRaw: string | null | undefined) => {
  const lower = String(memberRaw ?? "").toLowerCase().trim();
  
  // 1. Si pone OT8 o All, es grupal
  if (/\bot8\b/.test(lower) || lower.includes("all") || lower === "varios") return "OT8";
  
  // 2. Separamos por espacios, comas, + o &
  const parts = lower.split(/[\s,+/&]+/).filter(Boolean);
  
  // 3. Si al separar hay más de 1 persona (ej: "bang-chan" y "felix" = 2), ¡es una Unit!
  if (parts.length > 1) return "Unit";
  
  return "Single";
};

// PRECIO PROMEDIO DE MERCADO ESTIMADO (En el futuro vendrá de la BD)
const AVG_PC_PRICE = 8; 

const KPOP_GROUPS: Record<string, { logo: string, members: string[] }> = {
  "Stray Kids": {
    logo: "/groups/straykids-logo.png", 
    members: ["Bang Chan", "Lee Know", "Changbin", "Hyunjin", "Han", "Felix", "Seungmin", "I.N"]
  },
  "ATEEZ": {
    logo: "/groups/ateez-logo.png",
    members: ["Hongjoong", "Seonghwa", "Yunho", "Yeosang", "San", "Mingi", "Wooyoung", "Jongho"]
  }
};



const inputStyle: CSSProperties = { width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #F3C7DA", outline: "none", fontWeight: 600, color: "#2F2740", backgroundColor: "#FFFDF5" };
const labelStyle: CSSProperties = { display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 900, color: "#8C659C", textTransform: "uppercase" };
const footerLinkStyle: CSSProperties = { fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px", display: "block" };
const footerColumnTitle: CSSProperties = { fontSize: "13px", color: "#8C659C", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px", display: "block" };

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: "12px 20px", background: "transparent", border: "none",
    borderBottom: active ? "3px solid #8C659C" : "3px solid transparent",
    color: active ? "#8C659C" : "#b17eac", fontWeight: 900, fontSize: "14px",
    cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
    transition: "all 0.2s ease", textTransform: "uppercase"
  };
}
const GROUP_ASSETS: Record<string, { logo: string, skzoo: string[], lights: string[], kawaii: string[] }> = {
  "stray-kids": {
    logo: "stray-kids-logo.png",
    skzoo: ["wolfchan", "leebit", "dwaekki", "jiniret", "hanquokka", "bbokari", "puppym", "foxiny"],
    lights: ["skz-v1", "skz-v2"],
    kawaii: ["heart-pink", "star-yellow"] // Nombres de tus archivos en /kawaii/stray-kids/
  },
  // Añade otros grupos aquí siguiendo la misma estructura
};


// Añade esto donde están los otros useState
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 768);
  check(); // Ejecuta al cargar
  window.addEventListener("resize", check);
  return () => window.removeEventListener("resize", check);
}, []);
export default function MePage() {
  const { refreshGlobal } = useGlobal();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ESTADOS EXISTENTES
  const [members, setMembers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  
  // AÑADE ESTO AQUÍ PARA QUITAR EL ROJO
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  // ... continúa el código
  // ESTADOS DEL SÚPER DASHBOARD
  const [stats, setStats] = useState({ 
    have: 0, wtt: 0, wts: 0, wishlist: 0, estimatedValue: 0,
    byType: { Single: 0, Unit: 0, OT8: 0 } as Record<string, number>,
    byMember: {} as Record<string, number>
  });
  const [marketWtt, setMarketWtt] = useState<any[]>([]);
  const [marketWts, setMarketWts] = useState<any[]>([]);

  const [tab, setTab] = useState<TabKey>("home");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [openBiasDropdown, setOpenBiasDropdown] = useState<string | null>(null);

  const [favGroups, setFavGroups] = useState<string[]>([]);
  const [biasByGroup, setBiasByGroup] = useState<Record<string, string[]>>({});
  const [wallPost, setWallPost] = useState("");
  const [wall, setWall] = useState<WallPost[]>([]);
  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [termsAccepted, setTermsAccepted] = useState(true);

  const tabs = useMemo(() => [
    { key: "home" as const, label: "Resumen", icon: <Home size={18} /> },
    { key: "groups" as const, label: "Mis Bias", icon: <Heart size={18} /> },
    { key: "fanzone" as const, label: "Fan Zone", icon: <MessageCircle size={18} /> },
    { key: "notices" as const, label: "Notificaciones", icon: <Bell size={18} /> },
  ] as const, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSettingsOpen(false);
        setIsAvatarModalOpen(false);
        setOpenBiasDropdown(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  
  useEffect(() => {
    const run = async () => {
  setLoading(true);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) { router.push("/login"); return; }

  // 1. CARGA DE GRUPOS (Para que el modal sepa qué grupos existen)
  const { data: gData } = await supabase
    .from("groups")
    .select("*")
    .order("name");
  if (gData) setGroups(gData);

  // 1. Cambiamos el select para que traiga TODO y ver qué falla
const { data: mData, error: mError } = await supabase
  .from("members") 
  .select("*"); // Traemos todas las columnas para no fallar con los nombres

if (mError) {
  console.error("Error real de Supabase:", mError.message);
}

if (mData) {
  setMembers(mData.map((m: any) => ({
    member_id: m.id,
    name: m.name,
    image_url: m.image_url,
    // Si tu columna se llama diferente en Supabase, cámbialo aquí:
    group_id: m.group_id || m.group || m.group_name 
  })));
}
  
  // ... resto del código de analíticas (statusData, etc.)
      // 1. Pedir inventario
      const { data: statusData } = await supabase
        .from("user_item_statuses")
        .select("status, qty, item_id")
        .eq("user_id", auth.user.id);

      if (statusData && statusData.length > 0) {
        // 2. Pedir info de las cartas para cruzar datos
        const itemIds = Array.from(new Set(statusData.map(s => s.item_id)));
        const { data: itemsData } = await supabase
          .from("items")
          .select("id, member, image_url")
          .in("id", itemIds);
          
        const itemsMap = Object.fromEntries((itemsData || []).map(i => [i.id, i]));

        const newStats = { 
          have: 0, wtt: 0, wts: 0, wishlist: 0, estimatedValue: 0, 
          byType: { Single: 0, Unit: 0, OT8: 0 } as Record<string, number>,
          byMember: {} as Record<string, number>
        };
        const wttArr: any[] = [];
        const wtsArr: any[] = [];

        statusData.forEach(row => {
          const qty = row.qty || 1;
          const item = itemsMap[row.item_id];

        if (row.status === 'have') {
            newStats.have += qty;
            newStats.estimatedValue += (qty * AVG_PC_PRICE);
            
            if (item) {
              // 1. Contamos el TIPO de carta (aquí sí se cuenta el OT8)
              const type = unitTypeFromMember(item.member);
              newStats.byType[type] = (newStats.byType[type] || 0) + qty;
              
              const rawMem = String(item.member || "Varios").toLowerCase();
              
              // 2. Si es grupal o "varios", NO lo metemos en la competición individual
              if (rawMem === "ot8" || rawMem.includes("all") || rawMem === "varios") {
                // No hacemos nada, ya está contado en byType
              } else {
                // 3. Separamos a los miembros si vienen juntos y les damos sus puntos
                const parts = rawMem.split(/[\s,+/&]+/).filter(Boolean);
                parts.forEach(p => {
                  let pretty = p;
                  if (p === "bang-chan") pretty = "Bang Chan";
                  else if (p === "lee-know") pretty = "Lee Know";
                  else if (p === "in" || p === "i.n") pretty = "I.N";
                  else pretty = p.charAt(0).toUpperCase() + p.slice(1);
                  
                  newStats.byMember[pretty] = (newStats.byMember[pretty] || 0) + qty;
                });
              }
            }
          }
          if (row.status === 'wtt') {
            newStats.wtt += qty;
            if (item && !wttArr.some(i => i.id === item.id)) wttArr.push(item);
          }
          if (row.status === 'wts') {
            newStats.wts += qty;
            if (item && !wtsArr.some(i => i.id === item.id)) wtsArr.push(item);
          }
          if (row.status === 'wishlist' || row.status === 'wish') newStats.wishlist += qty;
        });

        setStats(newStats);
        setMarketWtt(wttArr);
        setMarketWts(wtsArr);
      }

      // PERFIL Y FAN ZONE
      const localProfileStr = localStorage.getItem("me:profile");
      let base: Profile;
      if (localProfileStr) {
        base = JSON.parse(localProfileStr);
      } else {
        base = {
          id: auth.user.id,
          email: auth.user.email ?? null,
          display_name: (auth.user.user_metadata as any)?.display_name || `KpopFan_${Math.floor(Math.random() * 10000)}`,
          avatar_url: (auth.user.user_metadata as any)?.avatar_url ?? null,
          bio: "Organizando mi colección con estilo ✨",
        };
      }
      setProfile(base);
      setFormData(base);
      try {
        setFavGroups(JSON.parse(localStorage.getItem("me:favGroups") || '["Stray Kids"]'));
        setBiasByGroup(JSON.parse(localStorage.getItem("me:biasByGroup") || '{}'));
        setWall(JSON.parse(localStorage.getItem("me:wall") || '[]'));
      } catch {}
      setLoading(false);
    };
    run();
  }, [router]);

  const persistProfile = async (updatedProfile: Profile) => {
    localStorage.setItem("me:profile", JSON.stringify(updatedProfile));
    await supabase.auth.updateUser({ data: { display_name: updatedProfile.display_name, avatar_url: updatedProfile.avatar_url, bio: updatedProfile.bio } });
    refreshGlobal(); 
  };

  const persistFanStuff = useCallback((nextGroups: string[], nextBias: Record<string, string[]>, nextWall: WallPost[]) => {
    localStorage.setItem("me:favGroups", JSON.stringify(nextGroups));
    localStorage.setItem("me:biasByGroup", JSON.stringify(nextBias));
    localStorage.setItem("me:wall", JSON.stringify(nextWall));
    refreshGlobal(); 
  }, [refreshGlobal]);

  const handleSaveBias = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const biasNameIdMap: Record<string, number> = {
        "hyunjin": 1, "changbin": 2, "han": 3, "bang chan": 4,
        "seungmin": 5, "lee know": 6, "felix": 7, "i.n": 8
      };

      const idsToSave: number[] = [];
      Object.values(biasByGroup).flat().forEach(name => {
        const id = biasNameIdMap[name.toLowerCase()];
        if (id) idsToSave.push(id);
      });

      await supabase.from("user_biases").delete().eq("user_id", auth.user.id);
      if (idsToSave.length > 0) {
        await supabase.from("user_biases").insert(
          idsToSave.map(id => ({ user_id: auth.user.id, member_id: id }))
        );
      }

      persistFanStuff(favGroups, biasByGroup, wall);
      alert("¡Bias sincronizados con tu Binder! ✨");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // 1. Subir al bucket 'avatars' (asegúrate de que sea público en Supabase)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Obtener la URL pública
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      const next = { ...profile, avatar_url: data.publicUrl } as Profile;
      setProfile(next);
      setFormData(next);
      setIsAvatarModalOpen(false);
      await persistProfile(next);
      alert("¡Avatar personalizado actualizado! ✨");
    } catch (err: any) {
      alert("Error al subir: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePredefinedAvatarSelect = async (url: string) => {
    const next = { ...profile, avatar_url: url } as Profile;
    setProfile(next);
    setFormData(next);
    setIsAvatarModalOpen(false);
    await persistProfile(next);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) return alert("Acepta el tratamiento de datos.");
    const next = { ...profile, ...formData } as Profile;
    setProfile(next);
    setIsSettingsOpen(false);
    await persistProfile(next);
  };
const handleDeleteAccount = async () => {
    const confirmDelete = confirm("¿Estás segura de que quieres cerrar tu cuenta? Esta acción es permanente y perderás toda tu colección. 🚨");
    if (!confirmDelete) return;

    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      // 1. Borramos el perfil en la base de datos (las cascadas deberían limpiar el resto)
      const { error } = await supabase.from("profiles").delete().eq("id", auth.user.id);
      if (error) throw error;

      // 2. Cerramos sesión
      await supabase.auth.signOut();
      localStorage.clear();
      alert("Cuenta cerrada correctamente. Esperamos verte pronto. 👋");
      router.push("/login");
    } catch (err: any) {
      alert("Error al cerrar la cuenta: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  const addGroup = (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const next = Array.from(new Set([...favGroups, cleanName]));
    setFavGroups(next);
    persistFanStuff(next, biasByGroup, wall);
  };

  const removeGroup = (name: string) => {
    const next = favGroups.filter((g) => g !== name);
    const nextBias = { ...biasByGroup };
    delete nextBias[name];
    setFavGroups(next);
    setBiasByGroup(nextBias);
    persistFanStuff(next, nextBias, wall);
  };

  const toggleBias = (group: string, member: string) => {
    const current = biasByGroup[group] || [];
    const nextBiases = current.includes(member) ? current.filter(b => b !== member) : [...current, member];
    const next = { ...biasByGroup, [group]: nextBiases };
    setBiasByGroup(next);
  };

  const postToWall = () => {
    const text = wallPost.trim();
    if (!text) return;
    const next = [{ id: `${Date.now()}`, text, createdAt: new Date().toISOString(), authorName: profile?.display_name || "Usuario", authorAvatar: profile?.avatar_url || null }, ...wall];
    setWall(next);
    setWallPost("");
    persistFanStuff(favGroups, biasByGroup, next);
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8C659C", fontWeight: 900 }}>Cargando...</div>;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFDF5", display: "flex", flexDirection: "column", color: "#2F2740" }}>
      
      {/* CABECERA OFICIAL */}
      <Header />

<main style={{ 
  width: "100%", 
  maxWidth: "1000px", 
  margin: isMobile ? "20px auto" : "60px auto", 
padding: isMobile ? "0 15px" : "0 40px",
  flex: 1 
}}>        
        {/* PERFIL HEADER */}
        <div style={{ 
  display: "flex", 
  flexDirection: isMobile ? "column" : "row", // Se apila en móvil
  justifyContent: "space-between", 
  alignItems: isMobile ? "center" : "flex-end", 
  marginBottom: "40px", 
  borderBottom: "1px solid #F3C7DA", 
  paddingBottom: "30px",
  gap: isMobile ? "20px" : "0"
}}>
  <div style={{ 
    display: "flex", 
    flexDirection: isMobile ? "column" : "row", 
    gap: "25px", 
    alignItems: "center",
    textAlign: isMobile ? "center" : "left"
  }}>
    {/* ... aquí va el div del avatar y el nombre que ya tienes ... */}
            <div onClick={() => setIsAvatarModalOpen(true)} style={{ width: 110, height: 110, borderRadius: "50%", border: "4px solid #ffd9e6", overflow: "hidden", backgroundColor: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={40} color="#b17eac" />}
              <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(140, 101, 156, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.opacity = "1"} onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}><Camera color="white" size={28} /></div>
            </div>
            <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*" onChange={handleAvatarUpload} />
            <div>
              <h1 className="tan-font" style={{ color: "#8C659C", fontSize: "48px", margin: 0 }}>{profile?.display_name}</h1>
              <p style={{ color: "#b17eac", fontWeight: 700, fontSize: "15px", marginTop: "8px" }}>{profile?.bio}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "15px" }}>
            <button onClick={() => router.push('/binder')} style={{ background: "#8C659C", color: "white", border: "none", padding: "12px 24px", borderRadius: "99px", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}><BookOpen size={18} /> Abrir Binder</button>
            <button onClick={() => setIsSettingsOpen(true)} style={{ background: "white", color: "#8C659C", border: "1px solid #F3C7DA", padding: "12px", borderRadius: "50%", cursor: "pointer" }}><Settings size={20} /></button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "40px" }}>
          {tabs.map((t) => <button key={t.key} onClick={() => setTab(t.key)} style={tabStyle(tab === t.key)}>{t.icon} {t.label}</button>)}
        </div>

        <div style={{ minHeight: "400px" }}>
          
          {/* SÚPER DASHBOARD: RESUMEN */}
          {tab === "home" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              
              {/* FILA 1: Totales y Valor */}
<div style={{ 
  display: "grid", 
  gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", // Una columna en móvil, dos en PC
  gap: "20px" 
}}>
                <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "24px", border: "1px solid #F3C7DA" }}>
                  <h3 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", margin: "0 0 20px 0", display: "flex", alignItems: "center", gap: "10px" }}><Boxes size={20}/> Mi Colección</h3>
                  <div style={{ display: "flex", gap: "40px" }}>
                    <div>
                      <div style={{ fontSize: "42px", fontWeight: 900, color: "#8C659C", lineHeight: 1 }}>{stats.have}</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#b17eac", textTransform: "uppercase", marginTop: "5px" }}>Photocards</div>
                    </div>
                    <div style={{ width: "1px", backgroundColor: "#F3C7DA" }}></div>
                    <div>
                      <div style={{ fontSize: "42px", fontWeight: 900, color: "#e2b86b", lineHeight: 1 }}>{stats.wishlist}</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#d1a351", textTransform: "uppercase", marginTop: "5px" }}>En Wishlist</div>
                    </div>
                  </div>
                </div>
                
                <div style={{ backgroundColor: "#FFF9FB", padding: "30px", borderRadius: "24px", border: "1px solid #F3DCE7", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <h3 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "10px" }}><Wallet size={20}/> Valor Estimado</h3>
                  <div style={{ fontSize: "48px", fontWeight: 900, color: "#2F2740", lineHeight: 1 }}>{stats.estimatedValue}€</div>
                  <p style={{ color: "#8C659C", fontSize: "13px", fontWeight: 600, margin: "5px 0 0 0" }}>*Basado en un promedio de {AVG_PC_PRICE}€ por photocard.</p>
                </div>
              </div>

              {/* FILA 2: Tipos y Top Miembros */}
         <div style={{ display: "grid", 
  gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", // Una sola columna en móvil
  gap: "20px" 
}}>
                <div style={{ backgroundColor: "white", padding: "25px", borderRadius: "24px", border: "1px solid #F3C7DA" }}>
                  <h3 style={{ color: "#8C659C", fontWeight: 900, fontSize: "16px", margin: "0 0 15px 0" }}>Desglose por Tipo</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "15px", borderBottom: "1px dashed #eee", paddingBottom: "5px" }}><span>Singles (Selfies)</span> <span style={{ color: "#8C659C" }}>{stats.byType.Single || 0}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "15px", borderBottom: "1px dashed #eee", paddingBottom: "5px" }}><span>Units (2+ miembros)</span> <span style={{ color: "#8C659C" }}>{stats.byType.Unit || 0}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "15px" }}><span>OT8 / Grupales</span> <span style={{ color: "#8C659C" }}>{stats.byType.OT8 || 0}</span></div>
                  </div>
                </div>

                <div style={{ backgroundColor: "white", padding: "25px", borderRadius: "24px", border: "1px solid #F3C7DA" }}>
                  <h3 style={{ color: "#8C659C", fontWeight: 900, fontSize: "16px", margin: "0 0 15px 0" }}>Top 3 Miembros</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Object.entries(stats.byMember)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([name, count], idx) => (
                        <div key={name} style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "15px", borderBottom: idx < 2 ? "1px dashed #eee" : "none", paddingBottom: "5px" }}>
                          <span>{name}</span> <span style={{ color: "#8C659C" }}>{count} pcs</span>
                        </div>
                      ))}

                        
                    {Object.keys(stats.byMember).length === 0 && <div style={{ color: "#999", fontSize: "14px", fontWeight: 600 }}>Aún no hay photocards registradas.</div>}
                  </div>
                </div>
              </div>

              {/* FILA 3: ACTIVIDAD DEL MARKET CON FOTOS */}
              <div style={{ backgroundColor: "#FFF9FB", padding: "30px", borderRadius: "24px", border: "1px solid #F3DCE7" }}>
                <h3 style={{ color: "#8C659C", fontWeight: 900, fontSize: "18px", margin: "0 0 20px 0", display: "flex", alignItems: "center", gap: "10px" }}><TrendingUp size={20}/> Mi Actividad en el Market</h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
                  {/* WTT ROW */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                      <span style={{ fontWeight: 900, color: "#8db8ff", fontSize: "15px", textTransform: "uppercase" }}>For Trade (WTT) - {stats.wtt} items</span>
                      <span style={{ fontSize: "13px", fontWeight: 800, color: "#8db8ff", backgroundColor: "#eaf2ff", padding: "2px 10px", borderRadius: "99px" }}>Ofertas recibidas: 0</span>
                    </div>
                    {marketWtt.length > 0 ? (
                      <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "10px" }}>
                        {marketWtt.map(it => (
                          <img key={it.id} src={it.image_url || "/mock-pcs/groupsui/not-available.png"} alt="WTT" style={{ width: 60, height: 85, borderRadius: "8px", objectFit: "cover", border: "1px solid #cfdcff" }} />
                        ))}
                      </div>
                    ) : <p style={{ color: "#888", fontSize: "14px", margin: 0, fontWeight: 600 }}>No tienes cartas marcadas para tradear.</p>}
                  </div>

                  {/* WTS ROW */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                      <span style={{ fontWeight: 900, color: "#ffb870", fontSize: "15px", textTransform: "uppercase" }}>A la Venta (WTS) - {stats.wts} items</span>
                      <span style={{ fontSize: "13px", fontWeight: 800, color: "#ffb870", backgroundColor: "#fff4ea", padding: "2px 10px", borderRadius: "99px" }}>Ofertas recibidas: 0</span>
                    </div>
                    {marketWts.length > 0 ? (
                      <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "10px" }}>
                        {marketWts.map(it => (
                          <img key={it.id} src={it.image_url || "/mock-pcs/groupsui/not-available.png"} alt="WTS" style={{ width: 60, height: 85, borderRadius: "8px", objectFit: "cover", border: "1px solid #ffe3c2" }} />
                        ))}
                      </div>
                    ) : <p style={{ color: "#888", fontSize: "14px", margin: 0, fontWeight: 600 }}>No tienes cartas a la venta.</p>}
                  </div>
                </div>

              </div>

            </div>
          )}

          {tab === "groups" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h2 style={{ color: "#8C659C", fontWeight: 900, fontSize: "24px" }}>Gestión de Bias</h2>
                <input placeholder="Añadir grupo..." onKeyDown={(e) => { if (e.key === "Enter") { addGroup((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }} style={{ padding: "12px 20px", borderRadius: "99px", border: "1px solid #F3C7DA", outline: "none", fontWeight: 700 }} />
              </div>
              {favGroups.map((g) => {
                const groupData = KPOP_GROUPS[g as keyof typeof KPOP_GROUPS];
                const availableMembers = groupData?.members || [];
                const isDropdownOpen = openBiasDropdown === g;
                return (
                  <div key={g} style={{ backgroundColor: "white", padding: "20px 30px", borderRadius: "24px", border: "1px solid #F3C7DA" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="tan-font" style={{ fontSize: "28px", color: "#8C659C" }}>{g}</span>
                      <button onClick={() => removeGroup(g)} style={{ background: "transparent", border: "none", color: "#ff99aa", cursor: "pointer" }}><Minus size={24} /></button>
                    </div>
                    <div style={{ borderTop: "1px dashed #F3DCE7", paddingTop: "15px", position: "relative", marginTop: "10px" }}>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontWeight: 900, color: "#b17eac", fontSize: "13px" }}>MIS BIAS:</span>
                        {(biasByGroup[g] || []).map(b => <div key={b} style={{ backgroundColor: "#8C659C", color: "white", padding: "4px 12px", borderRadius: "99px", fontSize: "12px", fontWeight: 800 }}>{b}</div>)}
                        <button onClick={() => setOpenBiasDropdown(isDropdownOpen ? null : g)} style={{ background: "#FFF9FB", border: "1px dashed #8C659C", color: "#8C659C", padding: "4px 12px", borderRadius: "99px", cursor: "pointer" }}>+ Seleccionar</button>
                      </div>
                      {isDropdownOpen && (
                        <>
                          <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setOpenBiasDropdown(null)} />
                          <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "10px", backgroundColor: "white", border: "1px solid #F3C7DA", borderRadius: "16px", padding: "10px", width: "250px", zIndex: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}>
                            {availableMembers.map(m => (
                              <div key={m} onClick={() => toggleBias(g, m)} style={{ padding: "8px", borderRadius: "8px", backgroundColor: (biasByGroup[g] || []).includes(m) ? "#ffd9e6" : "transparent", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>{m}</div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: "30px", display: "flex", justifyContent: "center" }}>
                <button 
                  onClick={handleSaveBias}
                  style={{ background: "#8C659C", color: "white", border: "none", padding: "15px 40px", borderRadius: "99px", fontWeight: 900, cursor: "pointer", boxShadow: "0 10px 20px rgba(140, 101, 156, 0.3)" }}
                >
                  GUARDAR MIS BIAS Y ACTUALIZAR BINDER
                </button>
              </div>
            </div>
          )}

          {tab === "fanzone" && (
            <div style={{ maxWidth: "650px", margin: "0 auto" }}>
              <div style={{ backgroundColor: "white", padding: "25px", borderRadius: "24px", border: "1px solid #F3C7DA", marginBottom: "40px" }}>
                <textarea value={wallPost} onChange={(e) => setWallPost(e.target.value)} placeholder="¿Qué photocard has conseguido hoy?..." rows={3} style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "none", backgroundColor: "#FFFDF5", outline: "none", resize: "none", fontWeight: 600 }} />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "15px" }}>
                  <button onClick={postToWall} style={{ background: "#8C659C", color: "white", border: "none", padding: "10px 28px", borderRadius: "99px", fontWeight: 900, cursor: "pointer" }}>Publicar en el Muro</button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {wall.map((p) => {
                  const avatarToShow = p.authorAvatar || profile?.avatar_url;
                  const nameToShow = p.authorName || profile?.display_name || "Usuario";
                  return (
                    <div key={p.id} style={{ backgroundColor: "white", padding: "25px", borderRadius: "24px", border: "1px solid #F3C7DA", display: "flex", gap: "15px" }}>
                      <div style={{ width: 45, height: 45, borderRadius: "50%", overflow: "hidden", backgroundColor: "#ffd9e6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {avatarToShow ? <img src={avatarToShow} alt="Autor" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={22} color="#8C659C" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span style={{ fontWeight: 900, color: "#8C659C" }}>{nameToShow}</span>
                          <span style={{ color: "#b17eac", fontSize: "12px" }}>{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p style={{ color: "#444", fontSize: "15px", margin: 0, whiteSpace: "pre-wrap" }}>{p.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
{/* MODAL AVATAR: JERARQUÍA REAL (SUPABASE + LOCAL) */}
{isAvatarModalOpen && (
  <div 
    style={{ position: "fixed", inset: 0, backgroundColor: "rgba(47, 39, 64, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, padding: "20px" }} 
    onClick={() => setIsAvatarModalOpen(false)}
  >
    <div 
      style={{ backgroundColor: "#FFFDF5", borderRadius: "32px", width: "100%", maxWidth: "750px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid #F3C7DA" }} 
      onClick={(e) => e.stopPropagation()}
    >
      
      {/* CABECERA */}
      <div style={{ padding: "25px", borderBottom: "1px solid #F3C7DA", textAlign: "center", position: "relative" }}>
         <h2 className="tan-font" style={{ color: "#8C659C", fontSize: "28px", margin: 0 }}>Personalizar Perfil</h2>
         <button onClick={() => setIsAvatarModalOpen(false)} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", cursor: "pointer" }}>
           <X size={24} color="#8C659C"/>
         </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "30px" }}>
        
        {/* 1. FOTO PROPIA (SUBIDA A STORAGE) */}
        <div style={{ marginBottom: "50px", textAlign: "center" }}>
          <p style={{ fontWeight: 900, color: "#b17eac", fontSize: "11px", textTransform: "uppercase", marginBottom: "15px" }}>Foto Personalizada</p>
          <button onClick={() => fileInputRef.current?.click()} style={{ background: "white", border: "2px dashed #F3C7DA", color: "#8C659C", padding: "12px 25px", borderRadius: "16px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", margin: "0 auto" }}>
            <Camera size={18}/> Subir desde mi dispositivo
          </button>
        </div>

        {/* 2. CATEGORÍA: LOGOS (DE TU TABLA 'GROUPS') */}
        <section style={{ marginBottom: "50px" }}>
          <h3 className="tan-font" style={{ color: "#8C659C", textAlign: "center", fontSize: "24px", marginBottom: "20px", borderBottom: "2px solid #F3DCE7", width: "100%", paddingBottom: "10px" }}>Logos de Grupos</h3>
          <div style={{ display: "flex", gap: "25px", flexWrap: "wrap", justifyContent: "center" }}>
            {/* Aquí usamos 'groups' que es tu estado con los datos de Supabase */}
            {groups.map((g: any) => (
              <div key={`logo-${g.id}`} onClick={() => handlePredefinedAvatarSelect(g.logo_url)} style={{ textAlign: "center", cursor: "pointer" }}>
                <img 
                  src={g.logo_url || "/branding/logo.png"} 
                  style={{ width: "75px", height: "75px", borderRadius: "16px", border: "2px solid #F3C7DA", padding: "10px", backgroundColor: "white", objectFit: "contain" }} 
                />
                <p style={{ fontSize: "11px", fontWeight: 800, color: "#8C659C", marginTop: "6px" }}>{g.name}</p>
              </div>
            ))}
          </div>
        </section>
{/* 3. CATEGORÍA: MIEMBROS (DE TU TABLA 'MEMBERS') */}
        <section style={{ marginBottom: "50px" }}>
          <h3 className="tan-font" style={{ color: "#8C659C", textAlign: "center", fontSize: "24px", marginBottom: "20px", borderBottom: "2px solid #F3DCE7", width: "100%", paddingBottom: "10px" }}>Todos los Miembros</h3>
          {groups.map((group: any) => {
            const groupName = group.name;
           // En el modal, usa esta comparación que acepta números o letras
const groupMembers = members.filter((m: any) => 
  String(m.group_id) === String(group.id) || m.group_name === group.name
);
            
            if (groupMembers.length === 0) return null;

            return (
              <div key={`members-group-${group.id}`} style={{ marginBottom: "30px" }}>
                <p style={{ fontSize: "12px", fontWeight: 900, color: "#8C659C", textTransform: "uppercase", marginBottom: "15px", borderLeft: "4px solid #F7A8D8", paddingLeft: "10px" }}>{groupName}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(85px, 1fr))", gap: "15px" }}>
                  {groupMembers.map((m: any) => (
                    <div key={m.member_id} onClick={() => handlePredefinedAvatarSelect(m.image_url)} style={{ cursor: "pointer", textAlign: "center" }}>
                      <img src={m.image_url} style={{ width: "70px", height: "70px", borderRadius: "50%", border: "2px solid #F3C7DA", objectFit: "cover" }} />
                      <p style={{ fontSize: "10px", fontWeight: 800, color: "#8C659C", marginTop: "6px" }}>{m.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

       {/* 4. CATEGORÍA: PERSONAJES (ZOOTOPIA LOCAL) */}
<section style={{ marginBottom: "50px" }}>
  <h3 className="tan-font" style={{ color: "#8C659C", textAlign: "center", fontSize: isMobile ? "20px" : "24px", marginBottom: "20px", borderBottom: "2px solid #F3DCE7", width: "100%", paddingBottom: "10px" }}>
    Personajes Oficiales
  </h3>
  {groups.map((group: any) => { // Usamos 'groups' de la BD
    const groupName = group.name;
    const folder = groupName.toLowerCase().replace(/\s+/g, '-');
    const characters = GROUP_ASSETS[folder]?.skzoo || [];
    if (characters.length === 0) return null;

    return (
      <div key={`zootopia-${group.id}`} style={{ marginBottom: "25px" }}>
        <p style={{ fontSize: "11px", fontWeight: 900, color: "#b17eac", marginBottom: "15px", paddingLeft: "10px" }}>
          {groupName}
        </p>
        <div style={{ 
          display: "flex", 
          gap: isMobile ? "10px" : "15px", 
          flexWrap: "wrap", 
          justifyContent: isMobile ? "center" : "flex-start", 
          paddingLeft: isMobile ? "0" : "10px" 
        }}>
          {characters.map((char: string) => (
            <img 
              key={char} 
              src={`/zootopia/${folder}/${char}.png`} 
              onClick={() => handlePredefinedAvatarSelect(`/zootopia/${folder}/${char}.png`)}
              style={{ 
                width: isMobile ? "55px" : "65px", // Más pequeños en móvil
                height: isMobile ? "55px" : "65px", 
                cursor: "pointer", 
                borderRadius: "50%", 
                border: "2px solid #F3C7DA", 
                backgroundColor: "white" 
              }} 
            />
          ))}
        </div>
      </div>
    );
  })}
</section>

        {/* 5. CATEGORÍA: LIGHTSTICKS (LOCAL) */}
        <section style={{ marginBottom: "50px" }}>
          <h3 className="tan-font" style={{ color: "#8C659C", textAlign: "center", fontSize: "24px", marginBottom: "20px", borderBottom: "2px solid #F3DCE7", width: "100%", paddingBottom: "10px" }}>Lightsticks</h3>
          {groups.map((group: any) => {
            const groupName = group.name;
            const folder = groupName.toLowerCase().replace(/\s+/g, '-');
            const lights = GROUP_ASSETS[folder]?.lights || [];
            
            if (lights.length === 0) return null;

            return (
              <div key={`lights-${group.id}`} style={{ marginBottom: "25px", paddingLeft: "10px" }}>
                <p style={{ fontSize: "11px", fontWeight: 900, color: "#b17eac", marginBottom: "15px" }}>{groupName}</p>
                <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                  {lights.map((ls: string) => (
                    <img 
                      key={ls} 
                      src={`/lightstick/${folder}/${ls}.png`} 
                      onClick={() => handlePredefinedAvatarSelect(`/lightstick/${folder}/${ls}.png`)}
                      style={{ width: "60px", height: "60px", cursor: "pointer", objectFit: "contain", border: "1px solid #F3DCE7", borderRadius: "12px", padding: "5px", backgroundColor: "white" }} 
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* 6. CATEGORÍA: ESTÉTICA KAWAII (CARPETA LOCAL) */}
        <section>
          <h3 className="tan-font" style={{ color: "#8C659C", textAlign: "center", fontSize: "24px", marginBottom: "20px", borderBottom: "2px solid #F3DCE7", width: "100%", paddingBottom: "10px" }}>Kawaii & Extras</h3>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", justifyContent: "center" }}>
            {/* Solo tienes que meter los nombres de los archivos que tengas en /kawaii/ */}
            {["heart-pink", "star-yellow", "sparkle-white"].map(k => (
              <img 
                key={k} 
                src={`/kawaii/${k}.png`} 
                onClick={() => handlePredefinedAvatarSelect(`/kawaii/${k}.png`)} 
                style={{ width: "55px", height: "55px", cursor: "pointer" }} 
              />
            ))}
          </div>
        </section>

      </div>
    </div>
  </div>
)}
{/* --- MODAL DE AJUSTES (SETTINGS) --- */}
      {isSettingsOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(47, 39, 64, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5000, padding: "20px" }} onClick={() => setIsSettingsOpen(false)}>
          <div style={{ backgroundColor: "#FFFDF5", borderRadius: "32px", width: "100%", maxWidth: "600px", maxHeight: "90vh", overflow: "auto", border: "1px solid #F3C7DA" }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ padding: "25px", borderBottom: "1px solid #F3C7DA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="tan-font" style={{ color: "#8C659C", fontSize: "28px", margin: 0 }}>Ajustes de Perfil</h2>
              <button onClick={() => setIsSettingsOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={24} color="#8C659C"/></button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ padding: "30px" }}>
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Nombre de Usuario</label>
                <input style={inputStyle} value={formData.display_name || ""} onChange={e => setFormData({...formData, display_name: e.target.value})} />
              </div>
              
              <div style={{ marginBottom: "25px" }}>
                <label style={labelStyle}>Biografía</label>
                <textarea style={{ ...inputStyle, height: "80px", resize: "none" }} value={formData.bio || ""} onChange={e => setFormData({...formData, bio: e.target.value})} />
              </div>

              {/* OPCIONES DE CUENTA */}
              <div style={{ borderTop: "1px solid #F3C7DA", paddingTop: "20px" }}>
                <p style={labelStyle}>Seguridad</p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button type="button" onClick={async () => {
                    await supabase.auth.resetPasswordForEmail(profile?.email || "");
                    alert("Email de recuperación enviado. ✨");
                  }} style={{ background: "#FFF9FB", color: "#8C659C", border: "1px solid #F3C7DA", padding: "10px 20px", borderRadius: "99px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                    Restablecer Contraseña
                  </button>

                  <button type="button" onClick={() => { supabase.auth.signOut(); router.push("/login"); }} style={{ background: "#F3C7DA", color: "#2F2740", border: "none", padding: "10px 20px", borderRadius: "99px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                    Cerrar Sesión
                  </button>
                </div>
              </div>

             {/* ZONA PELIGROSA */}
<div style={{ 
  marginTop: "30px", 
  padding: isMobile ? "0 15px" : "0 40px",
  backgroundColor: "#FFF5F5", 
  borderRadius: "16px", 
  border: "1px solid #FFDADA" 
}}>
  <p style={{ ...labelStyle, color: "#FF6B6B" }}>Zona Peligrosa</p>
  <button 
    type="button" 
    onClick={handleDeleteAccount} 
    style={{ 
      background: "none", 
      border: "none", 
      color: "#FF6B6B", 
      textDecoration: "underline", 
      fontWeight: 800, 
      cursor: "pointer", 
      fontSize: isMobile ? "11px" : "12px",
      textAlign: "left"
    }}
  >
    Cerrar cuenta definitivamente
  </button>
</div>

              <button type="submit" style={{ width: "100%", marginTop: "30px", background: "#8C659C", color: "white", border: "none", padding: "15px", borderRadius: "99px", fontWeight: 900, cursor: "pointer" }}>
                Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      )}

     <Footer />
      {/* ✨ AÑADE ESTO PARA QUE LA CABECERA RECUPERE SU FUENTE ✨ */}
      <style jsx global>{`
        @font-face { font-family: 'TanTangkiwood'; src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype'); }
        .tan-font { font-family: 'TanTangkiwood', sans-serif !important; }
      `}</style>
    </div>
  );
}