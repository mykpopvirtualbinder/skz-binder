"use client";

import AdRailLayout from "../components/AdRailLayout";
import React, { useState, useEffect, useMemo, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { useGlobal } from "../context/GlobalContext";
import { formatCollectionOptionLabel, sortCollectionEntries, isStrayKidsPlaceholderMerchAlbumRow, isStrayKidsGroupName } from "@/lib/collection-filters";
import { formatPhysicalMerchLabel, formatMerchAlbumTypeDisplay } from "@/lib/album-physical-labels";
import {
  ALBUM_KIND_ORDER,
  ALBUM_REGION_ORDER,
  deriveAlbumRegionKey,
  deriveAlbumKindKey,
  merchAlbumSlot4Value,
  merchAlbumMemberLabel,
  sortMerchAlbumSlot4Labels,
  isAccordionKindKey,
  type AlbumKindKey,
  MERCH_ALBUM_DB_CATEGORY,
} from "@/lib/merch-album-filter-meta";
import { albumRowMatchesMerchGroupFilter, canonicalMerchGroupDisplayName } from "@/lib/merch-group-display";
import { merchRowMatchesQuery } from "@/lib/merch-item-search";
import { compareMerchAlbumCatalogItems } from "@/lib/merch-album-catalog-sort";
import { merchAlbumCardBreadcrumbLine, merchAlbumCardHeading } from "@/lib/merch-album-card-display";
import { avisarFavoritos } from "@/lib/avisos";
import { resolveWtsKoins, stripWtsKoinsMark, withWtsListingMarks, parseWtsListingExtras } from "@/lib/wts-koins-mark";
import { stockStatusRank } from "@/lib/catalog-sort";
import ImageWithExtensionFallback from "../components/ImageWithExtensionFallback";
import BindersShortcut from "../components/BindersShortcut";
import CatalogLoadingFun from "../components/CatalogLoadingFun";
import WtsListingModal from "../library/WtsListingModal";
import ContributeEmptyState from "../components/ContributeEmptyState";
import ContributeColabModal from "../components/ContributeColabModal";
import {
  compactFolderKey,
  folderAlbumsForMerchFilters,
  type FolderTreeCatalog,
} from "@/lib/folder-tree-catalog-shared";
import {
  merchGoodsMeta,
  merchGoodsNameMatches,
  MERCH_GOODS_KIND_ORDER,
  type MerchGoodsKind,
} from "@/lib/merch-collection-meta";
import {
  Search, Package, CheckCircle2, Star, Loader2,
  Repeat2, DollarSign, LayoutGrid, Archive, Truck, X, Info, Coins, Users, Disc3, Mic2, Layers, MapPin, ArrowUpDown,
  ChevronLeft, ChevronRight, ZoomIn,
} from "lucide-react";

// Font is loaded globally via @font-face in globals.css

type MerchItem = {
  id: string;
  name: string;
  category: string;
  group_name: string;
  image_url: string;
  rarity: string;
  album_title?: string | null;
  album_type?: string | null;
  album_version?: string | null;
};

/** Rows with `category === MERCH_ALBUM_DB_CATEGORY` appear in the Álbumes tab; optional fields power album filters. */
function isAlbumItem(item: Pick<MerchItem, "category">) {
  return item.category === MERCH_ALBUM_DB_CATEGORY;
}

const MERCH_INCLUSIONS_DB_CATEGORY = "Inclusions";
const FOLDER_TREE_CACHE_KEY = "mkb_folder_tree_v1";
const MERCH_ALBUMS_CACHE_KEY = "mkb_merch_albums_v2";
const MERCH_PRODUCTS_CACHE_KEY = "mkb_merch_products_v2";

type MerchStockKey = "have" | "wtt" | "wts" | "otw" | "wishlist";

function merchStockLabel(s: MerchStockKey, t: (k: string) => string): string {
  if (s === "have") return t("merch.label_have");
  if (s === "wtt") return t("merch.label_wtt");
  if (s === "wts") return t("merch.label_wts");
  if (s === "otw") return t("merch.label_otw");
  return t("merch.info_modal.wishlist_label");
}

function MerchMetaRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
        padding: "6px 10px",
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          flex: "0 0 auto",
          borderRadius: 10,
          border: "1px solid var(--state-disabled-border)",
          background: "linear-gradient(180deg, var(--bg-card), var(--bg-soft))",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", lineHeight: 1.15 }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || "—"}</div>
      </div>
    </div>
  );
}

function applyMerchStockDelta(prev: Record<MerchStockKey, number>, s: MerchStockKey, delta: number): Record<MerchStockKey, number> {
  const nextVal = Math.max(0, (prev[s] ?? 0) + delta);
  const next = { ...prev, [s]: nextVal };
  if (s !== "wishlist" && nextVal > 0) next.wishlist = 0;
  if (s === "wishlist" && nextVal > 0) {
    next.have = 0;
    next.wtt = 0;
    next.wts = 0;
    next.otw = 0;
  }
  return next;
}

function MerchStockQtyRows({
  draft,
  disabled,
  onDelta,
  t,
}: {
  draft: Record<MerchStockKey, number>;
  disabled?: boolean;
  onDelta: (s: MerchStockKey, delta: number) => void;
  t: (k: string) => string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {(["have", "wtt", "wts", "otw", "wishlist"] as MerchStockKey[]).map((s) => (
        <div key={s} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: "var(--library-stock-row-label-fg)" }}>
            {merchStockLabel(s, t)}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDelta(s, -1)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid var(--library-stock-step-minus-border)",
                background: "var(--library-stock-step-minus-bg)",
                color: "var(--library-stock-step-minus-fg)",
                fontWeight: 900,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1,
              }}
            >
              -
            </button>
            <span style={{ minWidth: 25, textAlign: "center", fontWeight: 950, fontSize: 14, color: "var(--library-stock-qty-fg)" }}>{draft[s]}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDelta(s, 1)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid var(--library-stock-step-minus-border)",
                background: "var(--library-stock-step-minus-bg)",
                color: "var(--library-stock-step-minus-fg)",
                fontWeight: 900,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1,
              }}
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function isInclusionScreenshotJunk(row: { name?: string | null; image_url?: string | null }): boolean {
  const name = String(row.name ?? "").trim();
  const url = String(row.image_url ?? "");
  let decodedUrl = url;
  try {
    decodedUrl = decodeURIComponent(url);
  } catch {
    /* keep raw */
  }
  return /captura de pantalla/i.test(name) || /captura de pantalla/i.test(decodedUrl);
}

function isInclusionItem(item: Pick<MerchItem, "category">) {
  return item.category === MERCH_INCLUSIONS_DB_CATEGORY;
}

const MERCH_CATEGORY_OPTIONS = [
  { id: "all", dbValue: null as string | null, labelKey: "merch.categories.all", fallback: "Todos" },
  { id: "plushies", dbValue: "Peluches", labelKey: "merch.categories.plushies", fallback: "Peluches" },
  { id: "lightsticks", dbValue: "Lightsticks", labelKey: "merch.categories.lightsticks", fallback: "Lightsticks" },
  { id: "clothes", dbValue: "Ropa", labelKey: "merch.categories.clothing", fallback: "Ropa" },
  { id: "accessories", dbValue: "Accesorios", labelKey: "merch.categories.accessories", fallback: "Accesorios" },
  { id: "tour_merch", dbValue: "Tour Merch", labelKey: "merch.categories.tour_merch", fallback: "Tour Merch" },
  { id: "albums", dbValue: MERCH_ALBUM_DB_CATEGORY, labelKey: "merch.categories.albums", fallback: "Álbumes" },
  { id: "inclusions", dbValue: MERCH_INCLUSIONS_DB_CATEGORY, labelKey: "market.cat_inclusion", fallback: "Inclusiones" },
] as const;

function nonAlbumMerchCardBreadcrumbLine(item: Pick<MerchItem, "group_name" | "category">, t: (key: string) => string): string {
  const g = canonicalMerchGroupDisplayName(item.group_name);
  const row = MERCH_CATEGORY_OPTIONS.find((c) => c.dbValue === item.category);
  const cat = row ? t(row.labelKey) : item.category;
  return `${g} · ${cat}`;
}

const MERCH_STOCK_FILTER_STATUSES = ["Todos", "HAVE", "OTW", "WTT", "WTS", "WISHLIST"] as const;

function merchAlbumTitleMatches(rowTitle: string | null | undefined, filterTitle: string): boolean {
  if (filterTitle === "Todos") return true;
  const a = String(rowTitle || "").trim();
  if (!a) return false;
  if (a === filterTitle) return true;
  const ka = compactFolderKey(a);
  const kb = compactFolderKey(filterTitle);
  return Boolean(ka && kb && ka === kb);
}

function merchAlbumKindOptionLabel(k: string, t: (key: string) => string): string {
  if (k === "Todos") return t("merch.filter_all_types");
  const i18nKey = `merch.album_kinds_${k}`;
  const translated = t(i18nKey);
  if (translated && translated !== i18nKey) return translated;
  return formatPhysicalMerchLabel(k);
}

function merchGoodsKindLabel(kind: MerchGoodsKind, t: (key: string) => string): string {
  const keys: Record<MerchGoodsKind, string> = {
    albums: "merch.kind_albums",
    tours: "merch.kind_tours",
    "pop-ups": "merch.kind_popups",
    events: "merch.kind_events",
    other: "merch.kind_other",
  };
  const fallbacks: Record<MerchGoodsKind, string> = {
    albums: "Álbum",
    tours: "Tour",
    "pop-ups": "Pop-ups",
    events: "Eventos",
    other: "Otros",
  };
  return t(keys[kind]) || fallbacks[kind];
}

function merchGoodsCollectionFilterLabel(kind: MerchGoodsKind, t: (key: string) => string): string {
  const keys: Record<MerchGoodsKind, string> = {
    albums: "merch.pick_album",
    tours: "merch.pick_tour",
    "pop-ups": "merch.pick_popup",
    events: "merch.pick_event",
    other: "merch.pick_other",
  };
  return t(keys[kind]) || merchGoodsKindLabel(kind, t);
}

function uniqueLabelList(values: string[]): string[] {
  const map = new Map<string, string>();
  for (const raw of values) {
    const v = String(raw || "").trim();
    if (!v) continue;
    const k = compactFolderKey(v);
    if (k && !map.has(k)) map.set(k, v);
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true }));
}

function merchStockFilterPillLabel(status: string, t: (key: string) => string): string {
  switch (status) {
    case "Todos":
      return t("common.all");
    case "HAVE":
      return t("merch.label_have");
    case "OTW":
      return t("merch.label_otw");
    case "WTT":
      return t("merch.label_wtt");
    case "WTS":
      return t("merch.label_wts");
    case "WISHLIST":
      return t("merch.inv_badge_wish");
    default:
      return status;
  }
}
type MerchStatus = { have: number; wtt: number; wts: number; wishlist: number; otw: number; updatedAt?: number; price?: number; koins?: number };

/** Stored in `user_merch_statuses.comment` for `wishlist` rows (JSON). */
type WishPosterMeta = { wantedPoster: boolean; posterTitle: string };

function parseMerchWttIds(row: { wtt_ids?: unknown; comment?: unknown }): string[] {
  const raw = row.wtt_ids;
  if (Array.isArray(raw)) {
    return raw.map((id) => String(id || "").trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map((id) => String(id || "").trim()).filter(Boolean);
    } catch {
      return raw
        .split(/[,;\s]+/)
        .map((id) => id.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function parseWishComment(raw: string | null | undefined): WishPosterMeta | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === "object" && typeof j.wantedPoster === "boolean") {
      return {
        wantedPoster: j.wantedPoster,
        posterTitle: typeof j.posterTitle === "string" ? j.posterTitle : "",
      };
    }
  } catch {
    /* legacy plain-text comments — ignore */
  }
  return null;
}

/** Mismo cartel “wanted.png” que el binder (WesternWantedFrame). */
function MerchWesternWantedFrame({
  children,
  name,
  variant = "card",
}: {
  children: React.ReactNode;
  name: string;
  variant?: "card" | "modal";
}) {
  const isCard = variant === "card";
  const len = name?.length ?? 0;
  const fontSizeConfig = isCard
    ? len > 12
      ? "7px"
      : "9px"
    : len > 12
      ? "22px"
      : "28px";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundImage: 'url("/wanted.png")',
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "26.5%",
          width: "41.4%",
          height: "38.2%",
          overflow: "hidden",
          boxShadow: "inset 0 0 12px var(--overlay-heavy)",
        }}
      >
        {children}
      </div>
      <div
        className="tan-font"
        style={{
          position: "absolute",
          top: "65.2%",
          width: "88%",
          height: "10%",
          color: "var(--text-main)",
          fontWeight: 950,
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textTransform: "uppercase",
          lineHeight: "1",
          fontSize: fontSizeConfig,
          letterSpacing: isCard ? "0px" : "-0.5px",
          pointerEvents: "none",
        }}
      >
        {(name || "WANTED").slice(0, 48)}
      </div>
    </div>
  );
}

// COLORES OFICIALES BINDER AHORA SON VARIABLES CSS
const COLORS = {
  have: { bg: "var(--bg-have)", border: "var(--border-have)", text: "var(--text-have)" },
  wtt: { bg: "var(--bg-wtt)", border: "var(--border-wtt)", text: "var(--text-wtt)" },
  wts: { bg: "var(--bg-wts)", border: "var(--border-wts)", text: "var(--text-wts)" },
  otw: { bg: "var(--bg-otw)", border: "var(--border-otw)", text: "var(--text-otw)" },
  wish: { bg: "var(--bg-wish)", border: "var(--border-wish)", text: "var(--text-wish)" }
};

/** Misma estética en todos los desplegables de filtros de la pestaña Álbumes (evita bordes gruesos / colores distintos). */
const MERCH_ALBUM_FILTER_LABEL: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  fontWeight: 900,
  color: "var(--accent-vibe-pink)",
};
const MERCH_ALBUM_FILTER_SELECT: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "12px",
  border: "1px solid var(--accent-vibe-pink)",
  outline: "none",
  color: "var(--accent-vibe-pink)",
  fontWeight: 800,
  background: "var(--bg-card)",
  boxSizing: "border-box",
};

export default function MerchClient({ variant = "merch" }: { variant?: "merch" | "albums" }) {
  const { profile, showAlert, t } = useGlobal(); // 👈 Añadido el 't' de traducciones
  const merchSearchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"catalogo_merch" | "albumes" | "inclusiones" | "mi_coleccion">(
    variant === "albums" ? "albumes" : "catalogo_merch",
  );
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeStatus, setActiveStatus] = useState("Todos");
  const [albumFilterGroup, setAlbumFilterGroup] = useState("Todos");
  const [albumFilterRegion, setAlbumFilterRegion] = useState("Todos");
  const [albumFilterAlbum, setAlbumFilterAlbum] = useState("Todos");
  const [albumFilterKind, setAlbumFilterKind] = useState("Todos");
  const [albumFilterSlot4, setAlbumFilterSlot4] = useState("Todos");
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [showCompactFilters, setShowCompactFilters] = useState(false);
 
  const [activeGroup, setActiveGroup] = useState("Todos");
  const [fMerchKind, setFMerchKind] = useState<"all" | MerchGoodsKind>("all");
  const [fMerchCollection, setFMerchCollection] = useState("all");
  const [fMerchSet, setFMerchSet] = useState("all");
  const [loading, setLoading] = useState(true);
  const [catalogSort, setCatalogSort] = useState<"default" | "album" | "stock_date" | "price" | "status">("default");
  const [merchCatalog, setMerchCatalog] = useState<MerchItem[]>([]);
  const [folderTree, setFolderTree] = useState<FolderTreeCatalog>({ albums: [] });
  const [showColabModal, setShowColabModal] = useState(false);
  const [allDbGroups, setAllDbGroups] = useState<string[]>([]);
  const [myInventory, setMyInventory] = useState<Record<string, MerchStatus>>({});
  const [wishMeta, setWishMeta] = useState<Record<string, WishPosterMeta>>({});
  const [wttOfferByMerch, setWttOfferByMerch] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const qParam = merchSearchParams.get("q");
    if (qParam != null) setSearch(qParam);
  }, [merchSearchParams]);

// MODALES
  const [infoModal, setInfoModal] = useState<MerchItem | null>(null);
  const [itemNote, setItemNote] = useState("");
  const [merchStockDraft, setMerchStockDraft] = useState<Record<MerchStockKey, number>>({
    have: 0,
    wtt: 0,
    wts: 0,
    otw: 0,
    wishlist: 0,
  });
  const [merchStockSaving, setMerchStockSaving] = useState(false);
  const [merchInspectOpen, setMerchInspectOpen] = useState(false);
  const [merchUserPrice, setMerchUserPrice] = useState("");
  const [merchPriceCurrency, setMerchPriceCurrency] = useState("EUR");

  // Cargar nota al abrir el modal info
  useEffect(() => {
    if (infoModal && profile) {
      supabase.from("user_merch_statuses").select("comment").eq("user_id", profile.id).eq("merch_id", infoModal.id).eq("status", "note").maybeSingle()
        .then(({ data }) => setItemNote(data?.comment || ""));
    }
  }, [infoModal, profile]);

  useEffect(() => {
    if (!infoModal) return;
    const inv = myInventory[infoModal.id] || { have: 0, wtt: 0, wts: 0, wishlist: 0, otw: 0 };
    setMerchStockDraft({
      have: inv.have || 0,
      wtt: inv.wtt || 0,
      wts: inv.wts || 0,
      otw: inv.otw || 0,
      wishlist: inv.wishlist || 0,
    });
    setMerchInspectOpen(false);
    if (typeof window !== "undefined") {
      setMerchUserPrice(localStorage.getItem(`binder:price:${infoModal.id}`) || "");
      setMerchPriceCurrency(localStorage.getItem(`binder:wtsCurrency:${infoModal.id}`) || "EUR");
    }
  }, [infoModal?.id, myInventory]);

  const saveItemNote = async (text: string) => {
    setItemNote(text);
    if (!profile || !infoModal) return;
    const ensured = await ensureMerchItemInDb(infoModal);
    if (!ensured.ok) return;
    if (text.trim() === "") {
       await supabase.from("user_merch_statuses").delete().eq("user_id", profile.id).eq("merch_id", infoModal.id).eq("status", "note");
    } else {
       await supabase.from("user_merch_statuses").upsert({ user_id: profile.id, merch_id: infoModal.id, status: 'note', qty: 1, comment: text }, { onConflict: "user_id,merch_id,status" });
    }
  };
  
  // WTS
  const [wtsModal, setWtsModal] = useState<MerchItem | null>(null);
  const [wtsReady, setWtsReady] = useState(false);
  const [savedWtsPriceKoins, setSavedWtsPriceKoins] = useState<number | null>(null);

  // WTT (Estilo Library Selector)
  const [wttModal, setWttModal] = useState<MerchItem | null>(null);
  const [wttSearch, setWttSearch] = useState("");
  const [wttSelectedIds, setWttSelectedIds] = useState<string[]>([]);
  const [wttComment, setWttComment] = useState("");

  const openMerchWttPicker = (item: MerchItem) => {
    setWttSelectedIds(wttOfferByMerch[item.id] ?? []);
    setWttModal(item);
  };

  useEffect(() => {
    if (!wttModal) return;
    setWttSelectedIds(wttOfferByMerch[wttModal.id] ?? []);
  }, [wttModal?.id]);

  useEffect(() => {
    if (!infoModal || !profile?.id) return;
    let cancelled = false;
    void supabase
      .from("user_merch_statuses")
      .select("wtt_ids, comment")
      .eq("user_id", profile.id)
      .eq("merch_id", infoModal.id)
      .eq("status", "wtt")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const ids = parseMerchWttIds(data);
        if (ids.length) {
          setWttOfferByMerch((prev) => ({ ...prev, [infoModal.id]: ids }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [infoModal?.id, profile?.id]);

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

  const loadMerchData = async () => {
    const catCacheKey = variant === "albums" ? MERCH_ALBUMS_CACHE_KEY : MERCH_PRODUCTS_CACHE_KEY;
    const applyRows = (rows: MerchItem[]) => {
      const merged = rows.filter((r) => {
        const img = String(r.image_url || "").trim();
        if (!img || /placehold\.co/i.test(img)) return false;
        if (isInclusionItem(r) || isInclusionScreenshotJunk(r)) return false;
        if (variant === "merch") return !isAlbumItem(r);
        if (variant === "albums") {
          if (!isAlbumItem(r)) return false;
          return !isStrayKidsPlaceholderMerchAlbumRow(r.group_name, r.album_title);
        }
        return true;
      });
      setMerchCatalog(merged);
      return merged.length;
    };

    let painted = false;
    try {
      if (typeof window !== "undefined") {
        const cached = sessionStorage.getItem(catCacheKey);
        if (cached) {
          const rows = JSON.parse(cached) as MerchItem[];
          if (Array.isArray(rows) && applyRows(rows) > 0) {
            setLoading(false);
            painted = true;
          }
        }
        const treeCached = sessionStorage.getItem(FOLDER_TREE_CACHE_KEY);
        if (treeCached) {
          const tree = JSON.parse(treeCached) as FolderTreeCatalog;
          if (tree && Array.isArray(tree.albums)) setFolderTree(tree);
        }
      }
    } catch {
      /* ignore */
    }
    if (!painted) setLoading(true);

    const catalogUrl = variant === "albums" ? "/api/merch-albums-catalog" : "/api/merch-products-catalog";
    const groupsPromise = supabase.from("groups").select("name");
    const invPromise = profile?.id
      ? supabase.from("user_merch_statuses").select("*").eq("user_id", profile.id)
      : Promise.resolve({ data: null as unknown[] | null });
    const catPromise = fetch(catalogUrl);
    const treePromise = fetch("/api/folder-tree-catalog");

    const [gDataWrap, catRes, treeRes] = await Promise.all([groupsPromise, catPromise, treePromise]);
    if (gDataWrap.data) setAllDbGroups(gDataWrap.data.map((g: { name: string }) => g.name).sort());

    let extra: MerchItem[] = [];
    try {
      if (catRes.ok) {
        const parsed = (await catRes.json()) as MerchItem[];
        if (Array.isArray(parsed)) extra = parsed;
      }
    } catch {
      /* ignore */
    }
    try {
      if (treeRes.ok) {
        const tree = (await treeRes.json()) as FolderTreeCatalog;
        if (tree && Array.isArray(tree.albums)) {
          setFolderTree(tree);
          try {
            sessionStorage.setItem(FOLDER_TREE_CACHE_KEY, JSON.stringify(tree));
          } catch {
            /* quota */
          }
        }
      }
    } catch {
      /* ignore */
    }

    applyRows(extra);
    try {
      sessionStorage.setItem(catCacheKey, JSON.stringify(extra));
    } catch {
      /* quota */
    }
    setLoading(false);

    const { data: inventory } = await invPromise;
    if (inventory) {
      const invMap: Record<string, MerchStatus> = {};
      const wm: Record<string, WishPosterMeta> = {};
      const wttOffers: Record<string, string[]> = {};
      inventory.forEach((row: any) => {
        if (row.status !== "note") {
          if (!invMap[row.merch_id]) invMap[row.merch_id] = { have: 0, wtt: 0, wts: 0, wishlist: 0, otw: 0, updatedAt: 0, price: 0, koins: 0 };
          invMap[row.merch_id][row.status as "have" | "wtt" | "wts" | "wishlist" | "otw"] = row.qty;
          const ts = Date.parse(String(row.updated_at || ""));
          if (Number.isFinite(ts)) invMap[row.merch_id].updatedAt = Math.max(invMap[row.merch_id].updatedAt ?? 0, ts);
          if (row.status === "wts") {
            invMap[row.merch_id].price = Number(row.price) || 0;
            invMap[row.merch_id].koins = resolveWtsKoins(row.price_koins, row.comment) || 0;
          }
        }
        if (row.status === "wishlist") {
          const parsed = parseWishComment(row.comment);
          wm[row.merch_id] = parsed ?? {
            wantedPoster: false,
            posterTitle: "",
          };
        }
        if (row.status === "wtt") {
          const ids = parseMerchWttIds(row);
          if (ids.length) wttOffers[row.merch_id] = ids;
        }
      });
      setMyInventory(invMap);
      setWishMeta(wm);
      setWttOfferByMerch(wttOffers);
    }
  };

  useEffect(() => {
    void loadMerchData();
  }, [profile?.id, variant]);

  const ensureMerchItemInDb = async (item: MerchItem | undefined) => {
    if (!item?.id) return { ok: false as const, error: t("common.error") };
    const { data: sessionData } = await supabase.auth.getSession();
    const tok = sessionData.session?.access_token;
    if (!tok) return { ok: false as const, error: t("merch.alert_notice_msg") };
    try {
      const res = await fetch("/api/ensure-merch-item", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          item: {
            id: item.id,
            name: item.name,
            category: item.category,
            group_name: item.group_name,
            image_url: item.image_url,
            rarity: item.rarity,
            album_title: item.album_title,
            album_type: item.album_type,
            album_version: item.album_version,
          },
        }),
      });
      if (res.ok) return { ok: true as const };
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false as const, error: body.error || t("common.error") };
    } catch {
      return { ok: false as const, error: t("common.error") };
    }
  };

  const updateMerchStatus = async (
    merchId: string,
    status: "have" | "wtt" | "wts" | "wishlist" | "otw",
    delta: number,
    opts?: { posterMeta?: WishPosterMeta; defaultTitle?: string; absoluteQty?: number }
  ) => {
    if (!profile?.id) return showAlert(t("merch.alert_notice_title"), t("merch.alert_notice_msg"));
    const catalogItem = merchCatalog.find((m) => m.id === merchId);
    if (catalogItem) {
      const ensured = await ensureMerchItemInDb(catalogItem);
      if (!ensured.ok) return showAlert(t("merch.alert_notice_title"), ensured.error);
    }
    const currentQty = myInventory[merchId]?.[status] || 0;
    const nextQty =
      opts?.absoluteQty != null ? Math.max(0, opts.absoluteQty) : Math.max(0, currentQty + delta);

    let metaForWish: WishPosterMeta | undefined;
    if (status === "wishlist" && nextQty > 0) {
      metaForWish =
        opts?.posterMeta ??
        wishMeta[merchId] ?? {
          wantedPoster: false,
          posterTitle: opts?.defaultTitle ?? "",
        };
    }

    setMyInventory((prev) => {
      const nextMap = { ...prev };
      if (!nextMap[merchId]) nextMap[merchId] = { have: 0, wtt: 0, wts: 0, wishlist: 0, otw: 0 };
      nextMap[merchId][status] = nextQty;

      if (status === "wishlist" && nextQty > 0) {
        nextMap[merchId].have = 0;
        nextMap[merchId].otw = 0;
        nextMap[merchId].wts = 0;
        nextMap[merchId].wtt = 0;
      } else if (status !== "wishlist" && nextQty > 0) {
        nextMap[merchId].wishlist = 0;
      }
      return nextMap;
    });

    setWishMeta((prev) => {
      if (status === "wishlist" && nextQty > 0 && metaForWish) {
        return { ...prev, [merchId]: metaForWish };
      }
      if (status === "wishlist" && nextQty === 0) {
        const next = { ...prev };
        delete next[merchId];
        return next;
      }
      return prev;
    });

    if (nextQty > 0) {
      const row: Record<string, unknown> = {
        user_id: profile.id,
        merch_id: merchId,
        status,
        qty: nextQty,
      };
      if (status === "wishlist" && metaForWish) {
        row.comment = JSON.stringify(metaForWish);
      }

      const { error } = await supabase
        .from("user_merch_statuses")
        .upsert(row as any, { onConflict: "user_id,merch_id,status" });
      if (error) {
        showAlert(t("merch.alert_notice_title"), error.message);
        return;
      }

      if (status === "wishlist") {
        await supabase
          .from("user_merch_statuses")
          .delete()
          .eq("user_id", profile.id)
          .eq("merch_id", merchId)
          .in("status", ["have", "otw", "wts", "wtt"]);
      } else {
        await supabase
          .from("user_merch_statuses")
          .delete()
          .eq("user_id", profile.id)
          .eq("merch_id", merchId)
          .eq("status", "wishlist");
      }
    } else {
      await supabase.from("user_merch_statuses").delete().eq("user_id", profile.id).eq("merch_id", merchId).eq("status", status);
    }
  };

  const commitMerchStockDraft = async () => {
    if (!infoModal) return;
    setMerchStockSaving(true);
    const heading = isAlbumItem(infoModal) ? merchAlbumCardHeading(infoModal) : infoModal.name;
    const cur = myInventory[infoModal.id] || { have: 0, wtt: 0, wts: 0, wishlist: 0, otw: 0 };
    const openedWtt = merchStockDraft.wtt > 0 && (cur.wtt || 0) === 0;
    const openedWts = merchStockDraft.wts > 0 && (cur.wts || 0) === 0;
    try {
      for (const k of ["have", "wtt", "wts", "otw", "wishlist"] as MerchStockKey[]) {
        const target = merchStockDraft[k] || 0;
        const prev = cur[k] || 0;
        if (target === prev) continue;
        await updateMerchStatus(infoModal.id, k, 0, {
          absoluteQty: target,
          defaultTitle: heading,
        });
      }
      if (openedWtt) openMerchWttPicker(infoModal);
      if (merchStockDraft.wtt === 0) {
        setWttOfferByMerch((prev) => {
          if (!(infoModal.id in prev)) return prev;
          const next = { ...prev };
          delete next[infoModal.id];
          return next;
        });
      }
      if (openedWts) setWtsModal(infoModal);
    } finally {
      setMerchStockSaving(false);
    }
  };

  const saveWishPosterMeta = async (merchId: string, meta: WishPosterMeta) => {
    if (!profile?.id) return;
    setWishMeta((prev) => ({ ...prev, [merchId]: meta }));
    await supabase
      .from("user_merch_statuses")
      .upsert(
        {
          user_id: profile.id,
          merch_id: merchId,
          status: "wishlist",
          qty: 1,
          comment: JSON.stringify(meta),
        } as any,
        { onConflict: "user_id,merch_id,status" }
      );
  };

  const handlePublishWts = async () => {
    if (!wtsModal || !profile) return;
    const ensured = await ensureMerchItemInDb(wtsModal);
    if (!ensured.ok) {
      showAlert(t("merch.alert_notice_title"), ensured.error);
      return;
    }
    const listingId = wtsModal.id;
    const priceRaw = typeof window !== "undefined" ? localStorage.getItem(`binder:price:${listingId}`) || "" : "";
    const koinsRaw = typeof window !== "undefined" ? localStorage.getItem(`binder:priceKoins:${listingId}`) || "" : "";
    const currencyValue = typeof window !== "undefined" ? localStorage.getItem(`binder:wtsCurrency:${listingId}`) || "EUR" : "EUR";
    const originValue = typeof window !== "undefined" ? localStorage.getItem(`binder:wtsOrigin:${listingId}`) || "" : "";
    const shippingValue = typeof window !== "undefined" ? localStorage.getItem(`binder:shipping:${listingId}`) || "Worldwide" : "Worldwide";
    const negotiableValue = typeof window !== "undefined" && localStorage.getItem(`binder:negotiable:${listingId}`) === "true";
    const commentValue = typeof window !== "undefined" ? localStorage.getItem(`binder:comment:${listingId}`) || "" : "";

    const fiat = parseFloat(String(priceRaw).replace(",", ".")) || 0;
    const koins = Math.max(0, parseInt(String(koinsRaw), 10) || 0);
    if (fiat <= 0 && koins <= 0) {
      showAlert(t("merch.alert_notice_title"), t("merch.wts_need_price_or_koins"));
      return;
    }

    const payload: Record<string, unknown> = {
      user_id: profile.id,
      merch_id: listingId,
      status: "wts",
      qty: 1,
      price: fiat > 0 ? fiat : 0,
      currency: currencyValue,
      comment: withWtsListingMarks(commentValue, koins, {
        origin: originValue,
        shipping: shippingValue,
        negotiable: negotiableValue,
      }),
      origin_country: originValue || null,
      shipping_to: shippingValue,
      wts_negotiable: negotiableValue,
    };
    if (koins > 0) {
      payload.price_koins = koins;
    } else if (savedWtsPriceKoins != null && savedWtsPriceKoins > 0) {
      payload.price_koins = null;
    }

    let { data: newAd, error } = await supabase
      .from("user_merch_statuses")
      .upsert(payload as any, { onConflict: "user_id,merch_id,status" })
      .select("id")
      .single();

    if (error) {
      const retryPayload = { ...payload };
      delete retryPayload.price_koins;
      delete retryPayload.origin_country;
      delete retryPayload.shipping_to;
      delete retryPayload.wts_negotiable;
      const retry = await supabase
        .from("user_merch_statuses")
        .upsert(retryPayload as any, { onConflict: "user_id,merch_id,status" })
        .select("id")
        .single();
      newAd = retry.data;
      error = retry.error;
    }

    if (error) {
      const msg = String(error.message || "");
      const details = String((error as { details?: string }).details || "");
      const combined = `${msg} ${details}`.toLowerCase();
      // PostgREST: columna ausente o caché desfasada — solo si el mensaje menciona price_koins (evita falsos positivos con "schema cache" suelto).
      const isPriceKoinsDb =
        combined.includes("price_koins") &&
        (combined.includes("schema cache") ||
          combined.includes("does not exist") ||
          combined.includes("could not find") ||
          combined.includes("unknown column"));
      if (isPriceKoinsDb) {
        showAlert(t("merch.alert_notice_title"), t("merch.wts_koins_column_missing"));
      } else {
        const userMsg = [msg, details].filter(Boolean).join(" — ");
        showAlert(t("merch.alert_notice_title"), userMsg || t("common.error"));
      }
      return;
    }

    if (newAd) {
      await avisarFavoritos(profile.id, "market_id", newAd.id);
      showAlert(t("merch.alert_created_title"), t("merch.alert_created_msg").replace("{name}", wtsModal.name));
      setMyInventory((p) => {
        const m = { ...p };
        if (!m[wtsModal.id]) m[wtsModal.id] = { have: 0, wtt: 0, wts: 0, wishlist: 0, otw: 0 };
        m[wtsModal.id].wts = 1;
        return m;
      });
    }
    setWtsModal(null);
    setWtsReady(false);
    setSavedWtsPriceKoins(null);
  };

  const handlePublishWtt = async () => {
    if (!wttModal || !profile || wttSelectedIds.length === 0) return showAlert(t("merch.alert_notice_title"), t("merch.alert_select_wanted"));
    const ensured = await ensureMerchItemInDb(wttModal);
    if (!ensured.ok) return showAlert(t("merch.alert_notice_title"), ensured.error);
    for (const wantedId of wttSelectedIds) {
      const wanted = merchCatalog.find((m) => m.id === wantedId);
      if (wanted) await ensureMerchItemInDb(wanted);
    }
    
    const wantedNames = wttSelectedIds.map(id => merchCatalog.find(m => m.id === id)?.name).filter(Boolean);
    const finalComment = `Busco: ${wantedNames.join(', ')}. ${wttComment}`;

   const { data: newAd, error } = await supabase.from("user_merch_statuses").upsert({
      user_id: profile.id, merch_id: wttModal.id, status: 'wtt', qty: 1, comment: finalComment,
      wtt_ids: wttSelectedIds
    }, { onConflict: "user_id,merch_id,status" }).select('id').single();

    let savedAd = newAd;
    let saveErr = error;
    if (saveErr) {
      const retry = await supabase.from("user_merch_statuses").upsert({
        user_id: profile.id, merch_id: wttModal.id, status: 'wtt', qty: 1, comment: finalComment,
      }, { onConflict: "user_id,merch_id,status" }).select('id').single();
      savedAd = retry.data;
      saveErr = retry.error;
    }

    if (!saveErr && savedAd) {
      await avisarFavoritos(profile.id, 'market_id', savedAd.id);
      showAlert(t("merch.alert_created_title"), t("merch.alert_created_msg").replace('{name}', wttModal.name));
      setMyInventory(p => { const m = {...p}; if(!m[wttModal.id]) m[wttModal.id] = {have:0,wtt:0,wts:0,wishlist:0,otw:0}; m[wttModal.id].wtt = 1; return m; });
      setWttOfferByMerch((prev) => ({ ...prev, [wttModal.id]: [...wttSelectedIds] }));
    } else if (saveErr) {
      showAlert(t("merch.alert_notice_title"), saveErr.message || t("common.error"));
      return;
    }
    setWttModal(null); setWttSelectedIds([]); setWttComment("");
  };

  useEffect(() => {
    if (!wtsModal) {
      setWtsReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const writeLs = (priceV: string, currencyV: string, koinsV: string, commentV: string, originV: string, shippingV: string, negotiableV: boolean) => {
        try {
          localStorage.setItem(`binder:price:${wtsModal.id}`, priceV);
          localStorage.setItem(`binder:priceKoins:${wtsModal.id}`, koinsV);
          localStorage.setItem(`binder:wtsCurrency:${wtsModal.id}`, currencyV);
          localStorage.setItem(`binder:wtsOrigin:${wtsModal.id}`, originV);
          localStorage.setItem(`binder:shipping:${wtsModal.id}`, shippingV);
          localStorage.setItem(`binder:negotiable:${wtsModal.id}`, String(negotiableV));
          localStorage.setItem(`binder:comment:${wtsModal.id}`, commentV);
        } catch {
          /* ignore */
        }
      };
      if (!profile?.id) {
        writeLs("", "EUR", "", "", "", "Worldwide", false);
        if (!cancelled) setWtsReady(true);
        return;
      }
      const { data } = await supabase
        .from("user_merch_statuses")
        .select("price, currency, comment, price_koins")
        .eq("user_id", profile.id)
        .eq("merch_id", wtsModal.id)
        .eq("status", "wts")
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        writeLs("", "EUR", "", "", "", "Worldwide", false);
        setSavedWtsPriceKoins(null);
        setWtsReady(true);
        return;
      }
      const extras = parseWtsListingExtras(typeof data.comment === "string" ? data.comment : "");
      const koinsSaved = resolveWtsKoins(data.price_koins, data.comment);
      writeLs(
        data.price != null ? String(data.price) : "",
        data.currency || "EUR",
        koinsSaved != null ? String(koinsSaved) : "",
        stripWtsKoinsMark(typeof data.comment === "string" ? data.comment : ""),
        extras.origin || "",
        extras.shipping || "Worldwide",
        Boolean(extras.negotiable),
      );
      setSavedWtsPriceKoins(koinsSaved);
      setWtsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [wtsModal?.id, profile?.id]);

  const albumCatalogItems = useMemo(
    () => merchCatalog.filter((i) => isAlbumItem(i)),
    [merchCatalog]
  );
  const inclusionCatalogItems = useMemo(
    () => merchCatalog.filter((i) => isInclusionItem(i)),
    [merchCatalog]
  );
  const merchCatalogItems = useMemo(
    () => merchCatalog.filter((i) => !isAlbumItem(i) && !isInclusionItem(i)),
    [merchCatalog]
  );

  const merchGoodsKindOptions = useMemo(() => {
    const present = new Set<MerchGoodsKind>();
    for (const item of merchCatalogItems) present.add(merchGoodsMeta(item).kind);
    for (const f of folderTree.albums) {
      if (f.source === "tours") present.add("tours");
      if (f.source === "pop-ups") present.add("pop-ups");
      if (f.source === "events") present.add("events");
    }
    return MERCH_GOODS_KIND_ORDER.filter((k) => present.has(k));
  }, [merchCatalogItems, folderTree]);

  const merchGoodsCollectionOptions = useMemo(() => {
    const names: string[] = [];
    for (const item of merchCatalogItems) {
      const meta = merchGoodsMeta(item);
      if (fMerchKind !== "all" && meta.kind !== fMerchKind) continue;
      if (meta.collection) names.push(meta.collection);
    }
    if (fMerchKind === "all" || fMerchKind === "tours") {
      for (const f of folderTree.albums) if (f.source === "tours") names.push(f.album_title);
    }
    if (fMerchKind === "all" || fMerchKind === "pop-ups") {
      for (const f of folderTree.albums) if (f.source === "pop-ups") names.push(f.album_title);
    }
    if (fMerchKind === "all" || fMerchKind === "events") {
      for (const f of folderTree.albums) if (f.source === "events") names.push(f.album_title);
    }
    return uniqueLabelList(names);
  }, [merchCatalogItems, folderTree, fMerchKind]);

  const merchGoodsSetOptions = useMemo(() => {
    if (fMerchKind === "all") return [];
    const names: string[] = [];
    for (const item of merchCatalogItems) {
      const meta = merchGoodsMeta(item);
      if (meta.kind !== fMerchKind) continue;
      if (fMerchCollection !== "all" && !merchGoodsNameMatches(meta.collection, fMerchCollection)) continue;
      if (meta.productSet) names.push(meta.productSet);
    }
    return uniqueLabelList(names);
  }, [merchCatalogItems, fMerchKind, fMerchCollection]);
  const albumLikeCatalogItems = activeTab === "inclusiones" ? inclusionCatalogItems : albumCatalogItems;

  const merchFolderSlice = useMemo(() => {
    const rows = folderAlbumsForMerchFilters(folderTree, {
      group: albumFilterGroup,
      region: albumFilterRegion,
      albumTitle: albumFilterAlbum,
    });
    if (activeTab === "inclusiones") return rows.filter((a) => a.hasInclusions);
    return rows;
  }, [folderTree, albumFilterGroup, albumFilterRegion, albumFilterAlbum, activeTab]);

  const merchFolderForKinds = useMemo(() => {
    return folderAlbumsForMerchFilters(folderTree, {
      group: albumFilterGroup,
      region: albumFilterRegion,
      albumTitle: albumFilterAlbum,
    });
  }, [folderTree, albumFilterGroup, albumFilterRegion, albumFilterAlbum]);

  const albumGroupOptions = useMemo(() => {
    const canon = new Set<string>();
    albumLikeCatalogItems.forEach((r) => {
      const g = r.group_name?.trim();
      if (g) canon.add(canonicalMerchGroupDisplayName(g));
    });
    for (const f of folderTree.albums) {
      if (f.source !== "albums") continue;
      if (activeTab === "inclusiones" && !f.hasInclusions) continue;
      const g = canonicalMerchGroupDisplayName(f.group_slug.replace(/[-_]+/g, " "));
      if (g) canon.add(g);
    }
    return ["Todos", ...Array.from(canon).sort((a, b) => a.localeCompare(b))];
  }, [albumLikeCatalogItems, folderTree, activeTab]);

  const albumTitleOptions = useMemo(() => {
    let rows = albumLikeCatalogItems;
    if (albumFilterGroup !== "Todos") {
      rows = rows.filter((r) => albumRowMatchesMerchGroupFilter(r.group_name, albumFilterGroup));
    }
    if (albumFilterRegion !== "Todos") {
      rows = rows.filter((r) => {
        const rk = deriveAlbumRegionKey(r);
        const key = rk ?? "unknown";
        return key === albumFilterRegion;
      });
    }
    const map = new Map<string, string | null>();
    const seenKey = new Set<string>();
    rows.forEach((r) => {
      const title = String(r.album_title || "").trim();
      if (!title) return;
      const k = compactFolderKey(title);
      if (k) seenKey.add(k);
      if (!map.has(title)) {
        map.set(title, (r as any).release_date || null);
      }
    });
    const folderRows = folderAlbumsForMerchFilters(folderTree, {
      group: albumFilterGroup,
      region: albumFilterRegion,
      albumTitle: "Todos",
    }).filter((f) => (activeTab === "inclusiones" ? f.hasInclusions : true));
    for (const f of folderRows) {
      const k = compactFolderKey(f.album_title) || compactFolderKey(f.album_slug);
      if (!k || seenKey.has(k)) continue;
      seenKey.add(k);
      const title = f.album_title || f.album_slug;
      if (!map.has(title)) map.set(title, null);
    }
    const sortGroupName =
      albumFilterGroup !== "Todos"
        ? albumFilterGroup
        : rows.length > 0 && rows.every((r) => isStrayKidsGroupName(r.group_name))
          ? "Stray Kids"
          : folderRows.some((f) => /stray/i.test(f.group_slug))
            ? "Stray Kids"
            : null;
    const sorted = sortCollectionEntries(
      Array.from(map.entries()).map(([name, releaseDate]) => ({ name, releaseDate })),
      { groupName: sortGroupName },
    ).map((x) => x.name);
    return ["Todos", ...sorted];
  }, [albumLikeCatalogItems, albumFilterGroup, albumFilterRegion, folderTree, activeTab]);

  const albumRegionOptions = useMemo(() => {
    let rows = albumLikeCatalogItems;
    if (albumFilterGroup !== "Todos") {
      rows = rows.filter((r) => albumRowMatchesMerchGroupFilter(r.group_name, albumFilterGroup));
    }
    const present = new Set<string>();
    rows.forEach((r) => {
      const rk = deriveAlbumRegionKey(r);
      present.add(rk ?? "unknown");
    });
    for (const f of folderTree.albums) {
      if (f.source !== "albums") continue;
      if (activeTab === "inclusiones" && !f.hasInclusions) continue;
      if (albumFilterGroup !== "Todos") {
        const g = f.group_slug.replace(/[-_]+/g, " ");
        if (!compactFolderKey(g).includes(compactFolderKey(albumFilterGroup)) && !compactFolderKey(albumFilterGroup).includes(compactFolderKey(g))) {
          continue;
        }
      }
      present.add(f.region);
    }
    return ["Todos", ...ALBUM_REGION_ORDER.filter((rk) => present.has(rk))];
  }, [albumLikeCatalogItems, albumFilterGroup, folderTree, activeTab]);

  const albumKindOptions = useMemo(() => {
    let rows = albumLikeCatalogItems;
    if (albumFilterGroup !== "Todos") {
      rows = rows.filter((r) => albumRowMatchesMerchGroupFilter(r.group_name, albumFilterGroup));
    }
    if (albumFilterRegion !== "Todos") {
      rows = rows.filter((r) => {
        const rk = deriveAlbumRegionKey(r);
        const key = rk ?? "unknown";
        return key === albumFilterRegion;
      });
    }
    if (albumFilterAlbum !== "Todos") rows = rows.filter((r) => merchAlbumTitleMatches(r.album_title, albumFilterAlbum));
    const keys = new Set<string>(rows.map((r) => deriveAlbumKindKey(r)));
    if (activeTab !== "inclusiones") {
      for (const f of merchFolderForKinds) {
        for (const k of f.portadasKinds) keys.add(k);
      }
    }
    const ordered = ALBUM_KIND_ORDER.filter((k) => keys.has(k));
    const extra = [...keys]
      .filter((k) => !(ALBUM_KIND_ORDER as string[]).includes(k))
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true }));
    return ["Todos", ...ordered, ...extra];
  }, [albumLikeCatalogItems, albumFilterGroup, albumFilterRegion, albumFilterAlbum, merchFolderForKinds, activeTab]);

  const albumSlot4Options = useMemo(() => {
    let rows = albumLikeCatalogItems;
    if (albumFilterGroup !== "Todos") {
      rows = rows.filter((r) => albumRowMatchesMerchGroupFilter(r.group_name, albumFilterGroup));
    }
    if (albumFilterRegion !== "Todos") {
      rows = rows.filter((r) => {
        const rk = deriveAlbumRegionKey(r);
        const key = rk ?? "unknown";
        return key === albumFilterRegion;
      });
    }
    if (albumFilterAlbum !== "Todos") rows = rows.filter((r) => merchAlbumTitleMatches(r.album_title, albumFilterAlbum));
    if (albumFilterKind === "Todos") return ["Todos"];
    rows = rows.filter((r) => deriveAlbumKindKey(r) === (albumFilterKind as AlbumKindKey));
    if (isAccordionKindKey(albumFilterKind)) {
      const labels = rows
        .map((r) => merchAlbumMemberLabel(r))
        .filter((x): x is string => Boolean(x?.trim()));
      return ["Todos", ...sortMerchAlbumSlot4Labels("accordion", labels)];
    }
    const labels = rows.map((r) => merchAlbumSlot4Value(r)).filter((x) => Boolean(x?.trim()));
    return ["Todos", ...sortMerchAlbumSlot4Labels(albumFilterKind as AlbumKindKey | "Todos", labels)];
  }, [albumLikeCatalogItems, albumFilterGroup, albumFilterRegion, albumFilterAlbum, albumFilterKind]);

  useEffect(() => {
    if (albumFilterSlot4 !== "Todos" && !albumSlot4Options.includes(albumFilterSlot4)) {
      setAlbumFilterSlot4("Todos");
    }
  }, [albumSlot4Options, albumFilterSlot4]);

  useEffect(() => {
    setAlbumFilterRegion("Todos");
    setAlbumFilterAlbum("Todos");
    setAlbumFilterKind("Todos");
    setAlbumFilterSlot4("Todos");
  }, [albumFilterGroup]);

  useEffect(() => {
    setAlbumFilterAlbum("Todos");
    setAlbumFilterKind("Todos");
    setAlbumFilterSlot4("Todos");
  }, [albumFilterRegion]);

  useEffect(() => {
    setAlbumFilterKind("Todos");
    setAlbumFilterSlot4("Todos");
  }, [albumFilterAlbum]);

  useEffect(() => {
    setAlbumFilterSlot4("Todos");
  }, [albumFilterKind]);

  useEffect(() => {
    setFMerchCollection("all");
    setFMerchSet("all");
  }, [fMerchKind]);

  useEffect(() => {
    setFMerchSet("all");
  }, [fMerchCollection]);

  const filteredMerch = useMemo(() => {
    const selectedCategory = MERCH_CATEGORY_OPTIONS.find((c) => c.id === activeCategory);
    const items = merchCatalog.filter((item) => {
      const matchesSearch = !search.trim() || merchRowMatchesQuery(item, search);

      let matchesCategory = true;
      if (activeTab === "catalogo_merch" || activeTab === "mi_coleccion") {
        matchesCategory = !selectedCategory?.dbValue || item.category === selectedCategory.dbValue;
      }

      const matchesGroup =
        activeTab === "albumes" || activeTab === "inclusiones"
          ? albumFilterGroup === "Todos" || albumRowMatchesMerchGroupFilter(item.group_name, albumFilterGroup)
          : activeGroup === "Todos" || item.group_name === activeGroup;

      let matchesGoodsFilters = true;
      if (activeTab === "catalogo_merch" || activeTab === "mi_coleccion") {
        const meta = merchGoodsMeta(item);
        if (fMerchKind !== "all" && meta.kind !== fMerchKind) matchesGoodsFilters = false;
        if (fMerchCollection !== "all" && !merchGoodsNameMatches(meta.collection, fMerchCollection)) matchesGoodsFilters = false;
        if (fMerchSet !== "all" && !merchGoodsNameMatches(meta.productSet, fMerchSet)) matchesGoodsFilters = false;
      }

      let matchesAlbumFilters = true;
      if (activeTab === "albumes" || activeTab === "inclusiones") {
        const at = item.album_title?.trim() ?? "";
        if (albumFilterAlbum !== "Todos" && !merchAlbumTitleMatches(at, albumFilterAlbum)) matchesAlbumFilters = false;

        if (albumFilterRegion !== "Todos") {
          const rk = deriveAlbumRegionKey(item);
          const key = rk ?? "unknown";
          if (key !== albumFilterRegion) matchesAlbumFilters = false;
        }

        if (albumFilterKind !== "Todos") {
          if (deriveAlbumKindKey(item) !== albumFilterKind) matchesAlbumFilters = false;
        }

        if (albumFilterSlot4 !== "Todos") {
          const slot = merchAlbumSlot4Value(item);
          if (slot !== albumFilterSlot4) matchesAlbumFilters = false;
        }
      }

      const inv = myInventory[item.id] || { have: 0, otw: 0, wtt: 0, wts: 0, wishlist: 0 };

      let matchesTabSlice = true;
      if (activeTab === "catalogo_merch" && (isAlbumItem(item) || isInclusionItem(item))) matchesTabSlice = false;
      if (activeTab === "albumes" && !isAlbumItem(item)) matchesTabSlice = false;
      if (activeTab === "inclusiones" && !isInclusionItem(item)) matchesTabSlice = false;

      let matchesTab = true;
      if (activeTab === "mi_coleccion") {
        matchesTab = inv.have > 0 || inv.wtt > 0 || inv.wts > 0 || inv.wishlist > 0 || inv.otw > 0;
      }

      let matchesStatus = true;
      if (activeStatus !== "Todos") {
        if (activeStatus === "HAVE") matchesStatus = inv.have > 0;
        else if (activeStatus === "OTW") matchesStatus = inv.otw > 0;
        else if (activeStatus === "WTT") matchesStatus = inv.wtt > 0;
        else if (activeStatus === "WTS") matchesStatus = inv.wts > 0;
        else if (activeStatus === "WISHLIST") matchesStatus = inv.wishlist > 0;
      }

      return (
        matchesSearch &&
        matchesCategory &&
        matchesGroup &&
        matchesGoodsFilters &&
        matchesAlbumFilters &&
        matchesTabSlice &&
        matchesTab &&
        matchesStatus
      );
    });
    if (catalogSort === "default") {
      if (activeTab === "albumes" || activeTab === "inclusiones") {
        items.sort(compareMerchAlbumCatalogItems);
      }
    } else {
      items.sort((a, b) => {
        if (catalogSort === "album") {
          const an = String(a.album_title || a.name || "");
          const bn = String(b.album_title || b.name || "");
          const c = an.localeCompare(bn, undefined, { sensitivity: "base" });
          if (c) return c;
          return String(a.album_version || "").localeCompare(String(b.album_version || ""), undefined, { sensitivity: "base" });
        }
        const ia = myInventory[a.id];
        const ib = myInventory[b.id];
        if (catalogSort === "stock_date") return (ib?.updatedAt ?? 0) - (ia?.updatedAt ?? 0);
        if (catalogSort === "status") {
          const ra = stockStatusRank(ia);
          const rb = stockStatusRank(ib);
          if (ra !== rb) return ra - rb;
          return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
        }
        const sa = (ia?.price ?? 0) * 1_000_000 + (ia?.koins ?? 0);
        const sb = (ib?.price ?? 0) * 1_000_000 + (ib?.koins ?? 0);
        return sb - sa;
      });
    }
    return items;
  }, [
    merchCatalog,
    search,
    activeTab,
    activeCategory,
    activeGroup,
    fMerchKind,
    fMerchCollection,
    fMerchSet,
    albumFilterGroup,
    albumFilterRegion,
    albumFilterAlbum,
    albumFilterKind,
    albumFilterSlot4,
    activeStatus,
    myInventory,
    catalogSort,
  ]);

  const progressSnapshot = useMemo(() => {
    const collectedHave = (items: MerchItem[]) =>
      items.filter((i) => (myInventory[i.id]?.have ?? 0) > 0).length;

    if (activeTab === "catalogo_merch") {
      const total = merchCatalogItems.length;
      const coll = collectedHave(merchCatalogItems);
      return {
        total,
        coll,
        pct: total ? Math.round((coll / total) * 100) : 0,
        msgKey: "merch.progress_msg_merch" as const,
      };
    }
    if (activeTab === "albumes") {
      const total = albumCatalogItems.length;
      const coll = collectedHave(albumCatalogItems);
      return {
        total,
        coll,
        pct: total ? Math.round((coll / total) * 100) : 0,
        msgKey: "merch.progress_msg_albums" as const,
      };
    }
    if (activeTab === "inclusiones") {
      const total = inclusionCatalogItems.length;
      const coll = collectedHave(inclusionCatalogItems);
      return {
        total,
        coll,
        pct: total ? Math.round((coll / total) * 100) : 0,
        msgKey: "merch.progress_msg_albums" as const,
      };
    }
    const total = merchCatalog.length;
    const coll = merchCatalog.filter((i) => (myInventory[i.id]?.have ?? 0) > 0).length;
    return {
      total,
      coll,
      pct: total ? Math.round((coll / total) * 100) : 0,
      msgKey: "merch.progress_msg_collection" as const,
    };
  }, [activeTab, merchCatalog, merchCatalogItems, albumCatalogItems, inclusionCatalogItems, myInventory]);

  const categoryPills =
    activeTab === "catalogo_merch"
      ? MERCH_CATEGORY_OPTIONS.filter((c) => c.id !== "albums" && c.id !== "inclusions")
      : MERCH_CATEGORY_OPTIONS;

  const hasMerchFiltersActive =
    search.trim() !== "" ||
    activeCategory !== "all" ||
    activeStatus !== "Todos" ||
    activeGroup !== "Todos" ||
    fMerchKind !== "all" ||
    fMerchCollection !== "all" ||
    fMerchSet !== "all" ||
    albumFilterGroup !== "Todos" ||
    albumFilterRegion !== "Todos" ||
    albumFilterAlbum !== "Todos" ||
    albumFilterKind !== "Todos" ||
    albumFilterSlot4 !== "Todos";

  const clearMerchFilters = () => {
    setSearch("");
    setActiveCategory("all");
    setActiveStatus("Todos");
    setActiveGroup("Todos");
    setFMerchKind("all");
    setFMerchCollection("all");
    setFMerchSet("all");
    setAlbumFilterGroup("Todos");
    setAlbumFilterRegion("Todos");
    setAlbumFilterAlbum("Todos");
    setAlbumFilterKind("Todos");
    setAlbumFilterSlot4("Todos");
  };

  const showContributeEmpty = useMemo(() => {
    if (search.trim()) return false;
    if (activeStatus !== "Todos") return false;
    if (albumFilterSlot4 !== "Todos") return false;
    if (activeTab === "catalogo_merch") {
      if (activeCategory !== "all") return false;
      if (fMerchKind === "all" && fMerchCollection === "all") return false;
      return true;
    }
    if (activeTab !== "albumes" && activeTab !== "inclusiones") return false;
    if (albumFilterAlbum === "Todos" && albumFilterKind === "Todos") return false;
    if (activeTab === "inclusiones") {
      if (albumFilterAlbum === "Todos") return false;
      if (merchFolderSlice.length > 0) return true;
      return merchFolderForKinds.some((f) => f.hasInclusions);
    }
    if (merchFolderForKinds.length === 0) return false;
    if (albumFilterKind === "Todos") return true;
    return merchFolderForKinds.some((f) => f.portadasKinds.includes(albumFilterKind));
  }, [
    search,
    activeStatus,
    albumFilterSlot4,
    activeTab,
    activeCategory,
    fMerchKind,
    fMerchCollection,
    albumFilterAlbum,
    albumFilterKind,
    merchFolderSlice,
    merchFolderForKinds,
  ]);

  const colabFolderLabel = [
    albumFilterAlbum !== "Todos" ? formatCollectionOptionLabel(albumFilterAlbum) : "",
    albumFilterKind !== "Todos" ? merchAlbumKindOptionLabel(albumFilterKind, t) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const seedMockData = async () => {
    const safeImage = (text: string) => `https://placehold.co/400x600/f4ebf8/8C659C?text=${encodeURIComponent(text)}`;
    const mockData = [
      { name: "Wolf Chan Plushie", category: "Peluches", group_name: "Stray Kids", rarity: "Común", image_url: safeImage("Wolf Chan") },
      { name: "Nachimbong Ver. 2", category: "Lightsticks", group_name: "Stray Kids", rarity: "Común", image_url: safeImage("Nachimbong") },
      { name: "MANIAC Tour Hoodie", category: "Ropa", group_name: "Stray Kids", rarity: "Tour Merch", image_url: safeImage("Tour Hoodie") },
      { name: "Lightiny Ver. 2", category: "Lightsticks", group_name: "ATEEZ", rarity: "Común", image_url: safeImage("Lightiny") },
      { name: "CandyBong Infinity", category: "Lightsticks", group_name: "TWICE", rarity: "Común", image_url: safeImage("CandyBong") },
    ];
    await supabase.from("merch_items").insert(mockData);
    loadMerchData();
    showAlert(t("merch.alert_loaded_title"), t("merch.alert_loaded_msg"));
  };

  const Badge = ({ label, colorObj }: { label: string, colorObj: any }) => (
    <span style={{ background: colorObj.bg, color: colorObj.text, border: `1px solid ${colorObj.border}`, fontSize: "9px", padding: "2px 6px", borderRadius: "6px", fontWeight: 900 }}>
      {label}
    </span>
  );

 return (
    <div className="merch-root" style={{ minHeight: variant === "albums" ? undefined : "100vh", backgroundColor: "var(--bg-main)", display: "flex", flexDirection: "column", color: "var(--text-main)" }}>
      <AdRailLayout section="merch">
      <main className="merch-main" style={{ flex: 1, width: "100%", maxWidth: "1400px", margin: "0 auto", padding: variant === "albums" ? "8px 20px 40px" : "40px 20px" }}>
        
        {variant === "merch" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Package size={28} color="var(--accent-vibe-cyan)" />
            <h1 className="tan-font" style={{ fontSize: "36px", color: "var(--text-heading)", margin: 0 }}>
              {t("merch.title")}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <BindersShortcut />
            {merchCatalog.length === 0 && !loading && (
               <button onClick={seedMockData} style={{ background: "var(--text-main)", color: "var(--bg-main)", padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: 800 }}>{t("merch.btn_demo")}</button>
            )}
          </div>
        </div>
        )}

        <section className="merch-progress-banner" style={{ backgroundColor: "var(--bg-card)", padding: "25px 35px", borderRadius: "24px", border: "1px solid var(--color-border)", marginBottom: "30px", display: loading ? "none" : "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 10px 20px var(--shadow-card)" }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: "var(--text-subheading)", fontWeight: 800, fontSize: "16px", margin: "0 0 10px 0" }}>
              {(t(progressSnapshot.msgKey) || t("merch.progress_msg")).replace("{percent}", progressSnapshot.pct.toString())}
            </p>
            <div style={{ width: "100%", maxWidth: "400px", height: "10px", backgroundColor: "var(--bg-soft)", borderRadius: "99px", overflow: "hidden" }}>
              <div style={{ width: `${progressSnapshot.pct}%`, height: "100%", backgroundColor: "var(--accent-vibe-cyan)", borderRadius: "99px", transition: "width 0.5s ease" }} />
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "42px", fontWeight: 900, color: "var(--accent-vibe-pink)", lineHeight: 1 }}>
              {progressSnapshot.coll}<span style={{fontSize: "24px", color:"var(--text-muted)"}}>/{progressSnapshot.total}</span>
            </div>
            <span style={{ fontSize: "12px", fontWeight: 900, color: "var(--text-muted)", textTransform: "uppercase" }}>
              {t("merch.unique_items")}
            </span>
          </div>
        </section>

       {isCompactViewport && !loading && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button onClick={() => setShowCompactFilters((v) => !v)} style={{ border: "1px solid var(--accent-vibe-pink)", background: "var(--bg-card)", color: "var(--accent-vibe-pink)", borderRadius: "99px", padding: "10px 14px", fontWeight: 900, cursor: "pointer" }}>
              {showCompactFilters ? (t("common.close") || "Cerrar") : (t("common.filters") || "Filtros")}
            </button>
          </div>
       )}
       <div className="page-filters-panel" style={{ display: loading ? "none" : !isCompactViewport || showCompactFilters ? "block" : "none", background: "var(--bg-card)", padding: "20px", borderRadius: "20px", border: "1px solid var(--color-border)", marginBottom: "30px" }}>
          {variant === "merch" && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid var(--color-border)", paddingBottom: "15px", flexWrap: "wrap" }}>
             <button onClick={() => { setActiveTab("catalogo_merch"); setActiveStatus("Todos"); }} style={{ background: "none", border: "none", padding: "10px 16px", fontSize: "16px", fontWeight: 900, color: activeTab === "catalogo_merch" ? "var(--accent-vibe-cyan)" : "var(--text-muted)", borderBottom: activeTab === "catalogo_merch" ? "3px solid var(--accent-vibe-cyan)" : "3px solid transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
               <LayoutGrid size={18}/> {t("merch.tab_catalog_merch")}
             </button>
             <button onClick={() => { setActiveTab("mi_coleccion"); setActiveStatus("Todos"); }} style={{ background: "none", border: "none", padding: "10px 16px", fontSize: "16px", fontWeight: 900, color: activeTab === "mi_coleccion" ? "var(--accent-vibe-pink)" : "var(--text-muted)", borderBottom: activeTab === "mi_coleccion" ? "3px solid var(--accent-vibe-pink)" : "3px solid transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
               <Archive size={18}/> {t("merch.tab_inventory")}
             </button>
          </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
            {(activeTab === "catalogo_merch" || activeTab === "mi_coleccion") && (
            <div className="h-scroll-pills" style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
              {categoryPills.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{ padding: "8px 16px", borderRadius: "99px", border: "1px solid var(--accent-vibe-violet)", backgroundColor: activeCategory === cat.id ? "var(--accent-vibe-violet)" : "var(--bg-card)", color: activeCategory === cat.id ? "var(--modal-cta-fg)" : "var(--accent-vibe-violet)", fontWeight: 800, cursor: "pointer", fontSize: "13px" }}>
                  {t(cat.labelKey) || cat.fallback}
                </button>
              ))}
            </div>
            )}

            {(activeTab === "albumes" || activeTab === "inclusiones") && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "stretch", flex: "1 1 100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={MERCH_ALBUM_FILTER_LABEL}><Users size={13} /> {t("merch.album_filter_group")}</label>
                  <select value={albumFilterGroup} onChange={(e) => setAlbumFilterGroup(e.target.value)} style={{ ...MERCH_ALBUM_FILTER_SELECT, minWidth: "140px" }}>
                    {albumGroupOptions.map((g) => (
                      <option key={g} value={g}>{g === "Todos" ? t("merch.filter_all_groups") : g}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={MERCH_ALBUM_FILTER_LABEL}><MapPin size={13} /> {t("merch.album_filter_region")}</label>
                  <select value={albumFilterRegion} onChange={(e) => setAlbumFilterRegion(e.target.value)} style={{ ...MERCH_ALBUM_FILTER_SELECT, minWidth: "140px" }}>
                    {albumRegionOptions.map((r) => (
                      <option key={r} value={r}>
                        {r === "Todos" ? t("merch.album_filter_all_regions") : t(`merch.album_regions_${r}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={MERCH_ALBUM_FILTER_LABEL}><Disc3 size={13} /> {t("merch.album_filter_collection")}</label>
                  <select value={albumFilterAlbum} onChange={(e) => setAlbumFilterAlbum(e.target.value)} style={{ ...MERCH_ALBUM_FILTER_SELECT, minWidth: "160px" }}>
                    {albumTitleOptions.map((g) => (
                      <option key={g} value={g}>{g === "Todos" ? t("merch.filter_all_collections") : formatCollectionOptionLabel(g)}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={MERCH_ALBUM_FILTER_LABEL}><Layers size={13} /> {t("merch.album_filter_kind")}</label>
                  <select value={albumFilterKind} onChange={(e) => setAlbumFilterKind(e.target.value)} style={{ ...MERCH_ALBUM_FILTER_SELECT, minWidth: "150px" }}>
                    {albumKindOptions.map((k) => (
                      <option key={k} value={k}>
                        {merchAlbumKindOptionLabel(k, t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={MERCH_ALBUM_FILTER_LABEL}>
                    <Mic2 size={13} />{" "}
                    {albumFilterKind === "Todos"
                      ? t("merch.album_filter_slot4_neutral")
                      : isAccordionKindKey(albumFilterKind)
                        ? t("merch.album_filter_slot4_member")
                        : t("merch.album_filter_slot4_version")}
                  </label>
                  <select
                    value={albumFilterSlot4}
                    onChange={(e) => setAlbumFilterSlot4(e.target.value)}
                    disabled={albumFilterKind === "Todos"}
                    style={{
                      ...MERCH_ALBUM_FILTER_SELECT,
                      minWidth: "130px",
                      opacity: albumFilterKind === "Todos" ? 0.55 : 1,
                    }}
                  >
                    {albumSlot4Options.map((g) => (
                      <option key={g} value={g}>
                        {g === "Todos" ? t("merch.album_filter_all_slot4") : g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
              <label style={MERCH_ALBUM_FILTER_LABEL}><ArrowUpDown size={13} /> {t("common.sort_label") || "Ordenar"}</label>
              <select value={catalogSort} onChange={(e) => setCatalogSort(e.target.value as typeof catalogSort)} style={{ ...MERCH_ALBUM_FILTER_SELECT, minWidth: "160px" }}>
                <option value="default">{t("common.sort_default") || "Por defecto"}</option>
                <option value="album">{t("common.sort_album") || "Por álbum"}</option>
                <option value="stock_date">{t("common.sort_stock_date") || "Fecha en tu stock"}</option>
                <option value="price">{t("common.sort_price") || "Por precio"}</option>
                <option value="status">{t("common.sort_status") || "Por estado"}</option>
              </select>
            </div>
            
            {(activeTab === "catalogo_merch" || activeTab === "albumes" || activeTab === "inclusiones" || activeTab === "mi_coleccion") && (
              <div
                role="group"
                aria-label={t("merch.filter_stock_by")}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  alignItems: "center",
                  borderLeft:
                    activeTab === "mi_coleccion" || activeTab === "catalogo_merch"
                      ? "2px solid var(--color-border)"
                      : undefined,
                  paddingLeft:
                    activeTab === "mi_coleccion" || activeTab === "catalogo_merch" ? "15px" : undefined,
                  flex: activeTab === "albumes" || activeTab === "inclusiones" ? "1 1 100%" : undefined,
                  marginTop: activeTab === "albumes" || activeTab === "inclusiones" ? "6px" : undefined,
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 900, color: "var(--text-muted)", marginRight: "4px" }}>
                  {t("merch.filter_stock_by")}
                </span>
                {MERCH_STOCK_FILTER_STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setActiveStatus(st)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: activeStatus === st ? "var(--text-main)" : "var(--bg-soft)",
                      color: activeStatus === st ? "var(--bg-main)" : "var(--text-main)",
                      fontWeight: 800,
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    {merchStockFilterPillLabel(st, t)}
                  </button>
                ))}
              </div>
            )}
            
            {(activeTab === "catalogo_merch" || activeTab === "mi_coleccion") && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "stretch" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={MERCH_ALBUM_FILTER_LABEL}><Users size={13} /> {t("merch.album_filter_group")}</label>
            <select 
              value={activeGroup} 
              onChange={(e) => setActiveGroup(e.target.value)} 
              style={{ ...MERCH_ALBUM_FILTER_SELECT, minWidth: "140px" }}
            >
              <option value="Todos">{t("merch.filter_all_groups")}</option>
              {allDbGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={MERCH_ALBUM_FILTER_LABEL}><Disc3 size={13} /> {t("merch.goods_kind")}</label>
              <select
                value={fMerchKind}
                onChange={(e) => setFMerchKind(e.target.value as "all" | MerchGoodsKind)}
                style={{ ...MERCH_ALBUM_FILTER_SELECT, minWidth: "150px" }}
              >
                <option value="all">{t("merch.categories.all")}</option>
                {merchGoodsKindOptions.map((k) => (
                  <option key={k} value={k}>{merchGoodsKindLabel(k, t)}</option>
                ))}
              </select>
            </div>
            {fMerchKind !== "all" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={MERCH_ALBUM_FILTER_LABEL}><Layers size={13} /> {merchGoodsCollectionFilterLabel(fMerchKind, t)}</label>
                <select
                  value={fMerchCollection}
                  onChange={(e) => setFMerchCollection(e.target.value)}
                  style={{ ...MERCH_ALBUM_FILTER_SELECT, minWidth: "170px" }}
                >
                  <option value="all">{t("merch.filter_all_collections")}</option>
                  {merchGoodsCollectionOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
            {fMerchKind !== "all" && merchGoodsSetOptions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={MERCH_ALBUM_FILTER_LABEL}><Package size={13} /> {t("merch.goods_set")}</label>
                <select
                  value={fMerchSet}
                  onChange={(e) => setFMerchSet(e.target.value)}
                  style={{ ...MERCH_ALBUM_FILTER_SELECT, minWidth: "160px" }}
                >
                  <option value="all">{t("common.all")}</option>
                  {merchGoodsSetOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
            </div>
            )}
            
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <Search size={16} color="var(--accent-vibe-cyan)" style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)" }} />
                <input type="text" placeholder={t("merch.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: "10px 15px 10px 38px", borderRadius: "99px", border: "1px solid var(--color-border)", outline: "none", fontWeight: 700, width: "200px", backgroundColor: "var(--bg-main)", color: "var(--text-main)", fontSize: "13px" }} />
              </div>
              <button
                type="button"
                onClick={clearMerchFilters}
                disabled={!hasMerchFiltersActive}
                style={{
                  padding: "10px 14px",
                  borderRadius: "99px",
                  border: "1px solid var(--color-border)",
                  backgroundColor: hasMerchFiltersActive ? "var(--bg-main)" : "var(--bg-soft)",
                  color: hasMerchFiltersActive ? "var(--text-main)" : "var(--text-muted)",
                  fontWeight: 800,
                  fontSize: "12px",
                  cursor: hasMerchFiltersActive ? "pointer" : "not-allowed",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <X size={14} aria-hidden />
                {t("merch.clear_filters")}
              </button>
            </div>
          </div>
        </div>

       {loading ? ( 
          <CatalogLoadingFun title={t("common.library_loading_title")} />
        ) : filteredMerch.length === 0 && showContributeEmpty ? (
          <ContributeEmptyState t={t} onOpenColab={() => setShowColabModal(true)} />
        ) : filteredMerch.length === 0 ? ( 
          <div style={{ textAlign: "center", padding: "50px", color: "var(--text-muted)", fontWeight: 800 }}>
            {t("merch.empty_search")}
            {(activeTab === "albumes" || activeTab === "inclusiones") && albumLikeCatalogItems.length === 0 && (
              <p
                style={{
                  marginTop: "18px",
                  maxWidth: "520px",
                  marginLeft: "auto",
                  marginRight: "auto",
                  fontWeight: 600,
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--text-subheading)",
                }}
              >
                {t("merch.albums_catalog_empty_hint")}
              </p>
            )}
            {(activeTab === "albumes" || activeTab === "inclusiones") && albumLikeCatalogItems.length > 0 && (
              <p
                style={{
                  marginTop: "14px",
                  maxWidth: "520px",
                  marginLeft: "auto",
                  marginRight: "auto",
                  fontWeight: 600,
                  fontSize: "14px",
                  lineHeight: 1.5,
                  color: "var(--text-subheading)",
                }}
              >
                {t("merch.empty_albums_filtered")}
              </p>
            )}
          </div> 
        ) : (
          <div className="merch-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: "14px", paddingBottom: "80px" }}>
            {filteredMerch.map((item) => {
              const inv = myInventory[item.id] || { have: 0, wtt: 0, wts: 0, wishlist: 0, otw: 0 };
              const isWish = inv.wishlist > 0;
              const albumHeading = isAlbumItem(item) ? merchAlbumCardHeading(item) : item.name;
              const posterTitle =
                (wishMeta[item.id]?.posterTitle || albumHeading || "").trim() || albumHeading;

              return (
                <div key={item.id} style={{ backgroundColor: "var(--bg-card)", borderRadius: "20px", overflow: "hidden", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", boxShadow: "0 8px 20px var(--shadow-card)", position: "relative" }}>
                  <div style={{ width: "100%", height: "200px", position: "relative", backgroundColor: "var(--bg-soft)", padding: "8px", overflow: "hidden" }}>
                    <div
                      onClick={() => setInfoModal(item)}
                      style={{ width: "100%", height: "100%", borderRadius: "12px", overflow: "hidden", position: "relative", cursor: "pointer" }}
                    >
                      {isWish && wishMeta[item.id]?.wantedPoster ? (
                        <MerchWesternWantedFrame name={posterTitle} variant="card">
                          <ImageWithExtensionFallback src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        </MerchWesternWantedFrame>
                      ) : (
                        <ImageWithExtensionFallback src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      )}
                      {isWish && !wishMeta[item.id]?.wantedPoster && (
                        <div style={{ position: "absolute", top: "25px", left: "-35px", background: "var(--bg-wish)", color: "var(--text-wish)", fontWeight: 900, fontSize: "14px", padding: "6px 45px", transform: "rotate(-45deg)", boxShadow: "0 4px 10px var(--overlay-soft)", letterSpacing: "3px", border: "2px dashed var(--border-wish)", zIndex: 10, pointerEvents: "none" }}>{t("merch.badge_wanted")}</div>
                      )}
                    </div>
                    
                    <button onClick={() => setInfoModal(item)} style={{ position: "absolute", top: "15px", right: "15px", background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: "50%", padding: "6px", cursor: "pointer", boxShadow: "0 2px 5px var(--shadow-card)" }}><Info size={16} color="var(--accent-vibe-cyan)"/></button>
                    
                    <div style={{ position: "absolute", bottom: "15px", left: "15px", display: "flex", gap: "5px", flexWrap: "wrap" }}>
                      {inv.have > 0 && <Badge label={t("merch.inv_badge_have").replace("{{count}}", String(inv.have))} colorObj={COLORS.have} />}
                      {inv.otw > 0 && <Badge label={t("merch.inv_badge_otw").replace("{{count}}", String(inv.otw))} colorObj={COLORS.otw} />}
                      {inv.wtt > 0 && <Badge label={t("merch.inv_badge_wtt").replace("{{count}}", String(inv.wtt))} colorObj={COLORS.wtt} />}
                      {inv.wts > 0 && <Badge label={t("merch.inv_badge_wts").replace("{{count}}", String(inv.wts))} colorObj={COLORS.wts} />}
                      {isWish && <Badge label={t("merch.inv_badge_wish")} colorObj={COLORS.wish} />}
                    </div>
                  </div>

                  <div style={{ padding: "15px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--accent-vibe-pink)", lineHeight: 1.35 }}>
                      {isAlbumItem(item)
                        ? merchAlbumCardBreadcrumbLine(item, t("merch.categories.albums"))
                        : nonAlbumMerchCardBreadcrumbLine(item, t)}
                    </span>
                    <h3 style={{ color: "var(--accent-vibe-violet)", fontWeight: 900, fontSize: "15px", margin: "5px 0 15px 0", lineHeight: "1.2" }}>{albumHeading}</h3>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "auto", marginBottom: "8px" }}>
                      <button onClick={() => updateMerchStatus(item.id, 'have', 1)} style={{ background: "transparent", color: "var(--accent-vibe-green)", border: "1px solid transparent", padding: "6px", borderRadius: "8px", fontWeight: 900, cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", textShadow: inv.have > 0 ? "0 0 8px color-mix(in srgb, var(--accent-vibe-green) 55%, transparent)" : "none" }}><CheckCircle2 size={12}/> {t("merch.label_have")}</button>
                      <button onClick={() => updateMerchStatus(item.id, 'otw', 1)} style={{ background: "transparent", color: "var(--accent-vibe-cyan)", border: "1px solid transparent", padding: "6px", borderRadius: "8px", fontWeight: 900, cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", textShadow: inv.otw > 0 ? "0 0 8px color-mix(in srgb, var(--accent-vibe-cyan) 55%, transparent)" : "none" }}><Truck size={12}/> {t("merch.label_otw")}</button>
                      <button onClick={() => openMerchWttPicker(item)} style={{ background: "transparent", color: "var(--accent-vibe-violet)", border: "1px solid transparent", padding: "6px", borderRadius: "8px", fontWeight: 900, cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", textShadow: inv.wtt > 0 ? "0 0 8px color-mix(in srgb, var(--accent-vibe-violet) 55%, transparent)" : "none" }}><Repeat2 size={12}/> {t("merch.label_wtt")}</button>
                      <button onClick={() => setWtsModal(item)} style={{ background: "transparent", color: "var(--accent-vibe-orange)", border: "1px solid transparent", padding: "6px", borderRadius: "8px", fontWeight: 900, cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", textShadow: inv.wts > 0 ? "0 0 8px color-mix(in srgb, var(--accent-vibe-orange) 55%, transparent)" : "none" }}><DollarSign size={12}/> {t("merch.label_wts")}</button>
                    </div>

                    <button onClick={() => updateMerchStatus(item.id, 'wishlist', isWish ? -1 : 1, { defaultTitle: albumHeading })} style={{ background: isWish ? "color-mix(in srgb, #ffe88a 35%, var(--bg-card))" : "color-mix(in srgb, #ffe88a 18%, var(--bg-card))", border: `1px ${isWish ? 'solid' : 'dashed'} color-mix(in srgb, #ffe88a 60%, var(--color-border))`, color: "#ffe88a", padding: "8px", borderRadius: "8px", fontWeight: 900, cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                       <Star size={14} color="#ffe88a" fill={isWish ? "#ffe88a" : "none"}/> {isWish ? t("merch.in_wishlist") : t("merch.add_wishlist")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      </AdRailLayout>

     {/* --- MODAL INFO (mismo shell que Library ItemModal) --- */}
      {infoModal && (() => {
         const inv = myInventory[infoModal.id] || { have: 0, wtt: 0, wts: 0, wishlist: 0, otw: 0 };
         const wm =
           wishMeta[infoModal.id] ?? {
             wantedPoster: false,
             posterTitle: isAlbumItem(infoModal) ? merchAlbumCardHeading(infoModal) : infoModal.name,
           };
         const infoHeading = isAlbumItem(infoModal) ? merchAlbumCardHeading(infoModal) : infoModal.name;
         const infoGroupLine = canonicalMerchGroupDisplayName(infoModal.group_name);
         const catOpt = MERCH_CATEGORY_OPTIONS.find((c) => c.dbValue === infoModal.category);
         const infoCategoryLabel = catOpt ? t(catOpt.labelKey) : infoModal.category;
         const navList = filteredMerch.some((m) => m.id === infoModal.id) ? filteredMerch : merchCatalog;
         const navIdx = navList.findIndex((m) => m.id === infoModal.id);
         const canPrev = navIdx > 0;
         const canNext = navIdx >= 0 && navIdx < navList.length - 1;
         const stockDirty =
           merchStockDraft.have !== (inv.have || 0) ||
           merchStockDraft.wtt !== (inv.wtt || 0) ||
           merchStockDraft.wts !== (inv.wts || 0) ||
           merchStockDraft.otw !== (inv.otw || 0) ||
           merchStockDraft.wishlist !== (inv.wishlist || 0);
         const headerIconBtn: React.CSSProperties = {
           width: 36,
           height: 36,
           borderRadius: 12,
           border: "1px solid var(--color-border)",
           background: "var(--surface-float)",
           cursor: "pointer",
           fontWeight: 900,
           color: "var(--color-primary)",
           boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 15%, transparent)",
           display: "inline-flex",
           alignItems: "center",
           justifyContent: "center",
         };
         const subtleCard: React.CSSProperties = {
           background: "var(--bg-soft)",
           border: "1px solid var(--color-border)",
           borderRadius: 18,
           boxShadow: "0 8px 24px color-mix(in srgb, var(--color-primary) 10%, transparent)",
         };
         return (
          <div
            className="library-item-modal-overlay"
            onClick={() => {
              if (merchInspectOpen) return;
              setInfoModal(null);
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--overlay-medium)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              className="library-item-modal-shell"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(960px, 96vw)",
                maxWidth: "96vw",
                height: "auto",
                maxHeight: "92vh",
                background: "var(--bg-main)",
                borderRadius: 18,
                border: "1px solid var(--color-border)",
                boxShadow: "0 30px 80px color-mix(in srgb, var(--text-main) 22%, transparent)",
                overflow: "hidden",
                display: "grid",
                gridTemplateRows: "auto auto",
                minWidth: 0,
              }}
            >
              <div
                className="library-item-modal-header"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--color-border)",
                  background: "var(--bg-soft)",
                }}
              >
                <div className="library-item-modal-meta-chips" style={{ display: "flex", flexWrap: "wrap", gap: 8, minWidth: 0, flex: 1, alignItems: "center" }}>
                  <MerchMetaRow icon={<Users size={16} strokeWidth={2.2} />} label={t("binders.picker.group")} value={infoGroupLine} />
                  <MerchMetaRow icon={<Disc3 size={16} strokeWidth={2.2} />} label={t("binders.picker.type")} value={infoCategoryLabel} />
                  {isAlbumItem(infoModal) ? (
                    <>
                      <MerchMetaRow icon={<Layers size={16} strokeWidth={2.2} />} label={t("binders.picker.album")} value={formatCollectionOptionLabel(infoModal.album_title || infoHeading)} />
                      <MerchMetaRow icon={<Mic2 size={16} strokeWidth={2.2} />} label={t("binders.picker.version")} value={formatPhysicalMerchLabel(infoModal.album_version || "")} />
                    </>
                  ) : (
                    <MerchMetaRow icon={<Package size={16} strokeWidth={2.2} />} label={t("merch.title")} value={infoHeading} />
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                  <button type="button" onClick={() => canPrev && setInfoModal(navList[navIdx - 1]!)} disabled={!canPrev} style={{ ...headerIconBtn, opacity: canPrev ? 1 : 0.45 }} title={t("common.previous")}>
                    <ChevronLeft size={18} strokeWidth={2.6} />
                  </button>
                  <button type="button" onClick={() => canNext && setInfoModal(navList[navIdx + 1]!)} disabled={!canNext} style={{ ...headerIconBtn, opacity: canNext ? 1 : 0.45 }} title={t("common.next")}>
                    <ChevronRight size={18} strokeWidth={2.6} />
                  </button>
                  <button type="button" onClick={() => setInfoModal(null)} style={headerIconBtn} title={t("common.close")}>
                    ✕
                  </button>
                </div>
              </div>

              <div className="library-item-modal-grid" style={{ display: "grid", gridTemplateColumns: "420px 520px", columnGap: 18, justifyContent: "start", height: "100%", minHeight: 0 }}>
                <div style={{ position: "relative", background: "var(--bg-main)", padding: 10, borderRight: "1px solid var(--bg-soft)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setMerchInspectOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setMerchInspectOpen(true);
                      }
                    }}
                    title={t("library.modal.inspect_hint") || t("binders.zoom")}
                    className="library-pc-preview"
                    style={{ width: "100%", maxWidth: 380, height: "min(62vh, 560px)", position: "relative", background: "transparent", margin: "auto 0", cursor: "zoom-in" }}
                  >
                    {merchStockDraft.wishlist > 0 && wm.wantedPoster ? (
                      <MerchWesternWantedFrame name={(wm.posterTitle || infoHeading).trim() || t("merch.badge_wanted")} variant="modal">
                        <ImageWithExtensionFallback src={infoModal.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      </MerchWesternWantedFrame>
                    ) : (
                      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 14, overflow: "hidden", border: "1px solid var(--state-disabled-border)", background: "var(--bg-card)" }}>
                        <ImageWithExtensionFallback src={infoModal.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        {merchStockDraft.wishlist > 0 && (
                          <div style={{ position: "absolute", top: "40px", left: "-50px", background: "var(--bg-wish)", color: "var(--text-wish)", fontWeight: 900, fontSize: "20px", padding: "10px 60px", transform: "rotate(-45deg)", boxShadow: "0 6px 15px var(--overlay-soft)", letterSpacing: "4px", border: "3px dashed var(--border-wish)", zIndex: 10, pointerEvents: "none" }}>{t("merch.badge_wanted")}</div>
                        )}
                      </div>
                    )}
                    <div style={{ position: "absolute", right: 10, bottom: 10, width: 36, height: 36, borderRadius: 12, background: "var(--surface-float)", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)", pointerEvents: "none" }}>
                      <ZoomIn size={16} />
                    </div>
                  </div>
                </div>

                <div style={{ padding: 16, overflowY: "auto", height: "100%", minHeight: 0, minWidth: 0, width: "100%" }}>
                  <div style={{ padding: 14, ...subtleCard }}>
                    <div className="library-item-stock-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
                      <div>
                        <div style={{ fontWeight: 950, marginBottom: 12, color: "var(--color-primary)" }}>{t("library.stock_title")}</div>
                        <MerchStockQtyRows
                          draft={merchStockDraft}
                          disabled={merchStockSaving}
                          onDelta={(s, d) => setMerchStockDraft((prev) => applyMerchStockDelta(prev, s, d))}
                          t={t}
                        />
                        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                          <button
                            type="button"
                            disabled={!stockDirty || merchStockSaving}
                            onClick={() =>
                              setMerchStockDraft({
                                have: inv.have || 0,
                                wtt: inv.wtt || 0,
                                wts: inv.wts || 0,
                                otw: inv.otw || 0,
                                wishlist: inv.wishlist || 0,
                              })
                            }
                            style={{
                              flex: 1,
                              padding: "10px",
                              borderRadius: 12,
                              border: "1px solid var(--library-stock-cancel-border)",
                              background: "var(--library-stock-cancel-bg)",
                              color: "var(--library-stock-cancel-fg)",
                              fontWeight: 900,
                              cursor: !stockDirty || merchStockSaving ? "not-allowed" : "pointer",
                              opacity: !stockDirty || merchStockSaving ? 0.55 : 1,
                            }}
                          >
                            {t("common.cancel")}
                          </button>
                          <button
                            type="button"
                            disabled={!stockDirty || merchStockSaving}
                            onClick={() => void commitMerchStockDraft()}
                            style={{
                              flex: 1,
                              padding: "10px",
                              borderRadius: 12,
                              border: "none",
                              background: "var(--library-stock-save-bg)",
                              color: "var(--library-stock-save-fg)",
                              fontWeight: 900,
                              cursor: !stockDirty || merchStockSaving ? "not-allowed" : "pointer",
                              opacity: !stockDirty || merchStockSaving ? 0.55 : 1,
                            }}
                          >
                            {merchStockSaving ? "…" : t("common.save")}
                          </button>
                        </div>
                      </div>
                      <div className="library-stock-price-col" style={{ minWidth: 0, display: "grid", gap: 10, alignContent: "start" }}>
                        <div style={{ fontWeight: 950, color: "var(--color-primary)" }}>{t("binders.item_info.price_title")}</div>
                        <div style={{ borderRadius: 14, border: "1px solid var(--color-border)", background: "var(--bg-card)", padding: 8 }}>
                          <div style={{ fontWeight: 950, marginBottom: 6, color: "var(--color-primary)", fontSize: 12 }}>{t("binders.item_info.your_price")}</div>
                          <input
                            value={merchUserPrice ? `${merchUserPrice} ${merchPriceCurrency}` : "—"}
                            disabled
                            placeholder={t("library.modal.price_unset")}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              height: 34,
                              fontSize: 12,
                              borderRadius: 12,
                              border: "1px solid var(--state-disabled-border)",
                              outline: "none",
                              background: "var(--state-disabled-bg)",
                              color: "var(--text-muted)",
                              cursor: "not-allowed",
                              fontWeight: 700,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {merchStockDraft.wishlist > 0 && (
                    <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 14, border: "1px solid var(--color-border)", background: "var(--bg-card)" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 900, fontSize: 13, color: "var(--text-main)" }}>
                        <input
                          type="checkbox"
                          checked={wm.wantedPoster}
                          onChange={(e) => {
                            const next = {
                              ...wm,
                              wantedPoster: e.target.checked,
                              posterTitle: wm.posterTitle || infoHeading,
                            };
                            void saveWishPosterMeta(infoModal.id, next);
                          }}
                          style={{ width: 18, height: 18, accentColor: COLORS.wish.text, cursor: "pointer" }}
                        />
                        {t("merch.wish_poster_toggle")}
                      </label>
                      <div style={{ marginTop: 10, fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {t("merch.wish_poster_title_label")}
                      </div>
                      <input
                        type="text"
                        value={wm.posterTitle}
                        placeholder={infoHeading}
                        onChange={(e) => {
                          const next = { ...wm, posterTitle: e.target.value };
                          setWishMeta((prev) => ({ ...prev, [infoModal.id]: next }));
                        }}
                        onBlur={() => {
                          const cur = wishMeta[infoModal.id] ?? wm;
                          void saveWishPosterMeta(infoModal.id, {
                            ...cur,
                            posterTitle: (cur.posterTitle || infoModal.name).trim(),
                          });
                        }}
                        style={{
                          width: "100%",
                          marginTop: 6,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid var(--color-border)",
                          fontWeight: 800,
                          fontSize: 14,
                          boxSizing: "border-box",
                          background: "var(--bg-main)",
                          color: "var(--text-main)",
                        }}
                      />
                    </div>
                  )}

                  <div style={{ marginTop: 12, background: "var(--bg-card)", padding: "15px", borderRadius: "14px", border: "1px solid var(--color-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "var(--color-primary)", fontWeight: 900, fontSize: "13px" }}>
                      {t("merch.item_notes")}
                    </div>
                    <textarea
                      value={itemNote}
                      onChange={(e) => saveItemNote(e.target.value)}
                      placeholder={t("merch.item_notes_placeholder")}
                      rows={2}
                      style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--color-border)", outline: "none", resize: "none", fontSize: "13px", fontFamily: "inherit", fontWeight: 700, background: "var(--bg-main)", color: "var(--text-main)" }}
                    />
                  </div>

                  <div style={{ marginTop: 12, padding: 14, ...subtleCard, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                      <div style={{ fontWeight: 950, color: "var(--color-primary)" }}>{t("library.modal.busco_wtt")}</div>
                      <button
                        type="button"
                        onClick={() => openMerchWttPicker(infoModal)}
                        disabled={merchStockDraft.wishlist > 0}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid var(--color-border)",
                          background: "var(--bg-card)",
                          cursor: merchStockDraft.wishlist > 0 ? "not-allowed" : "pointer",
                          fontWeight: 900,
                          fontSize: 12,
                          color: "var(--color-primary)",
                          opacity: merchStockDraft.wishlist > 0 ? 0.6 : 1,
                          boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 15%, transparent)",
                        }}
                      >
                        {t("library.modal.mis_trades")}
                      </button>
                    </div>
                    {(wttOfferByMerch[infoModal.id] ?? []).length ? (
                      <div className="merch-wtt-carousel">
                        {(wttOfferByMerch[infoModal.id] ?? [])
                          .map((id) => merchCatalog.find((m) => m.id === id))
                          .filter((m): m is MerchItem => Boolean(m))
                          .map((w, idx) => (
                            <ImageWithExtensionFallback
                              key={`${w.id}-${idx}`}
                              src={w.image_url}
                              alt=""
                              draggable={false}
                              title={w.name}
                              style={{
                                width: 90,
                                height: 110,
                                borderRadius: 12,
                                border: "1px solid var(--state-disabled-border)",
                                background: "linear-gradient(180deg, var(--bg-card), var(--bg-soft))",
                                objectFit: "cover",
                                flex: "0 0 auto",
                                scrollSnapAlign: "start",
                                boxShadow: "0 8px 18px color-mix(in srgb, var(--text-main) 6%, transparent)",
                              }}
                            />
                          ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{t("library.modal.wtt_empty")}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {merchInspectOpen && (
              <div
                onClick={() => setMerchInspectOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 10000, background: "var(--overlay-strong)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
              >
                <ImageWithExtensionFallback src={infoModal.image_url} alt="" style={{ maxWidth: "94vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 16 }} />
              </div>
            )}
          </div>
         );
      })()}

     <WtsListingModal
        open={Boolean(wtsModal) && wtsReady}
        itemId={wtsModal?.id ?? null}
        onClose={() => {
          setWtsModal(null);
          setWtsReady(false);
        }}
        onSaved={() => {
          void handlePublishWts();
        }}
      />

     {/* --- MODAL WTT (SELECTOR DEL CATÁLOGO) --- */}
      {wttModal && (
        <div className="merch-wtt-picker-overlay library-wtt-offer-overlay" style={{ position: "fixed", inset: 0, background: "var(--overlay-strong)", zIndex: 10050, display: "flex", alignItems: "center", justifyContent: "center", padding: "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))", backdropFilter: "blur(5px)" }}>
          <div className="merch-wtt-picker-shell library-wtt-offer-shell" style={{ background: "var(--bg-main)", borderRadius: "24px", width: "100%", maxWidth: "720px", height: "min(80vh, 80dvh)", maxHeight: "calc(100dvh - 24px)", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 22px 60px var(--shadow-card)", minWidth: 0 }}>
            
            <div style={{ padding: "16px 20px", background: "var(--bg-soft)", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexShrink: 0 }}>
               <h3 style={{ color: "var(--accent-vibe-cyan)", margin: 0, fontSize: "20px", fontWeight: 950 }}>{t("merch.trade_title")}</h3>
               <button onClick={() => { setWttModal(null); }} style={{ background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: "10px", width: 32, height: 32, cursor: "pointer", fontWeight: 900, color: "var(--text-muted)", display: "flex", alignItems:"center", justifyContent:"center", flexShrink: 0 }}><X size={18}/></button>
            </div>

            {wttSelectedIds.length > 0 && (
              <div className="merch-wtt-carousel" style={{ padding: "10px 16px 4px", flexShrink: 0 }}>
                {wttSelectedIds
                  .map((id) => merchCatalog.find((m) => m.id === id))
                  .filter((m): m is MerchItem => Boolean(m))
                  .map((w, idx) => (
                    <ImageWithExtensionFallback
                      key={`sel-${w.id}-${idx}`}
                      src={w.image_url}
                      alt=""
                      title={w.name}
                      style={{
                        width: 72,
                        height: 88,
                        borderRadius: 10,
                        border: "2px solid var(--color-primary)",
                        objectFit: "cover",
                        flex: "0 0 auto",
                        scrollSnapAlign: "start",
                        background: "var(--bg-card)",
                      }}
                    />
                  ))}
              </div>
            )}

            <div style={{ padding: "12px 20px", background: "var(--bg-card)", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
               <div style={{ position: "relative" }}>
                 <Search size={16} color="var(--accent-vibe-cyan)" style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)" }} />
                 <input type="text" placeholder={t("merch.trade_search_placeholder")} value={wttSearch} onChange={e => setWttSearch(e.target.value)} style={{ width: "100%", padding: "12px 15px 12px 40px", borderRadius: "99px", border: "1px solid var(--color-border)", outline: "none", fontWeight: 700, fontSize: "14px", background: "var(--bg-main)", color: "var(--text-main)", boxSizing: "border-box" }} />
               </div>
            </div>

            <div className="merch-wtt-picker-grid" style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(140px, 100%), 1fr))", gap: "12px", alignContent: "start", background: "var(--bg-main)", minHeight: 0 }}>
               {merchCatalog
                 .filter((m) => m.id !== wttModal.id && merchRowMatchesQuery(m, wttSearch))
                 .slice(0, wttSearch.trim() ? 240 : 96)
                 .map((m) => {
                 const isSelected = wttSelectedIds.includes(m.id);
                 return (
                   <div key={m.id} onClick={() => setWttSelectedIds(prev => isSelected ? prev.filter(id => id !== m.id) : [...prev, m.id])} style={{ background: isSelected ? "var(--bg-soft)" : "var(--bg-card)", border: isSelected ? "2px solid var(--color-primary)" : "1px solid var(--color-border)", borderRadius: "14px", padding: "8px", cursor: "pointer", position: "relative", transition: "all 0.2s" }}>
                     <img src={m.image_url} style={{ width: "100%", aspectRatio: "1/1", objectFit: "contain", borderRadius: "8px", background: "var(--bg-soft)" }} alt="" />
                     <div style={{ fontSize: "11px", fontWeight: 900, color: "var(--text-main)", marginTop: "8px", textAlign: "center", lineHeight: 1.2 }}>{m.name}</div>
                     {isSelected && <div style={{ position: "absolute", top: -8, right: -8, background: "var(--color-primary)", color: "white", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, border: "2px solid var(--bg-card)" }}>✓</div>}
                   </div>
                 );
               })}
            </div>

            <div style={{ padding: "16px 20px", background: "var(--bg-card)", borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "12px", flexShrink: 0 }}>
               <textarea placeholder={t("merch.wtt_comment_placeholder")} value={wttComment} onChange={e => setWttComment(e.target.value)} rows={2} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", resize: "none", fontWeight: 700, fontSize: "13px", fontFamily: "inherit", background: "var(--bg-main)", color: "var(--text-main)", boxSizing: "border-box" }} />
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--accent-vibe-pink)" }}>{wttSelectedIds.length} {t("merch.items_selected")}</span>
                  <button onClick={handlePublishWtt} disabled={wttSelectedIds.length === 0} style={{ padding: "12px 25px", borderRadius: "12px", border: "none", background: wttSelectedIds.length > 0 ? "var(--accent-vibe-orange)" : "var(--bg-soft)", color: wttSelectedIds.length > 0 ? "var(--modal-cta-fg)" : "var(--text-muted)", fontWeight: 900, cursor: wttSelectedIds.length > 0 ? "pointer" : "not-allowed", boxShadow: wttSelectedIds.length > 0 ? "0 4px 10px var(--shadow-card)" : "none" }}>{t("merch.btn_publish_wtt")}</button>
               </div>
            </div>

          </div>
        </div>
      )}

      <ContributeColabModal
        open={showColabModal}
        onClose={() => setShowColabModal(false)}
        initialEmail={profile?.email ?? ""}
        initialAsunto={
          colabFolderLabel
            ? t("common.contribute_empty_subject").replace("{{folder}}", colabFolderLabel)
            : ""
        }
      />

      <style jsx global>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}