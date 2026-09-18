"use client";

import Footer from "../components/footer";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

import ItemPicker from "../components/ItemPicker";
import AdRailLayout from "../components/AdRailLayout";
import ImageWithExtensionFallback from "../components/ImageWithExtensionFallback";
import { useGlobal } from "../context/GlobalContext";
import { formatCollectionOptionLabel, sortCollectionEntries } from "@/lib/collection-filters";
import { getCurrencyOptions } from "../library/currencyOptions";
import {
  Search,
  Sparkles,
  ArrowRightLeft,
  MapPin,
  Loader2,
  X,
  Heart,
  Users,
  Disc3,
  Mic2,
  User,
  Layers,
  Lightbulb,
  MessageCircle,
  BookOpen,
  Send,
  Tag,
  Camera,
  BookText,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";

// Font is loaded globally via @font-face in globals.css

type MarketAd = {
  id: string;
 itemType?: "pc" | "merch"; // 👈 NUEVO
  item_id: number | string;  // 👈 Cambia a number | string (porque el merch usa UUID)
  type: "wtt" | "wts";
  user_id: string;
  username: string;
  avatar_url: string;
  country: string;
  pcImage: string;
  pcName: string;
  group_id: number | null;
  group_name: string | null; // 👈 AÑADE ESTA LÍNEA
  album_id: number | null;
  version: string;
  member: string;
  category: string;
  price?: number;
  currency?: string;
  target_wtt_id?: number | string; // 👈 Añade el | string para el merch
  time: string;
  shippingTo?: string;
  negotiable?: boolean;
  comment?: string;
  /** Merch WTS optional K-oins asking price */
  price_koins?: number | null;
};

type TargetInfo = {
  image_url: string;
  name: string;
  member: string;
  group_id: number | null;
  album_id: number | null;
  version: string;
  category?: string; // 👈 ESTO ES LO NUEVO
  itemType?: "pc" | "merch"; // 👈 Para saber si pintar álbum o categoría
};

// Utilidad para poner nombres bonitos sin romper paréntesis
const formatPrettyName = (name: string | null | undefined) => {
  if (!name) return "";
  const noDashes = name.replace(/[-_]/g, " ");
  return noDashes.replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
};

/** Acentos por tema (ver --accent-vibe-* en globals.css) */
const ACC = {
  pink: "var(--accent-vibe-pink)",
  purple: "var(--accent-vibe-purple)",
  cyan: "var(--accent-vibe-cyan)",
  green: "var(--accent-vibe-green)",
  orange: "var(--accent-vibe-orange)",
} as const;

const ghostMarketBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid transparent",
  padding: "10px",
  borderRadius: "8px",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
};

const unitTypeFromMember = (
  memberRaw: string | null | undefined
): "single" | "unit" | "ot8" => {
  let lower = String(memberRaw ?? "").toLowerCase().trim();
  if (!lower || lower === "-") return "single";
  if (/\bot8\b/.test(lower) || lower.includes("all")) return "ot8";
  if (
    lower.includes("+") ||
    lower.includes("/") ||
    lower.includes("&") ||
    lower.includes(",")
  )
    return "unit";
  lower = lower
    .replace(/\blee know\b/g, "leeknow")
    .replace(/\bbang chan\b/g, "bangchan")
    .replace(/\bi\.?n\b/g, "in");
  if (lower.split(/\s+/).filter(Boolean).length > 1) return "unit";
  return "single";
};

const normalizeMemberKey = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const splitMemberNames = (memberRaw: string | null | undefined): string[] => {
  if (!memberRaw) return [];
  const normalized = memberRaw
    .replace(/[+\/]/g, ",")
    .replace(/\s+&\s+/gi, ",")
    .replace(/\s+y\s+/gi, ",")
    .replace(/\s+and\s+/gi, ",")
    .trim();
  const parts = normalized
    .split(",")
    .map((part) => formatPrettyName(part.trim()))
    .filter(Boolean);
  if (parts.length > 0) return parts;
  return [formatPrettyName(memberRaw.trim())].filter(Boolean);
};

const formatMemberLabel = (raw: string) => {
  const cleaned = raw.trim();
  const normalized = normalizeMemberKey(cleaned);
  if (normalized === "in") return "I.N";
  return formatPrettyName(cleaned);
};

const extractMemberNames = (
  memberRaw: string | null | undefined,
  knownSingles: string[]
): string[] => {
  if (!memberRaw) return [];
  const direct = splitMemberNames(memberRaw).map(formatMemberLabel).filter(Boolean);

  // If we already split by explicit separators, keep that.
  if (direct.length > 1) {
    return Array.from(new Set(direct.map((m) => m.trim()).filter(Boolean)));
  }

  const one = direct[0] || "";
  const oneNorm = normalizeMemberKey(one);
  const knownByNorm = new Map(knownSingles.map((name) => [normalizeMemberKey(name), formatMemberLabel(name)]));
  if (knownByNorm.has(oneNorm)) return [knownByNorm.get(oneNorm)!];

  // Fallback for units without clear separators, e.g. "Hyunjin Changbin"
  // Use token-based matching to avoid false positives (e.g. "Hyunjin" matching "I.N").
  const knownMap = new Map(knownSingles.map((name) => [normalizeMemberKey(name), formatMemberLabel(name)]));
  const tokenBase = memberRaw
    .toLowerCase()
    .replace(/[-_/+&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = tokenBase
    .split(" ")
    .map((t) => normalizeMemberKey(t))
    .filter(Boolean);

  const found = new Map<string, string>();
  for (let i = 0; i < tokens.length; i++) {
    const single = tokens[i];
    if (knownMap.has(single)) found.set(single, knownMap.get(single)!);
    if (i + 1 < tokens.length) {
      const pair = `${tokens[i]}${tokens[i + 1]}`;
      if (knownMap.has(pair)) {
        found.set(pair, knownMap.get(pair)!);
        i += 1;
      }
    }
  }
  if (found.size > 0) return Array.from(found.values());

  return one ? [formatMemberLabel(one)] : [];
};

const MEMBER_ORDER = [
  "bangchan",
  "leeknow",
  "changbin",
  "hyunjin",
  "han",
  "felix",
  "seungmin",
  "in",
] as const;

const memberOrderIndex = (name: string) => {
  const idx = MEMBER_ORDER.indexOf(normalizeMemberKey(name) as (typeof MEMBER_ORDER)[number]);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
};

const memberKeysFromRaw = (memberRaw: string | null | undefined, knownSingles: string[]) => {
  const keys = new Set<string>();
  extractMemberNames(memberRaw, knownSingles).forEach((name) => {
    const key = normalizeMemberKey(name);
    if (key) keys.add(key);
  });
  const raw = String(memberRaw || "").trim();
  const rawKey = normalizeMemberKey(raw);
  if (rawKey) keys.add(rawKey);
  return keys;
};

const PriceConverter = ({
  price,
  currency,
  negotiable,
}: {
  price: number;
  currency: string;
  negotiable?: boolean;
}) => {
  const { t, profile } = useGlobal();
  const [targetCurrency, setTargetCurrency] = useState(currency);
  const [convertedPrice, setConvertedPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const currencyOptions = useMemo(
    () => getCurrencyOptions(profile?.language ?? "es"),
    [profile?.language],
  );

  useEffect(() => {
    if (targetCurrency === currency) {
      setConvertedPrice(price);
      return;
    }
    let isMounted = true;
    const fetchRate = async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`);
        const data = await res.json();
        if (isMounted && data.rates && data.rates[targetCurrency]) {
          setConvertedPrice(price * data.rates[targetCurrency]);
        }
      } catch (e) {
        console.error("Error FX:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchRate();
    return () => {
      isMounted = false;
    };
  }, [price, currency, targetCurrency]);

  return (
    <div
      style={{
        backgroundColor: "var(--bg-soft)",
        padding: "8px",
        borderRadius: "10px",
        border: "1px dashed var(--color-primary)",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          fontSize: "9px",
          fontWeight: 900,
          color: "var(--color-primary)",
          lineHeight: 1,
        }}
      >
        {t("market.price_label")}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "4px",
        }}
      >
        {loading ? (
          <Loader2 size={14} className="spinner" color="var(--color-primary)" />
        ) : (
          <span
            style={{
              fontSize: "15px",
              fontWeight: 950,
              color: "var(--color-primary)",
              lineHeight: 1,
            }}
          >
            {convertedPrice !== null ? convertedPrice.toFixed(2) : price}
          </span>
        )}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <select
            value={targetCurrency}
            onChange={(e) => setTargetCurrency(e.target.value)}
            style={{
              fontSize: "10px",
              padding: "3px 18px 3px 6px",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              outline: "none",
              color: "var(--color-primary)",
              fontWeight: 900,
              background: "var(--bg-card)",
              cursor: "pointer",
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
              width: "74px",
            }}
          >
            {!currencyOptions.some((c) => c.code === targetCurrency) ? (
              <option value={targetCurrency}>{targetCurrency}</option>
            ) : null}
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            color="var(--color-primary)"
            style={{
              position: "absolute",
              right: "5px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
      {(targetCurrency !== currency || negotiable) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "2px",
          }}
        >
          {targetCurrency !== currency ? (
            <span style={{ fontSize: "8px", color: "var(--text-muted)", fontWeight: 800 }}>
              (Orig: {price}{currency})
            </span>
          ) : (
            <span />
          )}
          {negotiable && (
            <span style={{ fontSize: "8px", color: "var(--color-primary)", fontWeight: 800 }}>
              {t("market.negotiable_label")}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

function MarketContent() {
  const router = useRouter();
  const { t } = useGlobal(); // 👈 AÑADE ESTA LÍNEA AQUÍ
  const searchParams = useSearchParams();
 

  // Ahora, en todos tus supabase.from(...).select(...).eq('user_id', ...)
  // USA targetUserId en lugar de currentUserId.

  const [tab, setTab] = useState<"wtt" | "wts">("wtt");
  const [search, setSearch] = useState("");
  const [searchMode, setSearchMode] = useState<"offered" | "wanted">("offered");
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [showCompactFilters, setShowCompactFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterRefreshTick, setFilterRefreshTick] = useState(0);

  useEffect(() => {
    const urlTab = searchParams.get("tab");
    const urlItem = searchParams.get("item");

    if (urlTab === "wtt" || urlTab === "wts") {
      setTab(urlTab);
    }

    if (urlItem) {
      setSearch(urlItem);
    }
  }, [searchParams]);

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
  const [profileActivity, setProfileActivity] = useState<any[]>([]);
const [fItemType, setFItemType] = useState<"all" | "pc" | "merch">("all");
  const [fCategory, setFCategory] = useState("all");
  const [fGroup, setFGroup] = useState<string | "all">("all");
  const [fAlbum, setFAlbum] = useState<string>("all");
  const [fVersion, setFVersion] = useState<string | "all">("all");
  const [fMember, setFMember] = useState<string | "all">("all");
  const [fUnit, setFUnit] = useState<string | "all">("all");
  const [myKoins, setMyKoins] = useState(0); // Para saber si tiene fondos
  // Variables para la "Muñeca Rusa" del Merch
  const [fMerchRelation, setFMerchRelation] = useState("all");
  const [fMerchEvent, setFMerchEvent] = useState("all");
  const [fMerchTour, setFMerchTour] = useState("all");
  const [showPublicProfile, setShowPublicProfile] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [profileAds, setProfileAds] = useState<any[]>([]); // Para mostrar sus otros anuncios
 

  const [ads, setAds] = useState<MarketAd[]>([]);
  const [wttTargets, setWttTargets] = useState<Record<string | number, TargetInfo>>({});
  const [groupDict, setGroupDict] = useState<Record<string | number, string>>({});
  const [albumDict, setAlbumDict] = useState<Record<string | number, string>>({});
const [profileBiases, setProfileBiases] = useState<string[]>([]);
  const [profileFollowers, setProfileFollowers] = useState(0);
  const [profileFollowing, setProfileFollowing] = useState(0);
  const [isFollowingProfile, setIsFollowingProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isPickingItem, setIsPickingItem] = useState(false);
  const [pickerAllowedTypes, setPickerAllowedTypes] = useState<Array<"pc" | "merch">>(["pc", "merch"]);
const [offeredItems, setOfferedItems] = useState<any[]>([]);
const [currentUserId, setCurrentUserId] = useState<string | null>(null); // Para saber de quién es el binder

// Recuperamos el ID del usuario actual y su saldo de K-oins (Puntos)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data?.user) {
        setCurrentUserId(data.user.id);
        
        // 🛠️ CORREGIDO: Buscamos por "user_id" en vez de "id"
        const { data: profile } = await supabase
          .from("profiles")
          .select("puntos")
          .eq("user_id", data.user.id) 
          .single();
          
        if (profile) setMyKoins(profile.puntos || 0);
      }
    });
  }, []);
  const [selectedAd, setSelectedAd] = useState<MarketAd | null>(null);
  /** Vista rápida al abrir el mercado desde una notificación (anuncio concreto). */
  const [showDeepLinkPeek, setShowDeepLinkPeek] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactFlow, setContactFlow] = useState<"wtt_trade" | "wts_buy">("wtt_trade");
  const [offerPrice, setOfferPrice] = useState("");
  const [contactMessage, setContactMessage] = useState("");
// Memorias para el WTT y K-oins
  const [offerKoins, setOfferKoins] = useState(false);
  const [koinsAmount, setKoinsAmount] = useState("");
  const [msgImage, setMsgImage] = useState<File | null>(null);
  const [msgImagePreview, setMsgImagePreview] = useState<string | null>(null);
  const [isUploadingMsg, setIsUploadingMsg] = useState(false);
  // Notificación flotante bonita
  const [showToast, setShowToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
   const fetchMarketplace = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      setCurrentUserId(userData.user?.id || null);

      const { data: gData } = await supabase.from("groups").select("id, name");
      const gMap: Record<string | number, string> = {};
      gData?.forEach((g) => (gMap[g.id] = g.name));
      setGroupDict(gMap);

      const { data: aData } = await supabase.from("albums").select("id, name");
      const aMap: Record<string | number, string> = {};
      aData?.forEach((a) => (aMap[a.id] = a.name));
      setAlbumDict(aMap);
  // ⚠️ ¡ATENCIÓN! ESTAS TRES VARIABLES TIENEN QUE ESTAR AQUÍ ARRIBA ⚠️
      const expandedAds: MarketAd[] = [];
      const targetPcIdsToFetch = new Set<number>();
      const targetMerchIdsToFetch = new Set<string>();

      // 1. CARGAMOS PHOTOCARDS
      const { data: pcData } = await supabase
        .from("user_item_statuses")
        .select('id, status, price, currency, origin_country, shipping_to, wts_negotiable, market_comment, wtt_ids, updated_at, user_id, item: items(id, name, image_url, member, version, group_id, album_id), profiles (display_name, avatar_url, is_restricted)')
        .in("status", ["wts", "wtt"]) // <-- RECUPERAMOS ESTE FILTRO VITAL
        .order("updated_at", { ascending: false });

      if (pcData) {
        pcData.forEach((row: any) => {
          const profile = row.profiles || {};
          if (profile.is_restricted) return; // Si está restringido, saltamos este anuncio
          
          const baseAd: MarketAd = { 
            id: `pc-${row.id}`, itemType: "pc", item_id: row.item?.id || row.item_id, type: row.status,
            user_id: row.user_id, username: profile.display_name || t("global.default_user_name"), avatar_url: profile.avatar_url || "https://ui-avatars.com/api/?name=U",
            country: row.origin_country || "España", pcImage: row.item?.image_url || "/mock-pcs/groups/not-available.png", pcName: row.item?.name || t("common.photocard"),
            group_id: row.item?.group_id || null, group_name: null, album_id: row.item?.album_id || null, version: row.item?.version || "", member: row.item?.member || "",
            category: t("common.photocard"), price: row.price || 0, currency: row.currency || "EUR", time: new Date(row.updated_at || Date.now()).toLocaleDateString(),
            shippingTo: row.shipping_to || t("countries.worldwide"), negotiable: row.wts_negotiable || false, comment: row.market_comment || ""
          };

          if (row.status === "wtt" && row.wtt_ids && row.wtt_ids.length > 0) {
            row.wtt_ids.forEach((targetId: number) => {
              targetPcIdsToFetch.add(targetId);
              expandedAds.push({ ...baseAd, id: `pc-${row.id}-${targetId}`, target_wtt_id: targetId });
            });
          } else { expandedAds.push(baseAd); }
        });
      }

      // 2. CARGAMOS MERCHANDISING
      const { data: merchData } = await supabase
        .from("user_merch_statuses")
        .select('id, status, price, currency, comment, wtt_ids, price_koins, updated_at, user_id, merch:merch_items(id, name, category, group_name, image_url, rarity), profiles(display_name, avatar_url, is_restricted)')
        .in("status", ["wts", "wtt"]) // <-- RECUPERAMOS ESTE FILTRO VITAL
        .order("updated_at", { ascending: false });

      if (merchData) {
        merchData.forEach((row: any) => {
          const profile = row.profiles || {};
          if (profile.is_restricted) return; // Si está restringido, no lo mostramos
          
          const merch = row.merch || {};
          const baseAd: MarketAd = { 
            id: `merch-${row.id}`, itemType: "merch", item_id: merch.id || 0, type: row.status,
            user_id: row.user_id, username: profile.display_name || t("global.default_user_name"), avatar_url: profile.avatar_url || "https://ui-avatars.com/api/?name=U",
            country: t("countries.worldwide"), pcImage: merch.image_url || "/mock-pcs/groups/not-available.png", pcName: merch.name || "Merch Oficial",
            group_id: null, group_name: merch.group_name || "", album_id: null, version: merch.rarity || "", member: "",
            category: merch.category || "Merch", price: row.price || 0, currency: row.currency || "EUR", time: new Date(row.updated_at || Date.now()).toLocaleDateString(),
            shippingTo: t("countries.worldwide"), negotiable: false, comment: row.comment || "",
            price_koins: row.price_koins != null ? Number(row.price_koins) : null,
          };

          if (row.status === "wtt" && row.wtt_ids && row.wtt_ids.length > 0) {
            row.wtt_ids.forEach((targetId: string) => {
              targetMerchIdsToFetch.add(targetId);
              expandedAds.push({ ...baseAd, id: `merch-${row.id}-${targetId}`, target_wtt_id: targetId });
            });
          } else { expandedAds.push(baseAd); }
        });
      }

      expandedAds.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setAds(expandedAds);

      const tMap: Record<string | number, TargetInfo> = {};

      if (targetPcIdsToFetch.size > 0) {
        const { data: pcTargets } = await supabase.from("items").select("id, name, member, image_url, group_id, album_id, version").in("id", Array.from(targetPcIdsToFetch));
        pcTargets?.forEach(t => {
          tMap[t.id] = { itemType: "pc", image_url: t.image_url, name: t.name || "Photocard", member: t.member || "", group_id: t.group_id, album_id: t.album_id, version: t.version || "", category: "Photocard" };
        });
      }

      if (targetMerchIdsToFetch.size > 0) {
        const { data: merchTargets } = await supabase.from("merch_items").select("id, name, category, group_name, image_url, rarity").in("id", Array.from(targetMerchIdsToFetch));
        merchTargets?.forEach(t => {
          tMap[t.id] = { itemType: "merch", image_url: t.image_url, name: t.name || "Merch", member: t.group_name || "", group_id: null, album_id: null, version: t.rarity || "", category: t.category };
        });
      }
      
     setWttTargets(tMap);
      setLoading(false);
    };
    
    fetchMarketplace(); // 👈 ¡EL BOTÓN DE ENCENDIDO QUE ME COMÍ!
  }, []);
  
  const knownSingleMembers = useMemo(() => {
    const singleMap = new Map<string, string>();
    const collectSingle = (raw: string | null | undefined) => {
      if (!raw) return;
      if (unitTypeFromMember(raw) !== "single") return;
      const label = formatMemberLabel(raw);
      const key = normalizeMemberKey(label);
      if (key && !singleMap.has(key)) singleMap.set(key, label);
    };
    ads.forEach((ad) => {
      collectSingle(ad.member);
      if (ad.target_wtt_id && wttTargets[ad.target_wtt_id]?.member) collectSingle(wttTargets[ad.target_wtt_id].member);
    });
    return Array.from(singleMap.values());
  }, [ads, wttTargets]);


  const filteredAds = ads.filter((ad) => {
    if (ad.type !== tab) return false;

    const isWanted = searchMode === "wanted" && tab === "wtt";
    const targetItem = ad.target_wtt_id ? wttTargets[ad.target_wtt_id] : null;
    const refItem = isWanted ? targetItem : ad;
    const hasStrictFilters =
      fItemType !== "all" ||
      fGroup !== "all" ||
      fCategory !== "all" ||
      fAlbum !== "all" ||
      fVersion !== "all" ||
      fUnit !== "all" ||
      fMember !== "all";

    // In "wanted" mode, if ad has no explicit target, only show it when no strict filter is active.
    if (!refItem) return !hasStrictFilters;

    const refItemType = (refItem as any).itemType || ad.itemType || "pc";

    if (fItemType !== "all" && refItemType !== fItemType) return false;

    const refGroupName = refItemType === "pc" ? groupDict[refItem.group_id as number] : refItem.member; // En merch usamos member para el grupo
    if (fGroup !== "all" && refGroupName !== fGroup) return false;
    if (fCategory !== "all" && refItem.category !== fCategory) return false;

    if (refItemType !== "merch") {
      if (fAlbum !== "all" && String(refItem.album_id) !== fAlbum) return false;
      if (fVersion !== "all" && refItem.version !== fVersion) return false;
      if (fUnit !== "all" && unitTypeFromMember(refItem.member) !== fUnit) return false;
    }

    if (fMember !== "all") {
      const memberSource = String(refItem.member || "");
      const candidateKeys = memberKeysFromRaw(memberSource, knownSingleMembers);
      const selectedKey = normalizeMemberKey(String(fMember));
      if (!selectedKey) return false;
      if (candidateKeys.size === 0) return false;
      if (!candidateKeys.has(selectedKey)) return false;
    }

    const q = search.toLowerCase();
    if (q) {
      const itemName = "pcName" in refItem ? refItem.pcName : (refItem as any).name;
      const hay = `${itemName} ${refItem.member} ${refItem.version} ${refGroupName} ${refItem.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const highlightParam = searchParams.get("highlight");
  const sellerParam = searchParams.get("seller");
  const pcItemParam = searchParams.get("pcItem");
  const pendingMarketAdScrollRef = useRef<string | null>(null);
  const deepLinkConsumedKeyRef = useRef<string | null>(null);

  const clearMarketDeepLinkQuery = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("highlight");
    p.delete("seller");
    p.delete("pcItem");
    const qs = p.toString();
    router.replace(qs ? `/market?${qs}` : "/market", { scroll: false });
  }, [router, searchParams]);

  const closeDeepLinkPeek = useCallback(() => {
    setShowDeepLinkPeek(false);
    clearMarketDeepLinkQuery();
  }, [clearMarketDeepLinkQuery]);

  useEffect(() => {
    if (loading || ads.length === 0) return;
    const hasDeepLink =
      Boolean(highlightParam?.length) ||
      Boolean(sellerParam && pcItemParam?.length);
    const urlKey = `${highlightParam ?? ""}|${sellerParam ?? ""}|${pcItemParam ?? ""}`;
    if (!hasDeepLink) {
      deepLinkConsumedKeyRef.current = null;
      return;
    }
    if (deepLinkConsumedKeyRef.current === urlKey) return;

    const h = highlightParam ? decodeURIComponent(highlightParam) : "";
    let match: MarketAd | undefined;
    if (h) {
      match = ads.find((a) => a.id === h || a.id.startsWith(`${h}-`));
    } else if (sellerParam && pcItemParam) {
      const itemNum = Number(pcItemParam);
      if (Number.isFinite(itemNum)) {
        match = ads.find((a) => a.user_id === sellerParam && Number(a.item_id) === itemNum);
      }
    }
    if (!match) return;

    deepLinkConsumedKeyRef.current = urlKey;
    pendingMarketAdScrollRef.current = match.id;
    setTab(match.type);
    setSearchMode("offered");
    setSearch("");
    setFItemType(match.itemType === "merch" ? "merch" : "pc");
    setFCategory("all");
    setFGroup("all");
    setFAlbum("all");
    setFVersion("all");
    setFMember("all");
    setFUnit("all");
    setFMerchRelation("all");
    setFMerchEvent("all");
    setFMerchTour("all");
  }, [loading, ads, highlightParam, sellerParam, pcItemParam]);

  useEffect(() => {
    const id = pendingMarketAdScrollRef.current;
    if (!id || loading) return;
    const ad = filteredAds.find((a) => a.id === id);
    if (!ad) return;
    pendingMarketAdScrollRef.current = null;
    setSelectedAd(ad);
    setShowDeepLinkPeek(true);
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        const el = document.querySelector(`[data-market-ad-id="${CSS.escape(id)}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.classList.add("market-ad-highlight-flash");
        window.setTimeout(() => el?.classList.remove("market-ad-highlight-flash"), 2200);
      }, 80);
    });
  }, [filteredAds, loading]);

  useEffect(() => {
    if (!showDeepLinkPeek) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDeepLinkPeek();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [showDeepLinkPeek, closeDeepLinkPeek]);

 const targetUserId = searchParams.get('u') || currentUserId; // 👈 Si hay un 'u' en la URL, usamos ese. Si no, el tuyo.
  const availableGroups = useMemo(
    () => Array.from(new Set(ads.map((a) => a.group_id).filter(Boolean))),
    [ads]
  );

  const availableAlbums = useMemo(
    () => {
      const ids = Array.from(
        new Set(
          ads
            .filter((a) => fGroup === "all" || groupDict[a.group_id as number] === fGroup)
            .map((a) => a.album_id)
            .filter(Boolean)
        )
      ) as number[];

      const sorted = sortCollectionEntries(
        ids.map((id) => ({
          id,
          name: albumDict[id] || `Álbum ${id}`,
          releaseDate: null,
        })),
        { groupName: fGroup === "all" ? null : fGroup },
      );
      return sorted.map((x) => x.id);
    },
    [ads, fGroup, groupDict, albumDict]
  );

  const availableVersions = useMemo(
    () =>
      Array.from(
        new Set(
          ads
            .filter(
              (a) =>
                (fGroup === "all" || groupDict[a.group_id as number] === fGroup) &&
                (fAlbum === "all" || String(a.album_id) === fAlbum)
            )
            .map((a) => a.version)
            .filter((v) => v && v.trim() !== "")
        )
      ),
    [ads, fGroup, fAlbum, groupDict]
  );

  const availableMembers = useMemo(() => {
    const mems = new Map<string, string>();
    const collectAny = (raw: string | null | undefined) => {
      extractMemberNames(raw, knownSingleMembers).forEach((member) => {
        const key = normalizeMemberKey(member);
        if (key && !mems.has(key)) mems.set(key, member);
      });
    };
    ads.forEach((ad) => {
      collectAny(ad.member);
      if (ad.target_wtt_id && wttTargets[ad.target_wtt_id]?.member) collectAny(wttTargets[ad.target_wtt_id].member);
    });
    return Array.from(mems.values())
      .filter(Boolean)
      .sort((a, b) => {
        const orderA = memberOrderIndex(a);
        const orderB = memberOrderIndex(b);
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b);
      });
  }, [ads, wttTargets, knownSingleMembers]);

  const handleBuy = (adId: string) => {
    const ad = ads.find((item) => item.id === adId);
    if (!ad) return;
    if (!currentUserId) return alert(t("market.alerts.login_contact"));
    setContactFlow("wts_buy");
    setSelectedAd(ad);
    setContactMessage("");
    setShowContactModal(true);
  };

 
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--color-primary)",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  };

  const selectStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--color-border)", // 👈 Cambiado
    background: "var(--bg-card)",            // 👈 Cambiado
    color: "var(--text-main)",
    outline: "none",
    width: "100%",
    fontSize: 13,
  };
 const openContact = (ad: MarketAd) => {
    if (!currentUserId) return alert(t("market.alerts.login_contact"));
    setContactFlow("wtt_trade");
    setSelectedAd(ad);
    setShowContactModal(true);
    setMsgImage(null);
    setMsgImagePreview(null);
  };

  const openOffer = (ad: MarketAd) => {
    if (!currentUserId) return alert(t("market.alerts.login_offer"));
    setSelectedAd(ad);
    setOfferPrice("");
    setOfferKoins(false);
    setKoinsAmount("");
    setOfferedItems([]);
    setContactMessage("");
    setShowOfferModal(true);
    setMsgImage(null);
    setMsgImagePreview(null);
  };

  const clearAllFilters = () => {
    setFCategory("all");
    setFGroup("all");
    setFAlbum("all");
    setFVersion("all");
    setFMember("all");
    setFUnit("all");
    setFMerchRelation("all");
    setFMerchEvent("all");
    setFMerchTour("all");
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsgImage(file);
    const url = URL.createObjectURL(file);
    setMsgImagePreview(url);
  };
const openPublicProfile = async (userId: string) => {
    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", userId).single();

    if (profile) {
      setSelectedProfile(profile);
      setProfileAds(ads.filter(a => a.user_id === userId));

      
      // 2. Buscar sus BIAS reales (usando tu tabla user_biases y members)
      const { data: biasesData } = await supabase
        .from('user_biases')
        .select('members(name)')
        .eq('user_id', userId);
        
      const biasNames = biasesData ? biasesData.map((b: any) => b.members?.name).filter(Boolean) : [];
      setProfileBiases(biasNames);

      // 3. Buscar cuántos SEGUIDORES tiene (quién le tiene en favoritos)
      const { count: followersCount } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);
      setProfileFollowers(followersCount || 0);

      // 4. Buscar a cuántos SIGUE
      const { count: followingCount } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);
      setProfileFollowing(followingCount || 0);

      // 5. ¿TÚ le tienes en favoritos ya?
      if (currentUserId) {
        const { data: fav } = await supabase
          .from('user_favorites')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', userId)
          .maybeSingle(); // Usamos maybeSingle para que no dé error si no hay
        setIsFollowingProfile(!!fav);
      }

      setShowPublicProfile(true);
    }
  };
 const handleSendMessage = async (type: string, messageContent: string) => {
  if (!currentUserId || !selectedAd) return;

  setIsUploadingMsg(true);
  try {
    let finalImgUrl = null;
    if (msgImage) {
      const fileExt = msgImage.name.split(".").pop();
      const fileName = `${currentUserId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, msgImage);

      if (!uploadError) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        finalImgUrl = data.publicUrl;
      } else {
        console.error("Error subiendo foto:", uploadError);
        setShowToast("Error al subir la foto adjunta");
        return;
      }
    }

    // 🚀 LA INSERCIÓN CORREGIDA (Solo las columnas que existen en tu base de datos)
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: selectedAd.user_id,
      sender_id: currentUserId,
      type: type,
      content: messageContent,
      image_url: finalImgUrl,
      is_read: false // 👈 ¡Ya podemos volver a ponerlo!
    });

    if (notifError) throw notifError;

    // CERRAMOS MODALES Y LIMPIAMOS TODAS LAS MEMORIAS
    setShowContactModal(false);
    setShowOfferModal(false);
    setOfferedItems([]);
    setOfferKoins(false);
    setKoinsAmount("");
    setContactMessage("");
    setOfferPrice("");
    setMsgImage(null);
    setMsgImagePreview(null);

    // TOAST BONITO
    setShowToast(type === "wtt_message" ? "¡Propuesta de tradeo enviada!" : "¡Oferta enviada!");
    setTimeout(() => setShowToast(null), 3000);

  } catch (error) {
    console.error("Error al enviar:", error);
    setShowToast("Error al enviar la propuesta.");
  } finally {
    setIsUploadingMsg(false);
  }
};

  return (
    <div
      className="market-root"
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-main)",
        display: "flex",
        flexDirection: "column",
        color: "var(--text-main)",
      }}
    >
      <AdRailLayout section="market">
      <main
        className="market-main"
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "40px 20px",
        }}
      >
          <div style={{ ["--color-primary"]: "var(--nav-market)" } as React.CSSProperties}>
          <div className="market-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px", flexWrap: "wrap", gap: "20px" }}>
         <div style={{ maxWidth: "600px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <Sparkles size={28} color="var(--nav-market, var(--color-primary))" />
              <h1
                style={{
                  fontSize: "36px",
                  color: "var(--nav-market, var(--color-primary))",
                  margin: 0,
                  fontFamily: "'Tan-Font', sans-serif",
                }}
              >
                {t("market.title")}
              </h1>
            </div>
            <p
              style={{
                color: "var(--text-muted)",
                fontWeight: 700,
                fontSize: "14px",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {t("market.subtitle")}
              <br />
              <span
                role="note"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  width: "100%",
                  maxWidth: "640px",
                  boxSizing: "border-box",
                  marginTop: "12px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: "1px solid color-mix(in srgb, #fd971f 55%, var(--color-border))",
                  borderLeftWidth: "4px",
                  borderLeftColor: "#fd971f",
                  background:
                    "color-mix(in srgb, #fd971f 14%, var(--bg-soft))",
                  boxShadow: "0 4px 18px color-mix(in srgb, #fd971f 12%, transparent)",
                }}
              >
                <Lightbulb
                  size={20}
                  color="#fd971f"
                  strokeWidth={2.25}
                  style={{ flexShrink: 0, marginTop: "1px" }}
                  aria-hidden
                />
                <span
                  style={{
                    color: "var(--text-main)",
                    fontWeight: 800,
                    fontSize: "13px",
                    lineHeight: 1.55,
                    letterSpacing: "0.01em",
                  }}
                >
                  {t("market.info_hint")}
                </span>
              </span>
            </p>
          </div>

         <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {tab === "wtt" && (
              <select
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as any)}
                style={{
                  padding: "10px 14px",
                  borderRadius: "12px",
                  border: "1px solid var(--color-border)", // 👈 Antes var(--color-border)
                  color: "var(--color-primary)",
                  fontWeight: 900,
                  outline: "none",
                  cursor: "pointer",
                  background: "var(--bg-card)", // 👈 Antes white
                  fontSize: "13px",
                }}
              >
                <option value="offered">{t("market.offered")}</option>
                <option value="wanted">{t("market.wanted")}</option>
              </select>
            )}

            <div style={{ position: "relative" }}>
              <Search
                size={16}
                color="var(--color-primary)"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <input
                type="text"
                placeholder={t("market.search_placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: "10px 16px 10px 36px",
                  borderRadius: "12px",
                  border: "1px solid var(--color-border)", // 👈 Antes var(--color-border)
                  background: "var(--bg-card)", // 👈 AÑADIDO
                  color: "var(--text-main)",    // 👈 AÑADIDO
                  outline: "none",
                  width: "200px",
                  fontSize: "13px",
                }}
              />
            </div>
          </div>
        </div>

       {/* ========================================= */}
          {/* INICIO DE LOS FILTROS                     */}
          {/* ========================================= */}
          <div style={{ marginBottom: "30px" }}>
            {isCompactViewport && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button onClick={() => setShowCompactFilters((v) => !v)} style={{ border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--color-primary)", borderRadius: "99px", padding: "10px 14px", fontWeight: 900, cursor: "pointer" }}>
                  {showCompactFilters ? (t("common.close") || "Cerrar") : (t("common.filters") || "Filtros")}
                </button>
              </div>
            )}
            <div style={{ display: !isCompactViewport || showCompactFilters ? "block" : "none" }} className="page-filters-panel">
            
            {/* --- 1. FILTRO MAESTRO: BOTONES TIPO PÍLDORA FUERA DE LA CAJA --- */}
            <div style={{ display: "flex", gap: "10px", marginBottom: fItemType === "all" ? "0" : "16px", flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setFItemType("all");
                  setFilterRefreshTick((v) => v + 1);
                }}
                style={{ padding: "8px 18px", borderRadius: "20px", border: "1px solid var(--color-border)", background: fItemType === "all" ? "var(--color-primary)" : "var(--bg-soft)", color: fItemType === "all" ? "white" : "var(--color-primary)", fontWeight: 800, cursor: "pointer", transition: "all 0.2s" }}
              >
                {t("market.filter_all")}
              </button>
              <button
                onClick={() => {
                  setFItemType("pc");
                  setFilterRefreshTick((v) => v + 1);
                }}
                style={{ padding: "8px 18px", borderRadius: "20px", border: "1px solid var(--color-border)", background: fItemType === "pc" ? "var(--color-primary)" : "var(--bg-soft)", color: fItemType === "pc" ? "white" : "var(--color-primary)", fontWeight: 800, cursor: "pointer", transition: "all 0.2s" }}
              >
                {t("market.filter_pc")}
              </button>
              <button
                onClick={() => {
                  setFItemType("merch");
                  setFilterRefreshTick((v) => v + 1);
                }}
                style={{ padding: "8px 18px", borderRadius: "20px", border: "1px solid var(--color-border)", background: fItemType === "merch" ? "var(--color-primary)" : "var(--bg-soft)", color: fItemType === "merch" ? "white" : "var(--color-primary)", fontWeight: 800, cursor: "pointer", transition: "all 0.2s" }}
              >
                {t("market.filter_merch")}
              </button>
              <button
                onClick={() => setShowAdvancedFilters((v) => !v)}
                style={{
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 14px",
                  borderRadius: "20px",
                  border: "1px solid var(--color-border)",
                  background: showAdvancedFilters ? "var(--color-primary)" : "var(--bg-card)",
                  color: showAdvancedFilters ? "white" : "var(--color-primary)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                <SlidersHorizontal size={14} />
                {showAdvancedFilters ? t("common.close") : t("market.filters")}
              </button>
              <button
                onClick={() => clearAllFilters()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 14px",
                  borderRadius: "20px",
                  border: "1px solid var(--color-border)",
                  background: "var(--bg-card)",
                  color: "var(--text-muted)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {t("market.clear_filters_action")}
              </button>
            </div>

           {/* --- 2. CAJA DE SUB-FILTROS --- */}
            {showAdvancedFilters && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                  background: "var(--bg-soft)", // 👈 Antes var(--bg-soft)
                  padding: 16,
                  borderRadius: 16,
                  border: "1px solid var(--color-border)", // 👈 Antes var(--color-border)
                  boxShadow: "0 4px 12px var(--shadow-card)", // 👈 Sombra dinámica
                }}
              >
                {/* ======================================================== */}
                {/* --- BLOQUE A: CONTENIDO DE ÁLBUM --- */}
                {/* ======================================================== */}
                {(fItemType === "pc" || fItemType === "all") && (
                  <>
                    {fItemType === "all" && (
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          fontSize: "12px",
                          fontWeight: 900,
                          color: "var(--color-primary)",
                          paddingBottom: "2px",
                        }}
                      >
                        {t("market.filter_pc")}
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label style={labelStyle}><Layers size={14} strokeWidth={2.4} /> {t("market.label_category")}</label>
                      <select value={fCategory} onChange={(e) => setFCategory(e.target.value)} style={selectStyle}>
                        <option value="all">{t("market.all_fem")}</option>
                        <option value="Photocard">{t("market.cat_pc")}</option>
                        <option value="Inclusion">{t("market.cat_inclusion")}</option>
                        <option value="Album">{t("market.cat_album")}</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label style={labelStyle}><Users size={14} strokeWidth={2.4} /> {t("market.label_group")}</label>
                      <select value={fGroup} onChange={(e) => setFGroup(e.target.value)} style={selectStyle}>
                        <option value="all">{t("market.all_masc")}</option>
                        {availableGroups.map((gid) => (
                          <option key={gid as number} value={String(gid)}>{groupDict[gid as number] || `Grupo ${gid}`}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label style={labelStyle}><Disc3 size={14} strokeWidth={2.4} /> {t("binders.picker.collection") || "Colección / Era"}</label>
                      <select value={fAlbum} onChange={(e) => setFAlbum(e.target.value)} style={selectStyle}>
                        <option value="all">{t("market.all_masc")}</option>
                        {availableAlbums.map((aid) => (
                          <option key={aid as number} value={aid as number}>{formatCollectionOptionLabel(albumDict[aid as number] || `Álbum ${aid}`)}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label style={labelStyle}><Mic2 size={14} strokeWidth={2.4} /> {t("market.label_version")}</label>
                      <select value={fVersion} onChange={(e) => setFVersion(e.target.value)} style={selectStyle}>
                        <option value="all">{t("market.all_fem")}</option>
                        {availableVersions.map((v) => (
                          <option key={v as string} value={v as string}>{formatPrettyName(v as string)}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label style={labelStyle}><User size={14} strokeWidth={2.4} /> {t("market.label_member")}</label>
                      <select value={fMember} onChange={(e) => setFMember(e.target.value)} style={selectStyle}>
                        <option value="all">{t("market.all_masc")}</option>
                        {availableMembers.map((m) => (
                          <option key={m as string} value={m as string}>{formatPrettyName(m as string)}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label style={labelStyle}><Layers size={14} strokeWidth={2.4} /> {t("market.label_type")}</label>
                      <select value={fUnit} onChange={(e) => setFUnit(e.target.value)} style={selectStyle}>
                        <option value="all">{t("market.all_fem")}</option>
                        <option value="single">Single</option>
                        <option value="unit">Unit</option>
                        <option value="ot8">OT8</option>
                      </select>
                    </div>
                  </>
                )}

                {/* ========================================= */}
                {/* --- BLOQUE B: MERCHANDISING SELECCIONADO --- */}
                {/* ========================================= */}
                {(fItemType === "merch" || fItemType === "all") && (
                  <>
                    {fItemType === "all" && (
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          fontSize: "12px",
                          fontWeight: 900,
                          color: "var(--color-primary)",
                          borderTop: "1px dashed var(--color-border)",
                          paddingTop: "8px",
                          marginTop: "2px",
                        }}
                      >
                        {t("market.filter_merch")}
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label style={labelStyle}><Layers size={14} strokeWidth={2.4} /> {t("market.label_category")}</label>
                      <select value={fCategory} onChange={(e) => setFCategory(e.target.value)} style={selectStyle}>
                        <option value="all">{t("market.all_fem")}</option>
                        <option value="Peluches">{t("market.cat_plush")}</option>
                        <option value="Lightsticks">{t("market.cat_lightstick")}</option>
                        <option value="Ropa">{t("market.cat_clothes")}</option>
                        <option value="Accesorios">{t("market.cat_accessories")}</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label style={labelStyle}><Users size={14} strokeWidth={2.4} /> {t("market.label_group")}</label>
                      <select value={fGroup} onChange={(e) => setFGroup(e.target.value)} style={selectStyle}>
                        <option value="all">{t("market.all_masc")}</option>
                        {availableGroups.map((gid) => (
                          <option key={gid as number} value={String(gid)}>{groupDict[gid as number] || `Grupo ${gid}`}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label style={labelStyle}><User size={14} strokeWidth={2.4} /> {t("market.label_member")}</label>
                      <select value={fMember} onChange={(e) => setFMember(e.target.value)} style={selectStyle}>
                        <option value="all">{t("market.all_masc")}</option>
                        {availableMembers.map((m) => (
                          <option key={m as string} value={m as string}>{formatPrettyName(m as string)}</option>
                        ))}
                      </select>
                    </div>

                    {/* RELACIÓN DINÁMICA (MUÑECA RUSA) */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label style={labelStyle}><Sparkles size={14} strokeWidth={2.4} /> {t("market.label_related")}</label>
                      <select value={fMerchRelation} onChange={(e) => {
                        setFMerchRelation(e.target.value);
                        setFAlbum("all");
                        setFMerchEvent("all");
                        setFMerchTour("all");
                      }} style={selectStyle}>
                        <option value="all">{t("market.rel_any")}</option>
                        <option value="album">{t("market.rel_album")}</option>
                        <option value="evento">{t("market.rel_event")}</option>
                        <option value="gira">{t("market.rel_tour")}</option>
                      </select>
                    </div>

                    {fMerchRelation === "album" && (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <label style={labelStyle}><Disc3 size={14} strokeWidth={2.4} /> {t("binders.picker.collection") || "Colección / Era"}</label>
                        <select value={fAlbum} onChange={(e) => setFAlbum(e.target.value)} style={selectStyle}>
                          <option value="all">{t("market.all_masc")}</option>
                          {availableAlbums.map((aid) => (
                            <option key={aid as number} value={aid as number}>{formatCollectionOptionLabel(albumDict[aid as number] || `Álbum ${aid}`)}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {fMerchRelation === "evento" && (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <label style={labelStyle}><MapPin size={14} strokeWidth={2.4} /> {t("market.label_event")}</label>
                        <select value={fMerchEvent} onChange={(e) => setFMerchEvent(e.target.value)} style={selectStyle}>
                          <option value="all">{t("market.all_masc")}</option>
                          <option value="skzoo_popup_magic_school">SKZOO Magic School</option>
                          <option value="skzoo_popup_jeju">SKZOO Jeju Pop-up</option>
                          <option value="fanmeeting_pilot">Pilot : For 5-Star</option>
                          <option value="fanmeeting_magic_school">Magic School Fan Meeting</option>
                        </select>
                      </div>
                    )}

                    {fMerchRelation === "gira" && (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <label style={labelStyle}><Mic2 size={14} strokeWidth={2.4} /> {t("market.label_tour")}</label>
                        <select value={fMerchTour} onChange={(e) => setFMerchTour(e.target.value)} style={selectStyle}>
                          <option value="all">{t("market.all_fem")}</option>
                          <option value="dominate">dominATE Tour</option>
                          <option value="maniac">MANIAC Tour</option>
                          <option value="district9">District 9 : Unlock</option>
                        </select>
                      </div>
                    )}
                  </>
                )}

              </div>
            )}
            </div>
          </div>
        {/* ========================================= */}
        {/* FIN DE LOS FILTROS                        */}
        {/* ========================================= */}

       <div
          style={{
            display: "flex",
            gap: "25px",
            marginBottom: "30px",
            borderBottom: "2px solid var(--color-border)", // 👈 Antes var(--color-border)
            paddingBottom: "12px",
          }}
        >
          <button
            onClick={() => {
              setTab("wtt");
              setSearchMode("offered");
            }}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === "wtt" ? `3px solid ${ACC.cyan}` : "3px solid transparent",
              fontSize: "16px",
              fontWeight: 900,
              cursor: "pointer",
              paddingBottom: 6,
              color: tab === "wtt" ? ACC.cyan : "var(--text-muted)", 
            }}
          >
            WTT
          </button>
          <button
            onClick={() => {
              setTab("wts");
              setSearchMode("offered");
            }}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === "wts" ? `3px solid ${ACC.orange}` : "3px solid transparent",
              fontSize: "16px",
              fontWeight: 900,
              cursor: "pointer",
              paddingBottom: 6,
              color: tab === "wts" ? ACC.orange : "var(--text-muted)", 
            }}
          >
            WTS
          </button>
        </div>
          </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "100px" }}>
            <Loader2 size={40} className="spinner" color="var(--color-primary)" />
          </div>
        ) : (
          <div
            key={`${tab}-${searchMode}-${fItemType}-${filterRefreshTick}`}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: "16px",
              paddingBottom: "60px",
            }}
          >
            {filteredAds.length === 0 ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  padding: "40px",
                  color: "var(--color-primary)",
                  fontWeight: 800,
                }}
              >
                {t("market.empty_search")}
              </div>
            ) : (
             filteredAds.map((ad) => {
                const targetInfo = ad.target_wtt_id ? wttTargets[ad.target_wtt_id] : null;
                const groupName = ad.itemType === "pc" ? groupDict[ad.group_id as number] : (ad as any).group_name || ad.member;
                const albumName = ad.itemType === "pc" ? albumDict[ad.album_id as number] : null;
                const metaSecond =
                  ad.itemType === "pc"
                    ? String(albumName || ad.category || "").trim()
                    : String(ad.category || "").trim();
                const metaLine = [groupName, metaSecond].filter(Boolean).join(" • ");
                const cardTitle =
                  ad.itemType === "pc" ? formatMemberLabel(ad.member) : ad.pcName;

                return (
                  <div key={ad.id} data-market-ad-id={ad.id} className="ad-card" style={{ background: "var(--bg-card)", borderRadius: "16px", border: "1px solid var(--color-border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    
                    {/* FOTO AREA */}
                    <div style={{ width: "100%", backgroundColor: "var(--bg-soft)", padding: "16px", boxSizing: "border-box" }}>
                      
                      {ad.type === "wtt" ? (
                        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", width: "100%" }}>
                          
                          {/* IZQUIERDA: OFRECE */}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: 0 }}>
                            <div style={{ fontSize: "9px", fontWeight: 900, color: "var(--modal-cta-fg)", background: ACC.pink, padding: "2px 6px", borderRadius: "4px", alignSelf: "center", marginBottom: "4px" }}>
                              {t("market.tag_offers")}
                            </div>
                            
                            <div style={{ width: "100%", aspectRatio: "3/4", background: "var(--bg-card)", borderRadius: "6px", border: "1px solid var(--color-border)", overflow: "hidden" }}>
                              <ImageWithExtensionFallback src={ad.pcImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                            </div>
                            
                            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "4px", marginTop: "2px" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
                                <User size={12} color={ACC.purple} style={{ flexShrink: 0, marginTop: "2px" }} />
                                <span style={{ fontSize: "10px", fontWeight: 900, color: ACC.purple, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ad.itemType === "pc" ? formatMemberLabel(ad.member) : ad.pcName}</span>
                              </div>
                            </div>
                          </div>

                          {/* CENTRO: FLECHAS */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "55px" }}>
                            <ArrowRightLeft size={16} color={ACC.orange} />
                          </div>

                          {/* DERECHA: BUSCA */}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: 0 }}>
                            <div style={{ fontSize: "9px", fontWeight: 900, color: ACC.cyan, background: "var(--bg-card)", border: `1px solid ${ACC.cyan}`, padding: "2px 6px", borderRadius: "4px", alignSelf: "center", marginBottom: "4px" }}>
                              {t("market.tag_looks_for")}
                            </div>
                            
                            {targetInfo ? (
                               <>
                                <div style={{ width: "100%", aspectRatio: "3/4", background: "var(--bg-card)", borderRadius: "6px", border: "1px solid var(--color-border)", overflow: "hidden" }}>
                                  <ImageWithExtensionFallback src={targetInfo.image_url || "https://ui-avatars.com/api/?name=PC"} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                                </div>
                                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "4px", marginTop: "2px" }}>
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
                                    <User size={12} color={ACC.cyan} style={{ flexShrink: 0, marginTop: "2px" }} />
                                    <span style={{ fontSize: "10px", fontWeight: 900, color: ACC.cyan, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{targetInfo.itemType === "merch" ? targetInfo.name : formatMemberLabel(targetInfo.member)}</span>
                                  </div>
                                </div>
                               </>
                            ) : (
                               <>
                                 <div style={{ width: "100%", aspectRatio: "3/4", background: "var(--bg-soft)", borderRadius: "6px", border: "1px dashed var(--color-primary)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <ImageWithExtensionFallback src={ad.pcImage} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.15, filter: "grayscale(100%)" }} alt="" />
                                 </div>
                                 <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", marginTop: "2px" }}>
                                   <span style={{ fontSize: "10px", fontWeight: 900, color: ACC.pink, textAlign: "center", marginTop: "4px", lineHeight: 1.3 }}>{t("market.any_equivalent")}<br/>{t("market.see_wishlist")}</span>
                                 </div>
                               </>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* --- TARJETA WTS Y NORMAL (UNA FOTO) --- */
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "80%", aspectRatio: "3/4", borderRadius: "8px", overflow: "hidden" }}>
                            <ImageWithExtensionFallback src={ad.pcImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* --- BOTONERA INFERIOR --- */}
                    <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", gap: "16px", background: "var(--bg-card)" }}>
                      <div>
                        <span style={{ fontSize: "10px", fontWeight: 900, color: ACC.pink, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                          {metaLine || "—"}
                        </span>
                        <h3 style={{ color: ACC.purple, fontWeight: 900, fontSize: "15px", margin: 0, lineHeight: 1.2 }}>
                          {cardTitle}
                        </h3>
                      </div>
                      {ad.type === "wts" && (
                        <>
                          {(ad.itemType !== "merch" || (ad.price ?? 0) > 0) && (
                            <PriceConverter price={ad.price || 0} currency={ad.currency || "EUR"} negotiable={ad.negotiable} />
                          )}
                          {ad.itemType === "merch" && Number(ad.price_koins) > 0 && (
                            <div style={{ fontSize: "13px", fontWeight: 900, color: ACC.green, marginTop: (ad.price ?? 0) > 0 ? 8 : 0 }}>
                              {ad.price_koins} K-oins
                            </div>
                          )}
                        </>
                      )}
                      
                      {ad.comment && (
                        <div style={{ fontSize: "11px", fontStyle: "italic", color: "var(--text-muted)" }}>"{ad.comment}"</div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: ad.type === "wts" ? "1fr 1fr" : "1fr", gap: "6px", marginTop: "auto" }}>
                        {ad.type === "wts" ? (
                          <>
                            <button onClick={() => handleBuy(ad.id)} style={{ ...ghostMarketBtn, color: ACC.green }}>{t("market.btn_buy")}</button>
                            <button onClick={() => openOffer(ad)} style={{ ...ghostMarketBtn, color: ACC.orange }}>{t("market.btn_offer")}</button>
                          </>
                        ) : (
                          <button onClick={() => openContact(ad)} style={{ ...ghostMarketBtn, color: ACC.cyan, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                            <MessageCircle size={18} color={ACC.cyan} /> {t("market.btn_contact")}
                          </button>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px", borderTop: "1px solid var(--color-border)", paddingTop: "12px" }}>
                        <img 
                          src={ad.avatar_url} 
                          onClick={() => openPublicProfile(ad.user_id)}
                          style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover", cursor: "pointer" }} 
                          alt="Avatar" 
                        />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span 
                            onClick={() => openPublicProfile(ad.user_id)}
                            style={{ fontSize: "13px", fontWeight: 900, color: ACC.purple, cursor: "pointer" }}
                          >
                            @{ad.username}
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                            <MapPin size={12} /> {ad.country}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
      </AdRailLayout>

     {/* Vista desde notificación: publicación concreta */}
      {showDeepLinkPeek && selectedAd && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay-strong)",
            zIndex: 10050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(6px)",
            padding: "16px",
          }}
          onClick={() => closeDeepLinkPeek()}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "24px",
              width: "100%",
              maxWidth: "440px",
              maxHeight: "88vh",
              overflowY: "auto",
              boxShadow: "0 20px 50px var(--shadow-card)",
              border: "2px solid var(--color-primary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const ad = selectedAd;
              const targetInfo = ad.target_wtt_id ? wttTargets[ad.target_wtt_id] : null;
              const groupName = ad.itemType === "pc" ? groupDict[ad.group_id as number] : (ad as { group_name?: string }).group_name || ad.member;
              const albumName = ad.itemType === "pc" ? albumDict[ad.album_id as number] : null;
              const metaSecond =
                ad.itemType === "pc"
                  ? String(albumName || ad.category || "").trim()
                  : String(ad.category || "").trim();
              const metaLine = [groupName, metaSecond].filter(Boolean).join(" • ");
              const cardTitle = ad.itemType === "pc" ? formatMemberLabel(ad.member) : ad.pcName;

              const photoRow =
                ad.type === "wtt" && targetInfo ? (
                  <div style={{ display: "flex", gap: "10px", alignItems: "stretch", justifyContent: "center" }}>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: "9px",
                          fontWeight: 900,
                          color: "var(--modal-cta-fg)",
                          background: ACC.pink,
                          padding: "4px 8px",
                          borderRadius: "6px",
                          display: "inline-block",
                          marginBottom: "8px",
                        }}
                      >
                        {t("market.tag_offers")}
                      </div>
                      <div style={{ aspectRatio: "3/4", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--color-border)" }}>
                        <ImageWithExtensionFallback src={ad.pcImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", paddingTop: "36px" }}>
                      <ArrowRightLeft size={20} color={ACC.orange} />
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: "9px",
                          fontWeight: 900,
                          color: ACC.cyan,
                          border: `1px solid ${ACC.cyan}`,
                          padding: "4px 8px",
                          borderRadius: "6px",
                          display: "inline-block",
                          marginBottom: "8px",
                        }}
                      >
                        {t("market.tag_looks_for")}
                      </div>
                      <div style={{ aspectRatio: "3/4", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--color-border)" }}>
                        <ImageWithExtensionFallback src={targetInfo.image_url || ad.pcImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <div
                      style={{
                        width: "72%",
                        maxWidth: "260px",
                        aspectRatio: "3/4",
                        borderRadius: "12px",
                        overflow: "hidden",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <ImageWithExtensionFallback src={ad.pcImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  </div>
                );

              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 20px 0 20px", gap: "12px" }}>
                    <div>
                      <h2 className="tan-font" style={{ color: "var(--nav-market, var(--color-primary))", margin: 0, fontSize: "20px", lineHeight: 1.2 }}>
                        {t("market.deep_link_modal_title")}
                      </h2>
                      <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-muted)", marginTop: "6px" }}>
                        {t("market.deep_link_modal_hint")}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={t("common.close")}
                      onClick={() => closeDeepLinkPeek()}
                      style={{
                        background: "var(--bg-soft)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "12px",
                        padding: "8px",
                        cursor: "pointer",
                        color: "var(--color-primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={22} />
                    </button>
                  </div>

                  <div style={{ padding: "16px 20px 20px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                    {photoRow}

                    <div>
                      <span style={{ fontSize: "10px", fontWeight: 900, color: ACC.pink, textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                        {metaLine || "—"}
                      </span>
                      <h3 style={{ color: ACC.purple, fontWeight: 900, fontSize: "18px", margin: 0, lineHeight: 1.25 }}>{cardTitle}</h3>
                    </div>

                    {ad.type === "wts" && (
                      <>
                        {(ad.itemType !== "merch" || (ad.price ?? 0) > 0) && (
                          <PriceConverter price={ad.price || 0} currency={ad.currency || "EUR"} negotiable={ad.negotiable} />
                        )}
                        {ad.itemType === "merch" && Number(ad.price_koins) > 0 && (
                          <div style={{ fontSize: "14px", fontWeight: 900, color: ACC.green }}>
                            {ad.price_koins} K-oins
                          </div>
                        )}
                      </>
                    )}

                    {ad.comment ? (
                      <div style={{ fontSize: "13px", fontStyle: "italic", color: "var(--text-muted)", lineHeight: 1.45 }}>
                        &ldquo;{ad.comment}&rdquo;
                      </div>
                    ) : null}

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingTop: "4px", borderTop: "1px solid var(--color-border)" }}>
                      <img src={ad.avatar_url} alt="" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} />
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 900, color: ACC.purple }}>@{ad.username}</div>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            color: "var(--text-muted)",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            marginTop: "2px",
                          }}
                        >
                          <MapPin size={12} /> {ad.country}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: ad.type === "wts" ? "1fr 1fr" : "1fr", gap: "10px", marginTop: "4px" }}>
                      {ad.type === "wts" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              closeDeepLinkPeek();
                              handleBuy(ad.id);
                            }}
                            style={{ ...ghostMarketBtn, color: ACC.green, border: `1px solid ${ACC.green}`, padding: "12px", borderRadius: "12px" }}
                          >
                            {t("market.btn_buy")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closeDeepLinkPeek();
                              openOffer(ad);
                            }}
                            style={{ ...ghostMarketBtn, color: ACC.orange, border: `1px solid ${ACC.orange}`, padding: "12px", borderRadius: "12px" }}
                          >
                            {t("market.btn_offer")}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            closeDeepLinkPeek();
                            openContact(ad);
                          }}
                          style={{
                            ...ghostMarketBtn,
                            color: ACC.cyan,
                            border: `1px solid ${ACC.cyan}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            padding: "14px",
                            borderRadius: "14px",
                            fontWeight: 900,
                          }}
                        >
                          <MessageCircle size={20} color={ACC.cyan} /> {t("market.btn_contact")}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => closeDeepLinkPeek()}
                      style={{
                        marginTop: "4px",
                        width: "100%",
                        padding: "12px",
                        borderRadius: "12px",
                        border: "1px solid var(--color-border)",
                        background: "var(--bg-soft)",
                        color: "var(--text-muted)",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {t("common.close")}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

     {/* MODAL CONTACTO / TRADE */}
     {showContactModal && selectedAd && (
        <div style={{ position: "fixed", inset: 0, background: "var(--overlay-strong)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", padding: "20px" }}>
          <div style={{ background: "var(--bg-card)", padding: "25px", borderRadius: "24px", width: "100%", maxWidth: "420px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px var(--shadow-card)", border: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center" }}>
              <h2 style={{ color: "var(--nav-market, var(--color-primary))", margin: 0, fontSize: "20px", fontFamily: "'Tan-Font', sans-serif" }}>
                {contactFlow === "wts_buy" ? t("market.wts_buy_title") : t("market.propose_trade")}
              </h2>
              <X onClick={() => { setShowContactModal(false); setOfferKoins(false); setKoinsAmount(""); }} style={{ cursor: "pointer", color: "var(--text-muted)" }} />
            </div>

            {contactFlow !== "wts_buy" && (
              <>
                <div style={{ background: "var(--bg-soft)", padding: "20px", borderRadius: "16px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", border: "1px dashed var(--color-border)" }}>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--color-primary)" }}>{t("market.what_to_offer")}</span>
                  {offeredItems.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", width: "100%", marginBottom: "5px" }}>
                      {offeredItems.map((item: any, idx: number) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-card)", padding: "6px 12px", borderRadius: "12px", border: "1px solid var(--color-primary)" }}>
                          <div style={{ width: "24px", height: "30px", borderRadius: "4px", overflow: "hidden", background: "var(--bg-soft)" }}><ImageWithExtensionFallback src={item.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /></div>
                          <span style={{ fontSize: "11px", fontWeight: 900, color: "var(--text-main)" }}>{item.type === "merch" ? item.name : item.member}</span>
                          <X size={14} color="var(--text-muted)" style={{ cursor: "pointer", marginLeft: "4px" }} onClick={() => setOfferedItems(offeredItems.filter(i => i.id !== item.id))} />
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setIsPickingItem(true)} className="market-btn-secondary" style={{ display: "flex", alignItems: "center", gap: "8px" }}><BookText size={18} /> {offeredItems.length > 0 ? t("market.modify_offer") : t("market.choose_binder")}</button>
                </div>

                <div style={{ background: "var(--bg-soft)", padding: "16px", borderRadius: "16px", marginBottom: "20px", border: "1px solid var(--color-border)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 800, color: "var(--color-primary)", userSelect: "none" }}>
                    <input type="checkbox" checked={offerKoins} onChange={(e) => setOfferKoins(e.target.checked)} style={{ accentColor: "var(--color-primary)", width: "18px", height: "18px", cursor: "pointer" }} />
                    {t('market.add_koins')?.replace('{koins}', myKoins.toString())}
                  </label>
                  {offerKoins && (
                    <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-card)", padding: "8px 12px", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
                      <Sparkles size={18} color="var(--color-primary)" />
                      <input type="number" min="1" max={myKoins} placeholder={t("market.offer_modal.koins_placeholder")} value={koinsAmount} onChange={(e) => setKoinsAmount(e.target.value)} style={{ flex: 1, border: "none", outline: "none", fontWeight: 800, color: "var(--text-main)", fontSize: "14px", background: "transparent" }} />
                      <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--color-primary)" }}>K-oins</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: "11px", fontWeight: 900, color: "var(--text-muted)", marginBottom: "6px" }}>
                {contactFlow === "wts_buy" ? t("market.wts_buy_message_label") : t("market.your_message")}
              </label>
              <textarea rows={3} value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder={contactFlow === "wts_buy" ? t("market.wts_buy_message_placeholder") : t("market.message_placeholder")} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", resize: "none", boxSizing: "border-box", fontSize: "13px", color: "var(--text-main)", background: "var(--bg-main)" }} />
            </div>

            <button
              onClick={() => {
                if (contactFlow === "wts_buy") {
                  const finalMsg = contactMessage.trim() || t("market.wts_buy_default_message");
                  handleSendMessage("wts_message", finalMsg);
                  return;
                }
                if (offerKoins && koinsAmount) {
                  const amount = parseInt(koinsAmount);
                  if (amount > myKoins) return setShowToast(t("market.alerts.koins_insufficient").replace("{{count}}", String(myKoins)));
                  if (amount <= 0) return setShowToast(t("market.alerts.koins_min"));
                }
                let finalMsg = contactMessage.trim();
                if (offeredItems.length > 0 || (offerKoins && koinsAmount)) {
                  const payload = { isSpecialOffer: true, items: offeredItems, koins: offerKoins ? parseInt(koinsAmount) : 0, text: contactMessage.trim() };
                  finalMsg = `[APP_OFFER_PAYLOAD]${JSON.stringify(payload)}`;
                }
                handleSendMessage("wtt_message", finalMsg);
              }}
              disabled={isUploadingMsg} className="market-btn-primary" style={{ width: "100%", marginTop: "20px", padding: "14px", borderRadius: "12px", fontSize: "14px", display: "flex", justifyContent: "center", gap: "8px" }}
            >
              {isUploadingMsg ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
              {isUploadingMsg ? t("market.sending") : contactFlow === "wts_buy" ? t("market.wts_buy_btn_send") : t("market.btn_send")}
            </button>
          </div>
        </div>
      )}

      {/* MODAL OFERTA WTS */}
      {showOfferModal && selectedAd && (
        <div style={{ position: "fixed", inset: 0, background: "var(--overlay-strong)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", padding: "20px" }}>
          <div style={{ background: "var(--bg-card)", padding: "25px", borderRadius: "24px", width: "100%", maxWidth: "440px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px var(--shadow-card)", border: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center" }}>
              <h2 style={{ color: "var(--nav-market, var(--color-primary))", margin: 0, fontSize: "20px", fontFamily: "'Tan-Font', sans-serif" }}>
                {t("market.wts_offer_title")}
              </h2>
              <X onClick={() => { setShowOfferModal(false); setOfferKoins(false); setKoinsAmount(""); setOfferPrice(""); setOfferedItems([]); }} style={{ cursor: "pointer", color: "var(--text-muted)" }} />
            </div>

            <div style={{ background: "var(--bg-soft)", padding: "16px", borderRadius: "16px", marginBottom: "14px", border: "1px solid var(--color-border)" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", marginBottom: "8px" }}>
                {t("market.wts_offer_price_label")}
              </label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input type="number" min="0" step="0.01" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder={t("market.wts_offer_price_placeholder")} style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--bg-card)", outline: "none", fontWeight: 800, color: "var(--text-main)" }} />
                <span style={{ minWidth: "52px", textAlign: "center", fontWeight: 900, color: "var(--color-primary)", fontSize: "12px" }}>
                  {selectedAd.currency || "EUR"}
                </span>
              </div>
            </div>

            <div style={{ background: "var(--bg-soft)", padding: "16px", borderRadius: "16px", marginBottom: "14px", border: "1px solid var(--color-border)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 800, color: "var(--color-primary)", userSelect: "none" }}>
                <input type="checkbox" checked={offerKoins} onChange={(e) => setOfferKoins(e.target.checked)} style={{ accentColor: "var(--color-primary)", width: "18px", height: "18px", cursor: "pointer" }} />
                {t('market.add_koins')?.replace('{koins}', myKoins.toString())}
              </label>
              {offerKoins && (
                <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-card)", padding: "8px 12px", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
                  <Sparkles size={18} color="var(--color-primary)" />
                  <input type="number" min="1" max={myKoins} placeholder={t("market.offer_modal.koins_placeholder")} value={koinsAmount} onChange={(e) => setKoinsAmount(e.target.value)} style={{ flex: 1, border: "none", outline: "none", fontWeight: 800, color: "var(--text-main)", fontSize: "14px", background: "transparent" }} />
                  <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--color-primary)" }}>K-oins</span>
                </div>
              )}
            </div>

            <div style={{ background: "var(--bg-soft)", padding: "20px", borderRadius: "16px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", border: "1px dashed var(--color-border)" }}>
              <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--color-primary)" }}>{t("market.what_to_offer")}</span>
              {offeredItems.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", width: "100%", marginBottom: "5px" }}>
                  {offeredItems.map((item: any, idx: number) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-card)", padding: "6px 12px", borderRadius: "12px", border: "1px solid var(--color-primary)" }}>
                      <div style={{ width: "24px", height: "30px", borderRadius: "4px", overflow: "hidden", background: "var(--bg-soft)" }}><ImageWithExtensionFallback src={item.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /></div>
                      <span style={{ fontSize: "11px", fontWeight: 900, color: "var(--text-main)" }}>{item.type === "merch" ? item.name : item.member}</span>
                      <X size={14} color="var(--text-muted)" style={{ cursor: "pointer", marginLeft: "4px" }} onClick={() => setOfferedItems(offeredItems.filter(i => i.id !== item.id))} />
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  onClick={() => { setPickerAllowedTypes(["pc"]); setIsPickingItem(true); }}
                  className="market-btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <BookText size={18} /> {offeredItems.length > 0 ? t("market.modify_offer") : t("market.choose_binder")}
                </button>
                {selectedAd.itemType === "merch" && (
                  <button
                    onClick={() => { setPickerAllowedTypes(["merch"]); setIsPickingItem(true); }}
                    className="market-btn-secondary"
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <Tag size={18} /> {t("market.choose_merch_stock")}
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: "11px", fontWeight: 900, color: "var(--text-muted)", marginBottom: "6px" }}>{t("market.your_message")}</label>
              <textarea rows={3} value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder={t("market.message_placeholder")} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", resize: "none", boxSizing: "border-box", fontSize: "13px", color: "var(--text-main)", background: "var(--bg-main)" }} />
            </div>

            <button
              onClick={() => {
                if (offerKoins && koinsAmount) {
                  const amount = parseInt(koinsAmount);
                  if (amount > myKoins) return setShowToast(t("market.alerts.koins_insufficient").replace("{{count}}", String(myKoins)));
                  if (amount <= 0) return setShowToast(t("market.alerts.koins_min"));
                }
                const payload = {
                  isWtsOffer: true,
                  price: offerPrice ? Number(offerPrice) : 0,
                  currency: selectedAd.currency || "EUR",
                  koins: offerKoins ? parseInt(koinsAmount || "0", 10) : 0,
                  items: offeredItems,
                  text: contactMessage.trim(),
                };
                handleSendMessage("offer_message", `[APP_WTS_OFFER_PAYLOAD]${JSON.stringify(payload)}`);
              }}
              disabled={isUploadingMsg}
              className="market-btn-primary"
              style={{ width: "100%", marginTop: "20px", padding: "14px", borderRadius: "12px", fontSize: "14px", display: "flex", justifyContent: "center", gap: "8px" }}
            >
              {isUploadingMsg ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
              {isUploadingMsg ? t("market.sending") : t("market.wts_offer_btn_send")}
            </button>
          </div>
        </div>
      )}

      <Footer />

      {/* 👤 MODAL DE PERFIL PÚBLICO */}
      {showPublicProfile && selectedProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999999, background: "var(--overlay-strong)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(480px, 95vw)", background: "var(--bg-card)", borderRadius: 30, overflow: "hidden", boxShadow: "0 25px 50px var(--shadow-card)", border: "1px solid var(--color-border)" }}>
            
            <div style={{ background: "var(--color-primary)", padding: "40px 20px 20px 20px", position: "relative", textAlign: "center" }}>
              <X onClick={() => setShowPublicProfile(false)} style={{ position: "absolute", top: 20, right: 20, color: "white", cursor: "pointer" }} />
              <div style={{ width: 100, height: 100, borderRadius: "50%", border: "4px solid var(--bg-card)", margin: "0 auto", overflow: "hidden", background: "var(--bg-soft)", boxShadow: "0 10px 20px var(--overlay-faint)" }}>
                <img src={selectedProfile.avatar_url || `https://ui-avatars.com/api/?name=${selectedProfile.display_name}&background=random`} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
              </div>
              <h2 style={{ color: "white", marginTop: 15, marginBottom: 5, fontSize: 22, fontWeight: 900 }}>@{selectedProfile.display_name}</h2>
              <span style={{ color: "color-mix(in srgb, var(--bg-card) 80%, transparent)", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{t("market.trader_title")}</span>
            </div>

            <div style={{ padding: 25 }}>
              <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginBottom: 15, fontStyle: "italic", lineHeight: 1.4 }}>
                "{selectedProfile.bio || t("market.no_bio")}"
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginBottom: 25 }}>
                {profileBiases.length > 0 ? (
                  profileBiases.map((biasName, i) => (
                    <span key={i} style={{ background: "var(--bg-soft)", color: "var(--color-primary)", padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: 800 }}>
                      💖 {biasName}
                    </span>
                  ))
                ) : (
                  <span style={{ background: "var(--bg-soft)", color: "var(--text-muted)", padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 }}>
                    {t("market.no_bias")}
                  </span>
                )}
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 25 }}>
                <div style={{ background: "var(--bg-soft)", padding: "12px 5px", borderRadius: 16, textAlign: "center", border: "1px solid var(--color-border)" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--color-primary)" }}>{profileAds.length}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>{t("market.stats_ads")}</div>
                </div>
                <div style={{ background: "var(--bg-soft)", padding: "12px 5px", borderRadius: 16, textAlign: "center", border: "1px solid var(--color-border)" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--color-primary)" }}>{selectedProfile.puntos || 0}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>{t("market.stats_koins")}</div>
                </div>
                <div style={{ background: "var(--bg-soft)", padding: "12px 5px", borderRadius: 16, textAlign: "center", border: "1px solid var(--color-border)" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-main)" }}>{profileFollowers}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>{t("market.stats_followers")}</div>
                </div>
                <div style={{ background: "var(--bg-soft)", padding: "12px 5px", borderRadius: 16, textAlign: "center", border: "1px solid var(--color-border)" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-main)" }}>{profileFollowing}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>{t("market.stats_following")}</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button 
                  onClick={() => { setShowPublicProfile(false); router.push(`/user/${selectedProfile.user_id}`); }}
                  className="market-btn-secondary" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <BookOpen size={18} /> {t("market.btn_view_collection")}
                </button>

                <div style={{ display: "flex", gap: 10 }}>
                  <button 
                    onClick={async () => {
                      if (!currentUserId) return setShowToast("Inicia sesión para guardar favoritos");
                      if (isFollowingProfile) {
                        await supabase.from('user_favorites').delete().eq('follower_id', currentUserId).eq('following_id', selectedProfile.user_id);
                        setIsFollowingProfile(false); setProfileFollowers(prev => prev - 1); setShowToast("Eliminado de Favoritos");
                      } else {
                        await supabase.from('user_favorites').insert({ follower_id: currentUserId, following_id: selectedProfile.user_id });
                        setIsFollowingProfile(true); setProfileFollowers(prev => prev + 1); setShowToast("¡Añadido a Favoritos! 💖");
                      }
                    }}
                    style={{ flex: 1, padding: "12px", borderRadius: "14px", border: isFollowingProfile ? "2px solid var(--color-primary)" : "1px solid var(--color-border)", background: isFollowingProfile ? "var(--bg-card)" : "var(--bg-soft)", color: "var(--color-primary)", fontWeight: 900, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <Heart size={16} fill={isFollowingProfile ? "var(--color-primary)" : "none"} /> 
                    {isFollowingProfile ? t("market.btn_following") : t("market.btn_favorite")}
                  </button>
                  
                  <button 
                    onClick={() => { setShowPublicProfile(false); router.push(`/me?u=${selectedProfile.user_id}`); }}
                    className="market-btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <MessageCircle size={16} /> {t("market.btn_contact")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICACIÓN */}
      {showToast && (
        <div style={{ position: "fixed", bottom: "40px", left: "50%", transform: "translateX(-50%)", background: "var(--color-primary)", color: "white", padding: "14px 28px", borderRadius: "50px", fontSize: "14px", fontWeight: 900, display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 10px 30px var(--shadow-card)", zIndex: 9999999999, animation: "fadeInUp 0.3s ease-out" }}>
          <Sparkles size={18} color="white" />
          {showToast}
        </div>
      )}

      {/* PICKER MODAL */}
      {isPickingItem && currentUserId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999999, background: "var(--overlay-strong)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(700px, 96vw)", height: "80vh", borderRadius: 24, background: "var(--bg-main)", overflow: "hidden", boxShadow: "0 20px 50px var(--shadow-card)", border: "1px solid var(--color-border)" }}>
            <ItemPicker
              userId={currentUserId}
              allowedTypes={pickerAllowedTypes}
              initialSelected={offeredItems}
              wantedIds={selectedAd ? Array.from(new Set(ads.filter(a => a.user_id === selectedAd.user_id && a.type === "wtt").flatMap(a => { if (Array.isArray(a.target_wtt_id)) return a.target_wtt_id; if (typeof a.target_wtt_id === "string" && a.target_wtt_id.includes(",")) { return a.target_wtt_id.split(",").map(s => s.trim()); } return a.target_wtt_id ? [a.target_wtt_id] : []; }).map(String))) : []}
              onSelect={(items: any[]) => {
                const normalized = items.map((item) => ({ ...item, itemType: item.type }));
                setOfferedItems((prev: any[]) => {
                  const merged = [...prev];
                  normalized.forEach((nextItem) => {
                    const exists = merged.some(
                      (existing) => String(existing.id) === String(nextItem.id) && existing.type === nextItem.type
                    );
                    if (!exists) merged.push(nextItem);
                  });
                  return merged;
                });
                setIsPickingItem(false);
                setPickerAllowedTypes(["pc", "merch"]);
              }}
              onCancel={() => { setIsPickingItem(false); setPickerAllowedTypes(["pc", "merch"]); }}
            />
          </div>
        </div>
      )}

      {/* ESTILOS CSS GLOBALES */}
      <style jsx global>{`
        .ad-card:hover { transform: translateY(-4px); box-shadow: 0 10px 24px var(--shadow-card); }
        .market-btn-primary { background: var(--color-primary); color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 900; cursor: pointer; transition: opacity 0.2s; }
        .market-btn-primary:hover { opacity: 0.9; }
        .market-btn-secondary { background: var(--bg-card); color: var(--color-primary); border: 2px solid var(--color-primary); padding: 10px; border-radius: 8px; font-weight: 900; cursor: pointer; transition: all 0.2s; }
        .market-btn-secondary:hover { background: var(--bg-soft); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes fadeInUp { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
    </div>
  );
}

export default function MarketClient() {
  return <MarketContent />;
}