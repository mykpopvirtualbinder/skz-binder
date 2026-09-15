"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resolveMemberAvatarUrl } from "@/lib/member-image-url";

import Footer from "../components/footer";
import { Sparkles, ArrowLeft, Instagram, Youtube, Info, Send, User, Heart, ImageIcon, X, Loader2, Flag, Reply, ShieldAlert } from "lucide-react";
import { useGlobal } from "../context/GlobalContext";

function ArtistContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const highlightedId = searchParams.get('highlight'); 
  const isAdmin = searchParams.get('admin') === 'true';
  const denunciaId = searchParams.get('denunciaId');

const { profile, showAlert, showPrompt, t } = useGlobal();
// El perfil en las dependencias de los efectos asegura que si el usuario
// cambia el idioma en el Header, el contenido de esta página se refresque.
// 
  const [isMobile, setIsMobile] = useState(false);

  const ARTIST_ID = "stray-kids"; 

  const [groupLogo, setGroupLogo] = useState<string | null>(null);
  const [dbMembers, setDbMembers] = useState<any[]>([]);
  const [wallPosts, setWallPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const fetchArtistData = async () => {
      const { data: gData } = await supabase.from('groups').select('*').ilike('name', '%Stray Kids%').single();
      if (gData) {
        setGroupLogo(gData.logo_url);
        const { data: mData } = await supabase.from('members').select('*').eq('group_id', gData.id);
        if (mData) setDbMembers(mData);
      }
    };
    fetchArtistData();
    loadWallPosts();
  }, []);

  useEffect(() => {
    if (highlightedId && wallPosts.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`post-${highlightedId}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }, 800);
    }
  }, [highlightedId, wallPosts]);

  const loadWallPosts = async () => {
    const { data: posts } = await supabase.from('artist_wall').select('*').eq('artist_id', ARTIST_ID).order('created_at', { ascending: false });
    if (!posts || posts.length === 0) return setWallPosts([]);

    const userIds = Array.from(new Set(posts.map(p => p.user_id)));
    const { data: profiles } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds);
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

    const postIds = posts.map(p => p.id);
    const { data: likes } = await supabase.from('artist_wall_likes').select('*').in('post_id', postIds);

    const authUser = (await supabase.auth.getUser()).data.user;
    
    const formattedPosts = posts.map(post => {
      const postLikes = likes?.filter(l => l.post_id === post.id) || [];
      return {
        ...post,
        profile: profileMap[post.user_id] || { display_name: t('global.default_user_name'), avatar_url: null },
        likes_count: postLikes.length,
        user_has_liked: postLikes.some(l => l.user_id === authUser?.id)
      };
    });
    setWallPosts(formattedPosts);
  };

  const handlePost = async () => {
    if (!profile?.id) return showAlert("¡Ups!", t('artist_month.error_login'));
    if (profile?.is_restricted) return showAlert(t('artist_month.error_restricted'), t('artist_month.error_restricted_msg'));
    if (!newPost.trim() && !selectedFile) return;

    setIsUploading(true);
    let mediaUrl = null;

    try {
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `artist-wall/${Date.now()}_${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('fanart-pics').upload(fileName, selectedFile);
        if (uploadError) throw uploadError;
        mediaUrl = supabase.storage.from('fanart-pics').getPublicUrl(fileName).data.publicUrl;
      }

      const { error } = await supabase.from('artist_wall').insert({
        artist_id: ARTIST_ID,
        user_id: profile.id,
        content: newPost,
        media_url: mediaUrl,
        parent_id: null
      });

      if (error) throw error;
      setNewPost("");
      setSelectedFile(null);
      loadWallPosts();
    } catch (err: any) {
      showAlert("Error", t('artist_month.error_publish') + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!profile?.id) return showAlert("¡Ups!", t('artist_month.error_login'));
    if (profile?.is_restricted) return showAlert(t('artist_month.error_restricted'), t('artist_month.error_restricted_msg'));
    if (!replyText.trim() && !replyFile) return;

    setIsReplying(true);
    let mediaUrl = null;

    try {
      if (replyFile) {
        const fileExt = replyFile.name.split('.').pop();
        const fileName = `artist-wall/reply_${Date.now()}_${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('fanart-pics').upload(fileName, replyFile);
        if (uploadError) throw uploadError;
        mediaUrl = supabase.storage.from('fanart-pics').getPublicUrl(fileName).data.publicUrl;
      }

      const { error } = await supabase.from('artist_wall').insert({
        artist_id: ARTIST_ID,
        user_id: profile.id,
        content: replyText,
        media_url: mediaUrl,
        parent_id: parentId
      });

      if (error) throw error;
      setReplyText("");
      setReplyFile(null);
      setReplyingToId(null);
      loadWallPosts();
    } catch (err: any) {
      showAlert("Error", t('artist_month.error_publish') + err.message);
    } finally {
      setIsReplying(false);
    }
  };

  const handleLike = async (postId: string, hasLiked: boolean) => {
    if (!profile?.id) return showAlert("¡Ups!", t('artist_month.error_login'));
    setWallPosts(prev => prev.map(p => p.id === postId ? { ...p, user_has_liked: !hasLiked, likes_count: hasLiked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    if (hasLiked) {
      await supabase.from('artist_wall_likes').delete().eq('post_id', postId).eq('user_id', profile.id);
    } else {
      await supabase.from('artist_wall_likes').insert({ post_id: postId, user_id: profile.id });
    }
  };

  const handleReport = (postId: string, reportedUserId: string) => {
    if (!profile?.id) return showAlert("Aviso", t('artist_month.error_login'));
    showPrompt(t('artist_month.report_prompt_title'), t('artist_month.report_prompt_msg'), async (razon, isAnonymous) => {
      await supabase.from('denuncias').insert({
        reporter_id: isAnonymous ? null : profile.id,
        reported_user_id: reportedUserId,
        motivo: `[Muro Artista - Mensaje: ${postId}] ${razon}`,
        estado: 'pendiente'
      });
      showAlert(t('artist_month.report_success_title'), t('artist_month.report_success_msg'));
    });
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontWeight: 800 }} onClick={e => e.stopPropagation()}>{part}</a>;
      }
      return part;
    });
  };

  const renderPosts = (parentId: string | null = null, level: number = 0) => {
    return wallPosts.filter(p => p.parent_id === parentId).map(post => (
      <div id={`post-${post.id}`} key={post.id} style={{ 
        display: "flex", gap: "15px", padding: "15px", paddingBottom: "20px", 
        borderBottom: level === 0 ? "1px solid var(--color-border)" : "none", 
        marginLeft: level > 0 ? "40px" : "0", marginTop: level > 0 ? "15px" : "0", 
        borderRadius: "16px",
        backgroundColor: highlightedId === post.id ? "var(--bg-soft)" : "transparent",
        border: highlightedId === post.id ? "1px dashed var(--color-primary)" : "none",
        transition: "all 0.5s ease"
      }}>
        <div style={{ width: level > 0 ? "30px" : "40px", height: level > 0 ? "30px" : "40px", borderRadius: "50%", background: "var(--bg-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {post.profile.avatar_url ? <img src={post.profile.avatar_url} style={{width:"100%", height:"100%", borderRadius:"50%", objectFit:"cover"}} alt=""/> : <User color="var(--color-primary)" size={level > 0 ? 16 : 20}/>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
            <span style={{ fontWeight: 900, color: "var(--text-main)", fontSize: level > 0 ? "13px" : "14px" }}>{post.profile.display_name}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 700 }}>{new Date(post.created_at).toLocaleDateString()}</span>
          </div>
          
          <p style={{ margin: "0 0 10px 0", color: "var(--text-main)", fontSize: "14px", lineHeight: "1.5", fontWeight: 500, wordWrap: "break-word" }}>
            {renderTextWithLinks(post.content)}
          </p>

          {post.media_url && (
             <div style={{ marginBottom: "10px", borderRadius: "12px", overflow: "hidden", maxWidth: "300px", border: "1px solid var(--color-border)" }}>
               {post.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                 <video src={post.media_url} controls style={{ width: "100%", display: "block" }} />
               ) : (
                 <img src={post.media_url} alt="Adjunto" style={{ width: "100%", display: "block" }} />
               )}
             </div>
          )}

          <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
            <button onClick={() => handleLike(post.id, post.user_has_liked)} style={{ background: "none", border: "none", padding: 0, color: post.user_has_liked ? "var(--color-border)" : "var(--text-muted)", fontSize: "12px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
              <Heart size={14} fill={post.user_has_liked ? "var(--color-border)" : "none"} /> {post.likes_count || ""}
            </button>
            <button onClick={() => { setReplyingToId(replyingToId === post.id ? null : post.id); setReplyText(""); setReplyFile(null); }} style={{ background: "none", border: "none", padding: 0, color: "var(--text-muted)", fontSize: "12px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
              <Reply size={14} /> {t('artist_month.btn_reply')}
            </button>
            <button onClick={() => handleReport(post.id, post.user_id)} style={{ background: "none", border: "none", padding: 0, color: "var(--text-muted)", fontSize: "12px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto" }}>
              <Flag size={12} /> {t('artist_month.btn_report')}
            </button>
          </div>

          {replyingToId === post.id && (
            <div style={{ marginTop: "15px", display: "flex", flexDirection: "column", gap: "10px", background: "var(--bg-main)", padding: "15px", borderRadius: "14px", border: "1px dashed var(--color-border)" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  autoFocus
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={`${t('artist_month.reply_to')} ${post.profile.display_name} ${t('artist_month.or_paste_link')}`}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "13px", color: "var(--text-main)", fontWeight: 600 }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleReply(post.id); }}
                />
                <button onClick={() => { setReplyingToId(null); setReplyFile(null); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}><X size={16}/></button>
              </div>

              {replyFile && (
                <div style={{ position: "relative", width: "fit-content" }}>
                  <img src={URL.createObjectURL(replyFile)} style={{ height: "40px", borderRadius: "6px", border: "1px solid var(--color-border)" }} alt="preview" />
                  <button onClick={() => setReplyFile(null)} style={{ position: "absolute", top: -6, right: -6, background: "var(--text-main)", color: "white", border: "none", borderRadius: "50%", width: 16, height: 16, cursor: "pointer", fontSize: "8px" }}>X</button>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed var(--color-border)", paddingTop: "10px" }}>
                <button onClick={() => replyFileInputRef.current?.click()} style={{ background: "var(--bg-soft)", border: "none", color: "var(--color-primary)", padding: "6px", borderRadius: "50%", cursor: "pointer", display: "flex" }}>
                  <ImageIcon size={14} />
                </button>
                <input type="file" ref={replyFileInputRef} style={{ display: "none" }} accept="image/*,video/*" onChange={e => setReplyFile(e.target.files?.[0] || null)} />
                
                <button onClick={() => handleReply(post.id)} disabled={(!replyText.trim() && !replyFile) || isReplying} style={{ background: "var(--color-primary)", color: "white", border: "none", padding: "6px 14px", borderRadius: "99px", fontWeight: 900, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", opacity: ((!replyText.trim() && !replyFile) || isReplying) ? 0.5 : 1 }}>
                  {isReplying ? <Loader2 size={14} className="spinner"/> : <><Send size={12}/> {t('artist_month.btn_send')}</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )).concat(
      wallPosts.filter(p => p.parent_id === parentId).map(post => <div key={`replies-${post.id}`}>{renderPosts(post.id, level + 1)}</div>) as any
    );
  };

  const membersSocials = [
    { name: "Bang Chan", handle: "@gnabnahc", link: "https://instagram.com/gnabnahc" },
    { name: "Lee Know", handle: "@t.leeknows_814", link: "https://instagram.com/t.leeknows_814" },
    { name: "Changbin", handle: "@jutdwae", link: "https://instagram.com/jutdwae" },
    { name: "Hyunjin", handle: "@hynjinnnn", link: "https://instagram.com/hynjinnnn" },
    { name: "Han", handle: "@_doolsetnet", link: "https://instagram.com/_doolsetnet" },
    { name: "Felix", handle: "@yong.lixx", link: "https://instagram.com/yong.lixx" },
    { name: "Seungmin", handle: "@miniverse.__", link: "https://instagram.com/miniverse.__" },
    { name: "I.N", handle: "@i.2.n.8", link: "https://instagram.com/i.2.n.8" }
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", width: "100%", height: isMobile ? "40vh" : "55vh", overflow: "hidden", backgroundColor: "var(--text-main)" }}>
        <img src="https://spanish.korea.net/upload/content/editImage/20251202110216185_AUBNJ5NY.jpg" alt="Hero" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.4 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--bg-main) 0%, transparent 100%)" }} />
        <div style={{ position: "absolute", bottom: isMobile ? "20px" : "40px", left: "0", width: "100%", padding: isMobile ? "0 20px" : "0 60px", maxWidth: "1200px", margin: "0 auto" }}>
          <button onClick={() => router.push('/')} style={{ background: "color-mix(in srgb, var(--bg-card) 80%, transparent)", border: "none", padding: "8px 16px", borderRadius: "99px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "var(--color-primary)", cursor: "pointer", marginBottom: "20px", backdropFilter: "blur(4px)" }}>
            <ArrowLeft size={16} /> {t('artist_month.back_home')}
          </button>
          <span style={{ background: "var(--color-border)", color: "white", padding: "6px 14px", borderRadius: "99px", fontSize: "12px", fontWeight: 900, letterSpacing: "1px", textTransform: "uppercase" }}>{t('artist_month.badge')}</span>
          <h1 className="tan-font" style={{ fontSize: isMobile ? "50px" : "80px", color: "var(--text-main)", margin: "10px 0 0 0", lineHeight: "1" }}>{t('artist_month.group_name')}</h1>
        </div>
      </div>

      <main style={{ flex: 1, width: "100%", maxWidth: "1100px", margin: "0 auto", padding: isMobile ? "20px" : "40px", position: "relative" }}>
        
        {isAdmin && denunciaId && (
          <div style={{ position: "fixed", bottom: "30px", right: "30px", zIndex: 9999 }}>
            <button
              onClick={() => router.push(`/admin-panel?reopen=${denunciaId}`)}
              style={{
                background: "var(--text-main)",
                color: "white",
                border: "2px solid var(--color-border)",
                padding: "14px 24px",
                borderRadius: "99px",
                fontWeight: 900,
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 15px 30px var(--overlay-soft)",
                transition: "transform 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <ShieldAlert size={20} color="var(--color-border)" />
              {t('artist_month.admin_back')}
            </button>
          </div>
        )}
        
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "40px" }}>
          
          <div style={{ flex: 1.6, display: "flex", flexDirection: "column", gap: "30px" }}>
            <section style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "24px", border: "1px solid var(--color-border)", boxShadow: "0 10px 30px color-mix(in srgb, var(--text-main) 5%, transparent)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
                {groupLogo ? <img src={groupLogo} alt="Logo" style={{ height: "40px", objectFit: "contain", maxWidth: "200px" }} /> : <div style={{ height: "40px", width: "120px", background: "var(--bg-soft)", borderRadius: "8px" }} />}
                <h2 style={{ color: "var(--color-primary)", fontSize: "24px", fontWeight: 900, margin: 0 }}>{t('artist_month.history_title')}</h2>
              </div>
              <p style={{ color: "var(--text-main)", fontSize: "16px", lineHeight: "1.8", fontWeight: 500 }}>{t('artist_month.history_p1')}</p>
              <div style={{ margin: "25px 0", borderRadius: "16px", overflow: "hidden", border: "1px solid var(--color-border)" }}>
                <img src="https://spanish.korea.net/upload/content/editImage/20251202110216185_AUBNJ5NY.jpg" alt="Artist" style={{ width: "100%", display: "block", objectFit: "cover", height: isMobile ? "200px" : "350px" }} />
              </div>
              <p style={{ color: "var(--text-main)", fontSize: "16px", lineHeight: "1.8", fontWeight: 500 }}>{t('artist_month.history_p2')}</p>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "20px" }}>
              <div style={{ background: "var(--bg-soft)", padding: "25px", borderRadius: "24px", border: "1px dashed var(--color-border)" }}>
                <h3 style={{ color: "var(--color-primary)", fontSize: "18px", fontWeight: 900, marginTop: 0, display: "flex", alignItems: "center", gap: "8px" }}><Info size={20} color="var(--color-border)" /> {t('artist_month.facts_title')}</h3>
                <ul style={{ color: "var(--text-main)", fontSize: "14px", lineHeight: "1.6", fontWeight: 600, paddingLeft: "20px", margin: 0 }}>
                  <li style={{ marginBottom: "10px" }}>{t('artist_month.fact_1')}</li>
                  <li>{t('artist_month.fact_2')}</li>
                </ul>
              </div>
              <div style={{ background: "var(--bg-soft)", padding: "25px", borderRadius: "24px", border: "1px dashed var(--color-primary)" }}>
                <h3 style={{ color: "var(--color-primary)", fontSize: "18px", fontWeight: 900, marginTop: 0, display: "flex", alignItems: "center", gap: "8px" }}><Sparkles size={20} color="var(--color-primary)" /> {t('artist_month.news_title')}</h3>
                <p style={{ color: "var(--text-main)", fontSize: "14px", lineHeight: "1.6", fontWeight: 600 }}>{t('artist_month.news_text')}</p>
              </div>
            </section>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "24px", border: "1px solid var(--color-border)" }}>
              <h3 style={{ color: "var(--color-primary)", fontSize: "20px", fontWeight: 900, marginTop: 0, marginBottom: "20px" }}>{t('artist_month.group_accounts')}</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "30px" }}>
                <a href="#" style={{ textDecoration: "none", background: "var(--bg-main)", padding: "12px 20px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px", color: "var(--text-main)", fontWeight: 800, fontSize: "14px" }}><IconSpotify /> Spotify</a>
                <a href="#" style={{ textDecoration: "none", background: "var(--bg-main)", padding: "12px 20px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px", color: "var(--text-main)", fontWeight: 800, fontSize: "14px" }}><IconAppleMusic /> Apple Music</a>
<a href="https://www.instagram.com/stray_kids_official_jp/" target="_blank" rel="noreferrer" style={{ textDecoration: "none", background: "var(--bg-main)", padding: "12px 20px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px", color: "var(--text-main)", fontWeight: 800, fontSize: "14px" }}>
  <Instagram size={18} color="var(--color-primary)" /> Instagram
</a>
                <a href="#" style={{ textDecoration: "none", background: "var(--bg-main)", padding: "12px 20px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px", color: "var(--text-main)", fontWeight: 800, fontSize: "14px" }}><IconX /> Twitter</a>
                <a href="#" style={{ textDecoration: "none", background: "var(--bg-main)", padding: "12px 20px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px", color: "var(--text-main)", fontWeight: 800, fontSize: "14px" }}><IconTikTok /> TikTok</a>
                <a href="#" style={{ textDecoration: "none", background: "var(--bg-main)", padding: "12px 20px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px", color: "var(--text-main)", fontWeight: 800, fontSize: "14px" }}><Youtube size={18} color="var(--state-danger-fg)" /> YouTube</a>
              </div>

              <h4 style={{ color: "var(--text-muted)", fontSize: "13px", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px", borderBottom: "1px solid var(--color-border)", paddingBottom: "10px" }}>{t('artist_month.personal_accounts')}</h4>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px" }}>
                {membersSocials.map(social => {
                  const memberDb = dbMembers.find(m => m.name.toLowerCase().includes(social.name.toLowerCase()) || social.name.toLowerCase().includes(m.name.toLowerCase()));
                  return <MemberSocial key={social.name} name={social.name} handle={social.handle} link={social.link} imgUrl={resolveMemberAvatarUrl(memberDb?.image_url) || `https://ui-avatars.com/api/?name=${social.name}&background=ffd9e6&color=8C659C`} />;
                })}
              </div>
            </div>
          </div>
        </div>

        <section style={{ marginTop: "60px", borderTop: "2px dashed var(--color-border)", paddingTop: "50px" }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "36px", margin: "0 0 10px 0" }}>{t('artist_month.wall_title')}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "16px", fontWeight: 700, margin: 0 }}>{t('artist_month.wall_subtitle')}</p>
          </div>

          <div style={{ maxWidth: "800px", margin: "0 auto", background: "var(--bg-card)", padding: isMobile ? "20px" : "30px", borderRadius: "24px", border: "1px solid var(--color-border)", boxShadow: "0 10px 30px color-mix(in srgb, var(--text-main) 5%, transparent)" }}>
            
<div style={{ 
  display: "flex", 
  flexDirection: "column", 
  gap: "10px", 
  marginBottom: "30px", 
  background: "var(--bg-main)", 
  padding: "15px", 
  borderRadius: "16px", 
  border: "1px solid var(--color-border)",
  transition: "all 0.3s ease" // Para que el cambio de color de fondo sea suave
}}>              <textarea 
                id="wall-input"
                value={newPost}
                onChange={e => setNewPost(e.target.value)}
                placeholder={t('artist_month.placeholder_post')} 
                style={{ width: "100%", border: "none", outline: "none", resize: "none", minHeight: "60px", fontFamily: "inherit", fontWeight: 600, color: "var(--text-main)", background: "transparent" }}
              />
              
              {selectedFile && (
                <div style={{ position: "relative", width: "fit-content" }}>
                  <img src={URL.createObjectURL(selectedFile)} style={{ height: "60px", borderRadius: "8px", border: "1px solid var(--color-border)" }} alt="preview" />
                  <button onClick={() => setSelectedFile(null)} style={{ position: "absolute", top: -8, right: -8, background: "var(--text-main)", color: "white", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: "10px" }}>X</button>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--color-border)", paddingTop: "10px" }}>
                <button onClick={() => fileInputRef.current?.click()} style={{ background: "var(--bg-soft)", border: "none", color: "var(--color-primary)", padding: "8px", borderRadius: "50%", cursor: "pointer", display: "flex" }}>
                  <ImageIcon size={18} />
                </button>
                <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*,video/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                
                <button 
  onClick={handlePost} 
  disabled={isUploading || (!newPost.trim() && !selectedFile)} 
  style={{ 
    background: "var(--color-primary)", 
    color: "white", // Forzamos blanco para que resalte en cualquier tema
    border: "none", 
    padding: "8px 20px", 
    borderRadius: "99px", 
    fontWeight: 900, 
    cursor: "pointer", 
    display: "flex", 
    alignItems: "center", 
    gap: "5px", 
    opacity: (isUploading || (!newPost.trim() && !selectedFile)) ? 0.5 : 1 
  }}
>
  {isUploading ? <Loader2 size={14} className="spinner"/> : <><Send size={14} /> {t('artist_month.btn_publish')}</>}
</button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {wallPosts.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>{t('artist_month.no_messages')}</p>
              ) : (
                <React.Suspense fallback={<p>{t('artist_month.loading_posts')}</p>}>
                  {renderPosts(null, 0)}
                </React.Suspense>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />

      <style jsx global>{`
        @font-face { font-family: 'TanTangkiwood'; src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype'); }
        .tan-font { font-family: 'TanTangkiwood', sans-serif !important; }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function ArtistOfTheMonth() {
  const { t } = useGlobal();
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)", fontWeight: 900, backgroundColor: "var(--bg-main)" }}>{t('artist_month.loading_page')}</div>}>
      <ArtistContent />
    </Suspense>
  );
}

const MemberSocial = ({ name, handle, link, imgUrl }: { name: string, handle: string, link: string, imgUrl: string }) => (
  <a href={link} target="_blank" rel="noreferrer" style={{ textDecoration: "none", background: "var(--bg-main)", padding: "10px", borderRadius: "14px", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "10px", transition: "0.2s" }}>
    <img src={imgUrl} alt={name} style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--bg-soft)", background: "var(--bg-card)" }} />
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--text-main)", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{name}</span>
      <span style={{ fontSize: "11px", color: "var(--color-primary)", fontWeight: 600 }}>{handle}</span>
    </div>
  </a>
);

// Iconos (Sin cambios, son SVG con colores fijos o dinámicos según su marca)
const IconX = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.004 3.916H5.078z"/></svg>;
const IconTikTok = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>;
const IconSpotify = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--state-success-border)"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.26.36.18.48.659.301 1.08zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zM20.04 9.36C15.96 6.96 9.24 6.72 5.4 7.68c-.6.12-1.14-.24-1.26-.84-.12-.6.24-1.14.84-1.26 4.32-1.08 11.64-.84 16.32 1.68.54.3.72 1.02.42 1.56-.24.6-.96.72-1.68.54z"/></svg>;
const IconAppleMusic = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--state-danger-fg)"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.62-1.48 3.608-2.947 1.16-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.542 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.246-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"/></svg>;