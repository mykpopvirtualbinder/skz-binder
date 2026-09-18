"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGlobal } from "@/app/context/GlobalContext"; 
import { supabase } from "@/lib/supabase";
import { avisarFavoritos } from "@/lib/avisos";
import { 
  Paintbrush, Loader2, UploadCloud, BookOpen, 
  Image as ImageIcon, CheckCircle2, ImagePlus, Trash2, LayoutGrid, FilePlus
} from "lucide-react";

import Header from "../components/header"; // 👈 Añadimos el Header
import { splitTitleBody } from "@/lib/fanfic-translation";
const STUDIO_ACCENT = {
  cyan: "#66d9ef",
  violet: "#ae81ff",
  pink: "#ff79c6",
};

export default function CreatorStudio() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const { showAlert, t } = useGlobal(); // 👈 Añadido t()
  const [activeTab, setActiveTab] = useState("mis-obras"); 

  const [myArtworks, setMyArtworks] = useState<any[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "Arte 2D",
    content_text: "",
    is_nsfw: false
  });

  const [isNewStory, setIsNewStory] = useState(true);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string>("");

  useEffect(() => {
    const checkArtistAndLoadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: p } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      if (!p?.is_artist) { router.push('/fanart'); return; }

      setProfile(p);
      
      const { data: arts } = await supabase.from('fanarts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setMyArtworks(arts || []);

      const { data: stories } = await supabase.from('fanarts').select('id, title').eq('user_id', user.id).eq('category', 'Fanfics');
      setUserStories(stories || []);

      setLoading(false);
    };
    checkArtistAndLoadData();
  }, [router]);

  const uploadToStorage = async (fileToUpload: File) => {
    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `studio/${profile.user_id}/${Date.now()}_${Math.random()}.${fileExt}`;
    const { error: storageError } = await supabase.storage.from('fanart-pics').upload(fileName, fileToUpload);
    if (storageError) throw storageError;
    const { data: { publicUrl } } = supabase.storage.from('fanart-pics').getPublicUrl(fileName);
    return publicUrl;
  };

  const traducirTodoJSON = async (texto: string, intentos = 3): Promise<Record<string, string> | null> => {
    const IDIOMAS_DESTINO = ['en', 'fr', 'de', 'it', 'pt', 'id', 'th', 'ko', 'zh', 'ja'];
    for (let i = 0; i < intentos; i++) {
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "batch",
            text: texto,
            targetLangs: IDIOMAS_DESTINO,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((json as { error?: string })?.error || "TRANSLATION_REQUEST_FAILED");
        return ((json as { translations?: Record<string, string> })?.translations || null);
      } catch (error) {
        if (i === intentos - 1) return null; 
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    return null;
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    if (profile?.is_restricted) {
      setUploading(false);
      return showAlert(t("creator.alert_restricted_title"), t("creator.alert_restricted_msg"));
    }

    try {
      let mainUrl: string = "text-only";
      let finalThumbUrl: string | null = null;
      let targetFanartId: string | null = null; 

      if (formData.category === "Fanfics" || formData.category === t('creator.cat_fanfics')) {
        
        if (!isNewStory && !selectedStoryId) {
          setUploading(false);
          return alert(t("creator.alert_new_story"));
        }

        const textoParaTraducir = `${formData.title}\n|||\n${formData.content_text}`;
        const traduccionesIA = await traducirTodoJSON(textoParaTraducir);
        if (!traduccionesIA) { setUploading(false); return alert(t("creator.alert_ia_error")); }

        let currentObraId = selectedStoryId;
        if (isNewStory) {
          const { data: newObra, error: errO } = await supabase.from('obras').insert([{ autor_id: profile.user_id, idioma_original: 'es' }]).select('id').single();
          if (errO || !newObra) throw new Error("Error al crear la historia: " + errO?.message);
          currentObraId = newObra.id;
        }

        const { data: caps } = await supabase.from('capitulos').select('numero_capitulo').eq('obra_id', currentObraId).order('numero_capitulo', { ascending: false }).limit(1);
        const sigCapitulo = (caps?.[0]?.numero_capitulo ?? 0) + 1;
        
        const { data: newCap, error: errC } = await supabase.from('capitulos').insert([{ obra_id: currentObraId, numero_capitulo: sigCapitulo }]).select('id').single();
        if (errC || !newCap) throw new Error("Error al crear el capítulo: " + errC?.message);

        const IDIOMAS_CODIGOS = ['es', 'en', 'fr', 'de', 'it', 'pt', 'id', 'th', 'ko', 'zh', 'ja'];
        const rowsTraducciones = IDIOMAS_CODIGOS.flatMap(lang => {
          if (lang === 'es') {
            return [{ capitulo_id: newCap.id, idioma: lang, titulo: formData.title, contenido: formData.content_text }];
          }
          if (!traduccionesIA?.[lang]) return [];
          const parsed = splitTitleBody(traduccionesIA[lang], formData.title, formData.content_text);
          return [{ capitulo_id: newCap.id, idioma: lang, titulo: parsed.title, contenido: parsed.body }];
        });

        const { error: errT } = await supabase.from('traducciones').insert(rowsTraducciones);
        if (errT) throw new Error(errT.message);

        if (isNewStory) {
          if (thumbFile) { finalThumbUrl = await uploadToStorage(thumbFile); mainUrl = finalThumbUrl; }
          await supabase.from('fanarts').insert({
            id: currentObraId, title: formData.title, artist_name: profile.display_name,
            user_id: profile.user_id, category: "Fanfics", image_url: mainUrl, 
            thumbnail_url: finalThumbUrl, content_text: formData.content_text, active: true
          });
        }
        
        targetFanartId = currentObraId; 

      } else {
        if (!file) throw new Error(t("creator.alert_file_error"));
        mainUrl = await uploadToStorage(file);
        finalThumbUrl = thumbFile ? await uploadToStorage(thumbFile) : mainUrl;
        
        const { data: newArt, error: artErr } = await supabase.from('fanarts').insert({
          title: formData.title, artist_name: profile.display_name, user_id: profile.user_id,
          category: formData.category, image_url: mainUrl, thumbnail_url: finalThumbUrl,
          is_nsfw: formData.is_nsfw, media_type: file.type.includes("video") ? "video" : (file.type.includes("pdf") ? "pdf" : "image"), active: true
        }).select('id').single();
        
        if (artErr) throw artErr;
        targetFanartId = newArt.id; 
      }

      const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', profile.user_id);
      
      if (followers && followers.length > 0 && targetFanartId) {
        const notices = followers.map((f: any) => ({
          user_id: f.follower_id, actor_id: profile.user_id, post_id: null,
          fanart_id: targetFanartId, market_id: null, type: 'new_publication'
        }));
        await supabase.from('fanzone_notifications').insert(notices);
      }

      if (targetFanartId) {
        await avisarFavoritos(profile.user_id, 'fanart_id', targetFanartId);
      }
     
      showAlert(t("creator.alert_success_title"), t("creator.alert_success_msg"));
      
      setTimeout(() => { window.location.reload(); }, 2500);

    } catch (error: any) { 
      showAlert(t("creator.alert_error_title"), error.message);
    } finally {
      setUploading(false); 
    } 
  };

  const eliminarObra = async (id: string) => {
    if (profile?.is_restricted) return showAlert(t("creator.alert_restricted_title"), t("creator.alert_restricted_delete"));
    
    if (!confirm(t("creator.confirm_delete"))) return;
    await supabase.from('fanarts').delete().eq('id', id);
    setMyArtworks(prev => prev.filter(a => a.id !== id));
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="spinner" size={48} color="var(--color-primary)" />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)", paddingBottom: "100px", color: "var(--text-main)", transition: "background-color 0.3s ease" }}>

      <main style={{ maxWidth: "1000px", margin: "40px auto", padding: "20px" }}>
        
        {/* ENCABEZADO */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", borderBottom: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)", paddingBottom: "20px", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--bg-soft) 75%, transparent), color-mix(in srgb, var(--bg-card) 55%, transparent))", padding: "15px", borderRadius: "16px", border: "1px solid color-mix(in srgb, var(--color-border) 70%, transparent)", boxShadow: `0 0 0 1px color-mix(in srgb, ${STUDIO_ACCENT.cyan} 22%, transparent), 0 10px 24px color-mix(in srgb, ${STUDIO_ACCENT.violet} 20%, transparent)` }}>
              <Paintbrush size={32} color={STUDIO_ACCENT.cyan} />
            </div>
            <div>
              <h1 className="tan-font" style={{ color: STUDIO_ACCENT.violet, fontSize: "36px", margin: 0, textShadow: `0 0 18px color-mix(in srgb, ${STUDIO_ACCENT.violet} 45%, transparent)` }}>
                {t("creator.title")}
              </h1>
              <p style={{ color: "var(--text-muted)", fontWeight: 800, margin: 0 }}>
                {t('creator.hello')?.replace('{name}', profile.display_name) || `Hola, ${profile.display_name} ✨`}
              </p>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setActiveTab("mis-obras")} style={tabBtnStyle(activeTab === "mis-obras")}>
              <LayoutGrid size={18} /> {t("creator.tab_works")}
            </button>
            <button 
              onClick={() => {
                if (profile?.is_restricted) return showAlert(t("creator.alert_restricted_title"), t("creator.alert_restricted_msg"));
                setActiveTab("subir");
              }} 
              style={tabBtnStyle(activeTab === "subir")}
            >
              <FilePlus size={18} /> {t("creator.tab_new")}
            </button>
          </div>
        </div>

        {/* CONTENIDO DE PESTAÑAS */}
        {activeTab === "mis-obras" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "20px" }}>
            {myArtworks.length === 0 ? (
              <p style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-muted)", fontWeight: 700, padding: "50px" }}>
                {t("creator.empty_gallery")}
              </p>
            ) : (
              myArtworks.map(art => (
                <div key={art.id} style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 86%, transparent), color-mix(in srgb, var(--bg-main) 74%, transparent))", borderRadius: "20px", border: "1px solid color-mix(in srgb, var(--color-border) 70%, transparent)", overflow: "hidden", position: "relative", boxShadow: `0 10px 26px var(--shadow-card), 0 0 0 1px color-mix(in srgb, ${STUDIO_ACCENT.cyan} 18%, transparent)` }}>
                  <img src={art.thumbnail_url || art.image_url} style={{ width: "100%", height: "150px", objectFit: "cover" }} alt="" />
                  <div style={{ padding: "12px" }}>
                    <p style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 900, textTransform: "uppercase" }}>{art.category}</p>
                    <p style={{ fontSize: "14px", fontWeight: 900, color: STUDIO_ACCENT.violet, margin: "4px 0" }}>{art.title}</p>
                    <button onClick={() => eliminarObra(art.id)} style={{ background: "none", border: "none", color: "var(--text-main)", cursor: "pointer", fontSize: "11px", fontWeight: 800, display: "flex", alignItems: "center", gap: "4px", padding: 0, marginTop: "8px" }}>
                      <Trash2 size={12} /> {t("creator.btn_delete")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <form onSubmit={handleUpload} style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 88%, transparent), color-mix(in srgb, var(--bg-main) 72%, transparent))", padding: "40px", borderRadius: "24px", border: "1px solid color-mix(in srgb, var(--color-border) 72%, transparent)", display: "flex", flexDirection: "column", gap: "25px", boxShadow: `0 10px 30px var(--shadow-card), 0 0 0 1px color-mix(in srgb, ${STUDIO_ACCENT.violet} 14%, transparent)` }}>
             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <label style={labelStyle}>{t("creator.label_title")}</label>
                  <input required style={inputStyle} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder={t("creator.title_placeholder")} />
                </div>
                <div>
                  <label style={labelStyle}>{t("creator.label_category")}</label>
                  <select style={inputStyle} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value={t("creator.cat_2d")}>{t("creator.cat_2d")}</option>
                    <option value={t("creator.cat_3d")}>{t("creator.cat_3d")}</option>
                    <option value={t("creator.cat_crafts")}>{t("creator.cat_crafts")}</option>
                    <option value={t("creator.cat_fanfics")}>{t("creator.cat_fanfics")}</option>
                    <option value={t("creator.cat_media")}>{t("creator.cat_media")}</option>
                  </select>
                </div>
                
                {(formData.category === "Fanfics" || formData.category === t('creator.cat_fanfics')) && (
                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: "20px", background: "var(--bg-soft)", padding: "15px", borderRadius: "12px", border: "1px solid var(--color-border)", flexWrap: "wrap" }}>
                    <label style={{ cursor: "pointer", fontWeight: 800, fontSize: "14px", color: "var(--color-primary)" }}>
                      <input type="radio" checked={isNewStory} onChange={() => setIsNewStory(true)} style={{ accentColor: "var(--color-primary)" }} /> {t("creator.radio_new_story")}
                    </label>
                    {userStories.length > 0 && (
                      <label style={{ cursor: "pointer", fontWeight: 800, fontSize: "14px", color: "var(--color-primary)" }}>
                        <input type="radio" checked={!isNewStory} onChange={() => setIsNewStory(false)} style={{ accentColor: "var(--color-primary)" }} /> {t("creator.radio_add_chapter")}
                      </label>
                    )}
                    {!isNewStory && (
                      <select style={{ ...inputStyle, flex: 1, padding: "8px" }} value={selectedStoryId} onChange={(e) => setSelectedStoryId(e.target.value)}>
                        <option value="">{t("creator.select_story")}</option>
                        {userStories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                      </select>
                    )}
                  </div>
                )}
             </div>

             {(formData.category === "Fanfics" || formData.category === t('creator.cat_fanfics')) ? (
                <div>
                  <label style={labelStyle}><BookOpen size={16} style={{ display: "inline", marginBottom: "-3px" }}/> {t("creator.label_text")}</label>
                  <textarea required style={{ ...inputStyle, minHeight: "350px", resize: "vertical", fontFamily: "Georgia, serif", fontSize: "15px" }} value={formData.content_text} onChange={e => setFormData({...formData, content_text: e.target.value})} placeholder={t("creator.text_placeholder")} />
                </div>
             ) : (
                <div>
                  <label style={labelStyle}>{t("creator.label_main_file")}</label>
                  <div style={dropzoneStyle(!!file)}>
                    <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: "none" }} id="main-file" />
                    <label htmlFor="main-file" style={{ cursor: "pointer" }}>
                      {file ? <CheckCircle2 color="var(--color-primary)" /> : <UploadCloud color="var(--color-primary)" />} 
                      <span>{file ? file.name : t("creator.upload_content")}</span>
                    </label>
                  </div>
                </div>
             )}

             <div>
               <label style={labelStyle}>
                 {(formData.category === "Fanfics" || formData.category === t('creator.cat_fanfics')) ? t("creator.label_cover_opt") : t("creator.label_cover_req")}
               </label>
               <div style={dropzoneStyle(!!thumbFile, "var(--bg-soft)")}>
                 <input type="file" accept="image/*" onChange={e => setThumbFile(e.target.files?.[0] || null)} style={{ display: "none" }} id="thumb-file" />
                 <label htmlFor="thumb-file" style={{ cursor: "pointer" }}>
                   {thumbFile ? <CheckCircle2 color="var(--color-primary)" /> : <ImagePlus color="var(--color-primary)" />} 
                   <span>{thumbFile ? thumbFile.name : t("creator.upload_cover")}</span>
                 </label>
               </div>
             </div>

             <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
               <input type="checkbox" checked={formData.is_nsfw} onChange={e => setFormData({...formData, is_nsfw: e.target.checked})} style={{ accentColor: "var(--color-primary)" }} /> 
               <span style={{ fontSize: "14px", color: "var(--color-primary)", fontWeight: 800 }}>{t("creator.nsfw")}</span>
             </label>

             <button type="submit" disabled={uploading} style={{ background: `linear-gradient(135deg, ${STUDIO_ACCENT.violet}, ${STUDIO_ACCENT.cyan})`, color: "white", border: "none", padding: "20px", borderRadius: "15px", fontWeight: 900, fontSize: "16px", cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.7 : 1, boxShadow: `0 12px 28px color-mix(in srgb, ${STUDIO_ACCENT.violet} 30%, transparent)` }}>
               {uploading ? <Loader2 className="spinner" /> : t("creator.btn_publish")}
             </button>
          </form>
        )}

      </main>
      <style jsx global>{`
        @font-face { font-family: 'TanTangkiwood'; src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype'); }
        .tan-font { font-family: 'TanTangkiwood', sans-serif !important; text-transform: uppercase; }
        .spinner { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ESTILOS DINÁMICOS
const labelStyle = { display: "block", fontSize: "13px", fontWeight: 800, color: STUDIO_ACCENT.cyan, marginBottom: "8px", letterSpacing: "0.02em", textTransform: "uppercase" as const };
const inputStyle = { width: "100%", padding: "14px", borderRadius: "12px", border: `1px solid color-mix(in srgb, ${STUDIO_ACCENT.cyan} 30%, var(--color-border))`, outline: "none", boxSizing: "border-box" as any, background: "color-mix(in srgb, var(--bg-main) 84%, transparent)", color: "var(--text-main)", boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${STUDIO_ACCENT.violet} 12%, transparent)` };
const dropzoneStyle = (hasFile: boolean, color = "var(--bg-soft)") => ({ padding: "20px", border: hasFile ? `2px solid ${STUDIO_ACCENT.cyan}` : `2px dashed color-mix(in srgb, ${STUDIO_ACCENT.violet} 42%, var(--color-border))`, borderRadius: "12px", textAlign: "center" as const, backgroundColor: hasFile ? color : "color-mix(in srgb, var(--bg-card) 88%, transparent)", transition: "all 0.3s", boxShadow: hasFile ? `0 0 0 1px color-mix(in srgb, ${STUDIO_ACCENT.cyan} 25%, transparent)` : "none" });
const tabBtnStyle = (active: boolean) => ({ background: active ? `linear-gradient(135deg, ${STUDIO_ACCENT.violet}, ${STUDIO_ACCENT.cyan})` : "color-mix(in srgb, var(--bg-card) 90%, transparent)", color: active ? "white" : "var(--text-main)", border: active ? "1px solid transparent" : "1px solid color-mix(in srgb, var(--color-border) 80%, transparent)", padding: "10px 18px", borderRadius: "99px", fontWeight: 900, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "0.2s", boxShadow: active ? `0 10px 20px color-mix(in srgb, ${STUDIO_ACCENT.violet} 28%, transparent)` : "none" });