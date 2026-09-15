"use client";

import { useRouter } from "next/navigation";
import Footer from "../components/footer";
import AdRailLayout from "../components/AdRailLayout";
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "../context/GlobalContext";
import { avisarFavoritos } from "@/lib/avisos";
import { canModerateGlobalContent } from "@/lib/admin-emails";
import {
  Heart, MessageCircle, Repeat2, Share, Image as ImageIcon, Sparkles,
  ShieldCheck, AlertTriangle, Ban, Loader2, X, Flag, Send, Trash2, ZoomIn, Star, Video
} from "lucide-react";

function MediaAttachment({
  url,
  onOpenImage,
}: {
  url: string;
  onOpenImage: (url: string) => void;
}) {
  const isClearlyImage = /\.(png|jpe?g|gif|webp|bmp|avif|svg)(\?|$)/i.test(url);
  const isClearlyVideo = /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
  const [preferVideo, setPreferVideo] = useState(isClearlyVideo || !isClearlyImage);

  if (preferVideo) {
    return (
      <video
        src={url}
        controls
        playsInline
        onError={() => setPreferVideo(false)}
        style={{ width: "100%", maxHeight: "300px", objectFit: "contain", borderRadius: "12px", border: "1px solid var(--color-border)" }}
      />
    );
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <img
        src={url}
        onClick={() => onOpenImage(url)}
        style={{ width: "100%", maxHeight: "300px", objectFit: "cover", borderRadius: "12px", cursor: "zoom-in", border: "1px solid var(--color-border)" }}
        alt="Adjunto"
      />
      <div style={{ position: "absolute", bottom: 10, right: 10, background: "var(--overlay-medium)", padding: "5px", borderRadius: "50%", color: "white", pointerEvents: "none" }}><ZoomIn size={16}/></div>
    </div>
  );
}

export default function FanZonePage() {
  const { profile, showAlert, t } = useGlobal(); // 👈 Añadido t
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]); 
  const router = useRouter();
  const [onlyFollowed, setOnlyFollowed] = useState(false);

  // --- EFECTO: SCROLL Y PARPADEO AL VENIR DESDE EL PERFIL ---
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashId = window.location.hash.substring(1); 
      setTimeout(() => {
        const element = document.getElementById(hashId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          element.style.animation = "parpadeoEleganteFanzone 2.5s infinite alternate ease-in-out";
          element.style.borderRadius = "24px"; 
          
          if (!document.getElementById('animacion-fanzone')) {
            const style = document.createElement('style');
            style.id = 'animacion-fanzone';
            style.innerHTML = `
              @keyframes parpadeoEleganteFanzone {
                0% { box-shadow: 0 0 0 4px var(--color-primary), 0 10px 20px var(--shadow-card); transform: scale(1.02); }
                100% { box-shadow: 0 0 25px 8px var(--shadow-card), 0 0 0 5px var(--color-primary); transform: scale(1.02); }
              }
            `;
            document.head.appendChild(style);
          }

          setTimeout(() => {
            element.style.animation = "none";
            element.style.transform = "scale(1)";
          }, 5000); 
        }
      }, 800);
    }
  }, [posts]);

  const consumedNotificationPostRef = useRef(false);

  /* Desde notificación: /fanzone?post=uuid (evita depender solo del hash en navegación cliente) */
  useEffect(() => {
    if (posts.length === 0 || typeof window === "undefined" || consumedNotificationPostRef.current) return;
    const q = new URLSearchParams(window.location.search).get("post");
    if (!q) return;
    consumedNotificationPostRef.current = true;
    const elId = `post-${q}`;
    setHighlightId(elId);
    const timer = window.setTimeout(() => {
      const element = document.getElementById(elId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.style.transition = "all 0.8s ease";
        element.style.boxShadow = "0 0 0 4px var(--color-primary), 0 15px 35px var(--shadow-card)";
        element.style.transform = "scale(1.02)";
        window.setTimeout(() => {
          element.style.boxShadow = "0 10px 20px var(--shadow-card)";
          element.style.transform = "scale(1)";
        }, 4000);
      }
      router.replace("/fanzone", { scroll: false });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [posts, router]);

  const [myFavorites, setMyFavorites] = useState<string[]>([]);

  const canModerateAllContent = canModerateGlobalContent(
    (profile as { email?: string | null } | null)?.email
  );
  
  // IMAGEN VISOR
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // RESPUESTAS Y MENCIONES
  const [replyingToId, setReplyingToId] = useState<{postId: string, commentId?: string} | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyMediaFile, setReplyMediaFile] = useState<File | null>(null);
  const [replyMediaPreview, setReplyMediaPreview] = useState<string | null>(null);
  const [isPublishingReply, setIsPublishingReply] = useState(false);
  const [mentionList, setMentionList] = useState<any[]>([]);
  const [mentionTarget, setMentionTarget] = useState<'post' | 'reply' | null>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  // MODALES
  const [reportModal, setReportModal] = useState<{type: 'post'|'comment', item: any} | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'post'|'comment', id: string} | null>(null);
  const [repostConfirm, setRepostConfirm] = useState<any | null>(null);

  // ADMIN HIGHLIGHT
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [isFromAdmin, setIsFromAdmin] = useState(false);
  const socialActionColors = {
    comment: "var(--color-secondary)",
    repost: "var(--color-accent-orange)",
    like: "var(--color-primary)",
    share: "var(--accent-vibe-green)",
  } as const;

  // 🚀 FUNCIÓN SABUESO: Encuentra el ID real del usuario sin importar dónde esté escondido
  const goToProfile = (item: any) => {
    let target = typeof item.user_id === 'string' ? item.user_id : null;
    if (!target) target = item.profiles?.user_id || item.profiles?.id;
    if (target) {
      router.push(`/me?u=${target}`); 
    } else {
      showAlert(t("common.error"), t("common.user_not_found"));
    }
  };

  useEffect(() => {
    const hasAccepted = localStorage.getItem("fanzone_rules_accepted");
    if (!hasAccepted) setShowRules(true);
    
    // VERIFICAR SI VIENE DE ADMIN
    if (window.location.search.includes('fromAdmin=true')) {
      setIsFromAdmin(true);
    }

    fetchPosts(true);
    fetchAllUsers();

    // Lógica de resaltado
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setHighlightId(hash);
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({behavior: 'smooth', block: 'center' });
          element.style.transition = "all 0.8s ease";
          element.style.boxShadow = "0 0 0 4px var(--color-primary), 0 15px 35px var(--shadow-card)";
          element.style.transform = "scale(1.02)";
          
          setTimeout(() => {
            element.style.boxShadow = "0 10px 20px var(--shadow-card)";
            element.style.transform = "scale(1)";
          }, 4000);
        }
      }, 800); 
    }
  }, [profile?.id]);

  async function fetchAllUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url, is_featured_artist');
    if (data) {
      const ordered = [...data].sort((a: any, b: any) => {
        const aStar = a.is_featured_artist ? 1 : 0;
        const bStar = b.is_featured_artist ? 1 : 0;
        if (aStar !== bStar) return bStar - aStar;
        return String(a.display_name || "").localeCompare(String(b.display_name || ""));
      });
      setAllUsers(ordered);
    }
  }

  async function fetchMyFavorites() {
    if (!profile?.id) {
      setMyFavorites([]);
      return;
    }
    const { data } = await supabase
      .from("user_favorites")
      .select("following_id")
      .eq("follower_id", profile.id);
    setMyFavorites((data || []).map((r: any) => String(r.following_id)));
  }

  async function fetchPosts(showLoader = true) {
    if (showLoader) setLoading(true);
    try {
      let { data, error } = await supabase
        .from("fanzone_posts")
        .select(`
          *,
          profiles:user_id (user_id, display_name, avatar_url, is_featured_artist),
          likes:fanzone_likes(user_id),
          original_post:repost_id (id, content, media_url, profiles:user_id(user_id, display_name)),
          comments:fanzone_comments(
            id, content, media_url, created_at, user_id, parent_comment_id,
            profiles:user_id (user_id, display_name, avatar_url),
            comment_likes:fanzone_comment_likes(user_id)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) {
        const errText = String(error.message || "").toLowerCase();
        const missingMediaColumn =
          errText.includes("media_url") && errText.includes("fanzone_comments");
        if (missingMediaColumn) {
          const retry = await supabase
            .from("fanzone_posts")
            .select(`
              *,
              profiles:user_id (user_id, display_name, avatar_url, is_featured_artist),
              likes:fanzone_likes(user_id),
              original_post:repost_id (id, content, media_url, profiles:user_id(user_id, display_name)),
              comments:fanzone_comments(
                id, content, created_at, user_id, parent_comment_id,
                profiles:user_id (user_id, display_name, avatar_url),
                comment_likes:fanzone_comment_likes(user_id)
              )
            `)
            .order("created_at", { ascending: false });
          data = retry.data as any;
          error = retry.error as any;
        }
      }

      if (!error && data) {
        const formatted = data.map(post => ({
          ...post,
          isLiked: post.likes?.some((l: any) => l.user_id === profile?.id),
          likesCount: post.likes?.length || 0,
          commentsCount: post.comments?.length || 0,
          comments: post.comments?.sort((a:any, b:any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) || [],
          profiles: post.profiles || { display_name: t("global.default_user_name"), avatar_url: "https://ui-avatars.com/api/?name=?" }
        }));
        const ordered = [...formatted].sort((a: any, b: any) => {
          const aStar = a.profiles?.is_featured_artist ? 1 : 0;
          const bStar = b.profiles?.is_featured_artist ? 1 : 0;
          if (aStar !== bStar) return bStar - aStar;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setPosts(ordered);
      }
    } catch (err) {}
    
    setLoading(false); 
  }

  useEffect(() => {
    void fetchMyFavorites();
  }, [profile?.id]);

  const sendNotification = async (receiverId: string, type: string, postId?: string, commentId?: string) => {
    if (!profile || receiverId === profile.id) return;
    await supabase.from('fanzone_notifications').insert([{
      user_id: receiverId, actor_id: profile.id, type, post_id: postId || null, comment_id: commentId || null
    }]);
  };

  const notifyMentions = async (text: string, postId: string, commentId?: string) => {
    const mentionedNames = text.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];
    for (const name of mentionedNames) {
      const user = allUsers.find(u => u.display_name.replace(/\s+/g, '') === name);
      if (user && user.user_id) {
        sendNotification(user.user_id, 'mention', postId, commentId);
      }
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>, target: 'post' | 'reply') => {
    const value = e.target.value;
    if (target === 'post') setNewPost(value);
    else setReplyContent(value);

    const words = value.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const query = lastWord.substring(1).toLowerCase();
      const matches = allUsers.filter(u => u.display_name?.toLowerCase().includes(query));
      setMentionList(matches.slice(0, 5));
      setMentionTarget(target);
    } else {
      setMentionList([]);
    }
  };

  const isVideoFile = (file: File | null) => {
    if (!file) return false;
    return String(file.type || "").toLowerCase().startsWith("video/");
  };
  const isGifFile = (file: File | null) => {
    if (!file) return false;
    const mime = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();
    return mime === "image/gif" || name.endsWith(".gif");
  };

  const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
  const MAX_GIF_BYTES = 20 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
  const MAX_VIDEO_SECONDS = 45;

  const getVideoDurationSeconds = (file: File) =>
    new Promise<number>((resolve, reject) => {
      const tmpUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const duration = Number(video.duration || 0);
        URL.revokeObjectURL(tmpUrl);
        resolve(duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(tmpUrl);
        reject(new Error("No se pudo leer la duración del vídeo"));
      };
      video.src = tmpUrl;
    });

  const validateMediaFile = async (file: File): Promise<string | null> => {
    const mime = String(file.type || "").toLowerCase();
    const isVideo = mime.startsWith("video/");
    const isImage = mime.startsWith("image/");
    if (!isVideo && !isImage) return "Formato no permitido. Usa imagen, GIF o vídeo.";
    if (isVideo) {
      if (file.size > MAX_VIDEO_BYTES) return "El vídeo supera 30 MB. Súbelo más ligero.";
      try {
        const duration = await getVideoDurationSeconds(file);
        if (duration > MAX_VIDEO_SECONDS) return "El vídeo es demasiado largo. Máximo 45 segundos.";
      } catch {
        return "No se pudo validar el vídeo. Prueba con otro archivo.";
      }
      return null;
    }
    if (isGifFile(file)) {
      if (file.size > MAX_GIF_BYTES) return "El GIF supera 20 MB.";
      return null;
    }
    if (file.size > MAX_IMAGE_BYTES) return "La imagen supera 12 MB.";
    return null;
  };

  const pickMainMedia = async (f: File | null) => {
    if (!f) return;
    const err = await validateMediaFile(f);
    if (err) {
      showAlert(t("common.error"), err);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedImage(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const pickReplyMedia = async (f: File | null) => {
    if (!f) return;
    const err = await validateMediaFile(f);
    if (err) {
      showAlert(t("common.error"), err);
      if (replyFileInputRef.current) replyFileInputRef.current.value = "";
      return;
    }
    setReplyMediaFile(f);
    setReplyMediaPreview(URL.createObjectURL(f));
  };

  const isVideoUrl = (url: string | null | undefined) => {
    if (!url) return false;
    return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
  };

  const insertMention = (displayName: string) => {
    const pseudoHandle = displayName.replace(/\s+/g, '');
    if (mentionTarget === 'post') {
      const words = newPost.split(/\s/);
      words.pop();
      setNewPost(words.join(' ') + ` @${pseudoHandle} `);
    } else {
      const words = replyContent.split(/\s/);
      words.pop();
      setReplyContent(words.join(' ') + ` @${pseudoHandle} `);
    }
    setMentionList([]);
  };

  const formatText = (text: string) => {
    if (!text) return "";
    return text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('@') && word.length > 1) {
        return <strong key={i} style={{ color: 'var(--color-primary)', cursor: 'pointer' }} onClick={() => showAlert("Info", `Perfil de ${word} (Pronto)`)}>{word}</strong>;
      }
      return word;
    });
  };

  const handlePost = async () => {
    if (!newPost.trim() || !profile) return;
    setIsPublishing(true);
    let mediaUrl = null;

    if (selectedImage) {
      const ext = selectedImage.name.split(".").pop() || "bin";
      const fileName = `${profile.id}_${Date.now()}.${ext}`;
      const { error: imgError } = await supabase.storage.from("fanzone_media").upload(fileName, selectedImage);
      if (!imgError) {
        const { data: pubUrl } = supabase.storage.from("fanzone_media").getPublicUrl(fileName);
        mediaUrl = pubUrl.publicUrl;
      }
    }

    const { data: newPostData, error } = await supabase.from("fanzone_posts").insert([{ user_id: profile.id, content: newPost, media_url: mediaUrl }]).select().single();
    if (!error && newPostData) {
      await avisarFavoritos(profile.id, 'post_id', newPostData.id);
      notifyMentions(newPost, newPostData.id); 
      setNewPost(""); setSelectedImage(null); setImagePreview(null);
      fetchPosts(false);
    }
    setIsPublishing(false);
  };

  const toggleLikePost = async (postId: string, alreadyLiked: boolean, postOwnerId: string) => {
    if (!profile) return showAlert(t("common.error"), t("fanzone.alerts.login_love"));
    
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, isLiked: !alreadyLiked, likesCount: alreadyLiked ? p.likesCount - 1 : p.likesCount + 1 } : p));

    if (alreadyLiked) {
      await supabase.from("fanzone_likes").delete().match({ post_id: postId, user_id: profile.id });
    } else {
      await supabase.from("fanzone_likes").insert([{ post_id: postId, user_id: profile.id }]);
      if (postOwnerId !== profile.id) {
        await supabase.from('fanzone_notifications').insert([{
          user_id: postOwnerId, actor_id: profile.id, post_id: postId, type: 'like_post'
        }]);
      }
    }
  };

  const toggleLikeComment = async (commentId: string, alreadyLiked: boolean, commentOwnerId: string) => {
    if (!profile) return;
    if (alreadyLiked) {
      await supabase.from("fanzone_comment_likes").delete().match({ comment_id: commentId, user_id: profile.id });
    } else {
      await supabase.from("fanzone_comment_likes").insert([{ comment_id: commentId, user_id: profile.id }]);
      if (commentOwnerId !== profile.id) {
        await supabase.from('fanzone_notifications').insert([{
          user_id: commentOwnerId, actor_id: profile.id, comment_id: commentId, type: 'like_comment'
        }]);
      }
    }
    fetchPosts(false);
  };

  const handlePublishReply = async () => {
    if (!profile || (!replyContent.trim() && !replyMediaFile) || !replyingToId) return;
    setIsPublishingReply(true);
    let mediaUrl: string | null = null;
    if (replyMediaFile) {
      const ext = replyMediaFile.name.split(".").pop() || "bin";
      const fileName = `${profile.id}_reply_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase
        .storage
        .from("fanzone_media")
        .upload(fileName, replyMediaFile);
      if (!uploadErr) {
        const { data: pubUrl } = supabase.storage.from("fanzone_media").getPublicUrl(fileName);
        mediaUrl = pubUrl.publicUrl;
      }
    }

    const payloadWithMedia = {
      post_id: replyingToId.postId,
      user_id: profile.id,
      content: replyContent,
      media_url: mediaUrl,
      parent_comment_id: replyingToId.commentId || null,
    };
    let { data: newComment, error } = await supabase
      .from("fanzone_comments")
      .insert([payloadWithMedia])
      .select()
      .single();
    if (error) {
      const errText = String(error.message || "").toLowerCase();
      const missingMediaColumn =
        errText.includes("media_url") && errText.includes("fanzone_comments");
      if (missingMediaColumn) {
        const payloadWithoutMedia = {
          post_id: replyingToId.postId,
          user_id: profile.id,
          content: replyContent,
          parent_comment_id: replyingToId.commentId || null,
        };
        const retry = await supabase
          .from("fanzone_comments")
          .insert([payloadWithoutMedia])
          .select()
          .single();
        newComment = retry.data;
        error = retry.error;
      }
    }

    if (!error && newComment) {
      const targetPost = posts.find(p => p.id === replyingToId.postId);
      if (targetPost && targetPost.user_id !== profile.id) {
        await supabase.from('fanzone_notifications').insert([{
          user_id: targetPost.user_id, actor_id: profile.id, post_id: replyingToId.postId, comment_id: newComment.id, type: 'reply'
        }]);
      }
      setReplyContent("");
      setReplyMediaFile(null);
      setReplyMediaPreview(null);
      if (replyFileInputRef.current) replyFileInputRef.current.value = "";
      setReplyingToId(null);
      fetchPosts(false);
    } else if (error) {
      showAlert(t("common.error"), `No se pudo enviar la respuesta: ${error.message}`);
    }
    setIsPublishingReply(false);
  };

  const executeRepost = async () => {
    if (!profile || !repostConfirm) return;
    const targetRepostId = repostConfirm.repost_id ? repostConfirm.repost_id : repostConfirm.id;
    await supabase.from("fanzone_posts").insert([{ user_id: profile.id, content: "", repost_id: targetRepostId }]);
    sendNotification(repostConfirm.user_id, 'repost', targetRepostId);
    setRepostConfirm(null);
    fetchPosts(false);
    showAlert(t("fanzone.reposted"), t("fanzone.reposted_msg"));
  };

  const executeReport = async () => {
    if (!profile || !reportModal || !reportReason.trim()) return;
    const item = reportModal.item;
    const prefix = reportModal.type === 'post' ? 'post' : 'comment';
    const postLink = `${window.location.origin}/fanzone#${prefix}-${item.id}`;
    
    const { error } = await supabase.from("denuncias").insert([{ 
        reported_user_id: item.user_id,
        reporter_id: profile.id, 
        motivo: `[FANZONE ${reportModal.type.toUpperCase()}] \nMotivo: ${reportReason}\nEnlace: ${postLink}`,
        estado: 'pendiente'
    }]);

    if (!error) {
      showAlert(t("fanzone.alerts.report_title"), t("fanzone.alerts.report_success"));
      setReportModal(null); setReportReason("");
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    if (!profile?.id) return;
    if (deleteConfirm.type === "post") {
      const { data: row } = await supabase
        .from("fanzone_posts")
        .select("id,user_id")
        .eq("id", deleteConfirm.id)
        .single();
      const isOwner = row?.user_id === profile.id;
      if (!isOwner && !canModerateAllContent) {
        showAlert(t("common.error"), "No tienes permisos para borrar este contenido.");
        setDeleteConfirm(null);
        return;
      }
      await supabase.from("fanzone_posts").delete().match({ id: deleteConfirm.id });
    } else {
      const { data: row } = await supabase
        .from("fanzone_comments")
        .select("id,user_id")
        .eq("id", deleteConfirm.id)
        .single();
      const isOwner = row?.user_id === profile.id;
      if (!isOwner && !canModerateAllContent) {
        showAlert(t("common.error"), "No tienes permisos para borrar este contenido.");
        setDeleteConfirm(null);
        return;
      }
      await supabase.from("fanzone_comments").delete().match({ id: deleteConfirm.id });
    }
    setDeleteConfirm(null);
    fetchPosts(false);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (deleteConfirm) {
        if (e.key === "Escape") {
          e.preventDefault();
          setDeleteConfirm(null);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          void executeDelete();
          return;
        }
      }
      if (repostConfirm) {
        if (e.key === "Escape") {
          e.preventDefault();
          setRepostConfirm(null);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          void executeRepost();
          return;
        }
      }
      if (reportModal) {
        if (e.key === "Escape") {
          e.preventDefault();
          setReportModal(null);
          return;
        }
        if (e.key === "Enter" && reportReason.trim()) {
          const target = e.target as HTMLElement | null;
          const tag = (target?.tagName || "").toLowerCase();
          const inTextarea = tag === "textarea";
          const canSubmit = !inTextarea || e.ctrlKey || e.metaKey;
          if (canSubmit) {
            e.preventDefault();
            void executeReport();
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteConfirm, repostConfirm, reportModal, reportReason]);

  const handleShare = async (postId: string) => {
    const postLink = `${window.location.origin}/fanzone#post-${postId}`;
    try {
      await navigator.clipboard.writeText(postLink);
      showAlert(t("fanzone.shared"), t("fanzone.shared_msg"));
    } catch (err) {}
  };

  const renderCommentThread = (comment: any, allComments: any[], depth = 0, parentPostId: string) => {
    const isCommentLiked = comment.comment_likes?.some((l:any) => l.user_id === profile?.id);
    const children = allComments.filter((c:any) => c.parent_comment_id === comment.id);
    
    return (
      <div key={comment.id} id={`comment-${comment.id}`} className={highlightId === `comment-${comment.id}` ? "highlight-target" : ""} style={{ marginTop: "15px", marginLeft: depth > 0 ? "20px" : "0", borderLeft: depth > 0 ? "2px solid var(--color-border)" : "none", paddingLeft: depth > 0 ? "15px" : "0" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <img 
            src={comment.profiles?.avatar_url || "https://ui-avatars.com/api/?name=?"} 
            style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }} 
            alt="" 
            onClick={() => goToProfile(comment)}
          />
           <div style={{ flex: 1 }}>
             <div style={{ background: depth === 0 ? "var(--bg-soft)" : "var(--bg-main)", padding: "12px", borderRadius: "0 16px 16px 16px", border: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                 <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                    <div 
                      onClick={() => goToProfile(comment)} 
                      style={{ cursor: "pointer" }}
                    >
                      <span style={{ fontWeight: 900, color: "var(--color-primary)", fontSize: "13px" }}
                            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'} 
                            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {comment.profiles?.display_name || t("global.default_user_name")}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{new Date(comment.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => setReportModal({type: 'comment', item: comment})} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}><Flag size={12} /></button>
                    {(profile?.id === comment.user_id || canModerateAllContent) && (
                      <button onClick={() => setDeleteConfirm({type: 'comment', id: comment.id})} style={{ background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer", padding: 0 }}><Trash2 size={12} /></button>
                    )}
                  </div>
                </div>
                <p style={{ margin: "5px 0 0 0", fontSize: "14px", color: "var(--text-main)", wordBreak: "break-word" }}>{formatText(comment.content)}</p>
                {comment.media_url && (
                  <div style={{ marginTop: "8px" }}>
                    {isVideoUrl(comment.media_url) ? (
                      <video src={comment.media_url} controls style={{ width: "100%", maxHeight: "220px", objectFit: "contain", borderRadius: "10px", border: "1px solid var(--color-border)" }} />
                    ) : (
                      <img src={comment.media_url} onClick={() => setFullscreenImage(comment.media_url)} style={{ width: "100%", maxHeight: "220px", objectFit: "cover", borderRadius: "10px", cursor: "zoom-in", border: "1px solid var(--color-border)" }} alt="Adjunto" />
                    )}
                  </div>
                )}
             </div>
             
             <div style={{ display: "flex", gap: "15px", marginTop: "5px", marginLeft: "10px", fontSize: "12px", fontWeight: 700, color: "var(--text-muted)" }}>
                <span onClick={() => toggleLikeComment(comment.id, isCommentLiked, comment.user_id)} style={{ cursor: "pointer", color: isCommentLiked ? "var(--color-primary)" : "inherit", display: "flex", alignItems: "center", gap: "3px" }}>
                  <Heart size={12} fill={isCommentLiked ? "var(--color-primary)" : "none"} /> {comment.comment_likes?.length > 0 && comment.comment_likes.length}
                </span>
                <span
                  onClick={() => {
                    setReplyingToId({ postId: parentPostId, commentId: comment.id });
                    setReplyContent("");
                    setReplyMediaFile(null);
                    setReplyMediaPreview(null);
                    if (replyFileInputRef.current) replyFileInputRef.current.value = "";
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {t("fanzone.reply")}
                </span>
             </div>

             {replyingToId?.commentId === comment.id && (
                <div style={{ position: "relative", marginTop: "10px" }}>
                  {replyMediaPreview && (
                    <div style={{ position: "relative", marginBottom: "8px", width: "fit-content", maxWidth: "100%" }}>
                      {isVideoFile(replyMediaFile) ? (
                        <video src={replyMediaPreview} controls style={{ maxWidth: "100%", maxHeight: "170px", borderRadius: "12px", border: "1px solid var(--color-border)" }} />
                      ) : (
                        <img src={replyMediaPreview} style={{ maxWidth: "100%", maxHeight: "170px", borderRadius: "12px", objectFit: "cover", border: "1px solid var(--color-border)" }} alt="preview" />
                      )}
                      <button onClick={() => { setReplyMediaFile(null); setReplyMediaPreview(null); if (replyFileInputRef.current) replyFileInputRef.current.value = ""; }} style={{ position: "absolute", top: 5, right: 5, background: "var(--overlay-medium)", color: "white", borderRadius: "50%", border: "none", cursor: "pointer", padding: "5px" }}><X size={14} /></button>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <textarea value={replyContent} onChange={(e) => handleTextChange(e, 'reply')} onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!isPublishingReply && (replyContent.trim() || replyMediaFile)) {
                          void handlePublishReply();
                        }
                      }
                    }} placeholder={t('fanzone.replying_to') || `Respondiendo a @${comment.profiles?.display_name?.replace(/\s+/g, '') || 'usuario'}...`} style={{ flex: 1, padding: "8px 12px", borderRadius: "99px", border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "var(--text-main)", resize: "none", outline: "none", fontSize: "13px" }} rows={1} />
                    <input
                      type="file"
                      ref={replyFileInputRef}
                      accept="image/*,video/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        void pickReplyMedia(f);
                      }}
                    />
                    <button type="button" onClick={() => replyFileInputRef.current?.click()} style={{ background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                      {isVideoFile(replyMediaFile) ? <Video size={14} /> : <ImageIcon size={14} />}
                    </button>
                    <button onClick={handlePublishReply} disabled={isPublishingReply || (!replyContent.trim() && !replyMediaFile)} style={{ background: "none", border: "none", color: (replyContent.trim() || replyMediaFile) ? "var(--color-primary)" : "var(--text-muted)", cursor: "pointer", opacity: isPublishingReply ? 0.6 : 1 }}><Send size={16} /></button>
                  </div>
                  
                  {mentionList.length > 0 && mentionTarget === 'reply' && (
                    <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: "12px", boxShadow: "0 -5px 15px var(--shadow-card)", zIndex: 10, padding: "5px", marginBottom: "5px" }}>
                      {mentionList.map(user => (
                        <div key={user.display_name} onClick={() => insertMention(user.display_name)} style={{ padding: "8px", display: "flex", gap: "10px", alignItems: "center", cursor: "pointer", borderRadius: "8px" }} className="mention-item">
                          <img src={user.avatar_url || "https://ui-avatars.com/api/?name=?"} style={{ width: 24, height: 24, borderRadius: "50%" }} alt=""/>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-primary)" }}>{user.display_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
             )}
           </div>
        </div>
        {children.map(child => renderCommentThread(child, allComments, depth + 1, parentPostId))}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)", display: "flex", flexDirection: "column", color: "var(--text-main)", transition: "background-color 0.3s ease" }}>
      
      {/* BOTÓN VOLVER AL EXPEDIENTE INTELIGENTE */}
      {isFromAdmin && (
        <button 
          onClick={() => {
            const params = new URLSearchParams(window.location.search);
            const rId = params.get('reopen');
            router.push(`/admin-panel?tab=denuncias${rId ? `&reopen=${rId}` : ''}`);
          }} 
          style={{ 
            position: "fixed", bottom: "30px", right: "30px", 
            background: "var(--text-main)", color: "var(--bg-main)", padding: "15px 30px", 
            borderRadius: "99px", display: "flex", alignItems: "center", 
            gap: "10px", fontWeight: 900, cursor: "pointer", zIndex: 9999, 
            boxShadow: "0 10px 30px var(--shadow-card)", border: "none" 
          }}
        >
          <AlertTriangle size={20} color="var(--bg-main)" /> VOLVER AL EXPEDIENTE
        </button>
      )}

      {fullscreenImage && (
        <div onClick={() => setFullscreenImage(null)} style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-heavy)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <img src={fullscreenImage} style={{ maxHeight: "90vh", maxWidth: "90vw", objectFit: "contain", borderRadius: "12px" }} alt="Fullscreen" />
          <X size={30} color="white" style={{ position: "absolute", top: 20, right: 20 }} />
        </div>
      )}

      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "24px", width: "100%", maxWidth: "400px", textAlign: "center", border: "1px solid var(--color-border)" }}>
            <Trash2 size={40} color="var(--color-primary)" style={{ marginBottom: "15px" }} />
            <h3 style={{ margin: "0 0 10px 0", color: "var(--text-main)" }}>{t("common.delete_confirm")}</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px" }}>{t("common.cannot_undo")}</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: "10px 20px", borderRadius: "99px", border: "1px solid var(--color-border)", background: "var(--bg-main)", cursor: "pointer", fontWeight: 700, color: "var(--text-muted)" }}>{t("common.cancel")}</button>
              <button onClick={executeDelete} style={{ padding: "10px 20px", borderRadius: "99px", border: "none", background: "var(--color-primary)", color: "white", cursor: "pointer", fontWeight: 900 }}>{t("common.yes_delete")}</button>
            </div>
          </div>
        </div>
      )}

      {repostConfirm && (
        <div onClick={() => setRepostConfirm(null)} style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "24px", width: "100%", maxWidth: "400px", textAlign: "center", border: "2px solid var(--color-primary)" }}>
            <Repeat2 size={40} color="var(--color-primary)" style={{ marginBottom: "15px" }} />
            <h3 style={{ margin: "0 0 10px 0", color: "var(--text-main)" }}>{t("fanzone.repost_confirm")}</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "14px" }}>{t("fanzone.repost_msg")}</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => setRepostConfirm(null)} style={{ padding: "10px 20px", borderRadius: "99px", border: "1px solid var(--color-border)", background: "var(--bg-main)", cursor: "pointer", fontWeight: 700, color: "var(--text-muted)" }}>{t("common.cancel")}</button>
              <button onClick={executeRepost} style={{ padding: "10px 20px", borderRadius: "99px", border: "none", background: "var(--color-primary)", color: "white", cursor: "pointer", fontWeight: 900 }}>{t("fanzone.yes_repost")}</button>
            </div>
          </div>
        </div>
      )}

      {reportModal && (
        <div onClick={() => setReportModal(null)} style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "24px", width: "100%", maxWidth: "450px", border: "2px solid var(--color-primary)" }}>
            <h3 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "24px", margin: "0 0 15px 0", display: "flex", alignItems: "center", gap: "10px" }}><AlertTriangle size={24}/> {t("common.report_content")}</h3>
            <textarea value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder={t("common.report_reason")} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "var(--text-main)", resize: "none", outline: "none", marginBottom: "15px", fontFamily: "inherit" }} rows={4} />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setReportModal(null)} style={{ padding: "10px 20px", borderRadius: "99px", background: "none", border: "none", color: "var(--text-muted)", fontWeight: 700, cursor: "pointer" }}>{t("common.cancel")}</button>
              <button onClick={executeReport} disabled={!reportReason.trim()} style={{ padding: "10px 20px", borderRadius: "99px", background: reportReason.trim() ? "var(--color-primary)" : "var(--bg-soft)", color: reportReason.trim() ? "white" : "var(--text-muted)", border: "none", fontWeight: 900, cursor: reportReason.trim() ? "pointer" : "not-allowed" }}>{t("common.send_report")}</button>
            </div>
          </div>
        </div>
      )}

      {showRules && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "var(--bg-card)", padding: "40px", borderRadius: "32px", width: "100%", maxWidth: "600px", border: "2px solid var(--color-primary)", boxShadow: "0 20px 50px var(--shadow-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "25px", borderBottom: "2px solid var(--color-border)", paddingBottom: "15px" }}>
              <ShieldCheck size={36} color="var(--color-primary)" />
              <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "32px", margin: 0 }}>{t("fanzone.rules_title")}</h2>
            </div>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "15px", marginBottom: "30px", color: "var(--text-main)" }}>
              <li style={{ display: "flex", gap: "10px" }}><Heart color="var(--color-primary)" size={20}/> <span>{t("fanzone.rule_1")}</span></li>
              <li style={{ display: "flex", gap: "10px" }}><Ban color="var(--color-primary)" size={20}/> <span>{t("fanzone.rule_2")}</span></li>
              <li style={{ display: "flex", gap: "10px" }}><AlertTriangle color="var(--color-primary)" size={20}/> <span>{t("fanzone.rule_3")}</span></li>
            </ul>
            <button onClick={() => { localStorage.setItem("fanzone_rules_accepted", "true"); setShowRules(false); }} style={{ width: "100%", background: "var(--color-primary)", color: "white", padding: "15px", borderRadius: "99px", border: "none", fontWeight: 900, cursor: "pointer" }}>{t("common.understood")}</button>
          </div>
        </div>
      )}

      <AdRailLayout section="fanzone">
      <main className="fanzone-main" style={{ flex: 1, display: "flex", justifyContent: "center", padding: "40px 20px 36px" }}>
        <div className="fanzone-column" style={{ width: "100%", maxWidth: "650px", display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Sparkles size={24} color="var(--color-primary)" />
            <h1 className="tan-font" style={{ fontSize: "32px", color: "var(--color-primary)", margin: 0 }}>{t("fanzone.title")}</h1>
          </div>

          <button 
            onClick={() => setOnlyFollowed(!onlyFollowed)} 
            style={{ 
              width: "fit-content", padding: "8px 20px", borderRadius: "99px", 
              border: onlyFollowed ? "1px solid var(--color-primary)" : "1px solid color-mix(in srgb, var(--color-primary) 32%, var(--color-border))",
              background: onlyFollowed ? "var(--color-primary)" : "var(--bg-card)",
              color: onlyFollowed ? "#ffffff" : "var(--color-primary)",
              fontWeight: 800, fontSize: "13px", 
              cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", marginTop: "10px",
              transition: "all 0.2s ease"
            }}
          >
            <Star size={14} color={onlyFollowed ? "#ffffff" : "var(--color-primary)"} fill={onlyFollowed ? "#ffffff" : "none"} /> 
            {onlyFollowed ? t("fanzone.viewing_favorites") : t("fanzone.filter_favorites")}
          </button>
          
          <div style={{ backgroundColor: "var(--bg-card)", padding: "20px", borderRadius: "24px", border: "1px solid var(--color-border)", boxShadow: "0 10px 20px var(--shadow-card)" }}>
            <div style={{ display: "flex", gap: "15px" }}>
              <img src={profile?.avatar_url || "https://ui-avatars.com/api/?name=?"} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
              <div style={{ flex: 1, position: "relative" }}>
                <textarea value={newPost} onChange={(e) => handleTextChange(e, 'post')} placeholder={t("fanzone.whats_on_mind")} style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: "16px", color: "var(--text-main)", backgroundColor: "transparent" }} rows={3} />
                
                {mentionList.length > 0 && mentionTarget === 'post' && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: "12px", boxShadow: "0 10px 25px var(--shadow-card)", zIndex: 10, padding: "5px" }}>
                    {mentionList.map(user => (
                      <div key={user.display_name} onClick={() => insertMention(user.display_name)} style={{ padding: "10px", display: "flex", gap: "10px", alignItems: "center", cursor: "pointer", borderRadius: "8px" }} className="mention-item">
                        <img src={user.avatar_url || "https://ui-avatars.com/api/?name=?"} style={{ width: 32, height: 32, borderRadius: "50%" }} alt=""/>
                        <p style={{ margin: 0, fontWeight: 900, color: "var(--color-primary)", fontSize: "14px" }}>{user.display_name}</p>
                      </div>
                    ))}
                  </div>
                )}

                {imagePreview && (
                  <div style={{ position: "relative", marginTop: "10px", width: "fit-content" }}>
                    <img src={imagePreview} style={{ maxWidth: "100%", maxHeight: "150px", borderRadius: "12px", objectFit: "cover" }} />
                    <button onClick={() => { setSelectedImage(null); setImagePreview(null); }} style={{ position: "absolute", top: 5, right: 5, background: "var(--overlay-medium)", color: "white", borderRadius: "50%", border: "none", cursor: "pointer", padding: "5px" }}><X size={16}/></button>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "15px", borderTop: "1px solid var(--color-border)", paddingTop: "15px" }}>
                  <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0] || null; void pickMainMedia(f); }} accept="image/*,video/*" style={{ display: "none" }} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer", display: "flex", gap: "5px", alignItems: "center", fontWeight: 700 }}>
                    <ImageIcon size={20} /> <span>{t("fanzone.photo")}</span>
                  </button>
                  <button onClick={handlePost} disabled={!newPost.trim() || isPublishing} style={{ background: newPost.trim() ? "var(--color-primary)" : "var(--bg-soft)", color: newPost.trim() ? "white" : "var(--text-muted)", padding: "10px 25px", borderRadius: "99px", border: "none", fontWeight: 900, cursor: newPost.trim() ? "pointer" : "not-allowed" }}>
                    {isPublishing ? <Loader2 className="animate-spin" size={18} /> : t("fanzone.publish")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "100px" }}>
            {loading && posts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" color="var(--color-primary)" /></div>
            ) : posts
                .filter(post => {
                  if (!onlyFollowed) return true; 
                  return myFavorites.includes(post.user_id); 
                })
                .map((post) => {
              const mainComments = post.comments.filter((c:any) => !c.parent_comment_id);
              
              return (
                <div key={post.id} id={`post-${post.id}`} className={highlightId === `post-${post.id}` ? "highlight-target" : ""} style={{ backgroundColor: "var(--bg-card)", padding: "20px 25px", borderRadius: "24px", border: "1px solid var(--color-border)", display: "flex", gap: "15px" }}>
                  <img 
                    onClick={() => goToProfile(post)}
                    src={post.profiles?.avatar_url || "https://ui-avatars.com/api/?name=?"} 
                    style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", cursor: "pointer", border: "1px solid var(--color-border)" }} 
                    alt="" 
                  />
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                        <div 
                          onClick={() => goToProfile(post)} 
                          style={{ cursor: "pointer" }} 
                          title={`Ver perfil de ${post.profiles?.display_name || t("global.default_user_name")}`}
                        >
                          <span style={{ fontWeight: 900, color: "var(--color-primary)", fontSize: "16px", textDecoration: "none" }} 
                                onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'} 
                                onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {post.profiles?.display_name || t("global.default_user_name")}
                          </span>
                        </div>
                        <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>{new Date(post.created_at).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <button onClick={() => setReportModal({type: 'post', item: post})} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><Flag size={16} /></button>
                        {(profile?.id === post.user_id || canModerateAllContent) && (
                          <button onClick={() => setDeleteConfirm({type: 'post', id: post.id})} style={{ background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer" }}><Trash2 size={16} /></button>
                        )}
                      </div>
                    </div>

                    {post.original_post ? (
                      <div style={{ marginTop: "10px", padding: "15px", border: "1px solid var(--color-border)", borderRadius: "16px", backgroundColor: "var(--bg-soft)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "5px", color: "var(--color-primary)", fontSize: "12px", fontWeight: 700 }}>
                          <Repeat2 size={14} /> <span>{t("fanzone.repost_of")} {post.original_post.profiles?.display_name}</span>
                        </div>
                        <p style={{ margin: "0 0 10px 0", color: "var(--text-main)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{formatText(post.original_post.content)}</p>
                        {post.original_post.media_url && (
                          <MediaAttachment
                            url={post.original_post.media_url}
                            onOpenImage={(u) => setFullscreenImage(u)}
                          />
                        )}
                      </div>
                    ) : (
                      <>
                        <p style={{ margin: "10px 0", color: "var(--text-main)", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.4" }}>{formatText(post.content)}</p>
                        {post.media_url && (
                          <div style={{ marginBottom: "15px" }}>
                            <MediaAttachment
                              url={post.media_url}
                              onOpenImage={(u) => setFullscreenImage(u)}
                            />
                          </div>
                        )}
                      </>
                    )}
                    
                    <div style={{ display: "flex", justifyContent: "space-between", maxWidth: "350px", color: "var(--text-muted)", marginBottom: "5px", marginTop: "10px" }}>
                      <button onClick={() => {
                        setReplyingToId({ postId: post.id });
                        setReplyContent("");
                        setReplyMediaFile(null);
                        setReplyMediaPreview(null);
                        if (replyFileInputRef.current) replyFileInputRef.current.value = "";
                      }} style={{ background: "none", border: "none", color: replyingToId?.postId === post.id && !replyingToId?.commentId ? socialActionColors.comment : "color-mix(in srgb, var(--text-muted) 60%, white 40%)", display: "flex", gap: "5px", cursor: "pointer", fontWeight: 700 }}>
                        <MessageCircle size={18} /> {post.commentsCount > 0 ? post.commentsCount : ""}
                      </button>
                      <button onClick={() => setRepostConfirm(post)} style={{ background: "none", border: "none", color: socialActionColors.repost, cursor: "pointer" }}><Repeat2 size={18} /></button>
                      <button onClick={() => toggleLikePost(post.id, post.isLiked, post.user_id)} style={{ background: "none", border: "none", color: post.isLiked ? socialActionColors.like : "color-mix(in srgb, var(--text-muted) 60%, white 40%)", display: "flex", gap: "6px", fontWeight: 700, cursor: "pointer", width: "40px" }}>
                        <Heart size={18} color={post.isLiked ? socialActionColors.like : "currentColor"} fill={post.isLiked ? socialActionColors.like : "none"} /> {post.likesCount > 0 ? post.likesCount : ""}
                      </button>
                      <button onClick={() => handleShare(post.id)} style={{ background: "none", border: "none", color: socialActionColors.share, cursor: "pointer" }}><Share size={18} /></button>
                    </div>

                    {replyingToId?.postId === post.id && !replyingToId?.commentId && (
                      <div style={{ position: "relative", marginTop: "10px", borderTop: "1px solid var(--color-border)", paddingTop: "15px" }}>
                        {replyMediaPreview && (
                          <div style={{ position: "relative", marginBottom: "8px", width: "fit-content", maxWidth: "100%" }}>
                            {isVideoFile(replyMediaFile) ? (
                              <video src={replyMediaPreview} controls style={{ maxWidth: "100%", maxHeight: "170px", borderRadius: "12px", border: "1px solid var(--color-border)" }} />
                            ) : (
                              <img src={replyMediaPreview} style={{ maxWidth: "100%", maxHeight: "170px", borderRadius: "12px", objectFit: "cover", border: "1px solid var(--color-border)" }} alt="preview" />
                            )}
                            <button onClick={() => { setReplyMediaFile(null); setReplyMediaPreview(null); if (replyFileInputRef.current) replyFileInputRef.current.value = ""; }} style={{ position: "absolute", top: 5, right: 5, background: "var(--overlay-medium)", color: "white", borderRadius: "50%", border: "none", cursor: "pointer", padding: "5px" }}><X size={14} /></button>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <textarea value={replyContent} onChange={(e) => handleTextChange(e, 'reply')} onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (!isPublishingReply && (replyContent.trim() || replyMediaFile)) {
                                void handlePublishReply();
                              }
                            }
                          }} placeholder={t("fanzone.reply_placeholder")} style={{ flex: 1, padding: "8px 12px", borderRadius: "99px", border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "var(--text-main)", resize: "none", outline: "none", fontSize: "14px" }} rows={1} />
                          <input
                            type="file"
                            ref={replyFileInputRef}
                            accept="image/*,video/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              void pickReplyMedia(f);
                            }}
                          />
                          <button type="button" onClick={() => replyFileInputRef.current?.click()} style={{ background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                            {isVideoFile(replyMediaFile) ? <Video size={16} /> : <ImageIcon size={16} />}
                          </button>
                          <button onClick={handlePublishReply} disabled={isPublishingReply || (!replyContent.trim() && !replyMediaFile)} style={{ background: "none", border: "none", color: (replyContent.trim() || replyMediaFile) ? "var(--color-primary)" : "var(--text-muted)", cursor: "pointer", opacity: isPublishingReply ? 0.6 : 1 }}><Send size={20} /></button>
                        </div>
                        {mentionList.length > 0 && mentionTarget === 'reply' && (
                          <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: "12px", boxShadow: "0 -5px 15px var(--shadow-card)", zIndex: 10, padding: "5px", marginBottom: "5px" }}>
                            {mentionList.map(user => (
                              <div key={user.display_name} onClick={() => insertMention(user.display_name)} style={{ padding: "8px", display: "flex", gap: "10px", alignItems: "center", cursor: "pointer", borderRadius: "8px" }} className="mention-item">
                                <img src={user.avatar_url || "https://ui-avatars.com/api/?name=?"} style={{ width: 24, height: 24, borderRadius: "50%" }} alt="" />
                                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-primary)" }}>{user.display_name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {mainComments.length > 0 && (
                      <div style={{ marginTop: "15px", paddingTop: "10px", borderTop: "1px dashed var(--color-border)" }}>
                        {mainComments.map((comment: any) => renderCommentThread(comment, post.comments, 0, post.id))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      </AdRailLayout>
      
      <Footer />

      <style jsx global>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mention-item:hover { background-color: var(--bg-soft); }
        .highlight-target { animation: highlight-pulse 3s ease-out; }
      `}</style>
    </div>
  );
}