"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Sparkles, ChevronLeft, ChevronRight, Crown, BookOpen, LayoutGrid, Palette, MessageSquare, X, Share2, Store, Repeat2, MessageCircle, Send, Heart, Star, AlertTriangle, Wallet, Boxes } from "lucide-react";
import VirtualBinder from "@/app/components/VirtualBinder";

import { useGlobal } from "app/context/GlobalContext"; // 👈 Añadido
import Footer from "app/components/footer"

const AVG_PC_PRICE = 8;

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { t } = useGlobal(); // 👈 Añadido
  
  // --- ESTADOS DE DATOS ---
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myKoins, setMyKoins] = useState<number>(0); 
  
  const [profile, setProfile] = useState<any>(null);
  const [binders, setBinders] = useState<any[]>([]); 
  const [pcs, setPcs] = useState<any[]>([]); 
  const [otwItems, setOtwItems] = useState<number[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [fanarts, setFanarts] = useState<any[]>([]);
  const [marketAds, setMarketAds] = useState<any[]>([]);
  const [groupedBiases, setGroupedBiases] = useState<any[]>([]);
  const [isFav, setIsFav] = useState(false);
  
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [binderPage, setBinderPage] = useState(0);
  
  // --- ESTADOS DE MODALES ---
  const [loading, setLoading] = useState(true);
  const [selectedBinder, setSelectedBinder] = useState<any>(null);
  const [showFollowModal, setShowFollowModal] = useState<'followers' | 'following' | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showKoinsModal, setShowKoinsModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const toggleFavorite = () => setIsFavorite(!isFavorite);
  const [customAlert, setCustomAlert] = useState<{title: string, message: string} | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const [contactMessage, setContactMessage] = useState("");
  const [koinsAmount, setKoinsAmount] = useState<number | "">("");
  const [isSending, setIsSending] = useState(false);

  const formatName = (str: string) => {
    if (!str) return "";
    return str.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  useEffect(() => {
    if (!userId) return;

    async function loadUserData() {
      setLoading(true);
      
      const { data: authData } = await supabase.auth.getUser();
      const myId = authData?.user?.id;
      if (myId) {
        setCurrentUserId(myId);
        const { data: myProfile } = await supabase.from("profiles").select("puntos").eq("user_id", myId).single();
        if (myProfile) setMyKoins(myProfile.puntos || 0);
      }

      const { data: p } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
      
      const { data: b } = await supabase
        .from("binders")
        .select("*, binder_pages(*, page_slots(*, item:items(*)))")
        .eq("user_id", userId);

      const bindersCalculados = (b || []).map(binder => {
        const todosLosSlots = binder.binder_pages?.flatMap((page: any) => page.page_slots) || [];
        const cartasReales = todosLosSlots.filter((slot: any) => slot.item); 
        const esPublico = binder.public_customization !== false;
        
        return { 
          ...binder, 
          all_items: cartasReales,
          display_cover: esPublico ? binder.cover_url : null
        };
      });

      const { data: c } = await supabase.from("user_item_statuses").select("*, item:items(*)").eq("user_id", userId).eq("status", "have");
      const { data: otwData } = await supabase.from("user_item_statuses").select("item_id").eq("user_id", userId).eq("status", "on_its_way");
      if (otwData) setOtwItems(otwData.map(row => row.item_id));
      
      const { data: fz } = await supabase.from("fanzone_posts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      const { data: fa } = await supabase.from("fanarts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      const { data: ads } = await supabase.from("market_ads").select("*").eq("user_id", userId).order("created_at", { ascending: false });

      const { data: f1_ids } = await supabase.from("user_favorites").select("follower_id").eq("following_id", userId);
      const { data: f2_ids } = await supabase.from("user_favorites").select("following_id").eq("follower_id", userId);
      
      let finalFollowers: any[] = [];
      let finalFollowing: any[] = [];

      if (f1_ids && f1_ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", f1_ids.map(x => x.follower_id));
        if (profs) finalFollowers = profs;
      }
      
      if (f2_ids && f2_ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", f2_ids.map(x => x.following_id));
        if (profs) finalFollowing = profs;
      }

      if (myId) {
        const { data: myFav } = await supabase.from("user_favorites").select("id").eq("follower_id", myId).eq("following_id", userId).maybeSingle();
        setIsFav(!!myFav);
      }

      const biasJson = p?.bias_by_group || {};
      const { data: allGroups } = await supabase.from("groups").select("*");
      
      const gMap: any[] = [];
      Object.keys(biasJson).forEach(groupName => {
        const groupObj = allGroups?.find(g => g.name.toLowerCase() === groupName.toLowerCase()) || { name: groupName, logo_url: null };
        const biases = biasJson[groupName] || [];
        if (biases.length > 0) gMap.push({ group: groupObj, biases });
      });

      if (p) setProfile(p);
      setBinders(bindersCalculados); 
      setPcs(c || []);
      setPosts(fz || []);
      setFanarts(fa || []);
      setMarketAds(ads || []);
      setFollowers(finalFollowers);
      setFollowing(finalFollowing);
      setGroupedBiases(gMap);
      setLoading(false);
    }
    
    loadUserData();
  }, [userId]);

  const handleToggleFavorite = async () => {
    if (!currentUserId || !profile) return setCustomAlert({ title: t("public_profile.alert_login_title"), message: t("public_profile.alert_login_msg") });
    if (isFav) {
      await supabase.from('user_favorites').delete().eq('follower_id', currentUserId).eq('following_id', profile.user_id);
      setIsFav(false);
      setFollowers(prev => prev.filter(f => f.user_id !== currentUserId));
    } else {
      await supabase.from('user_favorites').insert([{ follower_id: currentUserId, following_id: profile.user_id }]);
      setIsFav(true);
      const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").eq("user_id", currentUserId).single();
      if (data) setFollowers(prev => [...prev, data]);
    }
  };

  const handleSendMessage = async () => {
    if (!contactMessage.trim() || !currentUserId) return;
    setIsSending(true);
    await supabase.from("notifications").insert({
      user_id: profile.user_id, sender_id: currentUserId, type: 'chat_message', content: contactMessage, read: false
    });
    setShowContactModal(false); 
    setContactMessage(""); 
    setIsSending(false);
    setCustomAlert({ title: t("public_profile.alert_msg_sent_title"), message: t("public_profile.alert_msg_sent") });
  };

  const handleSendKoins = async () => {
    if (!koinsAmount || koinsAmount <= 0 || !currentUserId) return;
    if (koinsAmount > myKoins) {
      setCustomAlert({ title: t("public_profile.alert_koins_insufficient_title"), message: t("public_profile.alert_koins_insufficient").replace('{amount}', koinsAmount.toString()).replace('{total}', myKoins.toString()) });
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.rpc('transferir_puntos', { remitente_id: currentUserId, destinatario_id: profile.user_id, cantidad: koinsAmount });
      if (error) throw error;
      await supabase.from('fanzone_notifications').insert({ user_id: profile.user_id, actor_id: currentUserId, type: 'points_gift' });
      
      setMyKoins(prev => prev - (koinsAmount as number));
      setShowKoinsModal(false); 
      setKoinsAmount("");
      setCustomAlert({ title: t("public_profile.alert_koins_sent_title"), message: t("public_profile.alert_koins_sent").replace('{amount}', koinsAmount.toString()).replace('{name}', profile.display_name) });
    } catch (e: any) { 
      setCustomAlert({ title: t("public_profile.alert_error_title"), message: t("public_profile.alert_error_koins") });
    }
    setIsSending(false);
  };

  const handleSubmitReport = async () => {
    if (!reportReason.trim()) return;
    setIsSending(true);
    await supabase.from('denuncias').insert({ reported_user_id: profile.user_id, reporter_id: currentUserId, motivo: "Reporte de perfil: " + reportReason, estado: 'pendiente' });
    setShowReportModal(false);
    setReportReason("");
    setIsSending(false);
    setCustomAlert({ title: t("public_profile.alert_report_sent_title"), message: t("public_profile.alert_report_sent") });
  };
if (loading) return <div style={{ padding: 100, textAlign: 'center', color: 'var(--color-primary)', fontWeight: 900 }}>{t("public_profile.loading")}</div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-main)", paddingBottom: "100px", transition: "background-color 0.3s ease" }}>

     {/* HEADER VIP */}
      <div style={{ background: "linear-gradient(180deg, var(--bg-soft) 0%, var(--bg-main) 100%)", padding: "50px 20px 40px 20px", textAlign: "center", position: "relative" }}>
        
        {/* Avatar */}
        <div style={{ width: 140, height: 140, borderRadius: "50%", border: "6px solid var(--bg-card)", margin: "0 auto", overflow: "hidden", background: "var(--bg-card)", boxShadow: "0 10px 30px var(--shadow-card)" }}>
          <img src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.display_name}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Avatar" />
        </div>
        
        {/* Nombre y Corona */}
        <h1 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "42px", marginTop: "15px", marginBottom: "5px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
          @{profile?.display_name}
          {profile?.is_premium && (
            <span title={t("public_profile.premium_user")} style={{ display: "flex", alignItems: "center" }}>
              <Crown size={32} color="var(--state-warning-fg)" fill="var(--state-warning-fg)" />
            </span>
          )}
        </h1>

        {/* LEMA DEL USUARIO */}
        <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "14px", fontStyle: "italic", maxWidth: "450px", margin: "0 auto 25px auto" }}>
          "{profile?.motto || profile?.bio || t('public_profile.collector_of')}"
        </p>
        
        {/* BOTONERA DINÁMICA */}
        {currentUserId && currentUserId !== profile?.user_id ? (
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "30px", flexWrap: "wrap" }}>
            
            <button onClick={handleToggleFavorite} style={{ background: "var(--state-warning-border)", color: "white", border: "none", padding: "10px 20px", borderRadius: "12px", fontWeight: 900, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", boxShadow: "0 4px 10px color-mix(in srgb, var(--state-warning-border) 20%, transparent)" }}>
              <Star size={18} fill={isFav ? "white" : "none"} /> {isFav ? t("public_profile.in_favorites") : t("public_profile.add_favorite")}
            </button>

            <button onClick={() => setShowContactModal(true)} style={{ background: "var(--color-primary)", color: "white", border: "none", padding: "10px 20px", borderRadius: "12px", fontWeight: 900, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", boxShadow: "0 4px 10px var(--shadow-card)" }}>
              <MessageCircle size={18} /> {t("public_profile.send_message")}
            </button>

            <button onClick={() => setShowKoinsModal(true)} style={{ background: "var(--state-warning-fg)", color: "white", border: "none", padding: "10px 20px", borderRadius: "12px", fontWeight: 900, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <Wallet size={18} /> {t("public_profile.gift_koins")}
            </button>

            <button onClick={() => setShowReportModal(true)} style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--color-border)", padding: "10px 15px", borderRadius: "12px", fontWeight: 900, cursor: "pointer" }}>
              <AlertTriangle size={18} />
            </button>

          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "30px" }}>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/user/${profile?.id}`); setCustomAlert({ title: t("public_profile.copied_title"), message: t("public_profile.link_copied") }); }} style={{ background: "var(--bg-soft)", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "8px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 900, cursor: "pointer" }}>
              {t("public_profile.copy_link")}
            </button>
          </div>
        )}

        {/* STATS FANS / SIGUIENDO */}
        <div style={{ display: "flex", justifyContent: "center", gap: "50px", marginTop: "10px" }}>
          <div onClick={() => setShowFollowModal('followers')} style={{ cursor: "pointer" }}>
            <div style={{ fontWeight: 900, color: "var(--color-primary)", fontSize: "24px" }}>{followers.length}</div>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>{t("public_profile.fans")}</div>
          </div>
          <div onClick={() => setShowFollowModal('following')} style={{ cursor: "pointer" }}>
            <div style={{ fontWeight: 900, color: "var(--color-primary)", fontSize: "24px" }}>{following.length}</div>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>{t("public_profile.following")}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 20px" }}>
        
        {/* VALOR DE COLECCIÓN */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "50px", marginTop: "20px" }}>
          <div style={{ backgroundColor: "var(--bg-card)", padding: "25px", borderRadius: "24px", border: "1px solid var(--color-border)", textAlign: "center" }}>
            <h3 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "16px", margin: "0 0 10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}><Boxes size={18}/> {t("public_profile.total_pcs")}</h3>
            <div style={{ fontSize: "48px", fontWeight: 900, color: "var(--color-primary)", lineHeight: 1 }}>{pcs.length}</div>
          </div>
          <div style={{ backgroundColor: "var(--bg-soft)", padding: "25px", borderRadius: "24px", border: "1px solid var(--color-border)", textAlign: "center" }}>
            <h3 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "16px", margin: "0 0 10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}><Wallet size={18}/> {t("public_profile.est_value")}</h3>
            <div style={{ fontSize: "48px", fontWeight: 900, color: "var(--text-main)", lineHeight: 1 }}>{pcs.length * AVG_PC_PRICE}€</div>
            <p style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, margin: "5px 0 0 0" }}>{t("public_profile.based_on")}</p>
          </div>
        </div>

        {/* GRUPOS Y BIAS */}
        {groupedBiases.length > 0 && (
          <div style={{ marginBottom: "60px" }}>
            <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "26px", display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}><Heart size={26} /> {t("public_profile.biases")}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
              {groupedBiases.map((g: any, i: number) => (
                <div key={i} style={{ background: "var(--bg-card)", padding: "20px", borderRadius: "24px", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "20px" }}>
                  <div style={{ width: 70, height: 70, borderRadius: "20px", background: "var(--bg-soft)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--color-border)", overflow: "hidden", flexShrink: 0 }}>
                    {g.group.logo_url ? <img src={g.group.logo_url} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="" /> : <Sparkles color="var(--color-primary)" />}
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 8px 0", color: "var(--color-primary)", fontWeight: 900, fontSize: "15px" }}>{g.group.name}</h3>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {g.biases.map((biasName: string, idx: number) => (
                        <span key={idx} style={{ background: "var(--bg-soft)", color: "var(--color-primary)", padding: "4px 12px", borderRadius: "99px", fontSize: "11px", fontWeight: 900 }}>{biasName.replace(/-/g, " ")}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 📚 BINDERS VIRTUALES */}
        <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "26px", display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}><BookOpen size={26} /> {t("public_profile.virtual_binders").replace('{count}', binders.length.toString())}</h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "30px", marginBottom: "60px", padding: "0 10px" }}>
          {binders.length > 0 ? binders.map(binder => (
            <div key={binder.id} onClick={() => { setSelectedBinder(binder); setBinderPage(0); }} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", transition: "transform 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform="scale(1.05)"} onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>
              <div style={{ 
                width: "130px", height: "180px", 
                background: binder.display_cover ? `url(${binder.display_cover}) center/cover` : (binder.color || "var(--color-primary)"), 
                borderRadius: "4px 16px 16px 4px", 
                position: "relative",
                boxShadow: "5px 5px 15px var(--shadow-card)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "15px"
              }}>
                <div style={{ position: "absolute", left: "10px", top: 0, bottom: 0, width: "2px", background: "color-mix(in srgb, var(--bg-card) 40%, transparent)" }}></div>
                {!binder.display_cover && <BookOpen color="white" size={36} opacity={0.9} />}
              </div>
              <span style={{ fontWeight: 900, color: "var(--text-main)", fontSize: "14px", textAlign: "center", width: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {(binder.title || t('public_profile.my_binder')).toUpperCase()}
              </span>
            </div>
          )) : <div style={{ gridColumn: '1/-1', color: "var(--text-muted)", padding: 20 }}>{t("public_profile.no_binders")}</div>}
        </div>

        {/* COLECCIÓN GENERAL */}
        <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "26px", display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}><LayoutGrid size={26} /> {t("public_profile.general_collection")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "15px", marginBottom: "60px" }}>
          {pcs.length > 0 ? pcs.map(slot => (
            <div key={slot.id} style={{ background: "var(--bg-card)", padding: "8px", borderRadius: "16px", border: "1px solid var(--color-border)", boxShadow: "0 4px 10px var(--shadow-card)", transition: "transform 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform="scale(1.05)"} onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>
              <div style={{ aspectRatio: '2/3', borderRadius: '10px', overflow: 'hidden' }}>
                <img src={slot.item?.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
              </div>
            </div>
          )) : <div style={{ gridColumn: '1/-1', color: "var(--text-muted)" }}>{t("public_profile.no_pcs")}</div>}
        </div>

        {/* MERCADO */}
        {marketAds.length > 0 && (
          <div style={{ marginBottom: "60px" }}>
            <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "26px", display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}><Store size={26} /> {t("public_profile.market_showcase")}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "15px" }}>
              {marketAds.map(ad => (
                <div key={ad.id} onClick={() => router.push(`/market?item=${ad.id}`)} style={{ background: "var(--bg-card)", padding: "15px", borderRadius: "20px", border: `2px solid ${ad.type === 'wtt' ? 'var(--color-primary)' : 'var(--state-warning-fg)'}`, cursor: "pointer", display: "flex", gap: "15px" }}>
                  <div style={{ width: 70, height: 90, borderRadius: "10px", background: "var(--bg-soft)", overflow: "hidden", flexShrink: 0 }}>
                    {ad.image_url && <img src={ad.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />}
                  </div>
                  <div>
                    <span style={{ background: ad.type === 'wtt' ? 'var(--bg-soft)' : 'var(--bg-card)9eb', color: ad.type === 'wtt' ? 'var(--color-primary)' : 'var(--state-warning-fg)', padding: "4px 10px", borderRadius: "8px", fontSize: "10px", fontWeight: 900, textTransform: "uppercase" }}>{ad.type === 'wtt' ? t("public_profile.looking_for") : t("public_profile.on_sale")}</span>
                    <h4 style={{ margin: "8px 0 4px 0", color: "var(--text-main)", fontSize: "14px", fontWeight: 900 }}>{formatName(ad.member) || t("public_profile.item")}</h4>
                    {ad.type === 'wts' && <div style={{ color: "var(--state-warning-fg)", fontWeight: 900 }}>{ad.price} K-oins</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FANZONE */}
        <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "26px", display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}><MessageSquare size={26} /> {t("public_profile.fanzone_activity")}</h2>
        <div style={{ display: "flex", flexDirection: "column", background: "var(--bg-card)", borderRadius: "24px", padding: "10px 20px", border: "1px solid var(--color-border)", marginBottom: "60px" }}>
          {posts.length > 0 ? posts.map((post, i) => (
            <div key={post.id} onClick={() => router.push(`/fanzone#post-${post.id}`)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 0", borderBottom: i !== posts.length - 1 ? "1px solid var(--color-border)" : "none", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ background: "var(--bg-soft)", padding: "8px", borderRadius: "10px" }}>
                  {post.parent_id ? <Share2 size={16} color="var(--state-warning-fg)" /> : <Repeat2 size={16} color="var(--color-primary)" />}
                </div>
                <div>
                  <div style={{ fontWeight: 900, color: "var(--text-main)", fontSize: "14px" }}>{post.title || (post.parent_id ? t("public_profile.reply_thread") : t("public_profile.untitled_thread"))}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{post.content?.substring(0, 80)}...</div>
                </div>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, whiteSpace: "nowrap", marginLeft: "15px" }}>{new Date(post.created_at).toLocaleDateString()}</div>
            </div>
          )) : <div style={{ padding: 20, color: "var(--text-muted)", textAlign: "center" }}>{t("public_profile.no_activity")}</div>}
        </div>

        {/* GALERÍA DE FANARTS */}
        <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "26px", display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}><Palette size={26} /> {t("public_profile.fanart_gallery")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "15px", marginBottom: "60px" }}>
          {fanarts.map(art => (
            <div key={art.id} onClick={() => router.push(`/fanart?highlight=${art.id}`)} style={{ borderRadius: "20px", overflow: "hidden", border: "2px solid var(--color-border)", cursor: "pointer" }}>
              <img src={art.image_url} style={{ width: "100%", height: "220px", objectFit: "cover" }} alt="" />
            </div>
          ))}
        </div>
      </div>

      {/* MODAL ALERTA CUSTOM */}
      {customAlert && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--overlay-strong)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '100%', maxWidth: '350px', borderRadius: '30px', padding: '30px', textAlign: 'center', boxShadow: '0 20px 40px var(--shadow-card)', border: "1px solid var(--color-border)" }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--bg-soft)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
              <Sparkles size={30} />
            </div>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--color-primary)', fontSize: '20px', fontWeight: 900 }}>{customAlert.title}</h3>
            <p style={{ color: 'var(--text-main)', fontSize: '14px', marginBottom: '25px', lineHeight: '1.5' }}>{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} style={{ background: 'var(--color-primary)', color: 'white', padding: '12px 30px', borderRadius: '99px', border: 'none', fontWeight: 900, cursor: 'pointer', width: '100%' }}>{t("common.understood")}</button>
          </div>
        </div>
      )}

      {/* MODAL REPORTE */}
      {showReportModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--overlay-strong)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '100%', maxWidth: '400px', borderRadius: '30px', overflow: 'hidden', border: "1px solid var(--color-border)" }}>
            <div style={{ padding: '20px', background: 'var(--color-primary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: "16px", display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={18} /> {t("public_profile.modal_report_title")}</h3>
              <X onClick={() => setShowReportModal(false)} style={{ cursor: 'pointer' }} />
            </div>
            <div style={{ padding: '25px' }}>
              <p style={{ color: 'var(--text-main)', fontWeight: 800, marginBottom: 15, fontSize: 14 }}>{t("public_profile.modal_report_desc").replace('{name}', profile?.display_name)}</p>
              <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder={t("public_profile.report_placeholder")} style={{ width: '100%', height: '100px', padding: '15px', borderRadius: '15px', border: '2px solid var(--color-border)', outline: 'none', resize: 'none', background: "var(--bg-main)", color: "var(--text-main)" }} />
              <button onClick={handleSubmitReport} disabled={isSending || !reportReason.trim()} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: 'none', background: reportReason.trim() ? 'var(--color-primary)' : 'var(--bg-soft)', color: reportReason.trim() ? 'white' : 'var(--text-muted)', fontWeight: 900, marginTop: '15px' }}>
                {isSending ? t("public_profile.sending") : t("public_profile.btn_send_report")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL K-OINS */}
      {showKoinsModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--overlay-strong)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '100%', maxWidth: '400px', borderRadius: '30px', overflow: 'hidden', textAlign: 'center', border: "1px solid var(--color-border)" }}>
            <div style={{ padding: '20px', background: 'var(--state-warning-fg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: "16px" }}>{t("public_profile.modal_koins_title")}</h3>
              <X onClick={() => setShowKoinsModal(false)} style={{ cursor: 'pointer' }} />
            </div>
            <div style={{ padding: '30px' }}>
              <Star size={48} fill="var(--state-warning-fg)" color="var(--state-warning-fg)" style={{ marginBottom: 15 }} />
              <p style={{ color: 'var(--text-main)', fontWeight: 800, marginBottom: 5 }}>{t("public_profile.koins_ask").replace('{name}', profile?.display_name)}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20, fontWeight: 700 }}>{t("public_profile.koins_avail").replace('{koins}', myKoins.toString())}</p>
              <input type="number" value={koinsAmount} onChange={(e) => setKoinsAmount(Number(e.target.value))} placeholder={t("public_profile.koins_placeholder")} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid var(--state-warning-fg)', outline: 'none', fontSize: '20px', fontWeight: 900, textAlign: 'center', background: "var(--bg-main)", color: "var(--text-main)" }} />
              <button onClick={handleSendKoins} disabled={isSending || !koinsAmount} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: 'none', background: koinsAmount ? 'var(--state-warning-fg)' : 'var(--bg-soft)', color: koinsAmount ? 'white' : 'var(--text-muted)', fontWeight: 900, marginTop: '20px' }}>
                {isSending ? t("public_profile.sending") : t("public_profile.btn_confirm_gift")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SEGUIDORES */}
      {showFollowModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--overlay-strong)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: 'var(--bg-main)', width: '100%', maxWidth: '400px', maxHeight: '70vh', borderRadius: '30px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: "1px solid var(--color-border)" }}>
            <div style={{ padding: '20px', background: 'var(--color-primary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 900 }}>{showFollowModal === 'followers' ? t("public_profile.modal_followers") : t("public_profile.modal_following")}</h3>
              <X onClick={() => setShowFollowModal(null)} style={{ cursor: 'pointer' }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
              {(showFollowModal === 'followers' ? followers : following).length > 0 ? (showFollowModal === 'followers' ? followers : following).map(f => (
                <div key={f.user_id} onClick={() => { setShowFollowModal(null); router.push(`/user/${f.user_id}`); }} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>
                  <img src={f.avatar_url || `https://ui-avatars.com/api/?name=?`} style={{ width: 45, height: 45, borderRadius: "50%", objectFit: 'cover' }} alt="" />
                  <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{f.display_name || t("global.default_user_name")}</span>
                </div>
              )) : <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>{showFollowModal === 'followers' ? t('public_profile.no_followers') : t('public_profile.no_following')}</p>}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHAT */}
      {showContactModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--overlay-strong)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '100%', maxWidth: '450px', borderRadius: '30px', overflow: 'hidden', border: "1px solid var(--color-border)" }}>
            <div style={{ padding: '20px', background: 'var(--color-primary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img src={profile?.avatar_url} style={{ width: 35, height: 35, borderRadius: "50%", border: "2px solid white", objectFit: "cover" }} alt="" />
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: "16px" }}>{t("public_profile.modal_chat_title").replace('{name}', profile?.display_name)}</h3>
              </div>
              <X onClick={() => setShowContactModal(false)} style={{ cursor: 'pointer' }} />
            </div>
            <div style={{ padding: '25px' }}>
              <textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder={t("public_profile.chat_placeholder")} style={{ width: '100%', height: '120px', padding: '15px', borderRadius: '15px', border: '2px solid var(--color-border)', outline: 'none', resize: 'none', background: "var(--bg-main)", color: "var(--text-main)" }} />
              <button onClick={handleSendMessage} disabled={isSending || !contactMessage.trim()} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: 'none', background: contactMessage.trim() ? 'var(--color-primary)' : 'var(--bg-soft)', color: contactMessage.trim() ? 'white' : 'var(--text-muted)', fontWeight: 900, marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {isSending ? t("public_profile.sending") : <><Send size={18} /> {t("public_profile.send_message")}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedBinder && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
          <VirtualBinder
            binderName={(selectedBinder.title || t('public_profile.my_binder')).toUpperCase()}
            binderColor={selectedBinder.color}
            coverUrl={selectedBinder.display_cover}
            pagesData={[/* ... lógica de páginas mantenida de tu código original ... */]}
            onClose={() => setSelectedBinder(null)}
          />
        </div>
      )}

      <Footer />
    </div>
  );
}