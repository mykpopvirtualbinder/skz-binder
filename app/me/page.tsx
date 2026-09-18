"use client";
import dynamic from 'next/dynamic';
import React, { useEffect, useMemo, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resolveMemberAvatarUrl } from "@/lib/member-image-url";
import { resolveProfileAvatarUrl } from "@/lib/default-profile-avatar";
import type { AvatarPublicCatalog } from "@/lib/avatarPublicCatalog.types";
import { buildVipGroupAssetsRows } from "@/lib/vip-badge-groups";
import {
  AvatarModalInsigniasSection,
  type VipBadgeSectionKey,
} from "./ui/AvatarModalInsigniasSection";
import { isAdminTeamEmail, isSiteAdminSession } from "@/lib/admin-emails";
import { getThemeUnlockCost, isVipThemeKey, normalizeThemeId, unlockKeyForTheme } from "@/lib/theme-unlocks";
import Footer from "../components/footer";
import Header from "../components/header"; // 👈 Añadido el Header
import {
  MapPin, Phone, Calendar, Bell, Ban, BookOpen, Boxes, Heart, Home,
  MessageCircle, ShieldAlert, Sparkles, User, Settings, Minus, Plus,
  Camera, X, Wallet, TrendingUp, CheckCheck, Trash2,
  Loader2, Mail, MailOpen, Send, ImageIcon, Crown, Star,
  Languages, RefreshCw, AlertTriangle, Repeat2, PenLine, LayoutDashboard, ExternalLink
} from "lucide-react";
import type { CSSProperties } from "react";
import { useGlobal } from "../context/GlobalContext";

type TabKey = "home" | "groups" | "fanzone" | "notices";

const ME_TAB_ACCENTS: Record<TabKey, string> = {
  home: "var(--accent-vibe-cyan)",
  groups: "var(--accent-vibe-pink)",
  fanzone: "var(--accent-vibe-purple)",
  notices: "var(--accent-vibe-orange)",
};

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_premium?: boolean;
  is_restricted?: boolean;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  birthdate?: string | null;
  puntos?: number;
  is_adult?: boolean | null;
  language?: string | null;
  theme_preference?: "pastel" | "dark" | "vibrant" | "minimal" | "k_pride" | "iris_bloom" | "gay_pride";
};

type WallPost = {
  id: string;
  text: string;
  createdAt: string;
  authorName?: string;
  authorAvatar?: string | null;
};

type Notification = {
  id: string;
  user_id: string;
  sender_id: string;
  type: string;
  content: string;
  image_url?: string | null;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  sender_profile?: {
    display_name: string;
    avatar_url: string | null;
  }
};

const AVG_PC_PRICE = 8;

// --- ESTILOS DINÁMICOS CORREGIDOS ---
const inputStyle: CSSProperties = {
  width: "100%", padding: "12px 16px", borderRadius: "12px",
  border: "1px solid var(--color-border)", outline: "none", fontWeight: 600,
  backgroundColor: "var(--bg-main)", color: "var(--text-main)"
};

const labelStyle: CSSProperties = {
  display: "block", marginBottom: "6px", fontSize: "12px",
  fontWeight: 900, color: "var(--color-primary)", textTransform: "uppercase"
};

const KPOP_GROUPS: Record<string, { logo: string, members: string[] }> = {
  "Stray Kids": { logo: "/groups/straykids-logo.png", members: ["Bang Chan", "Lee Know", "Changbin", "Hyunjin", "Han", "Felix", "Seungmin", "I.N"] },
  "ATEEZ": { logo: "/groups/ateez-logo.png", members: ["Hongjoong", "Seonghwa", "Yunho", "Yeosang", "San", "Mingi", "Wooyoung", "Jongho"] },
  "BlackPink": { logo: "/groups/blackpink-logo.png", members: ["Jisoo", "Jennie", "Rosé", "Lisa"] },
  "BTS": { logo: "/groups/bts-logo.png", members: ["Jin", "Suga", "J-Hope", "RM", "Jimin", "V", "Jungkook"] },
};

function normGroupKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function uiAvatarPortrait(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=96&background=F4EBF8&color=8C659C&bold=true`;
}

function normalizeSkzMemberKey(raw: string): string {
  let k = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (k === "i.n" || k === "in" || k === "jeongin" || k === "i n") return "i.n";
  if (k === "bangchan" || k === "bang chan") return "bang chan";
  if (k === "changbin" || k === "chang bin") return "changbin";
  return k;
}

/** Retratos locales en /public (si existen el archivo). */
function strayKidsLocalPortrait(memberName: string): string | null {
  const k = normalizeSkzMemberKey(memberName);
  const files: Record<string, string> = {
    "bang chan": "/members/stray-kids/bang-chan.png",
    "lee know": "/members/stray-kids/lee-know.png",
    changbin: "/members/stray-kids/changbin.png",
    hyunjin: "/members/stray-kids/hyunjin.png",
    han: "/members/stray-kids/han.png",
    felix: "/members/stray-kids/felix.png",
    seungmin: "/members/stray-kids/seungmin.jpg",
    "i.n": "/members/stray-kids/in.png",
  };
  return files[k] ?? null;
}

/** Fotos locales en /public para BlackPink y BTS (alta y preferencias). */
function kpopLocalPortrait(presetGroupKey: string | null, memberName: string): string | null {
  const g = normGroupKey(presetGroupKey || "");
  const n = memberName.trim().toLowerCase().replace(/\u2019/g, "'");

  if (g === "blackpink" || g === "black pink") {
    const bp: Record<string, string> = {
      "rosé": "/members/black-pink/rose.jpg",
      rose: "/members/black-pink/rose.jpg",
      lisa: "/members/black-pink/lisa.png",
      jisoo: "/members/black-pink/jisoo.jpg",
      jennie: "/members/black-pink/jennie.jpg",
    };
    return bp[n] ?? null;
  }
  if (g === "bts") {
    const b: Record<string, string> = {
      jungkook: "/members/bts/jungkook.jpg",
      v: "/members/bts/v.jpg",
      "j-hope": "/members/bts/j-hope.jpg",
      jhope: "/members/bts/j-hope.jpg",
      jimin: "/members/bts/jimin.jpg",
      jin: "/members/bts/jin.jpg",
      suga: "/members/bts/suga.jpg",
      rm: "/members/bts/rm.jpg",
    };
    return b[n] ?? null;
  }
  return null;
}

/** Avatar ilustrado estable cuando no hay foto en disco (Bang Chan, Changbin, I.N, etc.). */
function skzIllustratedPortrait(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4`;
}

function portraitForBiasMember(
  memberName: string,
  imageUrl: string | null | undefined,
  presetGroupKey: string | null,
): string {
  const fixed = resolveMemberAvatarUrl(imageUrl);
  if (fixed) return fixed;
  const kpop = kpopLocalPortrait(presetGroupKey, memberName);
  if (kpop) return kpop;
  if (presetGroupKey === "Stray Kids") {
    const local = strayKidsLocalPortrait(memberName);
    if (local) return local;
    return skzIllustratedPortrait(memberName);
  }
  return uiAvatarPortrait(memberName);
}

/** Miembros desde Supabase si coinciden; si no, lista local (p. ej. Stray Kids) con retrato. */
function resolveMembersForGroup(gName: string, dbMembers: { name: string; group_name?: string | null; image_url?: string | null }[]): { name: string; portrait: string }[] {
  const gn = normGroupKey(gName);
  const presetEntry =
    Object.entries(KPOP_GROUPS).find(([k]) => normGroupKey(k) === gn) ||
    Object.entries(KPOP_GROUPS).find(([k]) => gn.includes(normGroupKey(k)) || normGroupKey(k).includes(gn));
  const presetKey = (presetEntry ? presetEntry[0] : null) || canonicalPresetGroupName(gName);

  const fromDb = dbMembers.filter((m) => normGroupKey(m.group_name || "") === gn);
  if (fromDb.length > 0) {
    const mapped = fromDb.map((m) => ({
      name: m.name,
      portrait: portraitForBiasMember(m.name, m.image_url ?? null, presetKey),
    }));
    if (presetEntry) {
      const order = new Map(
        presetEntry[1].members.map((name, index) => [normGroupKey(name), index])
      );
      return mapped.sort((a, b) => {
        const ai = order.get(normGroupKey(a.name));
        const bi = order.get(normGroupKey(b.name));
        if (ai != null && bi != null) return ai - bi;
        if (ai != null) return -1;
        if (bi != null) return 1;
        return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      });
    }
    return mapped;
  }
  if (presetEntry) {
    const [, data] = presetEntry;
    return data.members.map((name) => ({
      name,
      portrait: portraitForBiasMember(name, null, presetKey),
    }));
  }
  return [];
}

function canonicalPresetGroupName(input: string): string | null {
  const t = normGroupKey(input);
  if (!t) return null;
  for (const key of Object.keys(KPOP_GROUPS)) {
    const nk = normGroupKey(key);
    if (nk === t || t.includes(nk) || nk.includes(t)) return key;
  }
  return null;
}

const GROUP_ASSETS: Record<string, { logo: string, skzoo: string[], lights: string[], kawaii: string[] }> = {
  "stray-kids": { logo: "stray-kids-logo.png", skzoo: ["wolfchan", "hanquokka", "bbokari", "leebit", "dwaekki", "jiniret", "puppym", "foxiny"], lights: ["skz-v1", "skz-v2"], kawaii: ["heart-pink", "star-yellow"] }
};

const FALLBACK_AVATAR_PACK_BASIC = [
  "/basic/msn-avatar-01-rose.svg",
  "/basic/msn-avatar-02-sky.svg",
  "/basic/msn-avatar-03-lilac.svg",
];

const FALLBACK_AVATAR_PACK_KPOP = [
  "/lightstick/01-kawaii-lightstick-blackpink.png",
  "/lightstick/02-kawaii-lightstick-bts.png",
  "/lightstick/03-kawaii-lightstick-seventeen.png",
  "/lightstick/04-kawaii-lightstick-twice.png",
  "/lightstick/05-kawaii-lightstick-stray-kids.png",
  "/lightstick/09-kawaii-lightstick-ateez.png",
  "/lightstick/13-kawaii-lightstick-txt.png",
  "/lightstick/15-kawaii-lightstick-shinee.png",
];

const FALLBACK_AVATAR_PACK_VIP = [
  "/kawaii/premium/01-kawaii-premium.png",
  "/kawaii/premium/02-kawaii-premium.png",
  "/kawaii/premium/03-kawaii-premium.png",
  "/kawaii/premium/04-kawaii-premium.png",
  "/kawaii/premium/05-kawaii-premium.png",
  "/kawaii/premium/06-kawaii-premium.png",
  "/kawaii/premium/07-kawaii-premium.png",
  "/kawaii/premium/08-kawaii-premium.png",
  "/kawaii/premium/09-kawaii-premium.png",
  "/kawaii/premium/10-kawaii-premium.png",
];

const FALLBACK_VIP_BADGE_GROUPS = [
  {
    key: "groups",
    title: "Grupos",
    items: [
      "/groups/straykids-logo.png",
      "/groups/bts-logo.png",
      "/groups/blackpink-logo.png",
      "/groups/ateez-logo.png",
    ],
  },
  {
    key: "members",
    title: "Miembros",
    items: [
      "/members/stray-kids/bang-chan.png",
      "/members/stray-kids/lee-know.png",
      "/members/stray-kids/changbin.png",
      "/members/stray-kids/hyunjin.png",
      "/members/stray-kids/han.png",
      "/members/stray-kids/felix.png",
      "/members/stray-kids/seungmin.jpg",
      "/members/stray-kids/in.png",
      "/members/bts/jungkook.jpg",
      "/members/bts/v.jpg",
      "/members/black-pink/jennie.jpg",
      "/members/black-pink/lisa.png",
    ],
  },
  {
    key: "skzoo",
    title: "SKZOO",
    items: [
      "/zootopia/stray-kids/wolfchan.png",
      "/zootopia/stray-kids/hanquokka.png",
      "/zootopia/stray-kids/bbokari.png",
      "/zootopia/stray-kids/leebit.png",
      "/zootopia/stray-kids/dwaekki.png",
      "/zootopia/stray-kids/jiniret.png",
      "/zootopia/stray-kids/puppym.png",
      "/zootopia/stray-kids/regular/foxi.ny.png",
    ],
  },
];

/** Catálogo mínimo para agrupar insignias VIP cuando aún no hay manifest HTTP. */
const FALLBACK_AVATAR_PUBLIC_CATALOG_FOR_VIP_GROUPS: AvatarPublicCatalog = {
  version: 1,
  generatedAt: "fallback",
  basic: FALLBACK_AVATAR_PACK_BASIC,
  lightstick: FALLBACK_AVATAR_PACK_KPOP,
  kawaiiPremium: FALLBACK_AVATAR_PACK_VIP,
  vipBadges: {
    groups: FALLBACK_VIP_BADGE_GROUPS[0].items,
    members: FALLBACK_VIP_BADGE_GROUPS[1].items,
    skzoo: FALLBACK_VIP_BADGE_GROUPS[2].items,
  },
};

const unitTypeFromMember = (memberRaw: string | null | undefined): "Single" | "Unit" | "0T8" => {
  const lower = String(memberRaw ?? "").toLowerCase().trim();
  if (/\bot8\b/.test(lower) || lower.includes("all") || lower === "varios") return "0T8";
  const parts = lower.split(/[\s,+/&]+/).filter(Boolean);
  if (parts.length > 1) return "Unit";
  return "Single";
};

function meTabButtonStyle(active: boolean, accent: string): CSSProperties {
  return {
    padding: "12px 20px",
    borderRadius: 99,
    border: `2px solid ${accent}`,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.2s ease",
    textTransform: "uppercase",
    background: active
      ? `linear-gradient(145deg, color-mix(in srgb, ${accent} 88%, white), ${accent})`
      : "color-mix(in srgb, var(--bg-card) 92%, transparent)",
    color: active ? "#fff" : "var(--text-main)",
    boxShadow: active
      ? `0 6px 22px color-mix(in srgb, ${accent} 35%, transparent)`
      : "0 2px 10px var(--shadow-card)",
  };
}

function MePageContent() {
  const { profile: globalProfile, refreshGlobal, showAlert, showConfirm, t, showPrompt } = useGlobal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const uParam: string | null = searchParams.get("u");
  const fromAdmin = searchParams.get("fromAdmin") === "true";

  const [loggedUserId, setLoggedUserId] = useState<string | null>(null);
  /** Email de la sesión Auth (no mezclar con perfil en pantalla ni caché de localStorage). */
  const [loggedSessionEmail, setLoggedSessionEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const isViewingOtherUser = Boolean(uParam && uParam !== loggedUserId);

  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, onClose?: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const prevChatLenRef = useRef(0);
  const [isEditingPuntos, setIsEditingPuntos] = useState(false);
  const [puntosDraft, setPuntosDraft] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [isTranslatingMsg, setIsTranslatingMsg] = useState<string | null>(null);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const translatingIdsRef = useRef<Set<string>>(new Set());
  const failedAutoTranslationsRef = useRef<Set<string>>(new Set());
  const [translationErrorHint, setTranslationErrorHint] = useState<string | null>(null);
  const translationFatalRef = useRef(false);
  const translationCooldownUntilRef = useRef(0);
  const [showChatTranslateAdvice, setShowChatTranslateAdvice] = useState(true);
  const [userCollection, setUserCollection] = useState<any[]>([]);

  const userLang = typeof window !== 'undefined' ? navigator.language.split('-')[0] : 'es';
  const getTargetLang = () => profile?.language || userLang || "es";
  const isThemePreferenceMissingColumnError = (err: unknown) => {
    const msg = String((err as { message?: string })?.message || err || "").toLowerCase();
    return msg.includes("theme_preference") && msg.includes("profiles");
  };

  const getCachedTranslation = (msg: Notification, lang: string): string | null => {
    const meta = (msg.metadata || {}) as Record<string, any>;
    const translations = meta?.translations;
    if (!translations || typeof translations !== "object") return null;
    const hit = translations[lang];
    return typeof hit === "string" && hit.trim() ? hit.trim() : null;
  };

  const traducirMensajeChat = async (msgId: string, textoOriginal: string) => {
    if (translatedMessages[msgId]) return;
    if (translatingIdsRef.current.has(msgId)) return;
    if (!textoOriginal || textoOriginal.startsWith("[APP_")) return;
    if (translationFatalRef.current) {
      setTranslationErrorHint("Traduccion desactivada por error de configuracion/permisos.");
      return;
    }
    const now = Date.now();
    if (translationCooldownUntilRef.current > now) {
      const waitSec = Math.max(1, Math.ceil((translationCooldownUntilRef.current - now) / 1000));
      setTranslationErrorHint(`Traduccion en pausa temporal (${waitSec}s) para evitar sobrecarga.`);
      return;
    }
    translatingIdsRef.current.add(msgId);
    setIsTranslatingMsg(msgId);
    const targetLang = getTargetLang();
    try {
      const translateRes = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textoOriginal,
          targetLang,
        }),
      });
      const payload = (await translateRes.json().catch(() => ({}))) as {
        translation?: string;
        error?: string;
        reason?: string;
        details?: string;
      };
      if (!translateRes.ok || !payload.translation) {
        throw new Error(
          [payload.reason || payload.error || "TRANSLATE_REQUEST_FAILED", payload.details]
            .filter(Boolean)
            .join(" | ")
        );
      }
      const traduccion = payload.translation.trim();
      if (!traduccion) throw new Error("Empty translation");
      setTranslatedMessages(prev => ({ ...prev, [msgId]: traduccion }));
      failedAutoTranslationsRef.current.delete(msgId);

      // Persist translation per target language to avoid re-translating on reopen.
      const msg = chatHistory.find((m) => m.id === msgId);
      if (msg) {
        const meta = (msg.metadata || {}) as Record<string, any>;
        const translations =
          meta.translations && typeof meta.translations === "object"
            ? { ...meta.translations }
            : {};
        translations[targetLang] = traduccion;
        const nextMetadata = { ...meta, translations };
        const { error: metaErr } = await supabase
          .from("notifications")
          .update({ metadata: nextMetadata })
          .eq("id", msgId)
          .eq("user_id", profile?.id || "");
        if (!metaErr) {
          setChatHistory((prev) =>
            prev.map((m) => (m.id === msgId ? { ...m, metadata: nextMetadata } : m))
          );
        }
      }
    } catch (error) {
      console.error("Error al traducir:", error);
      const errText = String(error || "");
      if (errText.includes("API_KEY_INVALID") || errText.includes("API key not valid") || errText.includes("MISSING_API_KEY")) {
        translationFatalRef.current = true;
        setAutoTranslate(false);
        setTranslationErrorHint("API de traduccion no configurada o no valida.");
      } else if (errText.includes("QUOTA_EXCEEDED")) {
        const retryMatch = errText.match(/retry in\s+([\d.]+)s/i);
        const retryMs = retryMatch?.[1] ? Math.ceil(Number(retryMatch[1]) * 1000) : 60_000;
        translationCooldownUntilRef.current = Date.now() + Math.max(30_000, retryMs);
        translationFatalRef.current = true;
        setAutoTranslate(false);
        setTranslationErrorHint("Cuota de traduccion agotada (Gemini).");
      } else if (errText.includes("PERMISSION_DENIED")) {
        translationCooldownUntilRef.current = Date.now() + 5 * 60_000;
        translationFatalRef.current = true;
        setAutoTranslate(false);
        setTranslationErrorHint("Permisos insuficientes en la API de traduccion.");
      } else if (errText.includes("API_NOT_ENABLED_OR_RESTRICTED")) {
        translationCooldownUntilRef.current = Date.now() + 5 * 60_000;
        translationFatalRef.current = true;
        setAutoTranslate(false);
        setTranslationErrorHint("API no habilitada o key restringida para este entorno.");
      } else if (errText.includes("MODEL_UNAVAILABLE")) {
        translationFatalRef.current = true;
        setAutoTranslate(false);
        setTranslationErrorHint("Modelo de traduccion no disponible temporalmente.");
      } else if (errText.includes("UPSTREAM_TIMEOUT")) {
        setTranslationErrorHint("Timeout en servicio de traduccion. Reintenta.");
      } else if (!translationErrorHint) {
        setTranslationErrorHint("Error de traduccion (API o red).");
      }
      failedAutoTranslationsRef.current.add(msgId);
      setTranslatedMessages((prev) => ({
        ...prev,
        [msgId]: prev[msgId] || t("me.translation_unavailable"),
      }));
    } finally {
      translatingIdsRef.current.delete(msgId);
      setIsTranslatingMsg(null);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [publicFanzonePosts, setPublicFanzonePosts] = useState<any[]>([]);
  const [myFavoritesProfiles, setMyFavoritesProfiles] = useState<any[]>([]);
  const [favoritedByCount, setFavoritedByCount] = useState(0);
  const [members, setMembers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
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

  const isAdmin = isAdminTeamEmail(loggedSessionEmail);
  const showAdminPanelShortcut = isSiteAdminSession(loggedSessionEmail);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarModalFilter, setAvatarModalFilter] = useState<"all" | "basic" | "vip" | "badges">("all");
  const [vipBadgeSection, setVipBadgeSection] = useState<VipBadgeSectionKey>("groups");
  const [vipBadgeGroupKey, setVipBadgeGroupKey] = useState<string>("");
  const [avatarPublicCatalog, setAvatarPublicCatalog] = useState<AvatarPublicCatalog | null>(null);

  useEffect(() => {
    if (!isAvatarModalOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/avatars/catalog", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as AvatarPublicCatalog;
        if (!cancelled) setAvatarPublicCatalog(data);
      } catch {
        /* usar fallbacks estáticos */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAvatarModalOpen]);

  const avatarPackBasic = useMemo(() => {
    const fromDisk = avatarPublicCatalog?.basic ?? [];
    if (fromDisk.length > 0) return fromDisk;
    return FALLBACK_AVATAR_PACK_BASIC;
  }, [avatarPublicCatalog]);

  const avatarPackKpop = useMemo(() => {
    const d = avatarPublicCatalog?.lightstick ?? [];
    return d.length > 0 ? d : FALLBACK_AVATAR_PACK_KPOP;
  }, [avatarPublicCatalog]);

  const avatarPackVip = useMemo(() => {
    const d = avatarPublicCatalog?.kawaiiPremium ?? [];
    return d.length > 0 ? d : FALLBACK_AVATAR_PACK_VIP;
  }, [avatarPublicCatalog]);

  const vipGroupAssetsRows = useMemo(
    () =>
      buildVipGroupAssetsRows(avatarPublicCatalog ?? FALLBACK_AVATAR_PUBLIC_CATALOG_FOR_VIP_GROUPS),
    [avatarPublicCatalog],
  );

  useEffect(() => {
    if (vipGroupAssetsRows.length === 0) return;
    setVipBadgeGroupKey((prev) => {
      if (prev && vipGroupAssetsRows.some((r) => r.key === prev)) return prev;
      return vipGroupAssetsRows[0].key;
    });
  }, [vipGroupAssetsRows]);

  const selectedVipGroupRow = useMemo(
    () => vipGroupAssetsRows.find((r) => r.key === vipBadgeGroupKey) ?? vipGroupAssetsRows[0] ?? null,
    [vipGroupAssetsRows, vipBadgeGroupKey],
  );

  const vipBadgeSectionTabs = useMemo(
    (): { key: VipBadgeSectionKey; label: string }[] => [
      { key: "groups", label: t("me.avatar_modal.groups_logos") },
      { key: "members", label: t("me.avatar_modal.vip_member_insignias") },
      { key: "skzoo", label: t("me.avatar_modal.vip_mascots") },
    ],
    [t],
  );

  const [openBiasDropdown, setOpenBiasDropdown] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [loadingFav, setLoadingFav] = useState(true);
  const [favGroups, setFavGroups] = useState<string[]>([]);
  const [biasByGroup, setBiasByGroup] = useState<Record<string, string[]>>({});
  const [wreckerByGroup, setWreckerByGroup] = useState<Record<string, string[]>>({});
  const [collectionPrefs, setCollectionPrefs] = useState<string[]>([]);
  const [fanzoneNotices, setFanzoneNotices] = useState<any[]>([]);
  const [loadingFanzone, setLoadingFanzone] = useState(false);
  const [wallPost, setWallPost] = useState("");
  const [wall, setWall] = useState<any[]>([]);
  const [formData, setFormData] = useState<Partial<Profile> & { newPassword?: string; given_name?: string; family_name?: string }>({
    display_name: "", full_name: "", bio: "", phone: "", address: "", birthdate: "", language: "es", given_name: "", family_name: ""
  });
  const [groupInput, setGroupInput] = useState("");
  const groupSuggestions = useMemo(() => {
    const q = groupInput.trim().toLowerCase();
    if (q.length < 1) return [] as string[];
    return Object.keys(KPOP_GROUPS).filter((k) => k.toLowerCase().includes(q));
  }, [groupInput]);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fzFilter, setFzFilter] = useState('all');
  const [selectedNotices, setSelectedNotices] = useState<Set<string>>(new Set());
  const [selectedFanzoneNotices, setSelectedFanzoneNotices] = useState<Set<string>>(new Set());
  const [itemsSeleccionados, setItemsSeleccionados] = useState<string[]>([]);
  const selectedNoticeRows = useMemo(
    () => notifications.filter((n) => selectedNotices.has(n.id)),
    [notifications, selectedNotices]
  );
  const selectedFanzoneRows = useMemo(
    () => fanzoneNotices.filter((n: any) => selectedFanzoneNotices.has(String(n.id))),
    [fanzoneNotices, selectedFanzoneNotices]
  );
  const allSelectedNoticesUnread =
    selectedNoticeRows.length > 0 && selectedNoticeRows.every((n) => n.read === false);
  const allSelectedFanzoneUnread =
    selectedFanzoneRows.length > 0 && selectedFanzoneRows.every((n: any) => n.read === false);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNotices(new Set(notifications.map(n => n.id)));
    } else {
      setSelectedNotices(new Set());
    }
  };

  const toggleSelection = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const next = new Set(selectedNotices);
    if (e.target.checked) next.add(id);
    else next.delete(id);
    setSelectedNotices(next);
  };

  const deleteSelectedNotices = async () => {
    if (selectedNotices.size === 0) return;
    const ids = Array.from(selectedNotices);
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    setSelectedNotices(new Set());
    await supabase.from("notifications").delete().in("id", ids);
    window.dispatchEvent(new Event("update_notifications"));
  };

  const markSelectedAsUnread = async () => {
    if (selectedNotices.size === 0) return;
    const ids = Array.from(selectedNotices);
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: false } : n));
    setSelectedNotices(new Set());
    await supabase.from("notifications").update({ read: false }).in("id", ids);
    window.dispatchEvent(new Event("update_notifications"));
  };

  const markSelectedAsRead = async () => {
    if (selectedNotices.size === 0) return;
    const ids = Array.from(selectedNotices);
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n));
    setSelectedNotices(new Set());
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    window.dispatchEvent(new Event("update_notifications"));
  };

  const markAsUnread = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: false } : n));
    await supabase.from("notifications").update({ read: false }).eq("id", id);
    window.dispatchEvent(new Event("update_notifications"));
  };

  const markAsReadFromButton = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    window.dispatchEvent(new Event("update_notifications"));
  };

  const deleteNotice = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
    window.dispatchEvent(new Event("update_notifications"));
  };

  const toggleFanzoneSelection = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const next = new Set(selectedFanzoneNotices);
    if (e.target.checked) next.add(id);
    else next.delete(id);
    setSelectedFanzoneNotices(next);
  };

  const handleSelectAllFanzone = (checked: boolean) => {
    if (checked) {
      setSelectedFanzoneNotices(new Set(fanzoneNotices.map((n) => String(n.id))));
    } else {
      setSelectedFanzoneNotices(new Set());
    }
  };

  const markFanzoneSelectedAsUnread = async () => {
    if (selectedFanzoneNotices.size === 0) return;
    const ids = Array.from(selectedFanzoneNotices);
    setFanzoneNotices((prev) =>
      prev.map((n) => (ids.includes(String(n.id)) ? { ...n, read: false } : n))
    );
    setSelectedFanzoneNotices(new Set());
    const { error } = await supabase
      .from("fanzone_notifications")
      .update({ read: false })
      .in("id", ids);
    // Si la tabla no tiene "read", no rompemos UX.
    if (error) console.warn("fanzone unread update", error.message);
  };

  const markFanzoneSelectedAsRead = async () => {
    if (selectedFanzoneNotices.size === 0) return;
    const ids = Array.from(selectedFanzoneNotices);
    setFanzoneNotices((prev) =>
      prev.map((n) => (ids.includes(String(n.id)) ? { ...n, read: true } : n))
    );
    setSelectedFanzoneNotices(new Set());
    const { error } = await supabase
      .from("fanzone_notifications")
      .update({ read: true })
      .in("id", ids);
    if (error) console.warn("fanzone read update", error.message);
  };

  const deleteFanzoneSelected = async () => {
    if (selectedFanzoneNotices.size === 0) return;
    const ids = Array.from(selectedFanzoneNotices);
    setFanzoneNotices((prev) => prev.filter((n) => !ids.includes(String(n.id))));
    setSelectedFanzoneNotices(new Set());
    await supabase.from("fanzone_notifications").delete().in("id", ids);
  };

  const markFanzoneAsUnread = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFanzoneNotices((prev) =>
      prev.map((n) => (String(n.id) === id ? { ...n, read: false } : n))
    );
    const { error } = await supabase
      .from("fanzone_notifications")
      .update({ read: false })
      .eq("id", id);
    if (error) console.warn("fanzone unread single", error.message);
  };

  const markFanzoneAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFanzoneNotices((prev) =>
      prev.map((n) => (String(n.id) === id ? { ...n, read: true } : n))
    );
    const { error } = await supabase
      .from("fanzone_notifications")
      .update({ read: true })
      .eq("id", id);
    if (error) console.warn("fanzone read single", error.message);
  };

  const deleteFanzoneNotice = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFanzoneNotices((prev) => prev.filter((n) => String(n.id) !== id));
    await supabase.from("fanzone_notifications").delete().eq("id", id);
  };

  const [loadingNotices, setLoadingNotices] = useState(false);
  const [chatHistory, setChatHistory] = useState<Notification[]>([]);

  useEffect(() => {
    if (!autoTranslate) return;
    if (translationFatalRef.current) return;
    if (isTranslatingMsg) return;

    const nextMsg = [...chatHistory].reverse().find((msg) => {
      const isMe = msg.sender_id === profile?.id;
      if (isMe) return false;
      if (!msg.content || msg.content.startsWith("[APP_")) return false;
      if (translatedMessages[msg.id]) return false;
      if (translatingIdsRef.current.has(msg.id)) return false;
      if (failedAutoTranslationsRef.current.has(msg.id)) return false;
      return true;
    });

    if (!nextMsg) return;
    traducirMensajeChat(nextMsg.id, nextMsg.content);
  }, [chatHistory, autoTranslate, translatedMessages, isTranslatingMsg, profile?.id, profile?.language]);

  const [activeChatUser, setActiveChatUser] = useState<{ id: string, name: string, avatar: string } | null>(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyImage, setReplyImage] = useState<File | null>(null);
  const [replyImagePreview, setReplyImagePreview] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const activeChatUserRef = useRef(activeChatUser);

  const tabs = useMemo(() => [
    { key: "home" as const, label: t("me.tabs.home"), icon: <Home size={18} /> },
    { key: "groups" as const, label: t("me.tabs.groups"), icon: <Heart size={18} /> },
    { key: "fanzone" as const, label: t("me.tabs.fanzone"), icon: <MessageCircle size={18} /> },
    { key: "notices" as const, label: t("me.tabs.notices"), icon: <Bell size={18} /> },
  ], [t]);

  const DEFAULT_AVATAR = `https://ui-avatars.com/api/?name=${profile?.display_name || 'U'}&background=F4EBF8&color=8C659C`;

  useEffect(() => {
    const currentLen = chatHistory.length;
    const hadNewMessage = currentLen > prevChatLenRef.current;
    prevChatLenRef.current = currentLen;
    if (!hadNewMessage) return;
    if (!shouldStickToBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [chatHistory]);

  useEffect(() => {
    if (!translationErrorHint) return;
    const timeout = window.setTimeout(() => {
      setTranslationErrorHint(null);
    }, 4500);
    return () => window.clearTimeout(timeout);
  }, [translationErrorHint]);

  useEffect(() => {
    activeChatUserRef.current = activeChatUser;
  }, [activeChatUser]);

  const closeChat = () => {
    setActiveChatUser(null);
    setChatHistory([]);
    setReplyText("");
    setReplyImage(null);
    setReplyImagePreview(null);
    setTranslationErrorHint(null);
    translationFatalRef.current = false;
    translationCooldownUntilRef.current = 0;
    setShowChatTranslateAdvice(true);
    shouldStickToBottomRef.current = true;
    prevChatLenRef.current = 0;
    fetchNotifications();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSettingsOpen(false);
        setIsAvatarModalOpen(false);
        setOpenBiasDropdown(null);
        closeChat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab === "notices" || urlTab === "home" || urlTab === "groups" || urlTab === "fanzone") {
      setTab(urlTab as TabKey);
    }
    if (searchParams.get("action") === "settings") {
      setIsSettingsOpen(true);
      router.replace("/me");
    }
  }, [searchParams, router]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setLoggedSessionEmail(null);
        router.push("/login");
        return;
      }
      setLoggedSessionEmail(auth.user.email ?? null);
      setLoggedUserId(auth.user.id);
      setUserId(auth.user.id);
      const profileIdToLoad = uParam || auth.user.id;
      const { data: profileData, error: profileError } = await supabase.from("profiles").select("*").eq("user_id", profileIdToLoad).single();

      if (profileError) {
        const fallback = {
          id: auth.user.id,
          email: auth.user.email ?? null,
          display_name: `User_${Math.floor(Math.random() * 1000)}`,
          avatar_url: resolveProfileAvatarUrl(null, null),
          bio: "Cargando perfil...",
          puntos: 0,
          language: "es",
          theme_preference: "pastel" as const,
        };
        setProfile(fallback as Profile);
        setFormData({ ...fallback, given_name: "", family_name: "" });
      } else if (profileData) {
        const esVIP = isAdminTeamEmail(auth.user.email);
        const fn = String(profileData.full_name || "").trim();
        const fnParts = fn.split(/\s+/).filter(Boolean);
        const given_name = fnParts[0] || "";
        const family_name = fnParts.slice(1).join(" ") || "";
        const loadedProfile = {
          id: profileIdToLoad,
          email: auth.user.email ?? null,
          display_name: profileData.display_name,
          avatar_url: resolveProfileAvatarUrl(
            profileData.avatar_url,
            (auth.user.user_metadata as { avatar_url?: string } | undefined)?.avatar_url,
          ),
          bio: profileData.bio || "Organizando mi colección con estilo",
          full_name: profileData.full_name,
          phone: profileData.phone,
          address: profileData.address,
          birthdate: profileData.birthdate,
          puntos: profileData.puntos || 0,
          is_adult: profileData.is_adult,
          is_premium: profileData.is_premium,
          is_restricted: profileData.is_restricted,
          esVIP: esVIP,
          language: profileData.language || "es",
          theme_preference: profileData.theme_preference || "pastel",
        };
        setProfile(loadedProfile);
        setFormData({ ...loadedProfile, given_name, family_name });
        setFavGroups(profileData.fav_groups || []);
        setBiasByGroup(profileData.bias_by_group || {});
        setWreckerByGroup(profileData.wrecker_by_group || {});
        setWall(profileData.wall_posts || []);
        setCollectionPrefs(profileData.collection_prefs || []);
      }

      if (!isViewingOtherUser) {
        refreshGlobal();
      }

      const { data: gData } = await supabase.from("groups").select("*").order("name");
      if (gData) setGroups(gData);

      const { data: mData } = await supabase.from("members").select("*");
      if (mData && gData?.length) {
        const gidToName = Object.fromEntries(gData.map((g: { id: number; name: string }) => [String(g.id), g.name]));
        setMembers(
          mData.map((m: Record<string, unknown>) => ({
            member_id: Number(m.member_id ?? m.id),
            name: m.name as string,
            image_url: (m.image_url as string | null) ?? null,
            group_id: m.group_id ?? m.group,
            group_name: (m.group_name as string | undefined) || gidToName[String(m.group_id ?? m.group ?? "")] || null,
          })),
        );
      } else if (mData) {
        setMembers(
          mData.map((m: Record<string, unknown>) => ({
            member_id: Number(m.member_id ?? m.id),
            name: m.name as string,
            image_url: (m.image_url as string | null) ?? null,
            group_id: m.group_id ?? m.group,
            group_name: (m.group_name as string | undefined) ?? null,
          })),
        );
      }

      const { data: statusData } = await supabase.from("user_item_statuses").select("status, qty, item_id").eq("user_id", profileIdToLoad);
      if (statusData && statusData.length > 0) {
        const itemIds = Array.from(new Set(statusData.map((s) => s.item_id)));
        const { data: itemsData } = await supabase.from("items").select("id, member, image_url").in("id", itemIds);
        const itemsMap = Object.fromEntries((itemsData || []).map((i) => [i.id, i]));
        
        const newStats = {
          have: 0, wtt: 0, wts: 0, wishlist: 0, estimatedValue: 0,
          byType: { Single: 0, Unit: 0, OT8: 0 } as Record<string, number>,
          byMember: {} as Record<string, number>,
        };
        const wttArr: any[] = [];
        const wtsArr: any[] = [];

        statusData.forEach((row) => {
          const qty = row.qty || 1;
          const item = itemsMap[row.item_id];
          if (row.status === "have") {
            newStats.have += qty;
            newStats.estimatedValue += qty * AVG_PC_PRICE;
            if (item) {
              const type = unitTypeFromMember(item.member);
              newStats.byType[type] = (newStats.byType[type] || 0) + qty;
              const rawMem = String(item.member || "Varios").toLowerCase();
              if (!(rawMem === "ot8" || rawMem.includes("all") || rawMem === "varios")) {
                const parts = rawMem.split(/[\s,+/&]+/).filter(Boolean);
                parts.forEach((p) => {
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
          if (row.status === "wtt") {
            newStats.wtt += qty;
            if (item && !wttArr.some((i) => i.id === item.id)) wttArr.push(item);
          }
          if (row.status === "wts") {
            newStats.wts += qty;
            if (item && !wtsArr.some((i) => i.id === item.id)) wtsArr.push(item);
          }
          if (row.status === "wishlist" || row.status === "wish") {
            newStats.wishlist += qty;
          }
        });
        setStats(newStats);
        setMarketWtt(wttArr);
        setMarketWts(wtsArr);
      }

      const { count } = await supabase.from('user_favorites').select('*', { count: 'exact', head: true }).eq('following_id', profileIdToLoad);
      setFavoritedByCount(count || 0);

      const { data: myFavs } = await supabase.from('user_favorites').select('following_id').eq('follower_id', profileIdToLoad);
      if (myFavs && myFavs.length > 0) {
        const ids = myFavs.map((f: any) => f.following_id);
        const { data: favProfs } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', ids);
        setMyFavoritesProfiles(favProfs || []);
      } else {
        setMyFavoritesProfiles([]);
      }
     setLoading(false);
    };
    run();
  }, [router, uParam, isViewingOtherUser]);

  useEffect(() => {
    if (tab === "notices" && profile) {
      fetchNotifications();
    }
  }, [tab, profile]);

  useEffect(() => {
    if (tab === "fanzone" && profile?.id) {
      void Promise.all([fetchPublicFanzonePosts(), fetchFanzoneNotices()]);
    }
  }, [tab, profile?.id]);

  useEffect(() => {
    if (profile?.id) {
      if (isViewingOtherUser) {
        fetchPublicFanzonePosts();
        fetchUserCollection(profile.id);
      } else {
        fetchNotifications();
      }
    }
  }, [profile?.id, isViewingOtherUser]);

  async function fetchUserCollection(userId: string) {
    const { data } = await supabase.from("user_item_statuses").select("*, item: items(*)").eq("user_id", userId);
    if (data) setUserCollection(data);
  }

  async function fetchPublicFanzonePosts() {
    const { data } = await supabase.from("fanzone_posts").select("*").eq("user_id", profile!.id).is("parent_id", null).order("created_at", { ascending: false });
    if (data) setPublicFanzonePosts(data);
  }

  async function fetchFanzoneNotices() {
    setLoadingFanzone(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setFanzoneNotices([]);
        return;
      }
      const { data, error } = await supabase
        .from("fanzone_notifications")
        .select("*")
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("fanzone_notifications", error);
        setFanzoneNotices([]);
        return;
      }
      if (!data || data.length === 0) {
        setFanzoneNotices([]);
        return;
      }
      const actorIds = Array.from(
        new Set(data.map((n: any) => String(n.actor_id || "")).filter(Boolean))
      );
      const { data: actors } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", actorIds);
      const actorMap = Object.fromEntries((actors || []).map((a: any) => [a.user_id, a]));
      setFanzoneNotices(
        data.map((n: any) => ({
          ...n,
          actor_profile: actorMap[n.actor_id] || { display_name: "Usuario", avatar_url: null },
        }))
      );
    } finally {
      setLoadingFanzone(false);
    }
  }

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel(`chat-room-${profile.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, (payload) => {
      const newMsg = payload.new as Notification;
      fetchNotifications();
      window.dispatchEvent(new Event("update_notifications"));
      if (activeChatUserRef.current && newMsg.sender_id === activeChatUserRef.current.id) {
        setChatHistory(prev => [...prev, newMsg]);
        supabase.from("notifications").update({ read: true }).eq("id", newMsg.id).then(() => {
          window.dispatchEvent(new Event("update_notifications"));
        });
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  const fetchNotifications = async () => {
    setLoadingNotices(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { data, error } = await supabase.from("notifications").select('*').eq("user_id", authData.user.id).order("created_at", { ascending: false });
      if (error) {
        console.error("notifications", error);
        setNotifications([]);
        return;
      }
      if (data && data.length > 0) {
        const senderIds = Array.from(new Set(data.map(n => n.sender_id).filter(Boolean)));
        const { data: profData } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", senderIds);
        const pMap = Object.fromEntries((profData || []).map(p => [p.user_id, p]));
        setNotifications(data.map(n => ({
          ...n, sender_profile: pMap[n.sender_id] || { display_name: "Usuario", avatar_url: null }
        })));
      } else {
        setNotifications([]);
      }
    } finally {
      setLoadingNotices(false);
    }
  };
  const loadChatHistory = async (otherUserId: string) => {
    setIsLoadingChat(true);
    const { data: authData } = await supabase.auth.getUser();
    const myId = authData.user?.id;
    if (!myId) return;
    const { data } = await supabase.from("notifications").select("*").or(`and(user_id.eq.${myId},sender_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},sender_id.eq.${myId})`).order("created_at", { ascending: true });
    if (data) {
      const rows = data as Notification[];
      const lang = getTargetLang();
      const cached = rows.reduce<Record<string, string>>((acc, msg) => {
        const hit = getCachedTranslation(msg, lang);
        if (hit) acc[msg.id] = hit;
        return acc;
      }, {});
      setTranslatedMessages((prev) => ({ ...cached, ...prev }));
      setChatHistory(rows);
    }
    setIsLoadingChat(false);
  };

  const openChat = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.type === 'like' || n.type === 'comment' || n.type === 'admin_approval') {
      if (n.image_url) {
        sessionStorage.setItem("open_fanart_id", n.image_url);
        router.push('/fanart');
      }
      return;
    }
    setActiveChatUser({ id: n.sender_id, name: n.sender_profile?.display_name || "Usuario", avatar: n.sender_profile?.avatar_url || DEFAULT_AVATAR });
    setTranslationErrorHint(null);
    translationFatalRef.current = false;
    translationCooldownUntilRef.current = 0;
    setShowChatTranslateAdvice(true);
    shouldStickToBottomRef.current = true;
    prevChatLenRef.current = 0;
    loadChatHistory(n.sender_id);
  };

  const handleReplyImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplyImage(file);
    setReplyImagePreview(URL.createObjectURL(file));
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    window.dispatchEvent(new Event("update_notifications"));
  };

  const handleNoticeRowClick = (n: Notification) => {
    void markAsRead(n.id);

    // Me gusta / comentario / aprobación admin en fanart (image_url = id de la obra)
    if (
      (n.type === "like" || n.type === "comment" || n.type === "admin_approval") &&
      n.image_url
    ) {
      sessionStorage.setItem("open_fanart_id", n.image_url);
      router.push("/fanart");
      return;
    }

    if (n.type === "market_listing") {
      const meta = n.metadata as { market_highlight?: string; market_pc_item_id?: number } | null | undefined;
      if (meta?.market_highlight) {
        router.push(`/market?highlight=${encodeURIComponent(meta.market_highlight)}`);
        return;
      }
      if (meta?.market_pc_item_id != null && n.sender_id) {
        router.push(
          `/market?seller=${encodeURIComponent(n.sender_id)}&pcItem=${encodeURIComponent(String(meta.market_pc_item_id))}`,
        );
        return;
      }
      router.push("/market");
      return;
    }

    if (n.type === "fanart_post") {
      const meta = n.metadata as { fanart_id?: string } | null | undefined;
      const fanartId = meta?.fanart_id ?? n.image_url;
      if (fanartId) sessionStorage.setItem("open_fanart_id", String(fanartId));
      router.push("/fanart");
      return;
    }

    if (n.type === "fanzone_post") {
      const meta = n.metadata as { fanzone_post_id?: string } | null | undefined;
      if (meta?.fanzone_post_id) {
        router.push(`/fanzone?post=${encodeURIComponent(meta.fanzone_post_id)}`);
        return;
      }
      router.push("/fanzone");
      return;
    }

    openChat(n);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const { data: authData } = await supabase.auth.getUser();
    if(authData.user) {
      await supabase.from("notifications").update({ read: true }).eq("user_id", authData.user.id).eq("read", false);
      window.dispatchEvent(new Event("update_notifications"));
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
    window.dispatchEvent(new Event("update_notifications"));
  };

  const handleSendReply = async () => {
    if (profile?.is_restricted) {
      setIsSendingReply(false);
      return showAlert(t("me.restricted_title"), t("me.restricted_chat"));
    }
    if ((!replyText.trim() && !replyImage) || !activeChatUser || !profile) return;
    setIsSendingReply(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { setIsSendingReply(false); return; }
      let finalImgUrl = null;
      if (replyImage) {
        const fileExt = replyImage.name.split('.').pop();
        const fileName = `${authData.user.id}-reply-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, replyImage);
        if (!uploadError) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
          finalImgUrl = data.publicUrl;
        } else {
        showAlert(t("common.error"), t("me.error_upload"));
          setIsSendingReply(false);
          return;
        }
      }
      const { data: newMsg, error } = await supabase.from("notifications").insert({
        user_id: activeChatUser.id,
        sender_id: authData.user.id,
        type: "wtt_message",
        content: replyText.trim(),
        image_url: finalImgUrl,
        read: false
      }).select().single();
      if (error) throw error;
      if (newMsg) setChatHistory(prev => [...prev, newMsg]);
      setReplyText(""); setReplyImage(null); setReplyImagePreview(null);
    } catch (e: any) {
      showAlert("Error", e.message);
    } finally {
      setIsSendingReply(false);
    }
  };

  const persistProfile = async (updatedProfile: Profile) => {
    if(!loggedUserId) return;
    const basePayload = {
      display_name: updatedProfile.display_name,
      avatar_url: updatedProfile.avatar_url,
      bio: updatedProfile.bio,
      is_premium: updatedProfile.is_premium,
      full_name: updatedProfile.full_name,
      phone: updatedProfile.phone,
      address: updatedProfile.address,
      birthdate: updatedProfile.birthdate,
      is_adult: updatedProfile.is_adult,
      language: updatedProfile.language,
    };
    const payloadWithTheme = {
      ...basePayload,
      theme_preference: updatedProfile.theme_preference,
    };
    let { error: updateErr } = await supabase
      .from('profiles')
      .update(payloadWithTheme)
      .eq('user_id', loggedUserId);
    if (updateErr && isThemePreferenceMissingColumnError(updateErr)) {
      const retry = await supabase
        .from('profiles')
        .update(basePayload)
        .eq('user_id', loggedUserId);
      updateErr = retry.error;
    }
    if (updateErr) throw updateErr;
    await supabase.auth.updateUser({
      data: { display_name: updatedProfile.display_name, avatar_url: updatedProfile.avatar_url, bio: updatedProfile.bio }
    });
    if (typeof window !== "undefined") {
      const selectedLang = String(updatedProfile.language || "es").toLowerCase();
      document.cookie = `NEXT_LOCALE=${selectedLang}; path=/; max-age=31536000`;
      // Al guardar ajustes, este idioma pasa a ser el persistente por defecto.
      sessionStorage.removeItem("ui:language_override");
      const localProfileStr = localStorage.getItem("me:profile");
      if (localProfileStr) {
        const parsed = JSON.parse(localProfileStr) as Record<string, unknown>;
        parsed.language = selectedLang;
        localStorage.setItem("me:profile", JSON.stringify(parsed));
      }
    }
    refreshGlobal();
  };

  const persistFanStuff = useCallback(async (
    nextGroups: string[],
    nextBias: Record<string, string[]>,
    nextWall: WallPost[],
    nextPrefs: string[],
    nextWrecker: Record<string, string[]> = wreckerByGroup,
  ) => {
    const targetId = profile?.id;
    if (!targetId || isViewingOtherUser) return;
    try {
      const { error } = await supabase.from('profiles').update({
        fav_groups: nextGroups,
        bias_by_group: nextBias,
        wrecker_by_group: nextWrecker,
        wall_posts: nextWall,
        collection_prefs: nextPrefs
      }).eq('user_id', targetId);
      if (error) throw error;
      refreshGlobal();
    } catch (err) {
      console.error("Error al sincronizar con Supabase:", err);
    }
  }, [profile?.id, isViewingOtherUser, refreshGlobal, wreckerByGroup]);

  const handleSaveBias = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      
      const idsToSave: number[] = [];
      const seen = new Set<number>();
      for (const name of Object.values(biasByGroup).flat()) {
        const row = members.find((m) => m.name && name && m.name.toLowerCase() === String(name).toLowerCase());
        const mid = row?.member_id != null ? Number(row.member_id) : NaN;
        if (Number.isFinite(mid) && !seen.has(mid)) {
          seen.add(mid);
          idsToSave.push(mid);
        }
      }
      
      await supabase.from("user_biases").delete().eq("user_id", auth.user.id);
      if (idsToSave.length > 0) {
        await supabase.from("user_biases").insert(idsToSave.map(id => ({ user_id: auth.user.id, member_id: id })));
      }
      persistFanStuff(favGroups, biasByGroup, wall, collectionPrefs, wreckerByGroup);
      showAlert(t("me.updated"), t("me.bias_sync"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: any) => {
    if (!profile?.is_premium && !isAdmin) {
      showAlert(t("common.vip_advantage"), t("me.avatar_vip_msg"));
      return;
    }
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const next = { ...profile, avatar_url: data.publicUrl } as Profile;
      setProfile(next);
      setFormData(next);
      setIsAvatarModalOpen(false);
      await persistProfile(next);
      showAlert(t("me.updated"), t("me.avatar_success"));
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectGalleryAvatar = async (imgUrl: string) => {
    if (!profile?.id) return;
    try {
      await supabase.from('profiles').update({ avatar_url: imgUrl }).eq('user_id', profile.id);
      setIsAvatarModalOpen(false);
      window.location.reload();
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!userId || !profile) return;
    try {
      if (isFav) {
        await supabase.from('user_favorites').delete().eq('follower_id', userId).eq('following_id', profile.id);
        setIsFav(false);
      } else {
        await supabase.from('user_favorites').insert([{ follower_id: userId, following_id: profile.id }]);
        setIsFav(true);
      }
    } catch (error) {
      console.error("Error al gestionar favorito:", error);
    }
  };

  useEffect(() => {
    if (isViewingOtherUser && userId && profile?.id) {
      const checkStatus = async () => {
        const { data } = await supabase.from('user_favorites').select('*').eq('follower_id', userId).eq('following_id', profile.id).single();
        if (data) setIsFav(true);
      };
      checkStatus();
    }
  }, [isViewingOtherUser, userId, profile?.id]);

  const handlePredefinedAvatarSelect = async (url: string) => {
    const next = { ...profile, avatar_url: url } as Profile;
    setProfile(next);
    setFormData(next);
    setIsAvatarModalOpen(false);
    await persistProfile(next);
  };

  const handleVipAvatarSelect = async (url: string) => {
    if (!profile?.is_premium && !isAdmin) {
      setIsAvatarModalOpen(false);
      showAlert(t("common.vip_advantage"), t("me.upgrade_premium_avatar"));
      return;
    }
    await handlePredefinedAvatarSelect(url);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) return showAlert(t("me.error_title"), t("me.error_terms"));
    
    let isAdult = false;
    if (formData.birthdate) {
      const birth = new Date(formData.birthdate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) { age--; }
      if (age >= 18) isAdult = true;
    }
    
    if (profile?.is_adult === false && isAdult === true) {
      const confirmAdult = await showConfirm(t("common.confirm"), t("me.confirm_adult"));
      if (!confirmAdult) return;
    } else if (profile?.is_adult === true && isAdult === false) {
      const confirmMinor = await showConfirm(t("common.confirm"), t("me.confirm_minor"));
      if (!confirmMinor) return;
    }
    
    const mergedFull = [formData.given_name, formData.family_name].filter(Boolean).join(" ").trim() || null;
    const next = { ...profile, ...formData, full_name: mergedFull, is_adult: isAdult } as Profile;
    setProfile(next);
    setFormData(next);
    setIsSettingsOpen(false);
    try {
      await persistProfile(next);
    } catch (err: any) {
      showAlert(t("common.error"), err?.message || t("me.error_title"));
      return;
    }

    if (newPassword && newPassword.trim() !== "") {
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (authError) {
        showAlert(t("common.error"), `${t("me.error_password")}: ${authError.message}`);
        return;
      }
    }
    setNewPassword("");
    showAlert(t("me.updated"), t("me.profile_success"));
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = await showConfirm(t("common.confirm"), t("me.delete_confirm"));
    if (!confirmDelete) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;
      await supabase.auth.signOut();
      localStorage.clear();
      showAlert(t("me.deleted_title"), t("me.deleted_msg"));
      router.push("/login");
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const addGroup = (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const preset = canonicalPresetGroupName(cleanName);
    const finalName = preset || cleanName;
    const next = Array.from(new Set([...favGroups, finalName]));
    setFavGroups(next);
    setGroupInput("");
    persistFanStuff(next, biasByGroup, wall, collectionPrefs, wreckerByGroup);
  };

  const removeGroup = (name: string) => {
    const next = favGroups.filter((g) => g !== name);
    const nextBias = { ...biasByGroup };
    delete nextBias[name];
    const nextWreck = { ...wreckerByGroup };
    delete nextWreck[name];
    setFavGroups(next);
    setBiasByGroup(nextBias);
    setWreckerByGroup(nextWreck);
    persistFanStuff(next, nextBias, wall, collectionPrefs, nextWreck);
  };

  const toggleMemberStatus = async (group: string, member: string) => {
    const currentBias = biasByGroup[group] || [];
    const currentWrecker = wreckerByGroup[group] || [];
    let nextBias = [...currentBias];
    let nextWrecker = [...currentWrecker];

    if (currentBias.includes(member)) {
      nextBias = nextBias.filter(m => m !== member);
      nextWrecker.push(member);
    } else if (currentWrecker.includes(member)) {
      nextWrecker = nextWrecker.filter(m => m !== member);
    } else {
      const totalBiases = Object.values(biasByGroup).flat().length;
      if (!profile?.is_premium && !isAdmin && totalBiases >= 2) {
        showAlert(t("common.vip_advantage"), t("me.bias_limit_msg"));
        return;
      }
      nextBias.push(member);
    }
    const newBiasObj = { ...biasByGroup, [group]: nextBias };
    const newWreckerObj = { ...wreckerByGroup, [group]: nextWrecker };
    setBiasByGroup(newBiasObj);
    setWreckerByGroup(newWreckerObj);
    if (profile?.id && !isViewingOtherUser) {
      await supabase.from('profiles').update({ bias_by_group: newBiasObj, wrecker_by_group: newWreckerObj }).eq('user_id', profile.id);
    }
  };

  const postToWall = () => {
    if (profile?.is_restricted) return showAlert(t("me.restricted_title"), t("me.restricted_post"));
    const text = wallPost.trim();
    if (!text) return;
    const next = [{ id: `${Date.now()}`, text, createdAt: new Date().toISOString(), authorName: profile?.display_name || "Usuario", authorAvatar: profile?.avatar_url || null }, ...wall];
    setWall(next);
    setWallPost("");
    persistFanStuff(favGroups, biasByGroup, next, collectionPrefs, wreckerByGroup);
  };

  const updatePuntos = async (targetUserId: string, currentPuntos: number, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email || !isAdminTeamEmail(user.email)) {
      return showAlert("Error", "No tienes permisos para modificar K-oins.");
    }
    const nuevosPuntos = (currentPuntos || 0) + delta;
    if (nuevosPuntos < 0 && delta < 0) {
      showAlert("Error", "El usuario no puede tener K-oins negativos.");
      return;
    }
    try {
      const { error } = await supabase.rpc('admin_update_puntos', { target_user_id: targetUserId, nuevos_puntos: nuevosPuntos });
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        sender_id: user.id,
        type: 'admin_message',
        content: delta > 0 ? `Felicidades! Has recibido ${delta} K-oins por tu colaboración.` : `Se han retirado ${Math.abs(delta)} K-oins de tu cuenta por moderación.`,
        read: false
      });
      setProfile((prev: any) => prev ? { ...prev, puntos: nuevosPuntos } : null);
      showAlert(
        delta > 0 ? t("me.koins_added") : t("me.koins_removed"),
        (t('me.koins_update_success') || `Se han actualizado los K-oins de @${profile?.display_name} correctamente.`).replace('{name}', profile?.display_name || "")
      );
    } catch (err: any) {
      showAlert("Error", err.message);
    }
  };

  const handleDirectPuntosUpdate = async () => {
    if (!profile?.id || !userId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email || !isAdminTeamEmail(user.email)) return;
    try {
      setLoading(true);
      const { error } = await supabase.rpc('admin_update_puntos', { target_user_id: profile.id, nuevos_puntos: puntosDraft });
      if (error) throw error;
      setProfile(prev => prev ? { ...prev, puntos: puntosDraft } : null);
      setIsEditingPuntos(false);
      showAlert("K-oins Actualizados", `Se han asignado ${puntosDraft} K-oins a @${profile.display_name} con éxito.`);
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransferPuntos = async () => {
    if (!profile?.id || !userId || transferAmount <= 0) return;
    if (userId === profile.id) {
      showAlert(t("common.error"), t("me.transfer_self_error"));
      return;
    }
    const misPuntosActuales = (globalProfile as any)?.puntos || 0;
    if (misPuntosActuales < transferAmount) {
      showAlert(t("me.koins_insufficient"), `Tienes ${misPuntosActuales} K-oins y quieres enviar ${transferAmount}.`);
      return;
    }
    setLoading(true);
    try {
      const destinatarioRealId = profile.id;
      const { error } = await supabase.rpc('transferir_puntos', { remitente_id: userId, destinatario_id: destinatarioRealId, cantidad: transferAmount });
      if (error) throw error;
      await supabase.from('fanzone_notifications').insert({ user_id: destinatarioRealId, actor_id: userId, type: 'points_gift' });
      showAlert(t("me.transfer_success_title"), t("me.transfer_success_msg").replace('{amount}', transferAmount.toString()));
      setIsTransferring(false);
      setTransferAmount(0);
      refreshGlobal();
      const { data: updated } = await supabase.from('profiles').select('puntos').eq('user_id', destinatarioRealId).single();
      if (updated) {
        setProfile(prev => prev ? { ...prev, puntos: updated.puntos } : null);
      }
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const manejarRecursoSancion = async () => {
    if (!profile?.id) return;

    showPrompt(
      t("me.appeal_title"),
      t("me.appeal_desc"),
      async (mensajeUsuario) => {
        if (!mensajeUsuario) return;
        setLoading(true);
        try {
          const { data: denuncias } = await supabase
            .from('denuncias')
            .select('*')
            .eq('reported_user_id', profile?.id) 
            .order('created_at', { ascending: false })
            .limit(1);

          const ahora = new Date();
          const fechaFormateada = `${ahora.toLocaleDateString()} ${ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          const textoApelacion = `\n\n--- APELACIÓN DEL USUARIO (${fechaFormateada}) ---\n"${mensajeUsuario}"\n--------------------------------------------`;

          if (denuncias && denuncias.length > 0) {
            const denunciaOriginal = denuncias[0];
            await supabase.from('denuncias').update({
              notas_admin: textoApelacion + "\n" + (denunciaOriginal.notas_admin || ""),
              estado: 'pendiente' 
            }).eq('id', denunciaOriginal.id);
            showAlert(t("me.sent"), t("me.appeal_added"));
          } else {
            await supabase.from('denuncias').insert({
              reported_user_id: profile?.id,
              motivo: "Apelación de restricción",
              notas_admin: textoApelacion,
              estado: 'pendiente'
            });
            showAlert(t("me.sent"), t("me.appeal_new"));
          }
        } catch (err: any) {
          showAlert("Error", err.message);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)", fontWeight: 900, backgroundColor: "var(--bg-main)" }}>
        {t("common.loading")}
      </div>
    );
  }
 const renderMessage = (content: string, isMe: boolean) => {
    if (!content) return null;
    if (content.startsWith("[APP_OFFER_PAYLOAD]")) {
      try {
        const jsonStr = content.replace("[APP_OFFER_PAYLOAD]", "");
        const payload = JSON.parse(jsonStr);
        const formatName = (str: string) => str ? str.replace(/[-]/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", marginTop: "4px" }}>
            <div style={{ fontSize: "11px", fontWeight: 900, color: isMe ? "white" : "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
              {t("me.trade_offer")}
            </div>
            {payload.items && payload.items.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px" }}>
                {payload.items.map((item: any, idx: number) => (
                  <div key={idx} style={{ background: isMe ? "color-mix(in srgb, var(--bg-card) 15%, transparent)" : "var(--bg-card)", border: isMe ? "1px solid color-mix(in srgb, var(--bg-card) 30%, transparent)" : "1px solid var(--color-border)", borderRadius: "12px", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 4px 10px var(--shadow-card)" }}>
                    <div style={{ height: "130px", width: "100%", overflow: "hidden", position: "relative" }}>
                      <img src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "2px", alignItems: "center", textAlign: "center" }}>
                      <span style={{ fontSize: "11px", fontWeight: 900, color: isMe ? "white" : "var(--text-main)", lineHeight: 1.2 }}>
                        {formatName(item.type === "pc" ? item.member : item.name)}
                      </span>
                      {item.type === "pc" && item.version && (
                        <span style={{ fontSize: "9px", fontWeight: 800, color: isMe ? "color-mix(in srgb, var(--bg-card) 80%, transparent)" : "var(--color-primary)" }}>
                          {formatName(item.version)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {payload.koins > 0 && (
              <div style={{ background: "var(--state-warning-fg)", color: "white", padding: "8px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: 900, display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 10px color-mix(in srgb, var(--state-warning-fg) 30%, transparent)" }}>
                {t("me.extra_offer")}: {payload.koins} K-oins
              </div>
            )}
            {payload.text && (
              <div style={{ marginTop: "4px", fontSize: "14px", fontWeight: 600, whiteSpace: "pre-wrap", color: isMe ? "white" : "var(--text-main)", borderTop: isMe ? "1px dashed color-mix(in srgb, var(--bg-card) 30%, transparent)" : "1px dashed var(--color-border)", paddingTop: "10px" }}>
                {payload.text}
              </div>
            )}
          </div>
        );
      } catch (e) {
        return <div>{content}</div>;
      }
    }
    return <div style={{ fontSize: "14px", fontWeight: 600, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{content}</div>;
  };

  return (
    <div
      className="me-page-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "var(--text-main)",
        ["--me-tab-accent" as string]: ME_TAB_ACCENTS[tab],
      }}
    >
      <main style={{ width: "100%", minWidth: "100%", maxWidth: "100vw", overflowX: "hidden", margin: "0", padding: isMobile ? "10px" : "40px", boxSizing: "border-box" }}>
        
        {fromAdmin && showAdminPanelShortcut && (
          <button onClick={() => { const rId = searchParams.get('reopen'); router.push(`/admin-panel?tab=denuncias${rId ? `&reopen=${rId}` : ''}`); }} style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--text-main)", color: "var(--bg-main)", padding: "10px 20px", borderRadius: "12px", border: "none", fontWeight: 900, cursor: "pointer", marginBottom: "20px", boxShadow: "0 4px 12px var(--shadow-card)", width: "fit-content" }}>
            <AlertTriangle size={18} color="var(--color-primary)" /> {t("me.back_to_file")}
          </button>
        )}

      {/* BANNER DE CUENTA RESTRINGIDA */}
        {!isViewingOtherUser && profile?.is_restricted && (
          <div style={{ background: "var(--state-danger-bg)", color: "var(--state-danger-fg)", padding: "18px", borderRadius: "16px", border: "2px solid var(--state-danger-border)", marginBottom: "25px", boxShadow: "0 4px 12px color-mix(in srgb, var(--state-danger-fg) 10%, transparent)" }}>
            <h3 style={{ margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: 900 }}>
              <ShieldAlert size={20} /> {t("me.restricted_banner_title")}
            </h3>
            <p style={{ fontSize: "14px", margin: "0 0 15px 0", fontWeight: 600, lineHeight: "1.5" }}>
              {t("me.restricted_banner_msg")}
            </p>
            
            <button 
              onClick={manejarRecursoSancion} 
              style={{ background: "var(--state-danger-fg)", color: "white", border: "none", padding: "10px 20px", borderRadius: "10px", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px" }}
            >
              <ShieldAlert size={16} /> {t("me.appeal_btn")}
            </button>
          </div>
        )}

        {/* CABECERA PERFIL */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: isMobile ? "center" : "space-between", alignItems: isMobile ? "center" : "flex-end", marginBottom: "30px", borderBottom: "1px solid var(--color-border)", paddingBottom: "20px", gap: isMobile ? "15px" : "0", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "25px", alignItems: "center", textAlign: isMobile ? "center" : "left" }}>
            
            {profile?.is_premium ? (
              <div onClick={() => setIsAvatarModalOpen(true)} style={{ width: 110, height: 110, borderRadius: "50%", overflow: "hidden", backgroundColor: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", border: "3px solid var(--state-warning-fg)", padding: "4px", flexShrink: 0 }}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} alt="Avatar" />
                ) : (
                  <User size={40} color="var(--text-muted)" />
                )}
                <div style={{ position: "absolute", inset: 0, backgroundColor: "color-mix(in srgb, var(--color-primary) 50%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.opacity = "1"} onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}>
                  <Camera color="white" size={28} />
                </div>
              </div>
            ) : (
              <div className="me-avatar-ring-wrap">
                <div onClick={() => setIsAvatarModalOpen(true)} style={{ width: 104, height: 104, borderRadius: "50%", overflow: "hidden", backgroundColor: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} alt="Avatar" />
                  ) : (
                    <User size={40} color="var(--text-muted)" />
                  )}
                  <div style={{ position: "absolute", inset: 0, backgroundColor: "color-mix(in srgb, var(--color-primary) 50%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.opacity = "1"} onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}>
                    <Camera color="white" size={28} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap", justifyContent: isMobile ? "center" : "flex-start" }}>
                <h1 className="tan-font shop-hero-headline" style={{ fontSize: isMobile ? 36 : 48, margin: 0, lineHeight: 1.1 }}>
                  {profile?.display_name}
                </h1>
                {profile?.is_premium && <Crown size={36} color="var(--state-warning-fg)" />}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: isMobile ? "center" : "flex-start" }}>
                <div style={{ padding: "4px 12px", borderRadius: "99px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", background: profile?.is_premium ? "var(--bg-card)" : "var(--bg-soft)", color: profile?.is_premium ? "var(--state-warning-fg)" : "var(--color-primary)", border: profile?.is_premium ? "1px solid var(--state-warning-fg)" : "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "6px" }}>
                  {profile?.is_premium ? <><Crown size={14} color="var(--state-warning-fg)" /> {t('common.premium_account')}</> : <><User size={12} /> {t('common.basic_account')}</>}
                </div>
                {!isViewingOtherUser && (
                  <button onClick={() => router.push('/shop')} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, textDecoration: "underline", cursor: "pointer", padding: 0 }}>
                    {profile?.is_premium ? t('me.manage_sub') : t('me.upgrade_btn')}
                  </button>
                )}
              </div>

              <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "center", justifyContent: isMobile ? "center" : "flex-start", flexWrap: "wrap" }}>
                {isViewingOtherUser ? (
                  <>
                    <button type="button" onClick={handleToggleFavorite} style={{ background: isFav ? "var(--state-warning-border)" : "var(--bg-card)", color: isFav ? "white" : "var(--state-warning-fg)", border: "2px solid var(--state-warning-border)", padding: "8px 16px", borderRadius: "12px", fontSize: "13px", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <Star size={16} fill={isFav ? "white" : "none"} /> {isFav ? t('me.in_favorites') : t('me.add_favorite')}
                    </button>
                    <button type="button" onClick={() => openChat({ sender_id: profile!.id, sender_profile: { display_name: profile!.display_name, avatar_url: profile!.avatar_url } } as any)} style={{ background: "var(--color-primary)", color: "white", border: "none", padding: "8px 16px", borderRadius: "12px", fontSize: "13px", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <MessageCircle size={16} /> {t('me.send_msg')}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/me?u=${profile?.id}`); showAlert(t("common.copied"), t("me.link_copied_msg")); }} style={{ background: "var(--bg-soft)", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 900, cursor: "pointer" }}>
                      {t("me.copy_link_btn")}
                    </button>
                    <button type="button" title={t("me.quick_settings")} aria-label={t("me.quick_settings")} onClick={() => setIsSettingsOpen(true)} style={{ width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--bg-soft)", color: "var(--color-primary)", border: "1px solid var(--color-border)", borderRadius: "10px", cursor: "pointer" }}>
                      <Settings size={20} />
                    </button>
                    {showAdminPanelShortcut && (
                      <button type="button" title={t("header.dropdown.admin_panel")} aria-label={t("header.dropdown.admin_panel")} onClick={() => router.push("/admin-panel")} style={{ width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--bg-soft)", color: "var(--color-primary)", border: "1px solid var(--color-border)", borderRadius: "10px", cursor: "pointer" }}>
                        <LayoutDashboard size={20} />
                      </button>
                    )}
                  </>
                )}
              </div>
              <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "15px", marginTop: "8px" }}>{profile?.bio}</p>
            </div>
          </div>
        </div>

        {/* TABS DE NAVEGACIÓN */}
        <div style={{ display: isMobile ? "grid" : "flex", gridTemplateColumns: isMobile ? "1fr 1fr" : "none", gap: "10px", marginBottom: "40px", width: "100%" }}>
          {tabs.map((tabItem) => {
            if (isViewingOtherUser && tabItem.key === "notices") return null;
            return (
              <button key={tabItem.key} onClick={() => setTab(tabItem.key)} style={{ ...meTabButtonStyle(tab === tabItem.key, ME_TAB_ACCENTS[tabItem.key]), width: "100%", display: "flex", justifyContent: "center", alignItems: "center", padding: isMobile ? "10px 8px" : "12px 20px", fontSize: isMobile ? "12px" : "14px" }}>
                {tabItem.icon} <span style={{ marginLeft: "8px" }}>{tabItem.label}</span>
              </button>
            )
          })}
        </div>

        <div style={{ minHeight: "400px" }}>
          {tab === "home" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: "20px" }}>
                <div className="me-panel-card" style={{ backgroundColor: "var(--bg-card)", padding: "30px", borderRadius: "24px" }}>
                  <h3 style={{ color: "var(--me-tab-accent)", fontWeight: 900, fontSize: "18px", margin: "0 0 20px 0", display: "flex", alignItems: "center", gap: "10px" }}><Boxes size={20}/> {t('me.my_collection_title')}</h3>
                  <div style={{ display: "flex", gap: "40px" }}>
                    <div>
                      <div style={{ fontSize: "42px", fontWeight: 900, color: "var(--color-primary)", lineHeight: 1 }}>{stats.have}</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginTop: "5px" }}>Photocards</div>
                    </div>
                    <div style={{ width: "1px", backgroundColor: "var(--color-border)" }}></div>
                    <div>
                      <div style={{ fontSize: "42px", fontWeight: 900, color: "var(--state-warning-fg)", lineHeight: 1 }}>{stats.wishlist}</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--state-warning-fg)", textTransform: "uppercase", marginTop: "5px" }}>Wishlist</div>
                    </div>
                  </div>
                </div>
                <div className="me-panel-card" style={{ backgroundColor: "var(--bg-soft)", padding: "30px", borderRadius: "24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <h3 style={{ color: "var(--me-tab-accent)", fontWeight: 900, fontSize: "18px", margin: "0 0 20px 0", display: "flex", alignItems: "center", gap: "10px" }}><Wallet size={20}/> {t('me.est_value')}</h3>
                  <div style={{ fontSize: "48px", fontWeight: 900, color: "var(--text-main)", lineHeight: 1 }}>{stats.estimatedValue}€</div>
                 <p style={{ color: "var(--text-muted)", fontSize: "13px", fontWeight: 600, margin: "5px 0 0 0" }}>
  {t("me.avg_price_note").replace('{price}', AVG_PC_PRICE.toString())}
</p>
                </div>
              </div>
              
              {Object.keys(stats.byMember).length > 0 && (
                <div className="me-panel-card" style={{ backgroundColor: "var(--bg-card)", padding: "30px", borderRadius: "24px" }}>
                  <h3 style={{ color: "var(--me-tab-accent)", fontWeight: 900, margin: "0 0 16px 0", fontSize: "18px" }}>{t("me.stats.top_members")}</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {Object.entries(stats.byMember).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([name, count]) => (
                      <span key={name} style={{ padding: "8px 14px", borderRadius: "12px", background: "var(--bg-soft)", border: "1px solid var(--color-border)", fontWeight: 800, fontSize: "13px" }}>
                        {name} · {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="me-panel-card" style={{ backgroundColor: "var(--bg-card)", padding: "30px", borderRadius: "24px" }}>
                <h3 style={{ color: "var(--me-tab-accent)", fontWeight: 900, margin: 0, display: "flex", alignItems: "center", gap: "10px" }}><Star fill="var(--state-warning-border)" color="var(--state-warning-border)" size={20}/> {t('me.fav_network')}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", fontWeight: 700, margin: "8px 0 16px 0" }}>
                  {t("me.favorites.saved_by").replace("{{count}}", String(favoritedByCount))}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                  {myFavoritesProfiles.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontWeight: 700, margin: 0 }}>{t("me.favorites.empty")}</p>
                  ) : (
                    myFavoritesProfiles.map((u: any) => (
                      <button type="button" key={u.user_id} onClick={() => router.push(`/me?u=${u.user_id}`)} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "10px 14px", borderRadius: "14px", border: "1px solid var(--color-border)", background: "var(--bg-soft)", fontWeight: 800 }}>
                        <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.display_name || "?")}`} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                        {u.display_name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="me-panel-card" style={{ backgroundColor: "var(--bg-card)", padding: "30px", borderRadius: "24px" }}>
                <h3 style={{ color: "var(--me-tab-accent)", fontWeight: 900, fontSize: "18px", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}><Sparkles color="var(--me-tab-accent)" size={20}/> {t('me.my_koins_title')}</h3>
                <div className="shop-koins-glow" style={{ display: "inline-flex", alignItems: "center", marginTop: "14px", padding: "12px 22px" }}>
                  <span style={{ fontSize: "30px", fontWeight: 950, color: "var(--me-tab-accent)", textShadow: "0 0 22px color-mix(in srgb, var(--me-tab-accent) 38%, transparent)" }}>{(profile as any)?.puntos || 0}</span>
                </div>
              </div>
            </div>
          )}

          {tab === "groups" && !isViewingOtherUser && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="me-panel-card" style={{ backgroundColor: "var(--bg-card)", padding: "20px 30px", borderRadius: "24px" }}>
                <h3 className="tan-font" style={{ color: "var(--me-tab-accent)", fontSize: "20px", margin: "0 0 15px 0" }}>{t("me.preferences.title")}</h3>
                <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "14px", marginBottom: "12px" }}>{t("me.preferences.subtitle")}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                  {["photocard", "merch", "ticket"].map((pref) => (
                    <button type="button" key={pref} onClick={() => {
                      const next = collectionPrefs.includes(pref) ? collectionPrefs.filter((x) => x !== pref) : [...collectionPrefs, pref];
                      setCollectionPrefs(next);
                      persistFanStuff(favGroups, biasByGroup, wall, next, wreckerByGroup);
                    }} style={{ padding: "8px 14px", borderRadius: "99px", border: collectionPrefs.includes(pref) ? "2px solid var(--color-primary)" : "1px solid var(--color-border)", background: collectionPrefs.includes(pref) ? "var(--bg-soft)" : "var(--bg-card)", fontWeight: 800, cursor: "pointer", fontSize: "12px", textTransform: "capitalize" }}>
                      {pref}
                    </button>
                  ))}
                </div>
                <h4 style={{ color: "var(--color-primary)", margin: "16px 0 8px 0", fontWeight: 900 }}>{t("me.preferences.management_title")}</h4>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700, margin: "0 0 8px 0" }}>{t("me.preferences.bias_cycle_hint")}</p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px", position: "relative", alignItems: "flex-start" }}>
                  <div style={{ position: "relative", flex: "1 1 220px", maxWidth: "280px" }}>
                    <input
                      placeholder={t("me.preferences.placeholder_add")}
                      value={groupInput}
                      onChange={(e) => setGroupInput(e.target.value)}
                      style={{ ...inputStyle, marginBottom: 0 }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addGroup(groupInput);
                        }
                      }}
                      autoComplete="off"
                    />
                    {groupSuggestions.length > 0 && (
                      <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 20, marginTop: "4px", background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: "12px", overflow: "hidden", boxShadow: "0 10px 30px var(--shadow-card)" }}>
                        {groupSuggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => addGroup(s)}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", fontWeight: 800, fontSize: "14px", color: "var(--text-main)" }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => addGroup(groupInput)} style={{ padding: "10px 16px", borderRadius: "12px", background: "var(--color-primary)", color: "white", border: "none", fontWeight: 900, cursor: "pointer" }}>+</button>
                </div>
                {favGroups.map((gName) => {
                  const rowMembers = resolveMembersForGroup(gName, members);
                  return (
                  <div key={gName} style={{ marginBottom: "16px", padding: "16px", borderRadius: "16px", border: "1px solid var(--color-border)", background: "var(--bg-soft)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontWeight: 900, color: "var(--color-primary)" }}>{gName}</span>
                      <button type="button" onClick={() => removeGroup(gName)} style={{ background: "none", border: "none", color: "var(--state-danger-fg)", cursor: "pointer", fontWeight: 800 }}><Minus size={16} /></button>
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: 900, color: "var(--text-muted)", marginBottom: "6px" }}>{t("me.preferences.bias_label")}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 900, padding: "2px 8px", borderRadius: "6px", border: "1px solid var(--color-primary)", color: "var(--color-primary)" }}>Bias</span>
                      <span style={{ fontSize: "10px", fontWeight: 900, padding: "2px 8px", borderRadius: "6px", border: "1px dashed var(--state-warning-fg)", color: "var(--state-warning-fg)" }}>Wrecker</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {rowMembers.length === 0 ? (
                        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>{t("me.preferences.no_members")}</span>
                      ) : (
                        rowMembers.map((m) => {
                          const isBias = (biasByGroup[gName] || []).includes(m.name);
                          const isWreck = (wreckerByGroup[gName] || []).includes(m.name);
                          const ring = isBias ? "var(--color-primary)" : isWreck ? "var(--state-warning-fg)" : "var(--color-border)";
                          return (
                            <button
                              type="button"
                              key={m.name}
                              title={isBias ? "Bias" : isWreck ? "Wrecker" : t("me.preferences.member_add_hint")}
                              onClick={() => toggleMemberStatus(gName, m.name)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "6px 10px 6px 6px",
                                borderRadius: "12px",
                                border: isBias ? "2px solid var(--color-primary)" : isWreck ? "2px dashed var(--state-warning-fg)" : "1px solid var(--color-border)",
                                background: isBias ? "var(--bg-card)" : isWreck ? "color-mix(in srgb, var(--state-warning-fg) 14%, transparent)" : "transparent",
                                fontWeight: 800,
                                fontSize: "12px",
                                cursor: "pointer",
                                color: "var(--text-main)",
                              }}
                            >
                              <span style={{ position: "relative", width: 36, height: 36, flexShrink: 0 }}>
                                <img
                                  src={m.portrait}
                                  alt=""
                                  width={36}
                                  height={36}
                                  style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: `2px solid ${ring}`, display: "block", background: "var(--bg-main)" }}
                                  onError={(e) => {
                                    const el = e.currentTarget;
                                    el.onerror = null;
                                    if (String(el.src).includes("ui-avatars.com")) return;
                                    el.src = uiAvatarPortrait(m.name);
                                  }}
                                />
                                {(isBias || isWreck) && (
                                  <span
                                    style={{
                                      position: "absolute",
                                      bottom: -2,
                                      right: -2,
                                      minWidth: 16,
                                      height: 16,
                                      padding: "0 3px",
                                      borderRadius: "50%",
                                      background: isBias ? "var(--color-primary)" : "var(--state-warning-fg)",
                                      border: "2px solid var(--bg-card)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "9px",
                                      fontWeight: 950,
                                      color: "var(--bg-card)",
                                      lineHeight: 1,
                                    }}
                                  >
                                    {isBias ? "★" : "☆"}
                                  </span>
                                )}
                              </span>
                              <span style={{ textAlign: "left" }}>{m.name}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                  );
                })}
                <button type="button" onClick={handleSaveBias} style={{ marginTop: "12px", padding: "12px 20px", borderRadius: "12px", border: "none", background: "var(--color-primary)", color: "white", fontWeight: 900, cursor: "pointer" }}>{t("me.preferences.btn_save_all")}</button>
              </div>
            </div>
          )}
          {tab === "groups" && isViewingOtherUser && (
            <p style={{ color: "var(--text-muted)", fontWeight: 700 }}>La gestión de bias solo está disponible en tu propio perfil.</p>
          )}

          {tab === "fanzone" && (
            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
              <h2 style={{ color: "var(--me-tab-accent)", fontWeight: 900, fontSize: "22px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}><MessageCircle size={22} /> {t("me.tabs.fanzone")}</h2>
              {loadingFanzone ? (
                <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="spinner" color="var(--color-primary)" /></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 800, color: "var(--text-muted)" }}>
                      <input
                        type="checkbox"
                        checked={fanzoneNotices.length > 0 && selectedFanzoneNotices.size === fanzoneNotices.length}
                        onChange={(e) => handleSelectAllFanzone(e.target.checked)}
                      />
                      Seleccionar todo
                    </label>
                    <button
                      type="button"
                      onClick={allSelectedFanzoneUnread ? markFanzoneSelectedAsRead : markFanzoneSelectedAsUnread}
                      style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 800, cursor: "pointer" }}
                    >
                      {allSelectedFanzoneUnread ? "Marcar leído" : "Marcar no leído"}
                    </button>
                    <button
                      type="button"
                      title="Borrar seleccionadas"
                      onClick={deleteFanzoneSelected}
                      style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--text-main)", cursor: "pointer" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {fanzoneNotices.map((n: any) => (
                    <div key={`fz-${n.id}`} onClick={() => router.push("/fanzone")} style={{ padding: "12px 14px", borderRadius: "12px", border: "1px solid var(--color-border)", background: n.read === false ? "var(--bg-soft)" : "var(--bg-card)", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedFanzoneNotices.has(String(n.id))}
                            onChange={(e) => toggleFanzoneSelection(String(n.id), e)}
                          />
                          <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-main)" }}>
                            @{n.actor_profile?.display_name || "Usuario"} · {String(n.type || "activity")}
                          </span>
                        </label>
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={(e) => (n.read === false ? markFanzoneAsRead(String(n.id), e) : markFanzoneAsUnread(String(n.id), e))}
                            style={{ border: "1px solid var(--color-border)", background: "var(--bg-main)", borderRadius: "8px", padding: "4px 8px", fontSize: "11px", fontWeight: 800, cursor: "pointer" }}
                          >
                            {n.read === false ? "Leído" : "No leído"}
                          </button>
                          <button
                            type="button"
                            title="Borrar"
                            onClick={(e) => deleteFanzoneNotice(String(n.id), e)}
                            style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "var(--text-main)", borderRadius: "8px", cursor: "pointer" }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: "6px", fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {publicFanzonePosts.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontWeight: 700 }}>Aún no hay hilos públicos. Participa en el Fan Zone.</p>
                  ) : publicFanzonePosts.map((post: any) => (
                    <button type="button" key={post.id} onClick={() => router.push(`/fanzone#post-${post.id}`)} className="me-panel-card me-fanzone-post-card" style={{ textAlign: "left", padding: "16px", borderRadius: "16px", background: "var(--bg-card)", cursor: "pointer" }}>
                      <div style={{ fontWeight: 900, color: "var(--text-main)" }}>{post.title || "Post"}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{post.content?.slice(0, 120)}…</div>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => router.push("/fanzone")} style={{ marginTop: "20px", display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 18px", borderRadius: "12px", border: "1px solid var(--color-primary)", background: "var(--bg-soft)", color: "var(--color-primary)", fontWeight: 900, cursor: "pointer" }}>
                <ExternalLink size={18} /> Fan Zone
              </button>
            </div>
          )}

          {tab === "notices" && (
            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "10px", borderBottom: "1px solid var(--color-border)" }}>
                <h2 style={{ color: "var(--me-tab-accent)", fontWeight: 900, fontSize: "24px", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}><Bell size={24} /> {t('me.notice_center')}</h2>
              </div>
              {loadingNotices ? (
                <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="spinner" color="var(--color-primary)" /></div>
              ) : notifications.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontWeight: 700 }}>No hay notificaciones.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 800, color: "var(--text-muted)" }}>
                      <input
                        type="checkbox"
                        checked={notifications.length > 0 && selectedNotices.size === notifications.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                      Seleccionar todo
                    </label>
                    <button
                      type="button"
                      onClick={allSelectedNoticesUnread ? markSelectedAsRead : markSelectedAsUnread}
                      style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 800, cursor: "pointer" }}
                    >
                      {allSelectedNoticesUnread ? "Marcar leído" : "Marcar no leído"}
                    </button>
                    <button
                      type="button"
                      title="Borrar seleccionadas"
                      onClick={deleteSelectedNotices}
                      style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--text-main)", cursor: "pointer" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {notifications.map((n) => (
                    <div key={n.id} onClick={() => handleNoticeRowClick(n)} style={{ padding: "14px 16px", borderRadius: "14px", border: "1px solid var(--color-border)", background: n.read ? "var(--bg-card)" : "var(--bg-soft)", cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedNotices.has(n.id)}
                            onChange={(e) => toggleSelection(n.id, e)}
                          />
                          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 800 }}>{new Date(n.created_at).toLocaleString()}</span>
                        </label>
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={(e) => (n.read ? markAsUnread(n.id, e) : markAsReadFromButton(n.id, e))}
                            style={{ border: "1px solid var(--color-border)", background: "var(--bg-main)", borderRadius: "8px", padding: "4px 8px", fontSize: "11px", fontWeight: 800, cursor: "pointer" }}
                          >
                            {n.read ? "No leído" : "Leído"}
                          </button>
                          <button
                            type="button"
                            title="Borrar"
                            onClick={(e) => deleteNotice(n.id, e)}
                            style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "var(--text-main)", borderRadius: "8px", cursor: "pointer" }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, marginTop: "4px", color: "var(--text-main)" }}>{n.sender_profile?.display_name || "MKB"}</div>
                      <div style={{ fontSize: "14px", marginTop: "6px", whiteSpace: "pre-wrap" }}>{n.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
     {/* MODAL DE CHAT */}
      {activeChatUser && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 6000, padding: "20px", backdropFilter: "blur(4px)" }} onClick={closeChat}>
          <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "24px", width: "100%", maxWidth: "500px", height: "85vh", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid var(--color-border)", boxShadow: "0 20px 50px var(--shadow-card)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "15px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-soft)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => router.push(`/me?u=${activeChatUser.id}`)}>
                <img src={activeChatUser.avatar} style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", border: "1px solid var(--color-border)" }} alt="" />
                <div>
                  <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "16px", margin: 0 }}>@{activeChatUser.name}</h2>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700 }}>{t('common.view_profile')}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button onClick={() => { showPrompt(t("me.report_chat_title"), t("me.report_chat_desc").replace('{name}', activeChatUser.name), async (razon, isAnonymous) => { await supabase.from('denuncias').insert({ reported_user_id: activeChatUser.id, reporter_id: isAnonymous ? null : profile?.id, motivo: "[Reporte de Chat] " + razon, estado: 'pendiente' }); showAlert(t("me.report_sent_title"), t("me.report_sent_msg")); }); }} style={{ background: "var(--bg-main)", border: "1px solid var(--color-primary)", color: "var(--color-primary)", padding: "4px 8px", borderRadius: "8px", fontSize: "10px", fontWeight: 900, cursor: "pointer" }}>{t('common.report')}</button>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: "var(--color-primary)", fontWeight: 800, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autoTranslate}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (next) {
                        translationFatalRef.current = false;
                        translationCooldownUntilRef.current = 0;
                      }
                      setAutoTranslate(next);
                    }}
                    style={{ accentColor: "var(--color-primary)" }}
                  /> {t('me.translate')}
                </label>
                {translationErrorHint && (
                  <span
                    title={translationErrorHint || t("me.translation_collapsed_tooltip")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 18,
                      height: 18,
                      borderRadius: "999px",
                      color: "var(--state-danger-fg)",
                      background: "color-mix(in srgb, var(--state-danger-fg) 14%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--state-danger-fg) 35%, transparent)",
                    }}
                  >
                    <AlertTriangle size={11} />
                  </span>
                )}
                <button onClick={closeChat} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={24} color="var(--color-primary)"/></button>
              </div>
            </div>
            <div
              ref={messagesViewportRef}
              onScroll={() => {
                const el = messagesViewportRef.current;
                if (!el) return;
                const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                shouldStickToBottomRef.current = distanceToBottom < 60;
              }}
              style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "15px", background: "var(--bg-main)", position: "relative" }}
            >
              {translationErrorHint && (
                <div
                  title={translationErrorHint}
                  style={{
                    alignSelf: "center",
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "var(--state-danger-fg)",
                    background: "color-mix(in srgb, var(--state-danger-fg) 10%, var(--bg-card))",
                    border: "1px solid color-mix(in srgb, var(--state-danger-fg) 35%, transparent)",
                    borderRadius: "999px",
                    padding: "6px 10px",
                  }}
                >
                  {t("me.translation_collapsed_tooltip")}
                </div>
              )}
              {showChatTranslateAdvice && (
                <div
                  style={{
                    border: "1px dashed var(--color-border)",
                    borderRadius: "12px",
                    background: "var(--bg-soft)",
                    padding: "10px 12px",
                    color: "var(--text-muted)",
                    fontSize: "11px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                  }}
                >
                  <span>{t("me.translation_recommendation_banner")}</span>
                  <button
                    onClick={() => setShowChatTranslateAdvice(false)}
                    style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontWeight: 900 }}
                  >
                    OK
                  </button>
                </div>
              )}
              {isLoadingChat ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}><Loader2 size={24} className="spinner" color="var(--color-primary)" /></div>
              ) : chatHistory.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "13px", fontWeight: 700, padding: "20px" }}>{t('me.no_messages')}</div>
              ) : (
                chatHistory.map((msg) => {
                  const isMe = msg.sender_id === profile?.id;
                  const isTranslating = isTranslatingMsg === msg.id;
                  const traduccion = translatedMessages[msg.id];
                  const translationUnavailable = t("me.translation_unavailable");
                  const canShowTranslation = Boolean(traduccion && traduccion !== translationUnavailable);
                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                      <div style={{ background: isMe ? "var(--color-primary)" : "var(--bg-card)", color: isMe ? "white" : "var(--text-main)", padding: "12px 16px", borderRadius: "16px", border: isMe ? "none" : "1px solid var(--color-border)", maxWidth: "80%", boxShadow: "0 2px 8px var(--shadow-card)" }}>
                        {msg.image_url && <img src={msg.image_url} style={{ maxWidth: "100%", borderRadius: "8px", marginBottom: "8px", border: "1px solid var(--color-border)" }} alt="Adjunto" />}
                        {renderMessage(msg.content, isMe)}
                        {!isMe && (
                          <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed var(--color-border)" }}>
                            {canShowTranslation ? (
                              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-primary)", display: "flex", flexDirection: "column", gap: "4px" }}>
                                <span style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}><Languages size={10} /> {t('me.ai_translation')}</span>
                                {traduccion}
                              </div>
                            ) : (
                              <button onClick={(e) => {
                                e.preventDefault();
                                failedAutoTranslationsRef.current.delete(msg.id);
                                setTranslatedMessages((prev) => {
                                  const next = { ...prev };
                                  delete next[msg.id];
                                  return next;
                                });
                                traducirMensajeChat(msg.id, msg.content);
                              }} disabled={isTranslating} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "11px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", padding: 0 }}>
                                {isTranslating ? <RefreshCw size={12} className="spinner" /> : <Languages size={12} />}
                                {isTranslating ? t('me.translating') : t('me.view_translation')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", fontWeight: 700 }}>
                        {new Date(msg.created_at).toLocaleString([], {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'})}
                      </span>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: "16px", background: "var(--bg-card)", borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "10px" }}>
              {replyImagePreview && (
                <div style={{ position: "relative", alignSelf: "flex-start" }}>
                  <img src={replyImagePreview} style={{ height: "80px", borderRadius: "8px", border: "1px solid var(--color-border)" }} alt="preview" />
                  <button onClick={() => { setReplyImage(null); setReplyImagePreview(null); }} style={{ position: "absolute", top: -8, right: -8, background: "var(--text-main)", color: "var(--bg-main)", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: "10px", fontWeight: "bold" }}>X</button>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
                <button onClick={() => replyFileInputRef.current?.click()} style={{ background: "var(--bg-soft)", border: "none", color: "var(--color-primary)", padding: "12px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0}}><ImageIcon size={20} /></button>
                <input type="file" ref={replyFileInputRef} style={{ display: "none" }} accept="image/*" onChange={handleReplyImagePick} />
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }} placeholder={t("me.write_message")} rows={2} style={{ flex: 1, padding: "12px", borderRadius: "16px", border: "1px solid var(--color-border)", outline: "none", fontSize: "13px", resize: "none", fontFamily: "inherit", fontWeight: 600, background: "var(--bg-main)", color: "var(--text-main)" }} />
                <button onClick={handleSendReply} disabled={isSendingReply || (!replyText.trim() && !replyImage)} style={{ background: "var(--color-primary)", border: "none", color: "white", padding: "12px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: isSendingReply ? 0.6 : 1, flexShrink: 0 }}>
                  {isSendingReply ? <Loader2 size={20} className="spinner" /> : <Send size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AVATAR */}
      {isAvatarModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, padding: "20px", backdropFilter: "blur(4px)" }} onClick={() => setIsAvatarModalOpen(false)}>
          <div style={{ backgroundColor: "var(--bg-main)", borderRadius: "32px", width: "100%", maxWidth: "750px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid var(--color-border)", boxShadow: "0 20px 50px var(--shadow-card)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "25px", borderBottom: "1px solid var(--color-border)", textAlign: "center", position: "relative", background: "var(--bg-soft)", flexShrink: 0 }}>
              <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "28px", margin: 0 }}>{t("me.avatar_modal.title")}</h2>
              <button onClick={() => setIsAvatarModalOpen(false)} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", cursor: "pointer" }}><X size={24} color="var(--color-primary)"/></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "30px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginBottom: "24px", alignItems: "center" }}>
                {[
                  { id: "all", label: t("common.all") },
                  { id: "basic", label: t("me.avatar_modal.basic_pack") },
                  { id: "vip", label: t("me.avatar_modal.vip_pack") },
                  { id: "badges", label: t("me.avatar_modal.vip_badges_title") },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setAvatarModalFilter(f.id as "all" | "basic" | "vip" | "badges")}
                    style={{
                      borderRadius: "999px",
                      border: avatarModalFilter === f.id ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                      background: avatarModalFilter === f.id ? "var(--bg-soft)" : "var(--bg-card)",
                      color: avatarModalFilter === f.id ? "var(--color-primary)" : "var(--text-main)",
                      padding: "8px 12px",
                      fontSize: "12px",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    if (profile?.is_premium || isAdmin) fileInputRef.current?.click();
                    else {
                      setIsAvatarModalOpen(false);
                      showAlert(t("common.vip_advantage"), t("me.upgrade_premium_avatar"));
                    }
                  }}
                  style={{
                    borderRadius: "999px",
                    border: "1px solid var(--state-warning-fg)",
                    background: "color-mix(in srgb, var(--state-warning-fg) 10%, var(--bg-card))",
                    color: "var(--state-warning-fg)",
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontWeight: 900,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Camera size={14} strokeWidth={2.5} />
                  {t("me.avatar_modal.pill_upload_photo")}
                </button>
                <input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
              </div>

              {(avatarModalFilter === "all" || avatarModalFilter === "basic") && (
              <section style={{ marginBottom: "40px" }}>
                <h3 className="tan-font" style={{ color: "var(--color-primary)", textAlign: "center", fontSize: "20px", marginBottom: "20px", borderBottom: "2px solid var(--color-border)", paddingBottom: "10px" }}>{t("me.avatar_modal.basic_pack")}</h3>
                <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", justifyContent: "center" }}>
                  {avatarPackBasic.map((img, i) => (
                    <div key={i} onClick={() => handlePredefinedAvatarSelect(img)} style={{ textAlign: "center", cursor: "pointer", transition: "transform 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                      <img src={img} style={{ width: "72px", height: "72px", borderRadius: "50%", border: "2px solid var(--color-border)", objectFit: "cover", backgroundColor: "var(--bg-card)" }} alt="Basic" />
                    </div>
                  ))}
                </div>
              </section>
              )}

              {(avatarModalFilter === "all" || avatarModalFilter === "vip") && (
              <section style={{ marginBottom: "40px", opacity: (!profile?.is_premium && !isAdmin) ? 0.7 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "30px", borderBottom: "2px solid var(--state-warning-fg)", paddingBottom: "10px" }}>
                  <Crown size={24} color="var(--state-warning-fg)" />
                  <h3 className="tan-font" style={{ color: "var(--state-warning-fg)", margin: 0, fontSize: "24px" }}>{t("me.avatar_modal.vip_pack")}</h3>
                </div>
                <h4 className="tan-font" style={{ color: "var(--state-warning-fg)", textAlign: "center", fontSize: "16px", marginBottom: "14px", fontWeight: 900 }}>
                  {t("me.avatar_modal.vip_badges_title")}
                </h4>
                <AvatarModalInsigniasSection
                  t={t}
                  kpopGroups={KPOP_GROUPS}
                  biasByGroup={biasByGroup}
                  portraitForBiasMember={portraitForBiasMember}
                  isPremium={Boolean(profile?.is_premium)}
                  isAdmin={isAdmin}
                  vipBadgeGroupKey={vipBadgeGroupKey}
                  setVipBadgeGroupKey={setVipBadgeGroupKey}
                  vipGroupAssetsRows={vipGroupAssetsRows}
                  vipBadgeSection={vipBadgeSection}
                  setVipBadgeSection={setVipBadgeSection}
                  selectedVipGroupRow={selectedVipGroupRow}
                  vipBadgeSectionTabs={vipBadgeSectionTabs}
                  onPredefinedAvatarSelect={handlePredefinedAvatarSelect}
                  onVipAvatarSelect={handleVipAvatarSelect}
                />
                <h4 className="tan-font" style={{ color: "var(--state-warning-fg)", textAlign: "center", fontSize: "16px", marginTop: "24px", marginBottom: "14px", fontWeight: 900 }}>
                  {t("me.avatar_modal.vip_lightsticks_title")}
                </h4>
                <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", justifyContent: "center", marginBottom: "22px" }}>
                  {avatarPackKpop.map((img, i) => (
                    <div key={`ls-${i}`} onClick={() => handleVipAvatarSelect(img)} style={{ textAlign: "center", cursor: "pointer", transition: "transform 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                      <img src={img} style={{ width: "72px", height: "72px", borderRadius: "50%", border: "2px solid var(--state-warning-fg)", objectFit: "cover", backgroundColor: "var(--bg-card)" }} alt="" />
                    </div>
                  ))}
                </div>
                <h4 className="tan-font" style={{ color: "var(--state-warning-fg)", textAlign: "center", fontSize: "16px", marginBottom: "14px", fontWeight: 900 }}>
                  {t("me.avatar_modal.vip_kawaii_title")}
                </h4>
                <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", justifyContent: "center", marginBottom: "18px" }}>
                  {avatarPackVip.map((img, i) => (
                    <div key={i} onClick={() => handleVipAvatarSelect(img)} style={{ textAlign: "center", cursor: "pointer", transition: "transform 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                      <img src={img} style={{ width: "72px", height: "72px", borderRadius: "50%", border: "2px solid var(--state-warning-fg)", objectFit: "cover", backgroundColor: "var(--bg-card)" }} alt="VIP Kawaii" />
                    </div>
                  ))}
                </div>
              </section>
              )}

              {avatarModalFilter === "badges" && (
              <section>
                <h3 className="tan-font" style={{ color: "var(--color-primary)", textAlign: "center", fontSize: "20px", marginBottom: "20px", borderBottom: "2px solid var(--color-border)", paddingBottom: "10px" }}>
                  {t("me.avatar_modal.vip_badges_title")}
                </h3>
                <AvatarModalInsigniasSection
                  t={t}
                  kpopGroups={KPOP_GROUPS}
                  biasByGroup={biasByGroup}
                  portraitForBiasMember={portraitForBiasMember}
                  isPremium={Boolean(profile?.is_premium)}
                  isAdmin={isAdmin}
                  vipBadgeGroupKey={vipBadgeGroupKey}
                  setVipBadgeGroupKey={setVipBadgeGroupKey}
                  vipGroupAssetsRows={vipGroupAssetsRows}
                  vipBadgeSection={vipBadgeSection}
                  setVipBadgeSection={setVipBadgeSection}
                  selectedVipGroupRow={selectedVipGroupRow}
                  vipBadgeSectionTabs={vipBadgeSectionTabs}
                  onPredefinedAvatarSelect={handlePredefinedAvatarSelect}
                  onVipAvatarSelect={handleVipAvatarSelect}
                />
              </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AJUSTES */}
      {isSettingsOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5000, padding: "20px", backdropFilter: "blur(4px)" }} onClick={() => setIsSettingsOpen(false)}>
          <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "32px", width: "100%", maxWidth: "600px", maxHeight: "90vh", overflow: "auto", border: "1px solid var(--color-border)", boxShadow: "0 20px 50px var(--shadow-card)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "25px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-soft)" }}>
              <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "28px", margin: 0 }}>{t("me.settings.title")}</h2>
              <button onClick={() => setIsSettingsOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={24} color="var(--color-primary)"/></button>
            </div>
            <form onSubmit={handleSaveSettings} style={{ padding: "30px" }}>
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>{t("me.settings.email")}</label>
                <input type="email" readOnly disabled style={{ ...inputStyle, opacity: 0.85, cursor: "not-allowed" }} value={formData.email || ""} />
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 600 }}>{t("me.settings.email_hint")}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={labelStyle}>{t("me.settings.given_name")}</label>
                  <input style={inputStyle} value={formData.given_name || ""} onChange={(e) => setFormData({ ...formData, given_name: e.target.value })} autoComplete="given-name" />
                </div>
                <div>
                  <label style={labelStyle}>{t("me.settings.family_name")}</label>
                  <input style={inputStyle} value={formData.family_name || ""} onChange={(e) => setFormData({ ...formData, family_name: e.target.value })} autoComplete="family-name" />
                </div>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>{t("me.settings.username")}</label>
                <input style={inputStyle} value={formData.display_name || ""} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>{t("me.settings.phone")}</label>
                <input type="tel" style={inputStyle} value={formData.phone || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} autoComplete="tel" />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>{t("me.settings.address")}</label>
                <input style={inputStyle} value={formData.address || ""} onChange={(e) => setFormData({ ...formData, address: e.target.value })} autoComplete="street-address" />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>{t("me.settings.birthdate")}</label>
                <input type="date" style={inputStyle} value={formData.birthdate ? String(formData.birthdate).slice(0, 10) : ""} onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })} />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>{t("me.settings.language")}</label>
                <select style={inputStyle} value={formData.language || "es"} onChange={(e) => setFormData({ ...formData, language: e.target.value })}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="ko">한국어 (Coreano)</option>
                  <option value="ja">日本語 (Japonés)</option>
                  <option value="zh">中文 (Chino)</option>
                  <option value="th">ไทย (Tailandés)</option>
                  <option value="id">Bahasa Indonesia</option>
                  <option value="pt">Português</option>
                  <option value="de">Deutsch</option>
                  <option value="it">Italiano</option>
                  <option value="fr">Français</option>
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>
                  {t("me.settings.theme_title")} {profile?.is_premium ? t("settings.theme_vip_active") : t("settings.theme_vip")}
                </label>
                <select
                  style={{ ...inputStyle }}
                  value={normalizeThemeId(formData.theme_preference || "pastel")}
                  onChange={async (e) => {
                    const newTheme = normalizeThemeId(e.target.value) as Profile["theme_preference"];
                    const needsUnlock =
                      isVipThemeKey(String(newTheme || "")) &&
                      !profile?.is_premium &&
                      !isAdmin;
                    if (needsUnlock) {
                      const { data: authData } = await supabase.auth.getUser();
                      const uid = authData.user?.id;
                      if (!uid) return;
                      const unlockKey = unlockKeyForTheme(String(newTheme));
                      const { data: existing } = await supabase
                        .from("user_vip_unlocks")
                        .select("id")
                        .eq("user_id", uid)
                        .eq("unlock_key", unlockKey)
                        .maybeSingle();
                      if (!existing) {
                        const cost = getThemeUnlockCost(String(newTheme));
                        const balance = Number(profile?.puntos || 0);
                        if (balance < cost) {
                          showAlert(t("common.error"), t("vip.unlock_theme_need", { cost }));
                          return;
                        }
                        const ok = await showConfirm(
                          t("shop.confirm_modal.btn_confirm"),
                          t("vip.unlock_theme_confirm", { name: t(`theme_selector.themes.${String(newTheme)}`), cost }),
                        );
                        if (!ok) return;
                        const { error: unlockErr } = await supabase
                          .from("user_vip_unlocks")
                          .upsert({ user_id: uid, unlock_key: unlockKey }, { onConflict: "user_id,unlock_key" });
                        if (unlockErr) {
                          showAlert(t("common.error"), unlockErr.message);
                          return;
                        }
                        const nextKoins = Math.max(0, balance - cost);
                        const { error: pointsErr } = await supabase
                          .from("profiles")
                          .update({ puntos: nextKoins })
                          .eq("user_id", uid);
                        if (pointsErr) {
                          showAlert(t("common.error"), pointsErr.message);
                          return;
                        }
                        setProfile((prev) => (prev ? { ...prev, puntos: nextKoins } : prev));
                      }
                    }
                    setFormData({ ...formData, theme_preference: newTheme });
                    document.documentElement.setAttribute("data-theme", newTheme || "pastel");
                    if (profile?.id) {
                      const { error } = await supabase
                        .from("profiles")
                        .update({ theme_preference: newTheme })
                        .eq("user_id", profile.id);
                      if (error && !isThemePreferenceMissingColumnError(error)) {
                        showAlert(t("common.error"), error.message);
                      }
                    }
                  }}
                >
                  <option value="pastel">{t("global.themes.pastel")}</option>
                  <option value="minimal">{t("global.themes.minimal")}</option>
                  <option value="dark">{t("global.themes.dark")}</option>
                  <option value="vibrant">{t("global.themes.vibrant")}</option>
                  <option value="k_pride">{t("global.themes.k_pride")}</option>
                  <option value="iris_bloom">{t("global.themes.iris_bloom")}</option>
                </select>
                {!profile?.is_premium && !isAdmin && (
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 600 }}>{t("me.settings.theme_vip_hint")}</p>
                )}
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>{t("me.settings.bio")}</label>
                <textarea style={{ ...inputStyle, height: "80px", resize: "none" }} value={formData.bio || ""} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} />
              </div>

              <div style={{ marginBottom: "24px", padding: "16px", borderRadius: "16px", border: "1px solid var(--color-border)", background: "var(--bg-soft)" }}>
                <label style={labelStyle}>{t("me.settings.password_change")}</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("me.settings.password_placeholder")}
                  style={inputStyle}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <button type="submit" style={{ width: "100%", marginTop: "10px", background: "var(--color-primary)", color: "white", border: "none", padding: "15px", borderRadius: "99px", fontWeight: 900, cursor: "pointer" }}>
                {t("me.settings.btn_save")}
              </button>

              <div style={{ marginTop: "30px", padding: "20px", backgroundColor: "var(--bg-soft)", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                <p style={{ ...labelStyle, color: "var(--text-main)" }}>{t("me.settings.danger_zone")}</p>
                <button type="button" onClick={handleDeleteAccount} style={{ background: "none", border: "none", color: "var(--text-muted)", textDecoration: "underline", fontWeight: 800, cursor: "pointer", fontSize: "12px" }}>
                  {t("me.settings.btn_delete_account")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ALERTAS CUSTOM */}
      {customAlert && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "24px", width: "100%", maxWidth: "400px", textAlign: "center", boxShadow: "0 20px 40px var(--shadow-card)", border: "1px solid var(--color-border)" }}>
            <h3 style={{ color: "var(--color-primary)", margin: "0 0 15px 0", fontSize: "22px", fontWeight: 900 }}>{customAlert.title}</h3>
            <p style={{ color: "var(--text-main)", fontSize: "15px", fontWeight: 600, marginBottom: "25px", lineHeight: "1.5" }}>{customAlert.message}</p>
            <button onClick={() => { if (customAlert.onClose) customAlert.onClose(); setCustomAlert(null); }} style={{ background: "var(--color-primary)", color: "white", padding: "12px 30px", borderRadius: "99px", border: "none", fontWeight: 900, cursor: "pointer", width: "100%" }}>
              {t('common.understood')}
            </button>
          </div>
        </div>
      )}

      <Footer />

      <style jsx global>{`
        @font-face { font-family: 'TanTangkiwood'; src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype'); }
        .tan-font { font-family: 'TanTangkiwood', sans-serif !important; }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const DynamicMeContent = dynamic(() => Promise.resolve({ default: MePageContent } as any), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--bg-main)" }}>
      <Loader2 className="animate-spin" size={40} color="var(--color-primary)" />
    </div>
  )
});

export default function MePage() {
  const { t } = useGlobal();
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--bg-main)" }}>
        <div style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px" }}>{t('common.loading')}</div>
      </div>
    }>
      <MePageContent />
    </Suspense>
  );
}