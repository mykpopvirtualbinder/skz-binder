"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminTeamEmail } from "@/lib/admin-emails";

import Footer from "../components/footer";
import { Plus, ShoppingBag, Loader2, BookText, Camera } from "lucide-react";
import VirtualBinder from "../components/VirtualBinder";
import BinderShelfThumb3D from "./BinderShelfThumb3D";
import { useGlobal } from "../context/GlobalContext";
import { BINDER_ACCENT_SWATCHES } from "@/lib/binder-color-swatches";

type BinderRow = {
  id: number;
  title: string | null;
  user_id: string;
  color?: string;
  cover_url?: string; 
};

const MAX_FREE_BINDERS = 3;

export default function BindersPage() {
  const [isCheckingLimit, setIsCheckingLimit] = useState(false); 
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null); 
  const [error, setError] = useState<string | null>(null);
  const [binders, setBinders] = useState<BinderRow[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [status, setStatus] = useState("");
  
  // ✅ 1. SOLUCIÓN AL ERROR "Cannot find name 't'"
  const { profile, showAlert, showConfirm, t } = useGlobal();
  
  const isAdmin = isAdminTeamEmail(email);

  const isVip = profile?.is_premium || isAdmin || false;
  const [userPlan, setUserPlan] = useState("free");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [extraBinders, setExtraBinders] = useState(0);
  const [extraPages, setExtraPages] = useState(0);
  const [extraSeparators, setExtraSeparators] = useState(0);
  const [totalPaginasUsadas, setTotalPaginasUsadas] = useState(0);
  const [totalSeparadoresUsados, setTotalSeparadoresUsados] = useState(0);
  const [previewBinderOpen, setPreviewBinderOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewColor, setPreviewColor] = useState(""); 
  const [previewCoverUrl, setPreviewCoverUrl] = useState<string | null>(null); 
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [previewingId, setPreviewingId] = useState<number | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadBinders = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setError("No hay sesión activa.");
      setLoading(false);
      return;
    }

    setEmail(userData.user.email ?? null);
    setUserId(userData.user.id);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('extra_binders, extra_pages, extra_separators, plan_type')
      .eq('user_id', userData.user.id)
      .single();
        
    setExtraBinders(profileData?.extra_binders || 0);
    setExtraPages(profileData?.extra_pages || 0);
    setExtraSeparators(profileData?.extra_separators || 0);
    setUserPlan(profileData?.plan_type || "free");

    const res = await supabase
      .from("binders")
      .select("id, title, user_id, color, cover_url")
      .eq("user_id", userData.user.id)
      .order("id", { ascending: true });

    if (res.error) {
      setError(res.error.message);
    } else {
      setBinders((res.data ?? []) as BinderRow[]);
      const bIds = (res.data ?? []).map(b => b.id);
      if (bIds.length > 0) {
        const { data: pData } = await supabase.from('binder_pages').select('layout_type').in('binder_id', bIds);
        setTotalPaginasUsadas(pData?.filter(p => p.layout_type !== 'separator').length || 0);
        setTotalSeparadoresUsados(pData?.filter(p => p.layout_type === 'separator').length || 0);
      } else {
        setTotalPaginasUsadas(0);
        setTotalSeparadoresUsados(0);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBinders();
  }, [loadBinders]);

  const updateBinder = async (id: number, updates: { title?: string; color?: string; cover_url?: string }) => {
    const { error } = await supabase
      .from("binders")
      .update(updates)
      .eq("id", id);

    if (error) {
      setError(error.message);
    } else {
      setBinders(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
      setStatus("¡Cambios guardados!");
      setTimeout(() => setStatus(""), 3000);
    }
  };

  const handleFileUpload = async (binderId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    setStatus("Subiendo portada...");
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${binderId}-${Math.random()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`; 

    try {
      const { error: uploadError } = await supabase.storage
        .from('covers')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('covers')
        .getPublicUrl(filePath);

      await updateBinder(binderId, { cover_url: publicUrl });
      setStatus("¡Portada actualizada!");
      
    } catch (err: any) {
      setError("Error subiendo imagen: " + err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const deleteBinder = async (id: number) => {
    const ok = await showConfirm(t("common.confirm"), t('binder_shelf.confirm_delete'));
    if (!ok) return;
    
    const { error: delErr } = await supabase.from("binders").delete().eq("id", id);
    if (delErr) {
      setError(delErr.message);
    } else {
      setStatus("Binder eliminado");
      setTimeout(() => setStatus(""), 3000);
      loadBinders();
    }
  };

  const createBinder = async () => {
    if (isCheckingLimit || loading || !userId) return;
    
    setIsCheckingLimit(true);
    setStatus("Verificando permisos...");

    try {
      const { count, error: countErr } = await supabase
        .from("binders")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (countErr) throw countErr;

      const currentBindersCount = count ?? 0;
      const effectivePlan = isVip && (!userPlan || userPlan === 'free') ? 'mensual' : userPlan;
      const baseLimit = effectivePlan === 'anual' ? 50 : effectivePlan === 'mensual' ? 15 : MAX_FREE_BINDERS;
      const limiteTotal = baseLimit + extraBinders;

      if (!isAdmin && currentBindersCount >= limiteTotal) {
        setStatus("Límite alcanzado");
        router.push("/shop?item=binders");
        setIsCheckingLimit(false);
        return;
      }

      const { data, error: insErr } = await supabase
        .from("binders")
        .insert({ user_id: userId, title: `Mi Binder ${currentBindersCount + 1}` })
        .select("id")
        .single();

      if (insErr) {
        setError(insErr.message);
      } else {
        setStatus("¡Binder creado!");
        await loadBinders();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCheckingLimit(false);
      setTimeout(() => setStatus(""), 3000);
    }
  };

  const handleOpenPreview = async (binderId: number, title: string, color: string, coverUrl?: string) => {
    setPreviewingId(binderId);
    
    try {
      const { data: pagesData, error: pagesError } = await supabase
        .from('binder_pages')
        .select('id, page_index, layout_type')
        .eq('binder_id', binderId)
        .order('page_index', { ascending: true });

      if (pagesError) throw pagesError;

     if (!pagesData || pagesData.length === 0) {
         setPreviewItems([{ layoutType: '3x3', slots: Array(9).fill(null) }]); 
         setPreviewTitle(title || "Mi Binder");
         setPreviewColor(color || "var(--color-primary)"); 
         setPreviewCoverUrl(coverUrl || null); 
         setPreviewBinderOpen(true);
         return;
      }

      const pageIds = pagesData.map(p => p.id);

      const { data: slotsData, error: slotsError } = await supabase
        .from('page_slots')
        .select(`
          page_id,
          slot_index,
          is_custom,
          custom_image_url,
          custom_text,
          custom_color,
          items (
            id,
            image_url,
            member
          )
        `)
        .in('page_id', pageIds);

      if (slotsError) throw slotsError;

      const bookPages: { layoutType: string, slots: (any | null)[] }[] = [];

      pagesData.forEach(page => {
         let capacity = 9; 
         const layout = page.layout_type || '3x3';
         
         if (layout.includes('2x3') || layout.includes('3x2')) capacity = 6;
         else if (layout.includes('2x2') || layout.includes('1x4')) capacity = 4;
         else if (layout.includes('1x1')) capacity = 1;
         
         const pageArray = Array(capacity).fill(null);

         const slotsForThisPage = (slotsData || []).filter(s => s.page_id === page.id);

         slotsForThisPage.forEach(slot => {
            const arrayIndex = (slot.slot_index || 1) - 1;

            if (arrayIndex >= 0 && arrayIndex < capacity) {
                if (slot.is_custom) {
                    pageArray[arrayIndex] = {
                        id: `custom-${page.id}-${arrayIndex}`,
                        image_url: slot.custom_image_url,
                        name: "PC Personalizada",
                        custom_text: slot.custom_text,
                        custom_color: slot.custom_color
                    };
                } else if (slot.items) {
                    const itemData = Array.isArray(slot.items) ? slot.items[0] : slot.items;
                    pageArray[arrayIndex] = {
                        id: itemData.id,
                        image_url: itemData.image_url,
                        name: itemData.member
                    };
                }
            }
         });

         bookPages.push({
           layoutType: layout,
           slots: pageArray
         });
      });

      setPreviewItems(bookPages);
      setPreviewTitle(title || "Mi Binder");
      setPreviewColor(color || "var(--color-primary)"); 
      setPreviewCoverUrl(coverUrl || null);
      setPreviewBinderOpen(true);
      
    } catch (err: any) {
      console.error(err);
      setStatus("Error al cargar el modo lectura: " + err.message);
      setTimeout(() => setStatus(""), 3000);
    } finally {
      setPreviewingId(null);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)", 
    borderRadius: 20,
    border: "1px solid var(--color-border)",
    padding: "25px 20px",
    textAlign: "center",
    cursor: "pointer",
    boxShadow: "0 8px 24px var(--shadow-card)", 
    transition: "all 0.2s ease",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 15,
    position: "relative",
    color: "var(--text-main)" 
  };

  // ✅ 2. CÁLCULO GLOBAL DE LÍMITES (SOLUCIONA EL ERROR "limiteTotal")
  const rawPlan = (profile as any)?.plan_type || "free";
  const effectivePlan = isVip && rawPlan === "free" ? "mensual" : rawPlan;
  const limits = {
    free: { binders: 3, pages: 30, separators: 5 },
    mensual: { binders: 15, pages: 60, separators: 15 },
    anual: { binders: 50, pages: 90, separators: 30 }
  };
  const base = limits[effectivePlan as keyof typeof limits] || limits.free;
  const maxB = isAdmin ? "∞" : base.binders + extraBinders;

  return (
    <div className="binders-page-shell">
      <main style={{ flex: 1, padding: isMobile ? "20px 15px" : "40px 20px", maxWidth: 1120, width: "100%", margin: "0 auto" }}>
        
        <div style={{ marginBottom: 30, textAlign: isMobile ? "left" : "center" }}>
          <h1
            className="tan-font shop-hero-headline"
            style={{ fontWeight: 950, fontSize: isMobile ? 28 : 36, marginBottom: 10, lineHeight: 1.12 }}
          >
            {t('binders.title')}
          </h1>
          <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>
            {email} • <span style={{ color: "var(--color-primary)", fontWeight: 900 }}>{binders.length} / {maxB}</span> {t('binders.allowed_count')}
          </p>
        </div>

        {error && <div style={{ background: "var(--bg-soft)", color: "var(--state-danger-fg)", border: "1px solid var(--state-danger-fg)", padding: 12, borderRadius: 12, marginBottom: 20, fontWeight: 700 }}>Error: {error}</div>}

        <div style={{ 
          display: "grid", 
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))", 
          gap: 20,
          marginBottom: 50
        }}>
          {binders.map((b) => (
            <div 
              key={b.id} 
              style={{
                ...cardStyle,
                borderColor: b.color || "var(--color-primary)",
                boxShadow: b.color ? `0 12px 35px ${b.color}55` : cardStyle.boxShadow,
                paddingTop: 30,
              }}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); deleteBinder(b.id); }} 
                style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18, fontWeight: 900, zIndex: 10 }}
              >✕</button>

              <BinderShelfThumb3D
                title={b.title || ""}
                color={b.color || ""}
                coverUrl={b.cover_url}
                onOpenBinder={() => router.push(`/binder?binderId=${b.id}`)}
                t={t}
              />

              <input
                value={b.title || ""}
                onChange={(e) => setBinders(prev => prev.map(item => item.id === b.id ? { ...item, title: e.target.value } : item))}
                onBlur={(e) => updateBinder(b.id, { title: e.target.value })}
                style={{ fontWeight: 950, color: "var(--text-main)", fontSize: 17, border: "none", borderBottom: "1px solid var(--color-border)", textAlign: "center", width: "90%", outline: "none", background: "transparent", padding: "4px 0" }}
                placeholder={t('binder_shelf.name_placeholder')}
              />

              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8, alignItems: "center", width: "100%" }}>
                <label
                  onClick={(e) => {
                    if (!isVip) {
                      e.preventDefault(); 
                      showAlert(t('binder_shelf.vip_cover_alert_title'), t('binder_shelf.vip_cover_alert_msg'));
                    }
                  }}
                  style={{ cursor: isVip ? "pointer" : "not-allowed", transition: "transform 0.2s"}}
                  onMouseEnter={(e) => { if (isVip) e.currentTarget.style.transform = "scale(1.1)"; }}
                  onMouseLeave={(e) => { if (isVip) e.currentTarget.style.transform = "scale(1)"; }}
                >
                  <input type="file" accept="image/*"
                    style={{ display: "none" }}
                    disabled={!isVip}
                    onChange={(e) => handleFileUpload(b.id, e)}
                  />
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--bg-main)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--color-border)" }}>
                    <Camera size={12} color={isVip ? "var(--color-primary)" : "var(--text-muted)"} />
                  </div>
                </label>

                {BINDER_ACCENT_SWATCHES.map((c) => (
                  <button 
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => updateBinder(b.id, { color: c })}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: c,
                      border: b.color === c ? "2px solid var(--text-main)" : "2px solid color-mix(in srgb, var(--color-border) 70%, transparent)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: b.color === c
                        ? `0 0 0 2px var(--color-primary), 0 0 14px color-mix(in srgb, ${c} 55%, transparent)`
                        : `0 0 8px color-mix(in srgb, ${c} 28%, transparent)`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.15)";
                      e.currentTarget.style.boxShadow = `0 0 16px color-mix(in srgb, ${c} 50%, transparent)`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = b.color === c
                        ? `0 0 0 2px var(--color-primary), 0 0 14px color-mix(in srgb, ${c} 55%, transparent)`
                        : `0 0 8px color-mix(in srgb, ${c} 28%, transparent)`;
                    }}
                  />
                ))}
              </div>

              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  handleOpenPreview(b.id, b.title || "", b.color || "", b.cover_url);
                }}
                disabled={previewingId === b.id}
                style={{ 
                  marginTop: "10px", 
                  background: "var(--text-main)", 
                  color: "var(--bg-main)", 
                  padding: "10px 16px", 
                  borderRadius: "99px", 
                  fontWeight: 900, 
                  fontSize: "12px", 
                  border: "none", 
                  cursor: previewingId === b.id ? "not-allowed" : "pointer", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "8px", 
                  width: "100%", 
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                  opacity: previewingId === b.id ? 0.6 : 1
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "var(--color-primary)";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "var(--text-main)";
                  e.currentTarget.style.color = "var(--bg-main)";
                }}
              >
                {previewingId === b.id ? <Loader2 size={16} className="spinner" /> : <BookText size={16} />} 
                {t('binders.btn_view')}
              </button>
            </div>
          ))}

          {/* BOTÓN CREAR DINÁMICO */}
          {(isVip || binders.length < MAX_FREE_BINDERS + extraBinders) ? (
              <button 
                onClick={createBinder}
                disabled={isCheckingLimit || loading}
                style={{ 
                  ...cardStyle, borderStyle: "dashed", background: "var(--bg-soft)",
                  cursor: (isCheckingLimit || loading) ? "not-allowed" : "pointer",
                  minHeight: "280px", justifyContent: "center"
                }}
              >
                <div style={{ 
                  width: 80, 
                  height: 110, 
                  borderRadius: 12, 
                  border: "2px dashed var(--color-primary)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center" 
                }}>
                  {isCheckingLimit ? 
                    <Loader2 className="spinner" color="var(--color-primary)" size={40} /> : 
                    <Plus color="var(--color-primary)" size={40} />
                  }
                </div>
                <div style={{ fontWeight: 900, color: "var(--color-primary)" }}> 
{isCheckingLimit ? t('common.checking') : t('binders.btn_create')}                </div>
              </button>
            ) : (
              <div 
                onClick={() => router.push("/shop?item=binders")}
                style={{ 
                  ...cardStyle, 
                  background: "var(--bg-soft)", 
                  borderColor: "var(--color-border)", 
                  minHeight: "280px", 
                  justifyContent: "center",
                  opacity: 0.8 
                }}
              >
                <div style={{ 
                  width: 80, 
                  height: 110, 
                  borderRadius: 12, 
                  background: "var(--bg-main)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center" 
                }}>
                  <ShoppingBag color="var(--text-muted)" size={40} />
                </div>
                <div style={{ fontWeight: 900, color: "var(--text-muted)" }}>
{t('binders.limit_reached')}                </div>
              </div>
            )}
        </div>

        {/* --- DASHBOARD RESUMEN --- */}
        <section style={{ 
          marginTop: 40, 
          padding: 25, 
          background: "var(--bg-soft)", 
          borderRadius: 24, 
          border: "1px solid var(--color-border)", 
          marginBottom: 40 
        }}>
          <h3 style={{ color: "var(--color-primary)", marginTop: 0 }}>
            {t('binders.usage_summary')}
          </h3>
          {/* Aquí puedes añadir el resto de tu contenido del Dashboard */}
        </section>
        
      </main>
      
      {status && (
        <div style={{ 
          position: "fixed", 
          bottom: 80, 
          left: "50%", 
          transform: "translateX(-50%)", 
          background: "var(--text-main)", 
          color: "var(--bg-main)", 
          padding: "10px 20px", 
          borderRadius: 999, 
          fontWeight: 800, 
          fontSize: 13, 
          boxShadow: "0 8px 20px var(--shadow-card)", 
          zIndex: 100000 
        }}>
          {status}
        </div>
      )}

      {previewBinderOpen && (
        <VirtualBinder 
          binderName={previewTitle} 
          binderColor={previewColor} 
          coverUrl={previewCoverUrl} 
          pagesData={previewItems} 
          onClose={() => setPreviewBinderOpen(false)} 
        />
      )}

      <Footer />
    </div>
  );
}