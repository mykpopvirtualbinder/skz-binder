"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { useGlobal } from "./context/GlobalContext";

import Footer from "./components/footer";
import {
  Users,
  Flame,
  Palette,
  MessageCircle,
  ArrowRight,
  Sparkles,
  Crown,
  BookOpen,
  Film,
  Star,
  Loader2,
} from "lucide-react";

// Font is loaded globally via @font-face in globals.css

// --- COMPONENTE DE NÚMEROS ANIMADOS ---
const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const increment = value / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        clearInterval(timer);
        setDisplayValue(value);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return <span>{displayValue.toLocaleString()}</span>;
};

// Mini-componente para las tarjetas de estadísticas con colores dinámicos
const StatCard = ({
  icon,
  title,
  value,
  bg,
}: {
  icon: any;
  title: string;
  value: number;
  bg: string;
}) => (
  <div
    style={{
      background: "var(--bg-card)",
      padding: "20px",
      borderRadius: "20px",
      border: `1px solid var(--color-border)`,
      display: "flex",
      alignItems: "center",
      gap: "15px",
      boxShadow: "0 4px 10px var(--shadow-card)",
    }}
  >
    <div style={{ background: bg, padding: "12px", borderRadius: "14px" }}>
      {icon}
    </div>
    <div>
      <div
        style={{
          fontSize: "24px",
          fontWeight: 900,
          color: "var(--text-main)",
          lineHeight: "1.1",
        }}
      >
        <AnimatedNumber value={value} />
      </div>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 800,
          color: "var(--text-muted)",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
    </div>
  </div>
);

// Componente Interno
function HomeContent() {
  const router = useRouter();
  const { t } = useGlobal();
  const [isMobile, setIsMobile] = useState(false);

  const [stats, setStats] = useState({
    users: 0,
    market: 0,
    fanarts: 0,
    comments: 0,
  });
  const [featuredGallery, setFeaturedGallery] = useState<any[]>([]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Gestión de tokens de acceso (Social Login)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        supabase.auth
          .setSession({ access_token, refresh_token })
          .then(({ error }) => {
            if (!error) {
              window.history.replaceState({}, document.title, "/");
              router.push("/binders");
            } else {
              console.error("Error de sesión:", error.message);
              window.location.hash = "";
            }
          });
      }
    }
  }, [router]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Contadores reales de Supabase
      const { count: usersCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { count: fanartsCount } = await supabase.from("fanarts").select("*", { count: "exact", head: true });
      const { count: commentsCount } = await supabase.from("fanart_comments").select("*", { count: "exact", head: true });
      const { count: marketCount } = await supabase.from("market_ads").select("*", { count: "exact", head: true });

      setStats({
        users: usersCount || 0,
        fanarts: fanartsCount || 0,
        market: marketCount || 0,
        comments: commentsCount || 0,
      });

      // Últimas 15 obras activas
      const { data: gallery } = await supabase
        .from("fanarts")
        .select("id, title, image_url, thumbnail_url, media_type, created_at, profiles:user_id(is_featured_artist)")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (gallery) {
        const ordered = [...gallery].sort((a: any, b: any) => {
          const aStar = a.profiles?.is_featured_artist ? 1 : 0;
          const bStar = b.profiles?.is_featured_artist ? 1 : 0;
          if (aStar !== bStar) return bStar - aStar;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setFeaturedGallery(ordered.slice(0, 15));
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div
      className="home-root"
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-main)",
        display: "flex",
        flexDirection: "column",
        transition: "background-color 0.3s ease",
        color: "var(--text-body)"
      }}
    >
      <main
        className="home-main"
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "1100px",
          margin: "0 auto",
          padding: isMobile ? "16px 16px 24px" : "40px",
        }}
      >
        {/* === BANNERS PRINCIPALES === */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "40px" }}>
          
          {/* Banner Market */}
          <div
            style={{
              background: "linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 100%)",
              borderRadius: "24px",
              padding: isMobile ? "25px" : "40px",
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "20px",
              boxShadow: "0 10px 30px var(--shadow-card)",
            }}
          >
            <div style={{ color: "#ffffff", textAlign: isMobile ? "center" : "left" }}>
              <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.2)", padding: "6px 12px", borderRadius: "99px", fontSize: "12px", fontWeight: 900, marginBottom: "15px", backdropFilter: "blur(5px)" }}>
                {t('home.banners.market_fire')}
              </div>
              <h2 className="tan-font" style={{ margin: "0 0 10px 0", fontSize: isMobile ? "28px" : "36px", lineHeight: "1.1" }}>
                {t('home.banners.market_title')}
              </h2>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, opacity: 0.9 }}>
                {t('home.banners.market_desc')}
              </p>
            </div>
            <button
              onClick={() => router.push("/market")}
              style={{ background: "#ffffff", color: "var(--color-primary)", border: "none", padding: "14px 30px", borderRadius: "99px", fontWeight: 900, fontSize: "15px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, boxShadow: "0 4px 15px var(--shadow-card)", transition: "transform 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              {t('home.banners.btn_go_market')} <ArrowRight size={18} />
            </button>
          </div>

          {/* Banner VIP */}
          <div
            style={{
              background: "linear-gradient(135deg, var(--color-accent-orange) 0%, var(--color-primary) 100%)",
              borderRadius: "24px",
              padding: isMobile ? "25px" : "30px",
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "20px",
              boxShadow: "0 10px 30px var(--shadow-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: "15px", flexDirection: isMobile ? "column" : "row", width: isMobile ? "100%" : "auto" }}>
              <div style={{ background: "#ffffff", padding: "15px", borderRadius: "50%", boxShadow: "0 4px 10px var(--shadow-card)" }}>
                <Crown size={28} color="var(--color-accent-orange)" />
              </div>
              <div style={{ textAlign: isMobile ? "center" : "left" }}>
                <h3 className="tan-font" style={{ color: "#ffffff", margin: "0 0 5px 0", fontSize: "22px" }}>
                  {t('home.banners.premium_title')}
                </h3>
                <p style={{ color: "rgba(255,255,255,0.92)", margin: 0, fontSize: "14px", fontWeight: 700 }}>
                  {t('home.banners.premium_desc')}
                </p>
              </div>
            </div>
            <button onClick={() => router.push("/shop")} style={{ background: "transparent", color: "#ffffff", border: "2px solid rgba(255,255,255,0.92)", padding: "10px 25px", borderRadius: "99px", fontWeight: 900, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap" }}>
              {t('home.banners.btn_view_advantages')}
            </button>
          </div>
        </div>

       {/* === ESTADÍSTICAS EN VIVO === */}
        <div style={{ marginBottom: "50px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 className="tan-font" style={{ color: "var(--text-heading)", margin: 0, fontSize: "24px" }}>
              {t('home.stats.title')}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 800, color: "var(--text-subheading)", background: "var(--bg-soft)", padding: "6px 12px", borderRadius: "99px" }}>
              <span style={{ width: "8px", height: "8px", background: "var(--state-success-border)", borderRadius: "50%", display: "inline-block", animation: "pulse 2s infinite" }} />
              {" "}{t('home.stats.live_label')}
            </div>
          </div>

          <div className="home-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "15px" }}>
            <StatCard icon={<Users color="var(--color-accent-blue)" size={24} />} title={t('home.stats.collectors')} value={stats.users} bg="var(--bg-soft)" />
            <StatCard icon={<Flame color="var(--color-accent-orange)" size={24} />} title={t('home.stats.trade_items')} value={stats.market} bg="var(--bg-soft)" />
            <StatCard icon={<Palette color="var(--color-primary)" size={24} />} title={t('home.stats.artworks')} value={stats.fanarts} bg="var(--bg-soft)" />
            <StatCard icon={<MessageCircle color="var(--color-primary)" size={24} />} title={t('home.stats.comments')} value={stats.comments} bg="var(--bg-soft)" />
          </div>
        </div>

        {/* === ARTISTA DEL MES (EDITORIAL) === */}
        <div style={{ marginBottom: "50px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <Star size={24} color="var(--color-accent-orange)" fill="var(--color-accent-orange)" />
            <h3 className="tan-font" style={{ color: "var(--text-subheading)", margin: 0, fontSize: "24px" }}>
              {t('home.artist_month.title')}
            </h3>
          </div>

          <div
            style={{
              background: "linear-gradient(120deg, var(--color-primary), var(--color-secondary))",
              borderRadius: "24px",
              overflow: "hidden",
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              boxShadow: "0 15px 40px var(--shadow-card)",
            }}
          >
            <div style={{ flex: 1.2, padding: isMobile ? "30px" : "50px", color: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "12px", fontWeight: 900, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>
                {t('home.artist_month.special_label')}
              </span>
              <h2 className="tan-font" style={{ fontSize: isMobile ? "38px" : "48px", margin: "0 0 15px 0", color: "white", lineHeight: "1.1" }}>
                {t('home.artist_month.title')}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "15px", lineHeight: "1.6", margin: "0 0 30px 0", fontWeight: 500, maxWidth: "90%" }}>
                {t('home.artist_month.desc')}
              </p>
              <div>
                <button
                  onClick={() => router.push("/artista-del-mes")}
                  style={{ background: "rgba(255,255,255,0.2)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.45)", padding: "14px 28px", borderRadius: "99px", fontWeight: 900, fontSize: "14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", transition: "transform 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  {t('home.artist_month.btn_participate')} <ArrowRight size={18} />
                </button>
              </div>
            </div>
            <div style={{ flex: 0.8, minHeight: isMobile ? "250px" : "100%", background: "url('https://spanish.korea.net/upload/content/editImage/20251202110216185_AUBNJ5NY.jpg') center/cover no-repeat", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.35) -5%, transparent 50%)", display: isMobile ? "none" : "block" }} />
            </div>
          </div>
        </div>

      {/* === MASONRY GRID === */}
        <div style={{ paddingBottom: "60px" }}>
          <div className="home-featured-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "25px" }}>
            <div>
              <h3 className="tan-font" style={{ color: "var(--color-secondary)", margin: "0 0 5px 0", fontSize: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
                <Sparkles size={24} color="var(--color-secondary)" /> {t('home.featured.title')}
              </h3>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px", fontWeight: 700 }}>
                {t('home.featured.subtitle')}
              </p>
            </div>
            <button onClick={() => router.push("/fanart")} style={{ background: "none", border: "none", color: "var(--color-accent-orange)", fontWeight: 900, fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}>
              {t('home.featured.btn_view_all')}
            </button>
          </div>

          <div style={{ columnCount: isMobile ? 2 : 4, columnGap: "15px" }}>
            {featuredGallery.map((art) => (
              <div
                key={art.id}
                onClick={() => {
                  sessionStorage.setItem("open_fanart_id", art.id);
                  router.push("/fanart");
                }}
                style={{
                  marginBottom: "15px",
                  breakInside: "avoid",
                  borderRadius: "16px",
                  overflow: "hidden",
                  cursor: "pointer",
                  position: "relative",
                  boxShadow: "0 4px 15px var(--shadow-card)",
                  border: "1px solid var(--color-border)",
                  background: "var(--bg-card)",
                }}
                className="masonry-item"
              >
                {art.media_type === "pdf" || art.media_type === "video" ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", background: "var(--bg-soft)" }}>
                    {art.media_type === "pdf" ? <BookOpen size={40} color="var(--color-primary)" style={{ margin: "0 auto" }} /> : <Film size={40} color="var(--color-primary)" style={{ margin: "0 auto" }} />}
                    <p style={{ fontSize: "13px", fontWeight: 900, color: "var(--text-main)", marginTop: "15px" }}>{art.title}</p>
                  </div>
                ) : (
                  <img src={art.thumbnail_url || art.image_url} alt={art.title} style={{ width: "100%", display: "block", objectFit: "cover" }} />
                )}

                <div className="hover-overlay" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--color-primary), transparent)", display: "flex", alignItems: "flex-end", padding: "15px", opacity: 0, transition: "opacity 0.3s" }}>
                  <span style={{ color: "white", fontWeight: 900, fontSize: "13px" }}>{art.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />

      <style jsx global>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0px var(--color-accent); }
          70% { box-shadow: 0 0 0 6px transparent; }
          100% { box-shadow: 0 0 0 0px transparent; }
        }
        .masonry-item:hover .hover-overlay { opacity: 1 !important; }
        .masonry-item img { transition: transform 0.3s ease; }
        .masonry-item:hover img { transform: scale(1.05); }
        .tan-font { font-family: 'Tan-Font', sans-serif !important; text-transform: uppercase; }
      `}</style>
    </div>
  );
}

export default function HomeClient() {
  return <HomeContent />;
}