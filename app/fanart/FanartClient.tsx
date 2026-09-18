"use client";
import Footer from "../components/footer";
import AdRailLayout from "../components/AdRailLayout";
import React, { useState, useRef, useEffect, Suspense } from "react";

import {
  Heart, MessageCircle, Plus, Paintbrush, X, UploadCloud, Loader2,
  FileText, Film, Eye, AlertTriangle, Maximize2, BookOpen, Flag, CheckCircle,
  ChevronLeft, ChevronRight, Trash2
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { canModerateGlobalContent } from "@/lib/admin-emails";
import { useGlobal } from "@/app/context/GlobalContext";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getUiLanguage,
  looksUntranslated,
  persistFanficTranslation,
  translateFanficLive,
} from "@/lib/fanfic-translation";

type FanArtPost = {
  id: string;
  user_id: string;
  artist_name: string;
  image_url: string;
  thumbnail_url?: string;
  title: string;
  category: string;
  is_nsfw: boolean;
  media_type: 'image' | 'video' | 'pdf';
  content_text?: string;
  likes_count?: number;
  user_has_liked?: boolean;
  profiles?: { display_name?: string; avatar_url?: string; is_artist?: boolean; is_featured_artist?: boolean };
  web_user_name?: string;
  author_badge?: string;
  comments_count?: number;
  _show_nsfw?: boolean;
};

/** UI ids → DB `fanarts.category` (Spanish labels stored in Supabase). */
const FANART_CATEGORY_FILTERS = [
  { id: "all" as const, dbCategory: null },
  { id: "2d" as const, dbCategory: "Arte 2D" },
  { id: "3d" as const, dbCategory: "Arte 3D" },
  { id: "crafts" as const, dbCategory: "Artesanía" },
  { id: "fanfics" as const, dbCategory: "Fanfics" },
  { id: "multimedia" as const, dbCategory: "Multimedia" },
];
const DEFAULT_AVATAR = "https://ui-avatars.com/api/?name=U&background=ffd9e6&color=8C659C";

/** Acentos por tema (Midnight = Monokai vía CSS; pastel/café/vibrant = tokens en globals.css) */
const ACC = {
  pink: "var(--accent-vibe-pink)",
  cyan: "var(--accent-vibe-cyan)",
  orange: "var(--accent-vibe-orange)",
  green: "var(--accent-vibe-green)",
  violet: "var(--accent-vibe-violet)",
} as const;

const FANART_CTA_GRAD = "var(--modal-cta-gradient)";
const FANART_CTA_SHADOW = "var(--modal-cta-shadow)";

const LANGUAGES = [
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'de', label: '🇩🇪 Deutsch' },
  { code: 'it', label: '🇮🇹 Italiano' },
  { code: 'pt', label: '🇧🇷 Português' },
  { code: 'id', label: '🇮🇩 Indonesia' },
  { code: 'th', label: '🇹🇭 ไทย' },
  { code: 'ko', label: '🇰🇷 한국어' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'ja', label: '🇯🇵 日本語' }
];

function FanArtContent() {
  const { profile: activeUser, showAlert, showPrompt, showConfirm, t, uiLanguage } = useGlobal();
  
  const [localProfile, setLocalProfile] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const denunciaId = searchParams.get('denunciaId');

  const isAdminReturn = searchParams.get('admin') === 'true';

  useEffect(() => {
   const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
        setLocalProfile({
          id: user.id,
          email: user.email,
          display_name: p?.display_name || t("global.default_user_name"),
          avatar_url: p?.avatar_url || null,
          is_adult: p?.is_adult || false,
          is_artist: p?.is_artist || false 
        });
      }
    };
    checkAuth();
  }, []);

  // --- ESTADOS DE LA GALERÍA ---
  const [artworks, setArtworks] = useState<FanArtPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<
    (typeof FANART_CATEGORY_FILTERS)[number]["id"]
  >("all");
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [showCompactFilters, setShowCompactFilters] = useState(false);

  // --- ESTADOS DEL VISOR ---
  const [viewingArt, setViewingArt] = useState<FanArtPost | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenOpenedAt = useRef(0);

  const openFullscreen = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    fullscreenOpenedAt.current = Date.now();
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    if (Date.now() - fullscreenOpenedAt.current < 400) return;
    setIsFullscreen(false);
  };

  const highlightId = searchParams.get("highlight");

  useEffect(() => {
    if (highlightId && viewingArt) { 
      setTimeout(() => {
        const el = document.getElementById(`comment-${highlightId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 800); 
    }
  }, [highlightId, viewingArt]);

  // --- ESTADOS DE CAPÍTULOS E IDIOMA ---
  const [chapters, setChapters] = useState<any[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [currentLang, setCurrentLang] = useState('es');
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState<{ current: number; total: number } | null>(null);

  const applyTranslation = (titulo?: string | null, contenido?: string | null) => {
    setViewingArt((prev) =>
      prev
        ? {
            ...prev,
            title: titulo || prev.title,
            content_text: contenido ?? prev.content_text,
          }
        : prev
    );
  };

  const loadSpecificChapter = async (chapterId: string, langCode: string, obraId?: string) => {
    const [{ data: original }, { data }] = await Promise.all([
      supabase
        .from("traducciones")
        .select("contenido, titulo")
        .eq("capitulo_id", chapterId)
        .eq("idioma", "es")
        .maybeSingle(),
      supabase
        .from("traducciones")
        .select("contenido, titulo")
        .eq("capitulo_id", chapterId)
        .eq("idioma", langCode)
        .maybeSingle(),
    ]);

    const source = original || data;
    if (langCode === "es") {
      if (source) applyTranslation(source.titulo, source.contenido);
      return !!source;
    }

    if (data && !looksUntranslated(data, original || source)) {
      applyTranslation(data.titulo, data.contenido);
      if (data.titulo) {
        setTranslatedTitles((prev) => ({ ...prev, [String(obraId || viewingArt?.id || "")]: data.titulo as string }));
      }
      return true;
    }

    const sourceTitle = source?.titulo || viewingArt?.title || "";
    const sourceBody = source?.contenido || viewingArt?.content_text || "";
    if (!sourceTitle && !sourceBody) {
      showAlert(t("common.error"), t("fanart.translation_unavailable"));
      return false;
    }

    setTranslating(true);
    setTranslationProgress({ current: 0, total: 1 });
    try {
      const live = await translateFanficLive(sourceTitle, sourceBody, langCode, (current, total) => {
        setTranslationProgress({ current, total });
      });
      applyTranslation(live.title, live.body);
      setTranslatedTitles((prev) => ({ ...prev, [String(obraId || viewingArt?.id || "")]: live.title }));
      await persistFanficTranslation({
        capituloId: chapterId,
        idioma: langCode,
        titulo: live.title,
        contenido: live.body,
      });
      return true;
    } catch (err) {
      console.error(err);
      showAlert(t("common.error"), t("fanart.translation_unavailable"));
      if (source) applyTranslation(source.titulo, source.contenido);
      return false;
    } finally {
      setTranslating(false);
      setTranslationProgress(null);
    }
  };

  const fetchChapters = async (obraId: string, langCode: string) => {
    setLoadingChapters(true);
    const { data } = await supabase
      .from('capitulos')
      .select('id, numero_capitulo')
      .eq('obra_id', obraId)
      .order('numero_capitulo', { ascending: true });

    if (data && data.length > 0) {
      setChapters(data);
      setCurrentChapterIndex(0);
      await loadSpecificChapter(data[0].id, langCode, obraId);
    } else {
      setChapters([]);
    }
    setLoadingChapters(false);
  };

  useEffect(() => {
    if (viewingArt && viewingArt.category === "Fanfics") {
      const lang = getUiLanguage(uiLanguage);
      setCurrentLang(lang);
      fetchChapters(viewingArt.id, lang);
    } else {
      setChapters([]);
    }
  }, [viewingArt?.id, uiLanguage]);

  useEffect(() => {
    const fanficIds = artworks
      .filter((art) => art.category === "Fanfics" || !!art.content_text)
      .map((art) => art.id);
    const lang = getUiLanguage(uiLanguage);
    if (!fanficIds.length) {
      setTranslatedTitles({});
      return;
    }
    let alive = true;
    (async () => {
      const { data: caps } = await supabase
        .from("capitulos")
        .select("id, obra_id")
        .in("obra_id", fanficIds)
        .eq("numero_capitulo", 1);
      if (!alive || !caps?.length) return;
      const { data: rows } = await supabase
        .from("traducciones")
        .select("capitulo_id, titulo")
        .in("capitulo_id", caps.map((c: { id: string }) => c.id))
        .eq("idioma", lang);
      const capToObra = Object.fromEntries(caps.map((c: { id: string; obra_id: string }) => [c.id, c.obra_id]));
      const originals = Object.fromEntries(artworks.map((a) => [a.id, a.title]));
      const next: Record<string, string> = {};
      for (const row of rows || []) {
        const obraId = capToObra[row.capitulo_id];
        if (!obraId || !row.titulo) continue;
        if (String(row.titulo).trim() !== String(originals[obraId] || "").trim()) {
          next[obraId] = row.titulo;
        }
      }
      if (alive) setTranslatedTitles(next);
      if (lang !== "es") {
        for (const art of artworks.filter((a) => a.category === "Fanfics" || !!a.content_text)) {
          if (!alive || next[art.id] || !art.title) continue;
          try {
            const res = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "single", text: art.title, targetLang: lang }),
            });
            const json = (await res.json().catch(() => ({}))) as { translation?: string };
            const title = String(json.translation || "").trim();
            if (!alive || !title || title === art.title) continue;
            setTranslatedTitles((prev) => ({ ...prev, [art.id]: title }));
          } catch {
            /* keep original card title */
          }
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [artworks, uiLanguage]);

  const handleLanguageChange = async (newLang: string) => {
    setCurrentLang(newLang);
    const chapterId = chapters[currentChapterIndex]?.id ?? chapters[0]?.id;
    if (!chapterId) {
      showAlert(t("common.error"), t("fanart.translation_unavailable"));
      return;
    }
    await loadSpecificChapter(chapterId, newLang);
  };

  const categoryLabel = (dbCategory: string) => {
    const map: Record<string, string> = {
      "Arte 2D": t("fanart.filters.2d"),
      "Arte 3D": t("fanart.filters.3d"),
      "Artesanía": t("fanart.filters.crafts"),
      "Fanfics": t("fanart.filters.fanfics"),
      "Multimedia": t("fanart.filters.multimedia"),
    };
    return map[dbCategory] || dbCategory;
  };

  const displayTitle = (art: { id: string; title: string }) => translatedTitles[art.id] || art.title;

  // --- RESTO DE ESTADOS ---
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => {
    const autoOpenId = sessionStorage.getItem("open_fanart_id");
    if (autoOpenId && artworks.length > 0) {
      const artToOpen = artworks.find(a => a.id === autoOpenId);
      if (artToOpen) {
        setViewingArt(artToOpen);
        sessionStorage.removeItem("open_fanart_id");
      }
    }
  }, [artworks]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    nombre: "", apellidos: "", nombreArtistico: "", email: "",
    instagram: "", tiktok: "", youtube: "", x: "", facebook: "", comentarios: ""
  });

  const fetchArt = async () => {
    setLoading(true);
    try {
      let isAdult = false;
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        const { data: p } = await supabase.from('profiles').select('is_adult').eq('user_id', auth.user.id).single();
        if (p?.is_adult) isAdult = true;
      }
      let query = supabase.from('fanarts').select('*, fanart_likes(user_id), fanart_comments(id)').eq('active', true);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = Array.from(new Set(data.map((a: any) => a.user_id).filter(Boolean)));
      const { data: pData, error: pError } = await supabase.from('profiles').select('user_id, display_name, avatar_url, is_artist, is_featured_artist').in('user_id', userIds);
      if (pError) console.error("Error cargando perfiles en galería:", pError);
      
      const pMap = Object.fromEntries((pData || []).map(p => [p.user_id, p]));

      const enriched = data.map((art: any) => ({
        ...art,
        profiles: pMap[art.user_id] || {},
        likes_count: art.fanart_likes?.length || 0,
        comments_count: art.fanart_comments?.length || 0,
        user_has_liked: art.fanart_likes?.some((l: any) => l.user_id === auth?.user?.id),
        _show_nsfw: !art.is_nsfw || isAdult
      }));
      const ordered = [...enriched].sort((a, b) => {
        const aStar = a.profiles?.is_featured_artist ? 1 : 0;
        const bStar = b.profiles?.is_featured_artist ? 1 : 0;
        if (aStar !== bStar) return bStar - aStar;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setArtworks(ordered);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchArt(); }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncViewport = () => {
      const compact = window.innerWidth <= 1024;
      setIsCompactViewport(compact);
      if (!compact) setShowCompactFilters(false);
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const filteredArt = artworks.filter((art) => {
    const entry = FANART_CATEGORY_FILTERS.find(
      (f) => f.id === activeCategoryFilter
    );
    const categoryMatch =
      entry?.dbCategory == null || art.category === entry.dbCategory;
    return categoryMatch && art._show_nsfw;
  });

  const handleLike = async (e: React.MouseEvent, art: FanArtPost, hasLiked: boolean) => {
    e.stopPropagation();
    if (!activeUser) return showAlert(t("fanart.alerts.login_like_title"), t("fanart.alerts.login_like_msg"));
    if (hasLiked) {
      await supabase.from('fanart_likes').delete().eq('fanart_id', art.id).eq('user_id', activeUser.id);
    } else {
      await supabase.from('fanart_likes').insert({ fanart_id: art.id, user_id: activeUser.id });
      if (art.user_id && art.user_id !== activeUser.id) {
        await supabase.from('notifications').insert({
          user_id: art.user_id, sender_id: activeUser.id, type: 'like',
          content: `${activeUser.display_name} le ha dado me gusta a tu publicación.`, image_url: art.id
        });
      }
    }
    fetchArt();
  };

  const loadComments = async (artId: string) => {
    const { data: comms, error } = await supabase.from('fanart_comments').select('*').eq('fanart_id', artId).order('created_at', { ascending: true });
    if (error || !comms || comms.length === 0) return setComments([]);
    const uIds = Array.from(new Set(comms.map(c => c.user_id)));
    const { data: profs } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', uIds);
    const pMap = Object.fromEntries((profs || []).map(p => [p.user_id, p]));
    setComments(comms.map(c => ({
      ...c, profiles: pMap[c.user_id] || { display_name: t("global.default_user_name"), avatar_url: null }
    })));
  };

  useEffect(() => { if (viewingArt) loadComments(viewingArt.id); }, [viewingArt]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setIsModalOpen(false);
          return;
        }
      }
      if (isFullscreen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setIsFullscreen(false);
          return;
        }
      }
      if (viewingArt) {
        if (e.key === "Escape") {
          e.preventDefault();
          setIsFullscreen(false);
          setViewingArt(null);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen, viewingArt, isFullscreen]);

  const deleteComment = async (commentId: string) => {
    const confirmDelete = await showConfirm(t("common.confirm"), t("fanart.confirm_delete_comment"));
    if (!confirmDelete) return;
    if (!activeUser?.id) return;
    const canModerateAllContent = canModerateGlobalContent(
      (activeUser as { email?: string | null } | null)?.email
    );
    const { data: commentRow } = await supabase
      .from("fanart_comments")
      .select("id,user_id")
      .eq("id", commentId)
      .single();
    const isOwner = commentRow?.user_id === activeUser.id;
    if (!isOwner && !canModerateAllContent) {
      return showAlert(t("common.error"), t("fanart.no_permission_comment"));
    }
    const { error } = await supabase.from('fanart_comments').delete().eq('id', commentId);
    if (error) return showAlert(t("common.error"), `${t("common.error")}: ${error.message}`);
    if (viewingArt) loadComments(viewingArt.id);

    setViewingArt(prev => prev ? { ...prev, comments_count: Math.max(0, (prev.comments_count || 0) - 1) } : prev);
    setArtworks(prev => prev.map(art => art.id === viewingArt?.id ? { ...art, comments_count: Math.max(0, (art.comments_count || 0) - 1) } : art));
  };

  const deleteFanArtPost = async (artId: string) => {
    const confirmDelete = await showConfirm(t("common.confirm"), t("fanart.admin_delete_warn"));
    if (!confirmDelete) return;
    const canModerateAllContent = canModerateGlobalContent(
      (activeUser as { email?: string | null } | null)?.email
    );
    if (!canModerateAllContent) {
      return showAlert(t("common.error"), t("fanart.no_permission_delete"));
    }
    const { error } = await supabase.from('fanarts').delete().eq('id', artId);
    if (error) return showAlert(t("common.error"), `${t("common.error")}: ${error.message}`);
    showAlert(t("common.deleted"), t("fanart.post_deleted"));
    setViewingArt(null);
    fetchArt();
  };

  const postComment = async () => {
    if (activeUser?.is_restricted) {
      return showAlert(t("fanart.alerts.restricted_title"), t("fanart.alerts.restricted_comment_msg"));
    }

    if (!newComment.trim() || !activeUser?.id || !viewingArt) return;

    const payload: any = { fanart_id: viewingArt.id, user_id: activeUser.id, comment_text: newComment };
    if (replyingTo) payload.parent_id = replyingTo;
    
    const { error } = await supabase.from('fanart_comments').insert(payload);
    
    if (error) return showAlert("Error", error.message);
    
    if (viewingArt.user_id && viewingArt.user_id !== activeUser.id) {
      await supabase.from('notifications').insert({
        user_id: viewingArt.user_id, 
        sender_id: activeUser.id, 
        type: 'comment',
        content: `${activeUser.display_name} ha comentado tu publicación.`, 
        image_url: viewingArt.id
      });
    }

    setNewComment(""); 
    setReplyingTo(null);
    loadComments(viewingArt.id);
    
    setViewingArt(prev => prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1} : prev);
    setArtworks(prev => prev.map(art => art.id === viewingArt.id ? {...art, comments_count: (art.comments_count || 0) + 1 } : art));
  };

  const enviarReporteComentario = (commentId: string, reportedUserId: string) => {
    if (!activeUser) return showAlert(t("fanart.alerts.login_report_title"), t("fanart.alerts.login_report_msg"));
    showPrompt(t("fanart.report_comment"), t("fanart.report_reason"), async (reason, isAnonymous) => {
      const { error } = await supabase.from('denuncias').insert({
        reporter_id: isAnonymous ? null : activeUser.id,
        reported_user_id: reportedUserId,
        fanart_id: viewingArt?.id,
        motivo: `[Comentario: ${commentId}] ${reason}`,
        estado: 'pendiente'
      });
      
      if (error) showAlert(t("common.error"), `${t("common.error")}: ${error.message}`);
      else showAlert(t("fanart.alerts.report_success_title"), t("fanart.report_success"));
    });
  };

  const enviarReporteObra = (artId: string, reportedUserId: string) => {
    if (!activeUser) return showAlert(t("fanart.alerts.login_report_title"), t("fanart.alerts.login_report_msg"));
    showPrompt(t("fanart.report_art"), t("fanart.report_art_reason"), async (reason, isAnonymous) => {
      const { error } = await supabase.from('denuncias').insert({
        reporter_id: isAnonymous ? null : activeUser.id,
        reported_user_id: reportedUserId,
        fanart_id: artId,
        motivo: `[Reporte de Obra] ${reason}`,
        estado: 'pendiente'
      });
      
      if (error) showAlert(t("common.error"), `${t("common.error")}: ${error.message}`);
      else showAlert(t("fanart.alerts.report_success_title"), t("fanart.report_success"));
    });
  };

  const handleCommentLike = async (commentId: string, hasLiked: boolean) => {
   if (!activeUser) return showAlert(t("fanart.alerts.login_like_title"), t("fanart.alerts.login_like_msg"));
    
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        return { 
          ...c, 
          user_has_liked: !hasLiked, 
          likes_count: hasLiked ? Math.max(0, (c.likes_count || 0) - 1) : (c.likes_count || 0) + 1 
        };
      }
      return c;
    }));

    if (hasLiked) {
      await supabase.from('fanart_comment_likes').delete().eq('comment_id', commentId).eq('user_id', activeUser.id);
    } else {
      await supabase.from('fanart_comment_likes').insert({ comment_id: commentId, user_id: activeUser.id });
    }
  };

  const renderComments = (parentId: string | null = null, level: number = 0): any[] => {
    return comments.filter(c => c.parent_id === parentId).map((c) => {
      const canModerateAllContent = canModerateGlobalContent(
        (activeUser as { email?: string | null } | null)?.email
      );
      const isCommentOwner = activeUser?.id === c.user_id;
      const canDelete = canModerateAllContent || isCommentOwner;
      const isHighlighted = c.id === highlightId;

      return (
        <div
          id={`comment-${c.id}`}
          key={c.id}
          className={isHighlighted ? "highlight-target" : ""}
          style={{
            marginLeft: level > 0 ? "30px" : "0",
            marginTop: "15px",
            borderLeft: level > 0 ? "2px solid var(--color-border)" : "none",
            paddingLeft: level > 0 ? "15px" : "0",
            transition: "all 0.5s ease"
          }}
        >
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <img 
              onClick={() => router.push(`/me?u=${c.user_id}`)}
              src={c.profiles?.avatar_url || DEFAULT_AVATAR} 
              style={{ width: level > 0 ? "28px" : "36px", height: level > 0 ? "28px" : "36px", borderRadius: "50%", objectFit: "cover", cursor: "pointer", border: `2px solid color-mix(in srgb, ${ACC.cyan} 45%, var(--color-border))` }} 
              alt="Avatar" 
            />
            
            <div style={{ flex: 1 }}>
              <div style={{ background: "var(--bg-soft)", padding: "12px 16px", borderRadius: "18px", position: "relative", border: `1px solid color-mix(in srgb, ${ACC.cyan} 30%, var(--color-border))` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span 
                    onClick={() => router.push(`/me?u=${c.user_id}`)}
                    style={{ fontSize: "13px", fontWeight: 900, color: ACC.violet, cursor: "pointer", display: "block", marginBottom: "4px" }}
                  >
                    {c.profiles?.display_name || "Usuario"}
                  </span>

                  {canDelete && (
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await showConfirm(t("common.confirm"), t("fanart.confirm_delete_comment"));
                        if (ok) {
                          deleteComment(c.id);
                        }
                      }} 
                      style={{ 
                        background: "var(--bg-main)", 
                        border: `1px solid color-mix(in srgb, ${ACC.pink} 40%, var(--color-border))`, 
                        color: ACC.pink, 
                        cursor: "pointer", 
                        borderRadius: "50%", 
                        width: "28px", 
                        height: "28px", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        marginLeft: "10px",
                        flexShrink: 0,
                        transition: "transform 0.2s"
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                      onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                      title={t("common.delete")}
                    >
                      <Trash2 size={14} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
                
                <p style={{ margin: 0, fontSize: "14px", color: "var(--text-main)", lineHeight: "1.4" }}>
                  {c.comment_text}
                </p>
              </div>

              <div style={{ display: "flex", gap: "15px", alignItems: "center", marginTop: "5px", paddingLeft: "10px" }}>
                <button 
                  onClick={() => {
                    setReplyingTo(c.id);
                    setNewComment(`@${c.profiles?.display_name} `);
                  }}
                  style={{ background: "none", border: "none", color: ACC.cyan, fontSize: "12px", fontWeight: 800, cursor: "pointer" }}
                >
                  {t('fanart.reply')}
                </button>

                <button 
                  onClick={() => handleCommentLike(c.id, !!c.user_has_liked)} 
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--text-muted)", fontWeight: 800 }}
                >
                  <Heart size={12} fill={c.user_has_liked ? ACC.pink : "none"} color={c.user_has_liked ? ACC.pink : "currentColor"} /> 
                  {c.likes_count || 0}
                </button>
              </div>
            </div>
          </div>
          {renderComments(c.id, level + 1)}
        </div>
      );
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) setSelectedFiles(Array.from(e.target.files)); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setIsSubmitting(true);
    
    try {
      if (!activeUser?.id) return showAlert(t("fanart.alerts.login_upload_title"), t("fanart.alerts.login_upload_msg"));

      const payload = new FormData();
      payload.append('nombre', formData.nombre);
      payload.append('apellidos', formData.apellidos);
      payload.append('nombreArtistico', formData.nombreArtistico);
      payload.append('email', formData.email);
      payload.append('comentarios', formData.comentarios);
      payload.append('instagram', formData.instagram);
      payload.append('tiktok', formData.tiktok);
      payload.append('youtube', formData.youtube);
      payload.append('x', formData.x);
      payload.append('facebook', formData.facebook);
      payload.append('userId', activeUser.id);
      selectedFiles.forEach((file) => payload.append('files', file));

      const res = await fetch('/api/fanart', {
        method: 'POST',
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar la solicitud');

      showAlert(t("fanart.alerts.upload_success_title"), t("fanart.alerts.upload_success_msg"));
      setIsModalOpen(false);
      setFormData({ nombre: "", apellidos: "", nombreArtistico: "", email: "", instagram: "", tiktok: "", youtube: "", x: "", facebook: "", comentarios: "" });
      setSelectedFiles([]);

    } catch (error: any) {
      console.error("Error enviando solicitud:", error);
      alert(`${t("common.error")}: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: `1px solid color-mix(in srgb, ${ACC.cyan} 28%, var(--color-border))`,
    outline: "none",
    fontSize: "14px",
    color: "var(--text-main)",
    backgroundColor: "var(--bg-main)",
    marginBottom: "15px",
    boxSizing: "border-box" as const,
  };
  const labelStyle = {
    display: "block",
    fontSize: "11px",
    fontWeight: 800,
    color: ACC.pink,
    marginBottom: "5px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  };

  const isVerifiedArtist = Boolean(
    localProfile?.is_artist || (activeUser as { is_artist?: boolean } | null)?.is_artist
  );

  const handleUploadArtClick = () => {
    if (isVerifiedArtist) {
      router.push("/studio");
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-main)",
        display: "flex",
        flexDirection: "column",
        color: "var(--text-main)",
        transition: "background-color 0.3s ease"
      }}
    >
      <AdRailLayout section="fanart">
      <main className="fanart-main" style={{ flex: 1, width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "40px 20px 36px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px", borderBottom: `1px solid color-mix(in srgb, ${ACC.violet} 22%, var(--color-border))`, paddingBottom: "20px", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <Paintbrush size={28} color={ACC.cyan} strokeWidth={2.2} />
              <h1 className="tan-font" style={{ fontSize: "42px", margin: 0, color: ACC.violet }}>
                {t('fanart.title')}
              </h1>            
            </div>
            <p style={{ color: "var(--text-subheading)", fontWeight: 700, fontSize: "16px", margin: 0 }}>
              {t('fanart.subtitle')}
            </p>
          </div>
          <button 
            type="button"
            onClick={handleUploadArtClick}
            style={{
              background: `linear-gradient(135deg, ${ACC.violet}, ${ACC.cyan})`,
              color: "var(--modal-cta-fg)",
              border: "none",
              padding: "14px 28px",
              borderRadius: "99px",
              fontWeight: 900,
              fontSize: "15px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: `0 10px 24px color-mix(in srgb, ${ACC.violet} 25%, transparent)`,
            }}
          >
            <Plus size={20} strokeWidth={3} /> {t('fanart.upload_art')}
          </button>
        </div>

        {isCompactViewport && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button type="button" onClick={() => setShowCompactFilters((v) => !v)} style={{ border: `1px solid color-mix(in srgb, ${ACC.pink} 45%, var(--color-border))`, background: "var(--bg-card)", color: ACC.pink, borderRadius: "99px", padding: "10px 14px", fontWeight: 900, cursor: "pointer" }}>
              {showCompactFilters ? (t("common.close") || "Cerrar") : (t("common.filters") || "Filtros")}
            </button>
          </div>
        )}
        <div className="h-scroll-pills page-filters-panel" style={{ display: !isCompactViewport || showCompactFilters ? "flex" : "none", gap: "10px", marginBottom: "40px", flexWrap: "wrap" }}>
          {FANART_CATEGORY_FILTERS.map(({ id }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveCategoryFilter(id)}
              style={{
                padding: "10px 20px",
                borderRadius: "99px",
                border: `1px solid ${ACC.violet}`,
                background:
                  activeCategoryFilter === id ? ACC.violet : "transparent",
                color: activeCategoryFilter === id ? "var(--modal-cta-fg)" : ACC.violet,
                fontWeight: 800,
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {t(`fanart.filters.${id}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "100px" }}><Loader2 className="spinner" size={48} color={ACC.cyan} /></div>
        ) : (
          <div className="fanart-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "30px", paddingBottom: "60px" }}>
          {filteredArt.map((art) => (
              <div key={art.id} onClick={() => setViewingArt(art)}
              id={`fanart-${art.id}`}
              ref={(el) => {
                if (el && highlightId === art.id) {
                  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
                }
              }}
              className="art-card" 
              style={{ 
                backgroundColor: "var(--bg-card)",
                borderRadius: "24px", 
                overflow: "hidden", 
                border: `1px solid ${highlightId === art.id ? ACC.cyan : "var(--color-border)"}`, 
                display: "flex", 
                flexDirection: "column", 
                transition: "all 0.35s ease", 
                cursor: "pointer", 
                position: "relative",
                boxShadow: highlightId === art.id ? `0 0 0 2px color-mix(in srgb, ${ACC.cyan} 55%, transparent), 0 12px 28px var(--shadow-card)` : "0 5px 15px var(--shadow-card)",
                transform: highlightId === art.id ? "scale(1.025)" : "scale(1)",
                animation: highlightId === art.id ? "fanart-highlight-pulse 2s infinite alternate ease-in-out" : "none"
              }}>
              
              <style>{`
                @keyframes fanart-highlight-pulse {
                  0% { box-shadow: 0 0 0 3px color-mix(in srgb, ${ACC.cyan} 70%, transparent), 0 10px 20px var(--shadow-card); }
                  100% { box-shadow: 0 0 28px 6px color-mix(in srgb, ${ACC.violet} 35%, transparent), 0 0 0 4px color-mix(in srgb, ${ACC.cyan} 45%, transparent); }
                }
              `}</style>
          
                <div style={{ width: "100%", height: "280px", position: "relative", overflow: "hidden", backgroundColor: "var(--bg-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {art.thumbnail_url ? (
                    <img src={art.thumbnail_url} alt={art.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} className="art-img" />
                  ) : art.content_text ? (
                    <div style={{ textAlign: 'center', color: ACC.cyan }}><BookOpen size={48} strokeWidth={2} /><p style={{ fontSize: '11px', fontWeight: 900, marginTop: 5, color: ACC.cyan }}>{t('fanart.reading')}</p></div>
                  ) : art.media_type === 'video' ? (
                    <div style={{ textAlign: 'center', color: ACC.orange }}><Film size={48} strokeWidth={2} /><p style={{ fontSize: '11px', fontWeight: 900, marginTop: 5, color: ACC.orange }}>{t('fanart.multimedia')}</p></div>
                  ) : art.media_type === 'pdf' ? (
                    <div style={{ textAlign: 'center', color: ACC.violet }}><FileText size={48} strokeWidth={2} /><p style={{ fontSize: '11px', fontWeight: 900, marginTop: 5, color: ACC.violet }}>{t("fanart.card.fanfic_pdf")}</p></div>
                  ) : (
                    <img src={art.image_url} alt={art.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} className="art-img" />
                  )}
                  {art.is_nsfw && <div style={{ position: "absolute", top: "15px", right: "15px", background: `color-mix(in srgb, ${ACC.orange} 88%, var(--overlay-strong))`, color: "var(--modal-cta-fg)", padding: "5px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: 900, backdropFilter: "blur(4px)", zIndex: 2, border: `1px solid color-mix(in srgb, ${ACC.orange} 40%, transparent)` }}>+18</div>}
                  <div className="view-overlay" style={{ position: "absolute", inset: 0, backgroundColor: `color-mix(in srgb, ${ACC.violet} 18%, var(--overlay-strong))`, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.3s" }}><Eye size={32} color={ACC.cyan} strokeWidth={2.2} /></div>
                </div>
                <div style={{ padding: "20px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 900, color: ACC.pink, textTransform: "uppercase", letterSpacing: "1px" }}>{categoryLabel(art.category)}</span>
                  <h3 style={{ color: ACC.violet, fontWeight: 900, fontSize: "16px", margin: "5px 0 15px 0", lineHeight: "1.3" }}>{displayTitle(art)}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <img 
                      src={art.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${art.profiles?.display_name || 'U'}&background=ffd9e6&color=8C659C`} 
                      alt="Avatar" 
                      style={{ width: "30px", height: "30px", borderRadius: "50%", border: `2px solid color-mix(in srgb, ${ACC.cyan} 35%, var(--bg-soft))`, objectFit: "cover" }} 
                    />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: "6px" }}>
                      {art.profiles?.display_name || art.artist_name || t("global.default_user_name")}
                      {art.profiles?.is_artist && <span title={t("fanart.verified_artist")}>🎨</span>}
                    </span>
                    
                    <div style={{ display: "flex", gap: "10px", color: "var(--text-muted)" }}>
                      <button type="button" onClick={(e) => handleLike(e, art, !!art.user_has_liked)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 800, padding: 0, color: art.user_has_liked ? ACC.pink : "var(--text-muted)" }}><Heart size={16} fill={art.user_has_liked ? ACC.pink : "none"} color={art.user_has_liked ? ACC.pink : "currentColor"} strokeWidth={2.2} /> {art.likes_count}</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setViewingArt(art); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 800, padding: 0, color: ACC.cyan }}><MessageCircle size={16} strokeWidth={2.2} /> {art.comments_count || 0}</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

       {!loading && filteredArt.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text-muted)" }}>
              <p style={{ fontWeight: 800, fontSize: "18px" }}>{t('fanart.no_content')}</p>
            </div>
          )}

          {isAdminReturn && (
            <button
              onClick={() => router.push(`/admin-panel?tab=denuncias${denunciaId ? `&reopen=${denunciaId}` : ''}`)}
              style={{ position: "fixed", bottom: "30px", right: "30px", zIndex: 9999, background: "var(--text-main)", color: "var(--bg-main)", padding: "15px 30px", borderRadius: "99px", fontWeight: 900, border: "none", cursor: "pointer", boxShadow: "0 10px 30px var(--overlay-soft)", display: "flex", alignItems: "center", gap: "10px" }}
            >
              <AlertTriangle size={20} color="var(--bg-main)" /> VOLVER AL EXPEDIENTE
            </button>
          )}

      </main>
      </AdRailLayout>

      {/* EL LIGHTBOX NORMAL (Información y Comentarios) */}
      {viewingArt && !isFullscreen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-heavy)", backdropFilter: "blur(10px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setViewingArt(null)}>
          <div className="fanart-modal-shell" style={{ backgroundColor: "var(--bg-card)", width: "100%", maxWidth: "900px", borderRadius: "30px", height: "90vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", border: `1px solid color-mix(in srgb, ${ACC.cyan} 30%, var(--color-border))`, boxShadow: "0 24px 60px var(--shadow-card)" }} onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setViewingArt(null)} style={{ position: "absolute", top: "15px", right: "20px", background: "var(--bg-soft)", border: `1px solid color-mix(in srgb, ${ACC.pink} 35%, var(--color-border))`, borderRadius: "50%", padding: "5px", zIndex: 10, cursor: "pointer" }}><X size={24} color={ACC.pink} /></button>
            <div style={{ flex: 1, overflowY: "auto", padding: "30px" }}>
              <div style={{ width: "100%", background: viewingArt.content_text ? "var(--bg-main)" : "var(--text-main)", borderRadius: "15px", overflow: "hidden", display: "flex", justifyContent: "center", position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
                
                <button type="button" onClick={openFullscreen} style={{ position: "absolute", top: "15px", right: "15px", background: `color-mix(in srgb, ${ACC.violet} 22%, var(--overlay-strong))`, color: ACC.cyan, border: `1px solid color-mix(in srgb, ${ACC.cyan} 45%, transparent)`, borderRadius: "10px", padding: "8px", cursor: "pointer", zIndex: 10, backdropFilter: "blur(4px)", display: "flex", alignItems: "center", gap: "5px", fontWeight: 800, fontSize: "12px", transition: "0.2s" }}>
                  <Maximize2 size={16} strokeWidth={2.2} /> {t('fanart.view_fullscreen')}
                </button>

                {viewingArt.content_text ? (
                  <div className="pcReaderScrollNormal" style={{ width: '100%', height: '60vh', overflowY: 'auto', padding: '40px', fontFamily: 'Georgia, serif', fontSize: '18px', lineHeight: '1.8', color: 'var(--text-main)', whiteSpace: 'pre-wrap', textAlign: 'left', boxSizing: 'border-box', backgroundColor: 'var(--bg-main)' }}>
                    
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', justifyContent: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: '20px' }}>
                      {chapters.length > 1 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-soft)", padding: "6px 18px", borderRadius: "99px", border: "1px solid var(--color-border)" }}>
                          <button 
                            disabled={currentChapterIndex === 0}
                            onClick={() => {
                              const newIdx = currentChapterIndex - 1;
                              setCurrentChapterIndex(newIdx);
                              loadSpecificChapter(chapters[newIdx].id, currentLang);
                              document.querySelector('.pcReaderScrollNormal')?.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            style={{ background: "none", border: "none", padding: 0, display: "flex", cursor: currentChapterIndex === 0 ? "default" : "pointer", color: currentChapterIndex === 0 ? "var(--color-border)" : ACC.cyan }}
                          >
                            <ChevronLeft size={18} strokeWidth={3} />
                          </button>
                          
                          <select 
                            value={chapters[currentChapterIndex]?.id}
                            onChange={(e) => {
                              const newId = e.target.value;
                              const newIdx = chapters.findIndex(c => c.id === newId);
                              setCurrentChapterIndex(newIdx);
                              loadSpecificChapter(newId, currentLang); 
                              document.querySelector('.pcReaderScrollNormal')?.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            style={{ border: "none", outline: "none", background: "transparent", fontWeight: 900, color: ACC.violet, fontSize: "13px", cursor: "pointer", textAlign: "center", textTransform: "uppercase", letterSpacing: "1px" }}
                          >
                            {chapters.map((c) => (
                              <option key={c.id} value={c.id}>Capítulo {c.numero_capitulo}</option>
                            ))}
                          </select>

                          <button 
                            disabled={currentChapterIndex === chapters.length - 1}
                            onClick={() => {
                              const newIdx = currentChapterIndex + 1;
                              setCurrentChapterIndex(newIdx);
                              loadSpecificChapter(chapters[newIdx].id, currentLang);
                              document.querySelector('.pcReaderScrollNormal')?.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            style={{ background: "none", border: "none", padding: 0, display: "flex", cursor: currentChapterIndex === chapters.length - 1 ? "default" : "pointer", color: currentChapterIndex === chapters.length - 1 ? "var(--color-border)" : ACC.cyan }}
                          >
                            <ChevronRight size={18} strokeWidth={3} />
                          </button>
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-soft)", padding: "6px 18px", borderRadius: "99px", border: "1px solid var(--color-border)" }}>
                        <span style={{ fontSize: "16px" }}>🌍</span>
                        <select 
                          value={currentLang}
                          disabled={loadingChapters || translating}
                          onChange={(e) => handleLanguageChange(e.target.value)}
                          style={{ border: "none", outline: "none", background: "transparent", fontWeight: 900, color: ACC.violet, fontSize: "13px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px" }}
                        >
                          {LANGUAGES.map(lang => (
                            <option key={lang.code} value={lang.code}>{lang.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <h1 className="tan-font" style={{ color: ACC.violet, marginBottom: "30px", fontSize: "26px", textAlign: "center", letterSpacing: "1px" }}>
                      {translating
                        ? (translationProgress
                            ? t("fanart.translating_progress", { current: translationProgress.current, total: translationProgress.total })
                            : t("fanart.translating"))
                        : viewingArt.title}
                    </h1>
                    {translating ? t("fanart.translating") : viewingArt.content_text}

                    {chapters.length > 1 && (
                      <div style={{ marginTop: "40px", paddingTop: "20px", borderTop: "1px dashed var(--color-border)", display: "flex", justifyContent: "space-between", gap: "15px" }}>
                        <button 
                          disabled={currentChapterIndex === 0}
                          onClick={() => {
                            const newIdx = currentChapterIndex - 1;
                            setCurrentChapterIndex(newIdx);
                            loadSpecificChapter(chapters[newIdx].id, currentLang);
                            document.querySelector('.pcReaderScrollNormal')?.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          style={{ flex: 1, padding: "10px", borderRadius: "12px", border: currentChapterIndex === 0 ? "1px solid var(--color-border)" : `1px solid color-mix(in srgb, ${ACC.cyan} 45%, var(--color-border))`, background: currentChapterIndex === 0 ? "var(--bg-main)" : "var(--bg-card)", color: currentChapterIndex === 0 ? "var(--text-muted)" : ACC.violet, fontWeight: 900, cursor: currentChapterIndex === 0 ? "default" : "pointer", opacity: currentChapterIndex === 0 ? 0.4 : 1 }}
                        >
                          « {t('fanart.prev_chapter')}
                        </button>
                        <button 
                          disabled={currentChapterIndex === chapters.length - 1}
                          onClick={() => {
                            const newIdx = currentChapterIndex + 1;
                            setCurrentChapterIndex(newIdx);
                            loadSpecificChapter(chapters[newIdx].id, currentLang);
                            document.querySelector('.pcReaderScrollNormal')?.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          style={{ flex: 1, padding: "10px", borderRadius: "12px", border: "none", background: currentChapterIndex === chapters.length - 1 ? "var(--bg-main)" : FANART_CTA_GRAD, color: currentChapterIndex === chapters.length - 1 ? "var(--text-muted)" : "var(--modal-cta-fg)", fontWeight: 900, cursor: currentChapterIndex === chapters.length - 1 ? "default" : "pointer", opacity: currentChapterIndex === chapters.length - 1 ? 0.4 : 1, boxShadow: currentChapterIndex === chapters.length - 1 ? "none" : FANART_CTA_SHADOW }}
                        >
                          {t('fanart.next_chapter')} »
                        </button>
                      </div>
                    )}
                  </div>
                ) : viewingArt.media_type === 'video' ? (
                  <video controls controlsList="nodownload" style={{ maxWidth: '100%', maxHeight: '50vh', display: 'block', margin: '0 auto' }} src={viewingArt.image_url} />
                ) : viewingArt.media_type === 'pdf' ? (
                  <iframe src={`${viewingArt.image_url}#toolbar=0`} style={{ width: '100%', height: '50vh', border: 'none', display: 'block', margin: '0 auto' }} />
                ) : (
                  <img src={viewingArt.image_url} style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain', userSelect: 'none', display: 'block', margin: '0 auto' }} alt={viewingArt.title} />
                )}
              </div>
              <div style={{ marginTop: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div>
                   <h2 className="tan-font" style={{ color: ACC.violet, margin: 0 }}>
                      {viewingArt.title}
                    </h2>
                    <p style={{ color: "var(--text-muted)", fontWeight: 700, margin: "5px 0 0 0", display: "flex", alignItems: "center", gap: "6px" }}>
                      {t('fanart.by')} {viewingArt.artist_name}
                      {viewingArt.author_badge && (
                        <img src={viewingArt.author_badge} alt="Medalla" style={{ width: "22px", height: "22px", objectFit: "contain" }} />
                      )}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {viewingArt.user_id && (
                      <button type="button" onClick={() => window.location.href = `/me?u=${viewingArt.user_id}`} style={{ background: FANART_CTA_GRAD, color: "var(--modal-cta-fg)", padding: "10px 16px", borderRadius: "12px", fontWeight: 900, border: "none", cursor: "pointer", boxShadow: FANART_CTA_SHADOW }}>{t('fanart.contact_artist')}</button>
                    )}
                    <button
                      type="button"
                      onClick={() => enviarReporteObra(viewingArt.id, viewingArt.user_id)}
                      style={{ background: "var(--bg-main)", color: ACC.pink, padding: "10px 16px", borderRadius: "12px", fontWeight: 900, border: `1px solid color-mix(in srgb, ${ACC.pink} 45%, var(--color-border))`, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Flag size={18} /> {t('common.report')}
                    </button>
                    {(activeUser as any)?.email === "info@mykpopbinder.com" && (
                      <button onClick={() => deleteFanArtPost(viewingArt.id)} style={{ background: "var(--text-main)", color: "var(--bg-main)", padding: "10px 16px", borderRadius: "12px", fontWeight: 900, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><AlertTriangle size={18} /> ELIMINAR OBRA</button>
                    )}
                  </div>
                </div>
                <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "20px", paddingBottom: "80px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 900, color: ACC.pink, marginBottom: "15px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t('fanart.community_comments')}</p>
                  {comments.length === 0 && <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>{t('fanart.no_comments')}</p>}
                  {renderComments(null)}
                </div>
              </div>
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--bg-card)", padding: "20px", borderTop: "1px solid var(--color-border)", boxShadow: "0 -10px 20px var(--shadow-card)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {replyingTo && (
                  <div style={{ fontSize: "11px", color: ACC.pink, fontWeight: 800, display: "flex", justifyContent: "space-between" }}><span>{t('fanart.replying_to')}</span><button type="button" onClick={() => { setReplyingTo(null); setNewComment(""); }} style={{ background: "none", border: "none", color: "var(--state-danger-fg)", cursor: "pointer" }}>{t('common.cancel')}</button></div>
                )}
                <div style={{ display: "flex", gap: "10px" }}>
                  <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder={activeUser?.id ? t("fanart.comment_placeholder") : t("fanart.lightbox.placeholder_logged_out")} disabled={!activeUser?.id} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: `1px solid color-mix(in srgb, ${ACC.cyan} 28%, var(--color-border))`, outline: "none", backgroundColor: activeUser?.id ? "var(--bg-main)" : "var(--bg-soft)", color: "var(--text-main)" }} />
                  <button type="button" onClick={postComment} disabled={!activeUser?.id || !newComment.trim()} style={{ background: (!activeUser?.id || !newComment.trim()) ? "var(--bg-soft)" : FANART_CTA_GRAD, color: (!activeUser?.id || !newComment.trim()) ? "var(--text-muted)" : "var(--modal-cta-fg)", border: "none", padding: "0 25px", borderRadius: "12px", cursor: "pointer", fontWeight: 800, opacity: (!activeUser?.id || !newComment.trim()) ? 0.5 : 1, boxShadow: (!activeUser?.id || !newComment.trim()) ? "none" : FANART_CTA_SHADOW }}>{t('common.send')}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ EL MODO LECTURA FULLSCREEN */}
      {isFullscreen && viewingArt && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-heavy)", zIndex: 20000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={(e) => { if (e.target === e.currentTarget) closeFullscreen(); }}>
          <div className="fanart-modal-shell" style={{ backgroundColor: "var(--bg-card)", width: "100%", maxWidth: "1000px", height: "90vh", borderRadius: "24px", display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 25px 50px var(--overlay-medium)", overflow: "hidden", border: `1px solid color-mix(in srgb, ${ACC.cyan} 30%, var(--color-border))` }} onClick={e => e.stopPropagation()}>
            
            <div style={{ padding: "20px", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--bg-main)", display: "flex", justifyContent: "center", alignItems: "center", gap: "25px", flexWrap: "wrap", position: "relative" }}>
              
              {chapters.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-card)", padding: "6px 18px", borderRadius: "99px", border: "1px solid var(--color-border)" }}>
                  <button 
                    disabled={currentChapterIndex === 0}
                    onClick={() => {
                      const newIdx = currentChapterIndex - 1;
                      setCurrentChapterIndex(newIdx);
                      loadSpecificChapter(chapters[newIdx].id, currentLang);
                      document.querySelector('.pcReaderScroll')?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{ background: "none", border: "none", padding: 0, display: "flex", cursor: currentChapterIndex === 0 ? "default" : "pointer", color: currentChapterIndex === 0 ? "var(--color-border)" : ACC.cyan }}
                  >
                    <ChevronLeft size={18} strokeWidth={3} />
                  </button>
                  
                  <select 
                    value={chapters[currentChapterIndex]?.id}
                    onChange={(e) => {
                      const newId = e.target.value;
                      const newIdx = chapters.findIndex(c => c.id === newId);
                      setCurrentChapterIndex(newIdx);
                      loadSpecificChapter(newId, currentLang); 
                      document.querySelector('.pcReaderScroll')?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{ border: "none", outline: "none", background: "transparent", fontWeight: 900, color: ACC.violet, fontSize: "14px", cursor: "pointer", textAlign: "center", textTransform: "uppercase", letterSpacing: "1px" }}
                  >
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>Capítulo {c.numero_capitulo}</option>
                    ))}
                  </select>

                  <button 
                    disabled={currentChapterIndex === chapters.length - 1}
                    onClick={() => {
                      const newIdx = currentChapterIndex + 1;
                      setCurrentChapterIndex(newIdx);
                      loadSpecificChapter(chapters[newIdx].id, currentLang);
                      document.querySelector('.pcReaderScroll')?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{ background: "none", border: "none", padding: 0, display: "flex", cursor: currentChapterIndex === chapters.length - 1 ? "default" : "pointer", color: currentChapterIndex === chapters.length - 1 ? "var(--color-border)" : ACC.cyan }}
                  >
                    <ChevronRight size={18} strokeWidth={3} />
                  </button>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-card)", padding: "6px 18px", borderRadius: "99px", border: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: "16px" }}>🌍</span>
                <select 
                  value={currentLang}
                  disabled={loadingChapters || translating}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  style={{ border: "none", outline: "none", background: "transparent", fontWeight: 900, color: ACC.violet, fontSize: "14px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px" }}
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.label}</option>
                  ))}
                </select>
              </div>

              <button type="button" onClick={closeFullscreen} style={{ position: "absolute", right: "20px", top: "20px", border: `1px solid color-mix(in srgb, ${ACC.pink} 35%, var(--color-border))`, background: "var(--bg-soft)", borderRadius: "50%", padding: "8px", cursor: "pointer" }}>
                <X size={24} color={ACC.pink} />
              </button>
            </div>

            <div className="pcReaderScroll" style={{ flex: 1, overflowY: "auto", padding: "40px 60px", backgroundColor: "var(--bg-card)" }}>
              {viewingArt.content_text ? (
                <article style={{ maxWidth: "800px", margin: "0 auto" }}>
                 <h1 className="tan-font" style={{ color: ACC.violet, fontSize: "30px", textAlign: "center", marginBottom: "40px", lineHeight: "1.2", letterSpacing: "1px" }}>
                  {translating
                    ? (translationProgress
                        ? t("fanart.translating_progress", { current: translationProgress.current, total: translationProgress.total })
                        : t("fanart.translating"))
                    : viewingArt.title}
                </h1>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", lineHeight: "1.9", color: "var(--text-main)", whiteSpace: "pre-wrap", textAlign: "left" }}>
                    {translating ? t("fanart.translating") : viewingArt.content_text}
                  </div>

                  {chapters.length > 1 && (
                    <div style={{ marginTop: "60px", paddingTop: "30px", borderTop: "1px dashed var(--color-border)", display: "flex", justifyContent: "space-between", gap: "20px" }}>
                      <button 
                        disabled={currentChapterIndex === 0}
                        onClick={() => {
                          const newIdx = currentChapterIndex - 1;
                          setCurrentChapterIndex(newIdx);
                          loadSpecificChapter(chapters[newIdx].id, currentLang);
                          document.querySelector('.pcReaderScroll')?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{ flex: 1, padding: "15px", borderRadius: "15px", border: currentChapterIndex === 0 ? "1px solid var(--color-border)" : `1px solid color-mix(in srgb, ${ACC.cyan} 45%, var(--color-border))`, background: currentChapterIndex === 0 ? "var(--bg-main)" : "var(--bg-card)", color: currentChapterIndex === 0 ? "var(--text-muted)" : ACC.violet, fontWeight: 900, cursor: currentChapterIndex === 0 ? "default" : "pointer", opacity: currentChapterIndex === 0 ? 0.4 : 1 }}
                      >
                        « {t('fanart.prev_chapter')}
                      </button>
                      <button 
                        disabled={currentChapterIndex === chapters.length - 1}
                        onClick={() => {
                          const newIdx = currentChapterIndex + 1;
                          setCurrentChapterIndex(newIdx);
                          loadSpecificChapter(chapters[newIdx].id, currentLang);
                          document.querySelector('.pcReaderScroll')?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{ flex: 1, padding: "15px", borderRadius: "15px", border: "none", background: currentChapterIndex === chapters.length - 1 ? "var(--bg-main)" : FANART_CTA_GRAD, color: currentChapterIndex === chapters.length - 1 ? "var(--text-muted)" : "var(--modal-cta-fg)", fontWeight: 900, cursor: currentChapterIndex === chapters.length - 1 ? "default" : "pointer", opacity: currentChapterIndex === chapters.length - 1 ? 0.4 : 1, boxShadow: currentChapterIndex === chapters.length - 1 ? "none" : FANART_CTA_SHADOW }}
                      >
                        {t('fanart.next_chapter')} »
                      </button>
                    </div>
                  )}
                </article>
              ) : viewingArt.media_type === 'video' ? (
                <video controls controlsList="nodownload" style={{ maxWidth: '100%', maxHeight: '50vh', display: 'block', margin: '0 auto' }} src={viewingArt.image_url} />
              ) : viewingArt.media_type === 'pdf' ? (
                <iframe src={`${viewingArt.image_url}#toolbar=0`} style={{ width: '100%', height: '50vh', border: 'none', display: 'block', margin: '0 auto' }} />
              ) : (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                  <img src={viewingArt.image_url} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "12px" }} alt={viewingArt.title} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FORMULARIO DE ENVÍO */}
      {isModalOpen && (
        <div onClick={() => setIsModalOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-medium)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "var(--bg-card)", width: "100%", maxWidth: "600px", borderRadius: "24px", border: `1px solid color-mix(in srgb, ${ACC.cyan} 28%, var(--color-border))`, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", boxShadow: "0 20px 40px var(--shadow-card)" }}>
            <div style={{ padding: "20px 25px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, backgroundColor: "var(--bg-card)", zIndex: 10 }}>
              <div>
                <h2 className="tan-font" style={{ margin: 0, color: ACC.violet, fontSize: "24px" }}>
                  {t('fanart.join_artist_title')}
                </h2>
                <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>
                  {t('fanart.join_artist_subtitle')}
                </p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: ACC.pink }}><X size={28} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: "25px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 15px" }}>
                <input required name="nombre" value={formData.nombre} onChange={handleInputChange} placeholder={t("fanart.upload_form.placeholder_name")} style={inputStyle} />
                <input required name="apellidos" value={formData.apellidos} onChange={handleInputChange} placeholder={t("fanart.upload_form.placeholder_surname")} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 15px" }}>
                <input required name="nombreArtistico" value={formData.nombreArtistico} onChange={handleInputChange} placeholder={t("fanart.upload_form.placeholder_artist_name")} style={inputStyle} />
                <input required type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder={t("fanart.upload_form.placeholder_email")} style={inputStyle} />
              </div>
              <div style={{ margin: "10px 0 20px 0", borderTop: "1px dashed var(--color-border)", paddingTop: "20px" }}>
                <h3 style={{ fontSize: "15px", color: ACC.violet, margin: "0 0 15px 0", fontWeight: 900 }}>{t("fanart.upload_form.socials_title")}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 15px" }}>
                  <input name="instagram" value={formData.instagram} onChange={handleInputChange} placeholder={t("fanart.upload_form.placeholder_instagram")} style={inputStyle} />
                  <input name="tiktok" value={formData.tiktok} onChange={handleInputChange} placeholder={t("fanart.upload_form.placeholder_tiktok")} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: "25px" }}>
                <label style={labelStyle}>{t("fanart.upload_form.samples_title")}</label>
                <div onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }} style={{ border: `2px dashed color-mix(in srgb, ${ACC.violet} 55%, var(--color-border))`, borderRadius: "14px", padding: "30px", backgroundColor: `color-mix(in srgb, ${ACC.cyan} 6%, var(--bg-main))`, textAlign: "center", cursor: "pointer" }}>
                  <UploadCloud size={32} color={ACC.cyan} style={{ margin: "0 auto 10px auto" }} />
                  <p style={{ margin: 0, fontSize: "14px", color: ACC.violet, fontWeight: 800 }}>{t("fanart.upload_form.upload_instruction")}</p>
                  <input required multiple type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} />
                </div>
                {selectedFiles.length > 0 && <div style={{ marginTop: "10px", fontSize: "12px", color: ACC.pink, fontWeight: 700 }}><p>{selectedFiles.length} archivos seleccionados</p></div>}
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>{t("fanart.upload_form.about_title")}</label>
                <textarea name="comentarios" value={formData.comentarios} onChange={handleInputChange} placeholder={t("fanart.upload_form.placeholder_about")} rows={4} style={{ ...inputStyle, resize: "none", fontFamily: "inherit" }} />
              </div>
              <button type="submit" disabled={isSubmitting} style={{ width: "100%", background: isSubmitting ? "var(--bg-soft)" : FANART_CTA_GRAD, color: isSubmitting ? "var(--text-muted)" : "var(--modal-cta-fg)", border: "none", padding: "16px", borderRadius: "14px", fontWeight: 900, fontSize: "16px", cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.7 : 1, boxShadow: isSubmitting ? "none" : FANART_CTA_SHADOW }}>
                {isSubmitting ? <><Loader2 size={20} className="spinner" /> {t("fanart.upload_form.btn_sending")}</> : t("fanart.upload_form.btn_submit")}
              </button>
            </form>
          </div>
        </div>
      )}
      <Footer />
      <style jsx global>{`
        .art-card:hover .view-overlay { opacity: 1 !important; }
        .art-card:hover .art-img { transform: scale(1.05); }
        .art-card:hover {
          border-color: color-mix(in srgb, #66d9ef 45%, var(--color-border)) !important;
          box-shadow: 0 0 0 1px color-mix(in srgb, #66d9ef 25%, transparent), 0 12px 32px var(--shadow-card);
        }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .highlight-target { 
          animation: marker-glow 6s ease-in-out; 
          position: relative;
          z-index: 10;
        }

        @keyframes marker-glow {
          0% { background-color: transparent; }
          5% { 
            background-color: var(--bg-soft); 
            box-shadow: 0 4px 0 #66d9ef; 
            transform: scale(1.01); 
          }
          15% { background-color: var(--color-border); box-shadow: 0 4px 0 #ae81ff; }
          30% { background-color: var(--color-border); box-shadow: 0 4px 0 #66d9ef; }
          50% { background-color: var(--bg-soft); box-shadow: 0 4px 0 #ae81ff; }
          100% { background-color: transparent; transform: scale(1); }
        }
      `}</style>
    </div>
  );
} 

export default function FanArtClient() {
  return (
    <Suspense fallback={<div style={{height: "100vh", background: "var(--bg-main)", display: "flex", justifyContent: "center", alignItems: "center"}}><Loader2 className="spinner" color={ACC.cyan}/></div>}>
      <FanArtContent />
    </Suspense>
  );
}