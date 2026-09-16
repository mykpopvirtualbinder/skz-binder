  
"use client";
import Footer from "../components/footer";
import { avisarFavoritos } from "@/lib/avisos";
import { useState } from "react"; // 1. Asegúrate de tener useState importado

import { useRouter, usePathname, useSearchParams } from "next/navigation"; // 2. Asegúrate de importar usePathname y useSearchParams
import { supabase } from "@/lib/supabase";
import { isAdminTeamEmail } from "@/lib/admin-emails";
import { 
  Trash2, ChevronLeft, ChevronRight, Users, Disc3, PenLine, Mic2, User, Layers, 
    SlidersHorizontal, RotateCw, Undo2, BookText, Bookmark, Heart 
} from "lucide-react";
import WtsListingModal from "../library/WtsListingModal"
import WttListingModal from "../library/WttListingModal"
import { getCurrencyOptions } from "../library/currencyOptions"
import React, { useCallback, useEffect, useMemo, useRef} from "react";
import type { CSSProperties } from "react";
import { OnboardingForm } from "../me/ui/OnboardingForm";
import { useGlobal } from "../context/GlobalContext"
import VirtualBinder from "../components/VirtualBinder";
import ImageWithExtensionFallback from "../components/ImageWithExtensionFallback";
import { BINDER_ACCENT_SWATCHES } from "@/lib/binder-color-swatches";
import { marketRefUsdStorageKey } from "@/lib/market-reference-keys";
import { getLayoutUnlockCost, unlockKeyForLayout } from "@/lib/theme-unlocks";
import { formatCollectionOptionLabel, sortCollectionEntries } from "@/lib/collection-filters";
import { PC_IMAGE_FILENAME_EXT_RE } from "@/lib/pc-image-extensions";
import { resolveMockPcBackUrl, resolveMockPcImageUrl } from "@/lib/mock-pc-url";

const CUSTOM_BUCKET = "binder_custom";
const SUBMISSIONS_BUCKET = "pc-submissions";
// ✅ back por defecto (/mock-pcs/groups/default-back.png)
const DEFAULT_BACK_URL = "/mock-pcs/groups/default-back.png";
// ...existing code...
// Traducciones

const TRANSPARENT_DRAG_IMG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');

function hideDragGhost(dt: DataTransfer | null | undefined) {
  if (!dt) return;
  try {
    const img = new Image();
    img.src = TRANSPARENT_DRAG_IMG;
    dt.setDragImage(img, 0, 0);
  } catch {
    // no-op
  }
}
type StatusKey = "have" | "wtt" | "wts" | "on_its_way" | "wish";


const footerSubLinkStyle: CSSProperties = { 
  fontSize: "12px", 
  color: "var(--text-muted)", // Rosa oscuro
  textDecoration: "none",
  fontWeight: 500
};

type StatusCounts = {
  have: number;
  wtt: number;
  wts: number;
  on_its_way: number;
  wish: number;
};

const emptyCounts = (): StatusCounts => ({
  have: 0,
  wtt: 0,
  wts: 0,
  on_its_way: 0,
  wish: 0,
});

function formatTooltipLines(
  itemId: number,
  counts: StatusCounts,
  placedCount: number,
  availableCount: number
) {
  const wishExclusive = Number(counts.wish ?? 0) > 0;
  const have = wishExclusive ? 0 : Number(counts.have ?? 0);
  const wtt = wishExclusive ? 0 : Number(counts.wtt ?? 0);
  const wts = wishExclusive ? 0 : Number(counts.wts ?? 0);
  const otw = wishExclusive ? 0 : Number(counts.on_its_way ?? 0);
  const wish = wishExclusive ? 1 : Number(counts.wish ?? 0);

  return [
    `ID: ${itemId}`,
    `Tengo: ${have}`,
    `WTT: ${wtt}`,
    `WTS: ${wts}`,
    `En camino: ${otw}`,
    `Wishlist: ${wish}`,
    `En Binder: ${placedCount}`,
    `Disponibles: ${availableCount}`
  ].join('\n');
}
function statusColors(counts: StatusCounts) {
  // OTW: Azul pastel brillante
  if ((counts.on_its_way ?? 0) > 0) return { key: "otw", border: "var(--state-info-border)", bg: "var(--state-info-bg)" }; 
  // WISH: Amarillo pastel brillante
  if ((counts.wish ?? 0) > 0) return { key: "wish", border: "var(--state-warning-border)", bg: "var(--bg-main)" }; 
  // WTT: Rosa brillante
  if ((counts.wtt ?? 0) > 0) return { key: "wtt", border: "var(--color-border)", bg: "var(--bg-soft)" }; 
  // HAVE: Verde menta brillante
  if ((counts.have ?? 0) > 0) return { key: "have", border: "var(--state-success-border)", bg: "var(--state-success-bg)" }; 

  return {
    key: "",
    border: "var(--binder-slot-status-empty-border)",
    bg: "var(--binder-slot-status-empty-bg)",
  };
}

function stockTotalOf(counts: StatusCounts) {
  const have = Number(counts.have ?? 0);
  const wtt  = Number(counts.wtt ?? 0);
  const wts  = Number(counts.wts ?? 0);
  const otw  = Number(counts.on_its_way ?? 0);
  return have + wtt + wts + otw;
}
function dominantBadge(counts: StatusCounts) {
  if (counts.on_its_way > 0)
    return { key: "on_its_way", label: "OTW", bg: "var(--state-info-bg)", border: "var(--state-info-border)" };
  if (counts.wish > 0)
    return { key: "wish", label: "WISH", bg: "var(--state-warning-bg)", border: "var(--state-warning-border)" };
  if (counts.wtt > 0)
    return { key: "wtt", label: "WTT", bg: "var(--bg-soft)", border: "var(--color-secondary)" };
  if (counts.wts > 0)
    return { key: "wts", label: "WTS", bg: "var(--state-disabled-bg)", border: "var(--state-disabled-border)" };
  if (counts.have > 0)
    return { key: "have", label: "HAVE", bg: "var(--state-success-bg)", border: "var(--state-success-border)" };
  return { key: null, label: "", bg: "var(--bg-card)", border: "var(--state-disabled-border)" };
}

const normText = (s: string | number | null | undefined) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ");

const normWords = (s: string | null | undefined) =>
  normText(s)
    .split(/\s+/)
    .filter(Boolean);

const memberMatches = (memberRaw: string | null | undefined, selected: string) => {
  if (!selected) return true;
  const memberWords = normWords(memberRaw);
  const targetWords = normWords(selected);
  return targetWords.every((t) => memberWords.includes(t));
};
// ✅ Comprueba si una PC es de alguno de los bias seleccionados
const isPcBias = (
  pc: { member?: string | null; member_name?: string | null },
  selectedBiasMembers: string[] | null | undefined
): boolean => {
  if (!selectedBiasMembers || selectedBiasMembers.length === 0) return false;
  const rawMember = pc.member ?? pc.member_name ?? "";
  return selectedBiasMembers.some((bias) => memberMatches(rawMember, bias));
};


const unitTypeFromMember = (memberRaw: string | null | undefined): "single" | "unit" | "ot8" => {
  let lower = String(memberRaw ?? "").toLowerCase().trim();
  
  if (!lower || lower === "-") return "single";
  if (/\bot8\b/.test(lower) || lower.includes("all")) return "ot8";
  
  // Si tiene los símbolos explícitos de unión, es unit directo
  if (lower.includes("+") || lower.includes("/") || lower.includes("&") || lower.includes(",")) return "unit";

  // EL TRUCO MAGISTRAL: Unimos los nombres compuestos para que no cuenten como dos personas distintas
  lower = lower.replace(/\blee know\b/g, "leeknow");
  lower = lower.replace(/\bbang chan\b/g, "bangchan");
  lower = lower.replace(/\bi\.?n\b/g, "in"); // Cubre tanto "i n" como "i.n"

  // Ahora sí, si al separar por espacios hay más de 1 palabra, es Unit garantizado (ej: "hyunjin changbin")
  if (lower.split(/\s+/).filter(Boolean).length > 1) return "unit";

  return "single";
};

type FilterOption = { id: number; name: string };
type AlbumOption = { id: number; name: string; release_date: string | null };

type UnitFilter = "all" | "single" | "unit" | "ot8";

type PickerItem = {
  id: number;
  member_id?: number | null; // <--- AÑADE ESTA LÍNEA
  name: string | null;
  image_url: string | null;

  back_image_url?: string | null;
  group_id?: number | null;
  album_id?: number | null;
  version_id?: number | null;
  version?: string | null;
 
  group_name?: string | null;
  album_name?: string | null;
  version_name?: string | null;
  version_name_display?: string | null;
  member_name?: string | null;
  member?: string | null;
};

const SUPABASE_PAGE = 1000;
const IN_QUERY_CHUNK = 80;
const PICKER_ITEM_COLS =
  "id, name, image_url, back_image_url, group_id, album_id, version_id, version, member_id, member";

type StatusRow = { item_id: unknown; status: unknown; qty: unknown };

function applyStatusRow(map: Record<number, StatusCounts>, row: StatusRow) {
  const itemId = Number(row.item_id);
  if (!Number.isFinite(itemId)) return;
  const st = String(row.status ?? "").trim().toLowerCase();
  const isWish = st === "wish" || st === "wishlist";
  const qtyRaw = row.qty == null ? (isWish ? 1 : 0) : Number(row.qty);
  const qty = Number.isFinite(qtyRaw) ? Math.max(0, Math.floor(qtyRaw)) : 0;
  const c = map[itemId] ?? emptyCounts();
  if (st === "have") c.have += qty;
  else if (st === "wtt") c.wtt += qty;
  else if (st === "wts") c.wts += qty;
  else if (st === "on_its_way" || st === "otw") c.on_its_way += qty;
  else if (isWish) c.wish += qty;
  map[itemId] = c;
}

function itemHasPickerStock(c: StatusCounts | undefined) {
  const counts = c ?? emptyCounts();
  return (
    Number(counts.have) + Number(counts.wtt) + Number(counts.wts) + Number(counts.on_its_way) > 0 ||
    Number(counts.wish) > 0
  );
}

function withResolvedPcImages<T extends { image_url?: string | null; back_image_url?: string | null }>(row: T): T {
  const front = typeof row.image_url === "string" ? resolveMockPcImageUrl(row.image_url) : row.image_url;
  const stored = typeof row.back_image_url === "string" ? row.back_image_url : null;
  const back =
    typeof front === "string" && front
      ? resolveMockPcBackUrl(front, stored)
      : stored
        ? resolveMockPcImageUrl(stored)
        : row.back_image_url;
  return { ...row, image_url: front || null, back_image_url: back || null };
}

/** PostgREST caps a single select at ~1000 rows. */
async function fetchAllUserItemStatuses(userId: string): Promise<StatusRow[]> {
  const all: StatusRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("user_item_statuses")
      .select("item_id, status, qty")
      .eq("user_id", userId)
      .order("item_id", { ascending: true })
      .range(from, from + SUPABASE_PAGE - 1);
    if (error) {
      const fallback = await supabase
        .from("user_item_statuses")
        .select("item_id, status, qty")
        .eq("user_id", userId);
      if (fallback.error) throw new Error(fallback.error.message);
      return (fallback.data ?? []) as StatusRow[];
    }
    const batch = (data ?? []) as StatusRow[];
    all.push(...batch);
    if (batch.length < SUPABASE_PAGE) break;
    from += SUPABASE_PAGE;
  }
  return all;
}

async function fetchPickerItemsByIds(ids: number[]): Promise<PickerItem[]> {
  const uniq = Array.from(new Set(ids.map((x) => Number(x)))).filter((x) => Number.isFinite(x));
  const all: PickerItem[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < uniq.length; i += IN_QUERY_CHUNK) {
    const chunk = uniq.slice(i, i + IN_QUERY_CHUNK);
    const { data, error } = await supabase
      .from("items")
      .select(PICKER_ITEM_COLS)
      .in("id", chunk)
      .order("id", { ascending: true });
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as PickerItem[]) {
      const id = Number(row.id);
      if (!Number.isFinite(id) || seen.has(id)) continue;
      seen.add(id);
      all.push(withResolvedPcImages({ ...row, id }));
    }
  }
  if (seen.size >= uniq.length) {
    all.sort((a, b) => Number(a.id) - Number(b.id));
    return all;
  }

  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("items")
      .select(PICKER_ITEM_COLS)
      .order("id", { ascending: true })
      .range(from, from + SUPABASE_PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as PickerItem[];
    for (const row of batch) {
      const id = Number(row.id);
      if (!uniq.includes(id) || seen.has(id)) continue;
      seen.add(id);
      all.push(withResolvedPcImages({ ...row, id }));
    }
    if (batch.length < SUPABASE_PAGE) break;
    from += SUPABASE_PAGE;
  }
  all.sort((a, b) => Number(a.id) - Number(b.id));
  return all;
}

type WttCarouselItem = {
  id: number;
  name: string | null;
  image_url: string | null;
  group_id?: number | null;
  album_id?: number | null;
  version?: string | null;
  member?: string | null;
  version_name?: string | null;
  version_name_display?: string | null;
  member_name?: string | null;
};

const clean = (s: string) =>
  (s ?? "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

const prettyText = (s: string) => {
  const raw = clean(s);
  if (!raw || raw === "—") return "";
  const keepUpper = new Set(["PC", "OT8", "WTS", "WTT", "GO", "USA", "UK", "CD", "DVD", "ID", "I.N"]);
  return raw
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      const upper = w.toUpperCase();
      if (keepUpper.has(upper)) return upper;
      if (/^\d/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
};
const formatPrice = (val: number | string | null) => {
  if (val == null) return "—";
  const n = typeof val === "string" ? Number(val.replace(",", ".")) : val;
  if (!Number.isFinite(n)) return "—";
  
  // 'en-US' usa coma para miles y punto para decimales (1,245.54)
  // 'es-ES' usa punto para miles y coma para decimales (1.245,54)
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};
const prettyMemberLabel = (raw: string | null | undefined, slugMap?: Record<string, string>) => {
  const s = String(raw ?? "").trim();
  if (!s || s === "—") return "";
  const parts = s
    .split(/\s*(?:\/|,|&|\+|x|\s)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.some((p) => p.toLowerCase() === "ot8")) return "OT8";
  const mapped = parts.map((p) => {
    const key = p.toLowerCase().replace(/\./g, "").trim();
    if (key === "feli") return slugMap?.["felix"] ?? "Felix";
    if (key === "in") return slugMap?.["in"] ?? "I.N";
    if (slugMap && slugMap[key]) return slugMap[key];
    return prettyText(p);
  });
  return mapped.filter(Boolean).join(" + ");
};

const matchesQuery = (it: PickerItem, query: string) => {
  const tokens = normWords(query);
  if (tokens.length === 0) return true;
  const haystack = normText(
    [
      it.id,
      it.name ?? "",
      it.member ?? "",
      it.member_name ?? "",
      it.group_name ?? "",
      it.album_name ?? "",
      it.version ?? "",
      it.version_name ?? "",
      it.version_name_display ?? "",
    ].join(" ")
  );
  if (tokens.length === 1 && tokens[0].length === 1) {
    return haystack.includes(tokens[0]);
  }
  return tokens.every((t) => {
    if (/^\d+$/.test(t)) return String(it.id).includes(t) || haystack.includes(t);
    return haystack.includes(t);
  });
};
const pickerLabelStyle: CSSProperties = {
 fontSize: 12,
 color: "var(--color-primary)",
 fontWeight: 900,
 display: "flex",
 alignItems: "center",
 gap: 6,
 lineHeight: 1.2,
 flexWrap: "wrap",
};

const pickerControlStyle: CSSProperties = {
 padding: "8px 10px",
 borderRadius: 10,
 border: "1px solid var(--color-border)",
 minWidth: 170,
 background: "var(--bg-card)",
 color: "var(--text-main)",
 boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 8%, transparent)",
};

const pickerSearchStyle: CSSProperties = {
 padding: "8px 10px",
 borderRadius: 10,
 border: "1px solid var(--color-border)",
 minWidth: 220,
 background: "var(--bg-card)",
 color: "var(--text-main)",
 boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 8%, transparent)",
};

const pickerShellStyle: CSSProperties = {
 background: "var(--bg-main)",
 border: "1px solid var(--color-border)",
 borderRadius: 20,
 overflow: "hidden",
 boxShadow: "0 18px 44px color-mix(in srgb, var(--color-primary) 10%, transparent)",
 height: "100%",
 display: "flex",
 flexDirection: "column",
 minHeight: 0,
};

const pickerHeaderStyle: CSSProperties = {
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 gap: 12,
 padding: "12px 16px",
 borderBottom: "1px solid var(--color-border)",
 background: "var(--bg-soft)",
};

const pickerTitleWrapStyle: CSSProperties = {
 display: "flex",
 alignItems: "center",
 gap: 12,
 minWidth: 0,
};

const pickerTitleStyle: CSSProperties = {
 color: "var(--color-primary)",
 fontWeight: 950,
 fontSize: 20,
 letterSpacing: 0.2,
 lineHeight: 1.1,
};

const pickerSectionStyle: CSSProperties = {
 padding: 16,
 background: "var(--bg-main)",
 display: "flex",
 flexDirection: "column",
 gap: 12,
 flex: 1,
 minHeight: 0,
};

const pickBtnStyle: CSSProperties = {
 marginTop: 14,
 width: "100%",
 padding: "9px 12px",
 borderRadius: 12,
 border: "1px solid var(--color-primary)",
 background: "var(--bg-soft)",
 color: "var(--color-primary)",
 cursor: "pointer",
 fontWeight: 900,
 boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 14%, transparent)",
 transition: "all 0.15s ease",
};
type LayoutType =
  | "3x3"
  | "4x3"
  | "3x4"
  | "4x4"
  | "2x2"
  | "2x3"
  | "2x4"
  | "1x4"
  | "1x3"
  | "1x2"
  | "sp_2x2"
  | "sp_1x2"
  | "sp_1x3"
  | "sp_1x4"
  | "sp_1x1"
  | "separator";

type LayoutDef = {
  key: LayoutType;
  label: string;
  cols: number;
  rows?: number;
  slots: number;
  size?: "pc" | "special";
};

const LAYOUTS: LayoutDef[] = [
  { key: "3x3", label: "3x3", cols: 3, rows: 3, slots: 9 },
  { key: "4x3", label: "4x3", cols: 4, rows: 3, slots: 12 },
  { key: "3x4", label: "3x4", cols: 3, rows: 4, slots: 12 },
  { key: "4x4", label: "4x4", cols: 4, rows: 4, slots: 16 },
  { key: "2x2", label: "2x2", cols: 2, rows: 2, slots: 4 },
  { key: "2x3", label: "2x3", cols: 2, rows: 3, slots: 6 },
  { key: "2x4", label: "2x4", cols: 2, rows: 4, slots: 8 },
  { key: "1x4", label: "1x4", cols: 1, rows: 4, slots: 4 },
  { key: "1x3", label: "1x3", cols: 1, rows: 3, slots: 3 },
  { key: "1x2", label: "1x2", cols: 1, rows: 2, slots: 2 },
  { key: "sp_2x2", label: "Special 2x2", cols: 2, rows: 2, slots: 4, size: "special" },
  { key: "sp_1x2", label: "Special 1x2", cols: 1, rows: 2, slots: 2, size: "special" },
  { key: "sp_1x3", label: "Special 1x3", cols: 1, rows: 3, slots: 3, size: "special" },
  { key: "sp_1x4", label: "Special 1x4", cols: 1, rows: 4, slots: 4, size: "special" },
  { key: "sp_1x1", label: "Special 1x1", cols: 1, rows: 1, slots: 1, size: "special" },
  { key: "separator", label: "Separador", cols: 1, rows: 1, slots: 1, size: "special" },
];

const LAYOUT_KEYS = new Set(LAYOUTS.map((l) => l.key));

const isLayoutType = (value: unknown): value is LayoutType =>
  typeof value === "string" && LAYOUT_KEYS.has(value as LayoutType);

const defFor = (key: LayoutType): LayoutDef => LAYOUTS.find((l) => l.key === key) ?? LAYOUTS[0];

const getExtrasCount = (_key: LayoutType) => 0;

// Página 9 del PDF
function ItemPicker({
  userId,
  binderId,
  binderTitle,
  placedByItem,
  invByItem,
  loadInvForIds,
  refreshTick,
  userBiases,
  onPick,
  onClose,
  isMobile, // ✅ AÑADE ESTA LÍNEA AQUÍ
}: {
  userId: string;
  binderId: number;
  binderTitle: string;
  placedByItem: Record<number, any>;
  invByItem: Record<number, any>;
  loadInvForIds: (ids: number[]) => Promise<void>;
  refreshTick: number;
  userBiases: number[];
  onPick: (itemId: number) => void;
  onClose: () => void;
  isMobile: boolean; // ✅ Y ESTA LÍNEA TAMBIÉN
}) {
  const { t } = useGlobal(); // ✅ AÑADE ESTA LÍNEA AQUÍ
 const DUMMY_PICK_ID = -1;

  const [loading, setLoading] = useState(true);
const [err, setErr] = useState<string | null>(null);
const [items, setItems] = useState<PickerItem[]>([]);

 const [pickerReloadTick, setPickerReloadTick] = useState(0);
 const [q, setQ] = useState("");
 const [localInv, setLocalInv] = useState<Record<number, StatusCounts>>({});
 
  const [statusFilter, setStatusFilter] = useState<"" | StatusKey>("");
  const [group, setGroupId] = useState<number | "">("");
  const [album, setAlbumId] = useState<number | "">("");
  const [version, setVersionId] = useState("");
  const [member, setMemberId] = useState("");
const [unitFilter, setUnitFilter] = useState<UnitFilter>("all");
  const [onlyBiases, setOnlyBiases] = useState(false); // <--- NUEVO ESTADO PARA EL BOTÓN
 const [groups, setGroups] = useState<FilterOption[]>([]);
const [albums, setAlbums] = useState<AlbumOption[]>([]);

useEffect(() => {
 let cancelled = false;

 const run = async () => {
  setLoading(true);
  setErr(null);

  try {
   const statusRows = await fetchAllUserItemStatuses(userId);
   const invMap: Record<number, StatusCounts> = {};
   for (const row of statusRows) applyStatusRow(invMap, row);
   const ids = Object.keys(invMap)
     .map((id) => Number(id))
     .filter((id) => Number.isFinite(id) && itemHasPickerStock(invMap[id]));
   if (!cancelled) setLocalInv(invMap);
   const rawItems = ids.length > 0 ? await fetchPickerItemsByIds(ids) : [];


// ⚠️ proteger carga de inventario
try {
 if (ids.length > 0) {
  await loadInvForIds(ids);
 }
} catch (e) {
 console.error("Error cargando inventario del picker", e);
}

   const toNum = (x: any): number | null => {
    if (typeof x === "number" && Number.isFinite(x)) return x;
    if (typeof x === "string" && x.trim() && Number.isFinite(Number(x))) return Number(x);
    return null;
   };

   const uniqNums = (arr: Array<any>) =>
    Array.from(new Set(arr.map(toNum).filter((n): n is number => n !== null))).sort((a, b) => a - b);

   const gIds = uniqNums(rawItems.map((i) => i.group_id));
   const aIds = uniqNums(rawItems.map((i) => i.album_id));
   const vIds = uniqNums(rawItems.map((i) => i.version_id));
   const mlds = uniqNums(rawItems.map((i) => i.member_id));

type IdName = {
 id?: number;
 member_id?: number;
 name: string;
 slug?: string | null;
 release_date?: string | null;
};
   const emptyListRes: { data: IdName[]; error: null } = { data: [], error: null };

  const [gRes, aRes, vRes, mRes] = await Promise.all([
 gIds.length ? supabase.from("groups").select("id, name").in("id", gIds) : Promise.resolve(emptyListRes),
 aIds.length
 ? supabase.from("albums").select("id, name, release_date").in("id", aIds)
 : Promise.resolve(emptyListRes),
 vIds.length ? supabase.from("versions").select("id, name").in("id", vIds) : Promise.resolve(emptyListRes),
 mlds.length ? supabase.from("members").select("member_id, name, slug").in("member_id", mlds) : Promise.resolve(emptyListRes),
]);

   if ("error" in gRes && gRes.error) throw new Error(gRes.error.message);
   if ("error" in aRes && aRes.error) throw new Error(aRes.error.message);
   if ("error" in vRes && vRes.error) throw new Error(vRes.error.message);
   if ("error" in mRes && mRes.error) throw new Error(mRes.error.message);

  const toMap = (rows: IdName[]) => {
 const out: Record<number, string> = {};
 for (const r of rows) {
  const key =
   typeof r.id === "number"
    ? r.id
    : typeof r.member_id === "number"
    ? r.member_id
    : null;

  if (key != null) {
   out[key] = String(r.name ?? "").trim();
  }
 }
 return out;
};

   const groupMap = toMap(gRes.data ?? []);
   const albumMap = toMap(aRes.data ?? []);
   const versionMap = toMap(vRes.data ?? []);
   const memberMap = toMap(mRes.data ?? []);

   const memberSlugMap: Record<string, string> = {};
for (const r of (mRes.data ?? []) as Array<{ member_id?: number; name: string; slug?: string | null }>) {
 const slug = String(r.slug ?? "").trim().toLowerCase();
 const name = String(r.name ?? "").trim();
 if (slug && name) memberSlugMap[slug] = name;
}

   const enrichedItems: PickerItem[] = rawItems.map((it) => {
  const gid = toNum(it.group_id);
  const aid = toNum(it.album_id);
  const vid = toNum(it.version_id);
const mid = toNum(it.member_id) ?? undefined;

    const groupName = gid !== null ? groupMap[gid] || null : null;
    const albumName = aid !== null ? albumMap[aid] || null : null;
    const versionName =
     typeof it.version === "string" && it.version.trim()
      ? it.version.trim()
      : vid !== null
      ? versionMap[vid] || null
      : null;
    const versionDisplay = versionName ? prettyText(versionName) : null;
    const memberNameFromId = mid !== undefined ? memberMap[mid] || null : null;
    const memberName =
     (typeof it.member === "string" && it.member.trim()
      ? prettyMemberLabel(it.member.trim(), memberSlugMap)
      : null) || memberNameFromId;

    return {
    ...it,
    // Forzamos la lectura directa del objeto que vino de la base de datos
    member_id: mid,
    group_name: groupName,
    
    album_name: albumName,
    version_name: versionName,
    version_name_display: versionDisplay,
    member_name: memberName,
  };
   });

 if (!cancelled) {
  setItems(enrichedItems);
  setGroups((gRes.data ?? []).map((r) => ({ id: r.id, name: r.name })));
  setAlbums((aRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    release_date: (r as any).release_date ?? null,
  })));
  // ✅ Añade esto aquí dentro también por seguridad:
  setLoading(false); 
}
  } catch (e: any) {
   if (!cancelled) {
    setErr(e?.message ?? "Error cargando el picker");
   }
  } finally {
   if (!cancelled) {
    setLoading(false);
   }
  }
 };

 void run();

 return () => {
  cancelled = true;
 };
}, [userId, binderId, loadInvForIds]);

useEffect(() => {
 if (!items.length) return;
 if (refreshTick === 0 && pickerReloadTick === 0) return;

 const ids = items.map((i) => i.id);
 void loadInvForIds(ids);
}, [refreshTick, pickerReloadTick, items, loadInvForIds]);


const albumOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const it of items) {
      if (group !== "" && (it.group_id ?? null) !== group) continue;
      const id = it.album_id ?? null;
      if (id == null) continue;
      const name = it.album_name ?? `#${id}`;
      if (name) map.set(id, name);
    }
    const entries = Array.from(map.entries()).map(([id, name]) => ({
      id,
      name,
      release_date: albums.find((a) => a.id === id)?.release_date ?? null,
    }));
    const selectedGroupName =
      group === "" ? null : groups.find((g) => g.id === group)?.name ?? null;
    return sortCollectionEntries(entries, { groupName: selectedGroupName });
  }, [items, group, albums, groups]);

  const versionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (group !== "" && (it.group_id ?? null) !== group) continue;
      if (album !== "" && (it.album_id ?? null) !== album) continue;
      const v = (it.version_name_display ?? it.version_name ?? "").trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, group, album]);

  const memberOptionsFixed = useMemo(
    () => [
      { value: "bang-chan", label: "Bang Chan" },
      { value: "lee-know", label: "Lee Know" },
      { value: "changbin", label: "Changbin" },
      { value: "hyunjin", label: "Hyunjin" },
      { value: "han", label: "Han" },
      { value: "felix", label: "Felix" },
      { value: "seungmin", label: "Seungmin" },
      { value: "in", label: "I.N" },
    ],
    []
  );  const availableMemberSet = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (group !== "" && (it.group_id ?? null) !== group) continue;
      if (album !== "" && (it.album_id ?? null) !== album) continue;
      if (version !== "") {
        const vLabel = (it.version_name_display ?? it.version_name ?? "").trim();
        if (vLabel !== version) continue;
      }
      if (unitFilter !== "all") {
        const ut = unitTypeFromMember(it.member ?? it.member_name);
        if (ut !== unitFilter) continue;
      }
      for (const m of memberOptionsFixed) {
        if (memberMatches(it.member ?? it.member_name, m.value)) {
          set.add(m.value);
        }
      }
    }
    return set;
  }, [items, group, album, version, unitFilter, memberOptionsFixed]);

  const memberOptions = useMemo(() => {
    return memberOptionsFixed.filter((m) => availableMemberSet.has(m.value));
  }, [memberOptionsFixed, availableMemberSet]);

  useEffect(() => {
    if (album !== "" && !albumOptions.some((a) => a.id === album)) setAlbumId("");
  }, [album, albumOptions]);

  useEffect(() => {
    if (version !== "" && !versionOptions.includes(version)) setVersionId("");
  }, [version, versionOptions]);

  useEffect(() => {
    if (member !== "" && !memberOptions.some((m) => m.value === member)) setMemberId("");
  }, [member, memberOptions]);

  const biasSlugById = useMemo(() => {
    return {
      1: "hyunjin",
      2: "changbin",
      3: "han",
      4: "bang-chan",
      5: "seungmin",
      6: "lee-know",
      7: "felix",
      8: "in",
    } as Record<number, string>;
  }, []);

  const filtered = useMemo(() => {
    // Log para verificar que los datos llegan al filtro
    console.log("Picker Debug Total items:", items.length, "User Biases:", userBiases);

    return items.filter((it) => {
      const counts = invByItem[it.id] ?? localInv[it.id] ?? emptyCounts();

      // 1. REGLA DE ORO: Si ya está en el binder, no la mostramos en el picker
      const inBinder = !!placedByItem[it.id];
      if (inBinder) return false;

      // 👇 AÑADIDO: REGLA DE PLATA: Si no tiene stock NI está en la wishlist, ¡fuera de aquí!
      const totalStock = Number(counts.have ?? 0) + Number(counts.wtt ?? 0) + Number(counts.wts ?? 0) + Number(counts.on_its_way ?? 0);
      const inWishlist = Number(counts.wish ?? 0) > 0;
      if (totalStock <= 0 && !inWishlist) return false;
      // 👆 HASTA AQUÍ

      // 2. FILTRO DE ESTADO (Solo si el usuario elige uno explícitamente)
      if (statusFilter) {
        const val = Number(counts[statusFilter] ?? 0);
        if (val <= 0) return false;
      }

      // 3. FILTROS DE CATEGORÍA
      if (group !== "" && (it.group_id ?? null) !== group) return false;
      // ... el resto de tus filtros siguen exactamente igual hacia abajo ...
      if (album !== "" && (it.album_id ?? null) !== album) return false;
      
      if (version !== "") {
        const vLabel = (it.version_name_display ?? it.version_name ?? "").trim();
        if (vLabel !== version) return false;
      }
      
      if (member !== "" && !memberMatches(it.member ?? it.member_name, member)) return false;

      // 4. FILTRO DE TIPO (Unit/Single/OT8)
      if (unitFilter !== "all") {
        const textToCheck = it.member || it.member_name || it.name || "";
        const ut = unitTypeFromMember(textToCheck);
        if (ut !== unitFilter) return false;
      }

      // 5. FILTRO DE SOLO MIS BIAS (Aquí es donde estaba el error)
      if (onlyBiases) {
        // DEFINIMOS biasList AQUÍ PARA QUE NO DE ERROR 
        const biasList = (userBiases || []).map(Number); 
        const rawMember = it.member ?? it.member_name ?? "";
        
        const isMyBias = (it.member_id != null && biasList.includes(Number(it.member_id))) ||
                        biasList.some((biasId) => {
                          const biasSlug = biasSlugById[Number(biasId)];
                          return biasSlug ? memberMatches(rawMember, biasSlug) : false;
                        });
        if (!isMyBias) return false;
      }

      // 6. BUSQUEDA POR TEXTO (Nombre o ID)
      return matchesQuery(it, q);
    });
  }, [
    items,
    q,
    invByItem,
    statusFilter,
    group,
    album,
    version,
    member,
    unitFilter,
    placedByItem,
    onlyBiases,
    userBiases,
    biasSlugById,
    localInv,
  ]);
 const pickBtnStyle: CSSProperties = {
 marginTop: 14,
 width: "100%",
 padding: "9px 12px",
 borderRadius: 12,
 border: "1px solid var(--color-primary)",
 background: "var(--bg-soft)",
 color: "var(--color-primary)",
 cursor: "pointer",
 fontWeight: 900,
 boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 14%, transparent)",
 transition: "all 0.15s ease",
};

const pickerShellStyle: CSSProperties = {
 background: "var(--bg-main)",
 border: "1px solid var(--color-border)",
 borderRadius: 20,
 overflow: "hidden",
 boxShadow: "0 18px 44px color-mix(in srgb, var(--color-primary) 10%, transparent)",
 height: "100%",
 display: "flex",
 flexDirection: "column",
 minHeight: 0,
};

const pickerHeaderStyle: CSSProperties = {
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 gap: 12,
 padding: "12px 16px",
 borderBottom: "1px solid var(--color-border)",
 background: "var(--bg-soft)",
};

const pickerTitleWrapStyle: CSSProperties = {
 display: "flex",
 alignItems: "center",
 gap: 12,
 minWidth: 0,
};

const pickerTitleStyle: CSSProperties = {
 color: "var(--color-primary)",
 fontWeight: 950,
 fontSize: 20,
 letterSpacing: 0.2,
 lineHeight: 1.1,
};

const pickerSectionStyle: CSSProperties = {
 padding: 16,
 background: "var(--bg-main)",
 display: "flex",
 flexDirection: "column",
 gap: 12,
 flex: 1,
 minHeight: 0,
};

const pickerLabelStyle: CSSProperties = {
 fontSize: 12,
 color: "var(--color-primary)",
 fontWeight: 900,
 display: "flex",
 alignItems: "center",
 gap: 6,
 lineHeight: 1.2,
 flexWrap: "wrap",
};

const pickerControlStyle: CSSProperties = {
 padding: "8px 10px",
 borderRadius: 10,
 border: "1px solid var(--color-border)",
 minWidth: 170,
 background: "var(--bg-card)",
 color: "var(--text-main)",
 boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 8%, transparent)",
};

const pickerSearchStyle: CSSProperties = {
 padding: "8px 10px",
 borderRadius: 10,
 border: "1px solid var(--color-border)",
 minWidth: 220,
 background: "var(--bg-card)",
 color: "var(--text-main)",
 boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 8%, transparent)",
};

/* NUEVOS ESTILOS PARA FIJAR FILTROS Y HACER SCROLL EN PCS */

const pickerFiltersWrapStyle: CSSProperties = {
 flex: "0 0 auto",
};

const pickerGridScrollStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto", // Habilita el scroll
  WebkitOverflowScrolling: "touch", // Suavidad en iPhone
  paddingRight: 6,
};

return (
  <div style={pickerShellStyle}>
   <div style={pickerHeaderStyle}>
  <div style={pickerTitleWrapStyle}>
    <img
      src="/branding/logo.png"
      alt={t('header.logo_alt')}
      draggable={false}
      style={{ height: 42, width: "auto", objectFit: "contain", flexShrink: 0 }}
    />
<div style={pickerTitleStyle}>{binderTitle}</div> 
  </div>

  <button
    type="button"
    onClick={onClose}
    title={t('common.close')}
    style={{
      width: 36,
      height: 36,
      borderRadius: 10,
      border: "1px solid var(--color-border)",
      background: "var(--bg-card)",
      color: "var(--color-primary)",
      fontWeight: 900,
      fontSize: 18,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 3px 10px color-mix(in srgb, var(--text-main) 6%, transparent)",
    }}
  >
    ✕
  </button>
</div>

    <div style={pickerSectionStyle}>
  <div style={pickerFiltersWrapStyle}>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={pickerLabelStyle}>
            <SlidersHorizontal size={14} strokeWidth={2.4} /> {t('binders.picker.status')}
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target.value || "") as "" | StatusKey)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--state-disabled-border)", ...pickerControlStyle, minWidth: 180 }}
          >
            <option value="">{t('binders.picker.all_masculine')}</option>
<option value="have">{t('binders.statuses.have')}</option>            <option value="wtt">{t('binders.statuses.wtt')}</option>
            <option value="wts">{t('binders.statuses.wts')}</option>
            <option value="on_its_way">{t('binders.statuses.otw')}</option>
            <option value="wish">{t('binders.statuses.wishlist')}</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={pickerLabelStyle}>
            <Users size={14} strokeWidth={2.4} /> {t('binders.picker.group')}
          </label>
          <select
            value={group}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--state-disabled-border)", ...pickerControlStyle, minWidth: 180 }}
          >
            <option value="">{t('binders.picker.all_masculine')}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={pickerLabelStyle}>
            <Disc3 size={14} strokeWidth={2.4} /> {t('binders.picker.collection') || "Colección / Era"}
          </label>
          <select
            value={album}
            onChange={(e) => setAlbumId(e.target.value ? Number(e.target.value) : "")}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--state-disabled-border)", ...pickerControlStyle, minWidth: 180 }}
          >
            <option value="">{t('binders.picker.all_masculine')}</option>
            {albumOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {formatCollectionOptionLabel(a.name, a.release_date)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={pickerLabelStyle}>
            <Mic2 size={14} strokeWidth={2.4} /> {t('binders.picker.version')}
          </label>
          <select
            value={version}
            onChange={(e) => setVersionId(e.target.value || "")}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--state-disabled-border)", ...pickerControlStyle, minWidth: 160 }}
          >
            <option value="">{t('binders.picker.all_feminine')}</option>
            {versionOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={pickerLabelStyle}>
            <Layers size={14} strokeWidth={2.4} /> {t('binders.picker.type')}
          </label>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value as UnitFilter)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--state-disabled-border)", ...pickerControlStyle, minWidth: 140 }}
          >
            <option value="all">{t('binders.picker.all_masculine')}</option>
            <option value="single">{t('binders.picker.type_selfie')}</option>
            <option value="unit">{t('binders.picker.type_unit')}</option>
            <option value="ot8">OT8</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={pickerLabelStyle}>
            <User size={14} strokeWidth={2.4} /> {t('binders.picker.member')}
          </label>
          <select
            value={member}
            onChange={(e) => setMemberId(e.target.value || "")}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--state-disabled-border)", ...pickerControlStyle, minWidth: 140 }}
          >
            <option value="">{t('binders.picker.all_masculine')}</option>
            {memberOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
{/* BOTÓN SOLO MIS BIAS */}

            {userBiases?.length > 0 && (

              <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "flex-end" }}>

                <button

                  type="button"

                  onClick={() => setOnlyBiases(!onlyBiases)}

                  style={{

                    height: 35,

                    padding: "0 12px",

                    borderRadius: 10,

                    border: onlyBiases ? "1px solid var(--color-primary)" : "1px solid var(--state-disabled-border)",

                    background: onlyBiases ? "var(--bg-soft)" : "var(--bg-card)",

                    color: onlyBiases ? "var(--color-primary)" : "var(--text-muted)",

                    fontWeight: 900,

                    cursor: "pointer",

                    display: "flex",

                    alignItems: "center",

                    gap: 6,

                    transition: "all 0.2s"

                  }}

                >

                  {onlyBiases ? "💖 Bias activado" : "🤍 Mis Bias"}

                </button>

              </div>

            )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 240 }}>
          <label style={pickerLabelStyle}>
            Búsqueda
          </label>
         <input
  value={q}
  onChange={(e) => setQ(e.target.value)}
  placeholder={t('binders.picker.search_placeholder')}
  style={{ ...pickerSearchStyle, width: "100%" }}
/>
               </div>
      </div>
      </div>

    <div style={pickerGridScrollStyle}>
{loading && <div style={{ color: "var(--text-muted)" }}>{t('common.loading')}</div>}      {err && <div style={{ color: "crimson" }}>Error: {err}</div>}

<div
  style={{
    marginTop: 12,
    display: "grid",
    // ✅ Móvil: 1 columna completa | Desktop: auto-relleno de mínimo 300px
    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))",
    gap: isMobile ? "12px" : "16px",
    alignContent: "flex-start",
    paddingBottom: 40
  }}
>
  {/* TARJETA PC PERSONALIZADA MEJORADA */}
  <div
    title={t('binders.picker.add_custom')}
    style={{
      width: "100%",
      minHeight: isMobile ? 180 : 210,
      display: "flex",
      flexDirection: "column",
      border: "2.5px dashed var(--color-accent-blue)", // Borde más visible
      borderRadius: 16,
      padding: 12,
      background: "var(--state-info-bg)",
      position: "relative",
      justifyContent: "space-between",
      boxShadow: "0 4px 12px color-mix(in srgb, var(--color-accent-blue) 15%, transparent)"
    }}
  >
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{
        width: isMobile ? 40 : 50, 
        height: isMobile ? 60 : 75, 
        borderRadius: 8, border: "2px dashed var(--color-accent-blue)",
        background: "var(--bg-card)", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 20, color: "var(--color-accent-blue)", fontWeight: 900
      }}>+</div>
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{ fontWeight: 950, color: "var(--text-main)", fontSize: isMobile ? 12 : 14, lineHeight: 1.2 }}>
          PC personalizada
        </div>
        {!isMobile && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.3 }}>
            Crea tu propia carta con foto y texto.
          </div>
        )}
      </div>
    </div>
    
    <button 
      type="button" 
      onClick={() => onPick(DUMMY_PICK_ID)} 
      style={{
        ...pickBtnStyle,
        marginTop: 8,
        padding: "8px",
        fontSize: "11px"
      }}
    >
      {t("binders.picker.add_custom")}
   </button>
  </div>

  {/* MAPEADO DE CARTAS DISPONIBLES DENTRO DEL GRID */}
  {/* El console.log debe ir dentro de llaves para ejecutarse en JSX */}
  {(() => {
      console.log("Items en el picker:", items.length, "Filtrados:", filtered.length);
      return null;
  })()}
 
  {filtered.map((it) => {
    // ... resto de tu lógica de stock y estados [cite: 429, 436]
  // --- 1. LÓGICA DE STOCK Y ESTADOS ---
  const counts = invByItem[it.id] ?? localInv[it.id] ?? emptyCounts();
  const rawHave = Number(counts.have ?? 0);
  const rawWtt = Number(counts.wtt ?? 0);
  const rawWts = Number(counts.wts ?? 0);
  const rawOtw = Number(counts.on_its_way ?? 0);
  const rawWish = Number(counts.wish ?? 0);

  const wishFlag = rawWish > 0;
  const have = wishFlag ? 0 : rawHave;
  const wtt = wishFlag ? 0 : rawWtt;
  const wts = wishFlag ? 0 : rawWts;
  const otw = wishFlag ? 0 : rawOtw;

  const stockTotal = have + wtt + wts + otw;
  const basePlaceable = wishFlag ? 1 : stockTotal > 0 ? stockTotal : 0;
  const placedCount = placedByItem[it.id] ? 1 : 0;
  
  // ✅ Definición de availableCount
  const availableCount = Math.max(0, basePlaceable - placedCount);
  // ✅ Definición de disabled
  const disabled = availableCount <= 0;
  // ✅ Definición de st (colores de estado)
  const st = statusColors(counts);

  // --- 2. LÓGICA DE BIAS ---
  const biasList = (userBiases || []).map(Number);
  const rawMember = it.member ?? it.member_name ?? "";
  const lowerMember = String(rawMember).toLowerCase().trim();
  const isMyBias = (it.member_id != null && biasList.includes(Number(it.member_id))) ||
                  /\bot8\b/.test(lowerMember) ||
                  biasList.some((biasId) => {
                    const biasSlug = biasSlugById[Number(biasId)];
                    return biasSlug ? memberMatches(rawMember, biasSlug) : false;
                  });

  // --- 3. DISEÑO VISUAL ANCHO ---
  return (
  <div
    key={it.id}
    style={{
      width: "100%",
      minHeight: isMobile ? 120 : 140, // Altura adaptada [cite: 3410]
      display: "flex",
      flexDirection: "column",
      backgroundColor: "var(--bg-card)",
      borderRadius: 20,
      border: `2px solid ${st.border}`,
      padding: isMobile ? "10px 12px" : "15px 20px", // Padding dinámico [cite: 3411]
      boxShadow: "0 6px 18px color-mix(in srgb, var(--text-main) 4%, transparent)",
      justifyContent: "space-between",
      position: "relative",
      transition: "all 0.25s ease-out",
    }}
  >
    <div style={{ display: "flex", gap: isMobile ? 10 : 20, alignItems: "center", flex: 1 }}>
      
      {/* FOTO */}
      <div style={{ 
        width: isMobile ? 65 : 85, // Un poco más pequeña en móvil para dar aire al texto [cite: 3414]
        aspectRatio: "1 / 1.4", 
        borderRadius: 12, 
        border: "1px solid var(--state-disabled-bg)", 
        overflow: "hidden", 
        flexShrink: 0,
        position: "relative" 
      }}>
        <ImageWithExtensionFallback
          src={it.image_url ?? "/mock-pcs/groups/not-available.png"}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {isMyBias && (
          <div style={{ position: "absolute", left: 4, bottom: 4, zIndex: 3 }}>
            <Heart size={isMobile ? 12 : 16} fill="var(--color-primary)" color="var(--color-primary)" strokeWidth={0} />
          </div>
        )}
      </div>

      {/* TEXTO: Quitamos el 'nowrap' para permitir 2 líneas */}
      <div style={{ textAlign: "left", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ 
          fontWeight: 950, 
          color: "var(--text-main)", 
          fontSize: isMobile ? 14 : 16, 
          marginBottom: 2, 
          lineHeight: 1.1,
          display: "-webkit-box",
          WebkitLineClamp: 2, // Permite 2 líneas para el nombre si es necesario
          WebkitBoxOrient: "vertical",
          overflow: "hidden"
        }}>
          {prettyMemberLabel(it.member ?? it.member_name ?? "") || it.name || `Item ${it.id}`}
        </div>

        <div style={{ fontSize: isMobile ? 10 : 12, color: "var(--text-muted)", lineHeight: 1.3 }}>
          <div style={{ marginBottom: 1 }}><b style={{ color: "var(--color-primary)" }}>{t("binders.picker.group")}:</b> {it.group_name}</div>
          
          {/* Álbum en 2 líneas */}
          <div style={{ 
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", 
            overflow: "hidden", textOverflow: "ellipsis" 
          }}>
            <b style={{ color: "var(--color-primary)" }}>{t("binders.picker.album")}:</b> {it.album_name}
          </div>

          {/* Versión en 2 líneas */}
          <div style={{ 
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", 
            overflow: "hidden", textOverflow: "ellipsis" 
          }}>
            <b style={{ color: "var(--color-primary)" }}>{t("binders.picker.version")}:</b> {it.version_name_display ?? it.version ?? "—"}
          </div>
        </div>

       {/* BADGES */}
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {rawHave > 0 && (
                <span style={{ background: "var(--state-success-bg)", border: "1px solid var(--state-success-border)", color: "var(--state-success-fg)", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 6 }}>
                  {t("binders.statuses.have")}: {rawHave}
                </span>
              )}
              {rawWtt > 0 && (
                <span style={{ background: "var(--bg-soft)", border: "1px solid var(--color-secondary)", color: "var(--color-primary)", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 6 }}>
                  WTT: {rawWtt}
                </span>
              )}
              {rawWts > 0 && (
                <span style={{ background: "var(--state-disabled-bg)", border: "1px solid var(--state-disabled-border)", color: "var(--text-muted)", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 6 }}>
                  WTS: {rawWts}
                </span>
              )}
              {rawOtw > 0 && ( // Ojo, usamos el rawOtw con cero que tienes definido en tu código
                <span style={{ background: "var(--state-info-bg)", border: "1px solid var(--state-info-border)", color: "var(--state-info-fg)", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 6 }}>
                  OTW: {rawOtw}
                </span>
              )}
              {rawWish > 0 && (
                <span style={{ background: "var(--state-warning-bg)", border: "1px solid var(--state-warning-border)", color: "var(--state-warning-fg)", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 6 }}>
                  WISH
                </span>
              )}
            </div>
      </div>
    </div>

    {/* PIE DE CARTA */}
    <div style={{ 
      marginTop: 8, 
      borderTop: "1px solid var(--bg-main)", 
      paddingTop: 8, 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "space-between" 
    }}>
      <div style={{ fontSize: isMobile ? 10 : 12, fontWeight: 950, color: "var(--text-main)" }}>
        {t("binders.item_info.stock")}: {availableCount}
      </div>
      <button
        type="button"
        onClick={() => onPick(it.id)}
        disabled={disabled}
        style={{
          background: disabled ? "var(--state-disabled-bg)" : "var(--bg-soft)",
          color: disabled ? "var(--state-disabled-fg)" : "var(--color-primary)",
          border: `1px solid ${disabled ? "var(--state-disabled-border)" : "var(--color-primary)"}`,
          borderRadius: 8,
          padding: isMobile ? "4px 10px" : "6px 20px",
          fontSize: isMobile ? "11px" : "13px",
          fontWeight: 900,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {disabled ? t("binders.picker.not_available") : t("binders.picker.select_button")}
      </button>
    </div>
  </div>
);
})}
</div>

      {!loading && !err && filtered.length === 0 && (
        <div style={{ marginTop: 10, color: "var(--text-muted)" }}>
          {t("binders.picker.no_results")}
        </div>
      )}
    </div>
  </div>
</div>
);
}

type SlotItem = {
  id: number;
  name: string | null;
  image_url: string | null;
  back_image_url: string | null;
  member_id?: number | null;
  member?: string | null;
  member_name?: string | null; // <--- AÑADE ESTO PARA QUITAR EL ROJO
  is_wanted?: boolean;         // <--- AÑADE ESTO PARA QUITAR EL ROJO
  is_custom?: boolean;
  custom_text?: string | null;
  custom_image_url?: string | null;
  custom_back_image_url?: string | null;
  custom_color?: string | null;
};
const DUMMY_ITEM_ID = 999999; // id "virtual" para la PC custom (no necesita existir en DB si usamos localStorage)

type SlotCustom = {
  text: string;
  imageDataUrl: string | null; // guardamos dataURL en localStorage
};
type DbItemRow = {
  id: number;
  name: string | null;
  image_url: string | null;
  back_image_url: string | null;
  group_id?: number | null;
  album_id?: number | null;
  version?: string | null;
  member?: string | null;
  member_id?: number | null;
};

type DragPayload = {
  fromPageId: number;
  fromSlot: number;
  itemId: number;

  // snapshot para poder mover entre páginas aunque cambies de pageId en UI
  is_custom?: boolean;
  custom_text?: string | null;
  custom_image_url?: string | null;

  // transform real del origen
  rot?: number;
  flipH?: boolean;
  face?: "front" | "back";

  // para reconstruir UI del destino sin pedir DB
  name?: string | null;
  image_url?: string | null;
  back_image_url?: string | null;
};

function parseDragPayload(s: string | null): DragPayload | null {
  if (!s) return null;
  try {
    const obj = JSON.parse(s);
    if (!obj) return null;

    const fromPageId = Number(obj.fromPageId);
    const fromSlot = Number(obj.fromSlot);
    const itemId = Number(obj.itemId);

    if (!Number.isFinite(fromPageId) || !Number.isFinite(fromSlot) || !Number.isFinite(itemId)) {
      return null;
    }

    return {
      fromPageId,
      fromSlot,
      itemId,

      is_custom: Boolean(obj.is_custom),
      custom_text: obj.custom_text ?? null,
      custom_image_url: obj.custom_image_url ?? null,

      rot: Number.isFinite(Number(obj.rot)) ? Number(obj.rot) : 0,
      flipH: Boolean(obj.flipH),
      face: obj.face === "back" ? "back" : "front",

      name: typeof obj.name === "string" ? obj.name : null,
      image_url: typeof obj.image_url === "string" ? obj.image_url : null,
      back_image_url: typeof obj.back_image_url === "string" ? obj.back_image_url : null,
    };
  } catch {
    return null;
  }
}



type PageDragPayload = { pageId: number };

function parsePageDragPayload(s: string | null): PageDragPayload | null {
  if (!s) return null;
  try {
    const obj = JSON.parse(s);
    const pageId = Number(obj.pageId);
    if (!Number.isFinite(pageId)) return null;
    return { pageId };
  } catch {
    return null;
  }
}

type ItemMeta = {
 id: number;
 name: string | null;
 image_url: string | null;
 back_image_url: string | null;
 group_id: number | null;
 album_id: number | null;
 // ✅ ahora son texto directo en items
 version: string | null;
 member: string | null;
};

type UndoSnapshot = {
  binderPages: Array<{ id: number; page_index: number; layout_type: LayoutType }>;
  pagesCount: number;
  currentPageIndex: number;
  pageId: number | null;
  layout: LayoutType;
  slotItems: Record<number, SlotItem>;
  slotRot: Record<number, number>;
  slotFlipH: Record<number, boolean>;
  slotFace: Record<number, "front" | "back">;
  slotCustom: Record<number, SlotCustom>;
  placedByItem: Record<number, number>; // <--- AÑADE ESTA LÍNEA
  allPageSlots: Record<
        number,
        Array<{
            is_wanted(is_wanted: any): unknown;
            member_id: null;
            slot_index: number;
            item_id: number | null;
            face: "front" | "back";
            rot: number;
            flip_h: boolean;
            is_custom: boolean;
            custom_text?: string | null;
            custom_image_url?: string | null;
            custom_back_image_url?: string | null;
        }>
    >;
  invByItem: Record<number, StatusCounts>;
  priceByItem: Record<number, string>;
  currencyByItem: Record<number, string>;
  marketByItem: Record<number, string>;
  wtsCurrencyByItem: Record<number, string>;
  notesByItem: Record<number, string>;
  wttWantedByItem: Record<number, number[]>;
  wttOfferByItem: Record<number, number[]>;
  wttOfferQtyByItem: Record<number, number>;
};

type PagesModalUndoSnapshot = {
 binderPages: Array<{ id: number; page_index: number; layout_type: LayoutType }>;
 pagesCount: number;
 currentPageIndex: number;
 pageId: number | null;
 layout: LayoutType;
};

type ModalUndoSnapshot = {
 itemId: number;
 dbStatuses: Array<{ status: string; qty: number }>;
 invCounts: StatusCounts;
 price: string;
 currency: string;
 market: string;
 wtsCurrency: string;
 notes: string;
 wttWanted: number[];
 wttOffer: number[];
 wttOfferQty: number;
 customText?: string;
customImageUrl?: string | null;
};
// 1. EL TIPO (Fuera de la función)
type SkzooType = {
 id: string;
 name: string;
 artist: string;
 img: string;
};

const skzooImgStyle: CSSProperties = {
 width: "100%",
 height: "100%",
 objectFit: "contain",
 filter: "drop-shadow(2px 2px 3px var(--overlay-soft))",
 userSelect: "none",
};
const menuBtnStyle: CSSProperties = { 
  background: "transparent", 
  border: "none", 
  padding: "10px 14px", 
  textAlign: "left", 
  borderRadius: 10, 
  cursor: "pointer", 
  fontWeight: 900, 
  color: "var(--color-primary)", 
  fontSize: 14 
};

const footerColumnTitle: CSSProperties = { 
  fontSize: "13px", 
  color: "var(--color-primary)", 
  fontWeight: 900, 
  textTransform: "uppercase", 
  marginBottom: "15px", 
  display: "block" 
};

const footerLinkStyle: CSSProperties = { 
  fontSize: "12px", 
  color: "var(--text-muted)", 
  textDecoration: "none", 
  fontWeight: 500, 
  marginBottom: "8px", 
  display: "block" 
};
export default function BinderClient() {
  // 1. Hooks de Next al principio
  const router = useRouter(); 
  const pathname = usePathname(); 
  const searchParams = useSearchParams(); 
const { userBiases, checkIsBias, profile, showAlert, showConfirm, t, refreshGlobal } = useGlobal();
  const binderFxCurrencyOptions = useMemo(
    () => getCurrencyOptions(profile?.language ?? "es"),
    [profile?.language],
  );

 // 1. ESTADOS BÁSICOS Y DE USUARIO
  const [loading, setLoading] = useState(true); 
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
const [binderTitle, setBinderTitle] = useState<string>(t('common.loading'));
  const [binderColor, setBinderColor] = useState<string>("var(--color-primary)");
  const [coverUrl, setCoverUrl] = useState<string | null>(null); 
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  // --- LIMITES INTELIGENTES ---
  const [userPlan, setUserPlan] = useState("free");
  const [extraPages, setExtraPages] = useState(0);
  const [extraSeparators, setExtraSeparators] = useState(0);

  const MAX_ALLOWED_PAGES = (userPlan === 'anual' ? 60 : userPlan === 'mensual' ? 30 : 12) + extraPages;
  const MAX_ALLOWED_SEPARATORS = (userPlan === 'anual' ? 30 : userPlan === 'mensual' ? 15 : 5) + extraSeparators;
 

  const isAdmin = isAdminTeamEmail((profile as { email?: string | null } | null)?.email);
  const [isMobile, setIsMobile] = useState(false); // ✅ Única declaración
  const [status, setStatus] = useState("");         // ✅ Única declaración
  const [error, setError] = useState<string | null>(null);

  // 2. PARÁMETROS DE URL Y PREVIEW
  const binderFromUrl = searchParams.get("binderId");
  const binderFromUrlNum = binderFromUrl ? Number(binderFromUrl) : NaN;
  const isViewMode = searchParams.get("view") === "true"; 
  const [previewBinderOpen, setPreviewBinderOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // 3. ESTADOS DEL BINDER Y PÁGINAS
  const [binderId, setBinderId] = useState<number | null>(null);
  const [pageId, setPageId] = useState<number | null>(null);
  const [pagesCount, setPagesCount] = useState<number>(0);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [binderPages, setBinderPages] = useState<
    Array<{ id: number; page_index: number; layout_type: LayoutType }>
  >([]);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [buyPagesOpen, setBuyPagesOpen] = useState(false);
  const [buySeparatorsOpen, setBuySeparatorsOpen] = useState(false);
  const [isShifting, setIsShifting] = useState(false);
  const [hoverSeam, setHoverSeam] = useState<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 4. EFECTOS (Separados y en orden correcto)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStatus("");
    }, 3000); 
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (isViewMode && !loading && binderPages.length > 0) {
      setPreviewBinderOpen(true);
    }
  }, [isViewMode, loading, binderPages.length]);

  // 5. FUNCIONES AUXILIARES
  function memberMatches(rawMember: string, biasSlug: string): boolean {
    if (!rawMember || !biasSlug) return false;
    const member = rawMember.toLowerCase().replace(/[.\-_]/g, " ").trim();
    const bias = biasSlug.toLowerCase().replace(/[.\-_]/g, " ").trim();
    if (bias === "in" || bias === "i n") {
      return /\bin\b/i.test(member) || member.includes("jeongin");
    }
    const regex = new RegExp(`\\b${bias}\\b`, "i");
    return regex.test(member);
  }

  // 6. ESTILOS DE BOTONES
  const topBtnStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    borderRadius: 999,
    border: "1px solid var(--binder-btn-outline-border)",
    background: "var(--binder-btn-outline-bg)",
    color: "var(--binder-btn-outline-fg)",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    textDecoration: "none",
    boxShadow: "var(--binder-btn-outline-shadow)",
    transition: "all 0.2s ease"
  };

  const softPinkBtnStyle: CSSProperties = {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--color-primary)",
    background: "var(--bg-soft)",
    color: "var(--color-primary)",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 14%, transparent)",
    transition: "all 0.15s ease",
  };

  const whitePinkBtnStyle: CSSProperties = {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--color-primary)",
    background: "var(--bg-card)",
    color: "var(--color-primary)",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 10%, transparent)",
    transition: "all 0.15s ease",
  };

  const tradeInputStyle: CSSProperties = {
    height: 34,
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid var(--color-border)",
    background: "var(--bg-card)",
    fontSize: 13,
    color: "var(--text-main)",
  };

  const tradeLabelStyle: CSSProperties = {
    fontSize: 12,
    color: "var(--color-primary)",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  const tradeMutedTextStyle: CSSProperties = {
    fontSize: 12,
    color: "var(--text-muted)",
    fontWeight: 900,
  };

  const [skzooQuery, setSkzooQuery] = useState("");
  const [cursorQuery, setCursorQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("binder:favorite-cursors");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const isFav = prev.includes(id);
      const next = isFav ? prev.filter((itemId) => itemId !== id) : [...prev, id];
      localStorage.setItem("binder:favorite-cursors", JSON.stringify(next));
      return next;
    });
  };

  // 7. LÓGICA DE ELIMINACIÓN Y MINIATURAS
  const handleConfirmDeletePC = async () => {
    setShowPreview(false);
    if (modalSlotIndex == null || pageId == null) return;
    const assigned = slotItems[modalSlotIndex] ?? null;

    const result = await persistSlotState(modalSlotIndex, { kind: "empty" }, 0, false);
    if (!result.ok) {
      setStatus("Error eliminando photocard: " + (result.error || "desconocido"));
      setError(result.error || "Error eliminando photocard");
      setTimeout(() => setShowPreview(true), 100);
      return;
    }

    setSlotItems((prev) => {
      const next = { ...prev };
      delete next[modalSlotIndex];
      return next;
    });

    setSlotRot((prev) => {
      const next = { ...prev };
      delete next[modalSlotIndex];
      return next;
    });

    setSlotFlipH((prev) => {
      const next = { ...prev };
      delete next[modalSlotIndex];
      return next;
    });

    setSlotFace((prev) => {
      const next = { ...prev };
      delete next[modalSlotIndex];
      return next;
    });

    setSlotCustom((prev) => {
      const next = { ...prev };
      delete next[modalSlotIndex];
      return next;
    });

    setSlotZoom((prev) => {
      const next = { ...prev };
      delete next[modalSlotIndex];
      return next;
    });

    if (assigned && assigned.id != null) {
      setPlacedByItem((prev) => {
        const next = { ...prev };
        const currentCount = next[assigned.id] ?? 0;
        if (currentCount > 1) {
          next[assigned.id] = currentCount - 1;
        } else {
          delete next[assigned.id];
        }
        return next;
      });
    };

    setPageThumbs((prev) => {
      const next = { ...prev };
      if (!next[pageId]) return next;
      const thumbs = { ...next[pageId] };
      delete thumbs[modalSlotIndex];
      if (Object.keys(thumbs).length === 0) {
        delete next[pageId];
      } else {
        next[pageId] = thumbs;
      }
      return next;
    });

    setRefreshTick((t) => t + 1);
    await loadPageThumbs();
    setTimeout(() => setShowPreview(true), 100);
    closeItemModal();
  };
// Estructura preparada para el futuro
const CURSOR_GROUPS = [
  {
    groupName: "Stray Kids (SKZOO)",
    mascots: [
      { id: 'wolfchan', name: 'Wolf Chan', artist: 'Bang Chan', img: '/ui/wolfchan-cursor.png' },
      { id: 'leebit', name: 'Leebit', artist: 'Lee Know', img: '/ui/leebit-cursor.png' },
      { id: 'jiniret', name: 'Jiniret', artist: 'Hyunjin', img: '/ui/jiniret-cursor.png' },
      { id: 'hanquokka', name: 'Han Quokka', artist: 'Han', img: '/ui/hanquokka-cursor.png' },
      { id: 'bbokari', name: 'BbokAri', artist: 'Felix', img: '/ui/bbokari-cursor.png' },
      { id: 'puppym', name: 'PuppyM', artist: 'Seungmin', img: '/ui/puppym-cursor.png' },
      { id: 'foxiny', name: 'FoxI.Ny', artist: 'I.N', img: '/ui/foxiny-cursor.png' },
      { id: 'dwaekki', name: 'Dwaekki', artist: 'Changbin', img: '/ui/dwaekki-cursor.png' },
    ]
  }
];

// --- SUSTITUIR DESDE AQUÍ ---
  const [activeSkzoo, setActiveSkzoo] = useState<SkzooType | null>(null);
const [skzooOpen, setSkzooOpen] = useState(false);
const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
const skzooBoxRef = useRef<HTMLDivElement | null>(null);
const skzooFollowerRef = useRef<HTMLDivElement | null>(null);
  // --- HASTA AQUÍ ---



// ✅ Undo 1: binder principal
const undoStackRef = useRef<UndoSnapshot[]>([]);

// ✅ Undo 2: modal “Ver todas”
const pagesModalUndoStackRef = useRef<PagesModalUndoSnapshot[]>([]);

// ✅ Undo 3: modal info PC
const modalUndoStackRef = useRef<ModalUndoSnapshot[]>([]);

// ✅ NUEVO: feedback instantáneo en el botón “Reverso (todas)”
const backAllBtnRef = useRef<HTMLButtonElement | null>(null);
const [wtsListingItemId, setWtsListingItemId] = useState<number | null>(null);
const [wtsListingModalOpen, setWtsListingModalOpen] = useState(false);
// 👇 NUEVOS ESTADOS PARA WTT 👇
              const [wttListingItemId, setWttListingItemId] =
useState<number | null>(null);
const [wttListingModalOpen,
setWttListingModalOpen] = useState(false);
const [resumeWttListingAfterLegacyPicker, setResumeWttListingAfterLegacyPicker] =
useState(false);
// ✅ Precio (localStorage por itemId)
const [priceByItem, setPriceByItem] = useState<Record<number,
string>>({});
const [currencyByItem, setCurrencyByItem] =
useState<Record<number, string>>({});
const [marketByItem, setMarketByItem] =
useState<Record<number, string>>({});
// ✅ Moneda del precio WTS (independiente del selector de conversión)
const [wtsCurrencyByItem, setWtsCurrencyByItem] =
useState<Record<number, string>>({});
// ✅ Notas (localStorage por itemId)
const [notesByItem, setNotesByItem] = useState<Record<number,
string>>({});
// ✅ Keys + LS helpers (DEBEN ir antes de handleWtsListingSaved)
const priceKey = useCallback((itemId: number) => `binder:price:${itemId}`, []);
const currencyKey = useCallback((itemId: number) => `binder:currency:${itemId}`, []);
const marketKey = useCallback((itemId: number) => `binder:market:${itemId}`, []);
const wtsCurrencyKey = useCallback((itemId: number) => `binder:wtsCurrency:${itemId}`, []);
const notesKey = useCallback((itemId: number) => `binder:notes:${itemId}`, []);
const wttMessageKey = useCallback((itemId: number) => `binder:wttMessage:${itemId}`, []);
const readLS = useCallback((k: string) => {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
}, []);
const writeLS = useCallback((k: string, v: string) => {
  try {
    const cleanValue = String(v ?? "");
    if (cleanValue.trim()) {
      localStorage.setItem(k, cleanValue);
    } else {
      localStorage.removeItem(k);
    }
  } catch {}
}, []);

const ensurePriceMarketLoaded = useCallback(
  (itemId: number) => {
    if (!Number.isFinite(itemId)) return;

    setPriceByItem((prev) => {
      const has = Object.prototype.hasOwnProperty.call(prev, itemId);
      const cur = has ? String((prev as any)[itemId] ?? "") : "";
      if (has && cur.trim() !== "") return prev; // ✅ si ya hay valor real, no pisa

      const v = readLS(priceKey(itemId));
      return { ...prev, [itemId]: v };
    });

    setCurrencyByItem((prev) => {
      const has = Object.prototype.hasOwnProperty.call(prev, itemId);
      const cur = has ? String((prev as any)[itemId] ?? "") : "";
      if (has && cur.trim() !== "") return prev;

      const v = readLS(currencyKey(itemId));
      return { ...prev, [itemId]: v || "EUR" };
    });

    setWtsCurrencyByItem((prev) => {
      const has = Object.prototype.hasOwnProperty.call(prev, itemId);
      const cur = has ? String((prev as any)[itemId] ?? "") : "";
      if (has && cur.trim() !== "") return prev;

      const v = readLS(wtsCurrencyKey(itemId));
      return { ...prev, [itemId]: v || "EUR" };
    });

   setMarketByItem((prev) => {
      const has = Object.prototype.hasOwnProperty.call(prev, itemId);
      const cur = has ? String((prev as any)[itemId] ?? "") : "";
      if (has && cur.trim() !== "") return prev;

      const v = readLS(marketKey(itemId));
      return { ...prev, [itemId]: v };
    });

    setNotesByItem((prev) => {
      const has = Object.prototype.hasOwnProperty.call(prev, itemId);
      const cur = has ? String((prev as any)[itemId] ?? "") : "";
      if (has && cur.trim() !== "") return prev;

      const v = readLS(notesKey(itemId));
      return { ...prev, [itemId]: v };
    });
  },
  [readLS, priceKey, currencyKey, wtsCurrencyKey, marketKey, notesKey]
);

const handleWtsListingSaved = useCallback(async () => {
  if (!userId || wtsListingItemId == null) return;
  const itemId = wtsListingItemId;

  await pushModalUndoSnapshot(itemId);

  // 1. Obtener y limpiar el valor del precio
  const rawPrice = readLS(priceKey(itemId));
  const cleanPrice = rawPrice ? parseFloat(String(rawPrice).replace(',', '.')) : null;
  
  // 2. Obtener valores con defaults seguros (incluyendo los nuevos campos)
  const currencyValue = readLS(wtsCurrencyKey(itemId)) || "EUR";
  const countryValue = readLS(marketKey(itemId)) || "España";
  
  // NUEVOS CAMPOS: Leemos con un localStorage directo porque son exclusivos del modal
  const shippingValue = localStorage.getItem(`binder:shipping:${itemId}`) || "Worldwide";
  const negotiableValue = localStorage.getItem(`binder:negotiable:${itemId}`) === "true";
  const commentValue = localStorage.getItem(`binder:comment:${itemId}`) || "";

  console.log("Intentando guardar anuncio:", { itemId, cleanPrice, currencyValue, countryValue, shippingValue, negotiableValue, commentValue });

  // 3. Upsert a Supabase con todos los campos nuevos
  const { error: upError } = await supabase
    .from("user_item_statuses")
    .upsert(
      [{ 
        user_id: userId, 
        item_id: itemId, 
        status: "wts", 
        qty: 1,
        price: cleanPrice,
        currency: currencyValue,
        origin_country: countryValue,
        shipping_to: shippingValue,
        wts_negotiable: negotiableValue,
        market_comment: commentValue
      }] as any, 
      { onConflict: "user_id,item_id,status" }
    );

  if (upError) {
    console.error("Error de Supabase:", upError);
    setError("No se pudo guardar: " + upError.message);
    return;
  }

  // 4. Si no hay error, actualizamos la UI local
  setInvByItem((prev) => ({
    ...prev,
    [itemId]: { ...(prev?.[itemId] ?? emptyCounts()), wts: 1 },
  }));

  setPriceByItem((p) => ({ ...p, [itemId]: String(cleanPrice || "") }));
  setMarketByItem((p) => ({ ...p, [itemId]: countryValue }));

  setWtsListingModalOpen(false); // ✅ Cierre forzado tras éxito
  setStatus("¡Anuncio publicado en el Market!");
  await avisarFavoritos(userId, 'market_id', wtsListingItemId);

}, [userId, wtsListingItemId, supabase, readLS, priceKey, wtsCurrencyKey, marketKey, pushModalUndoSnapshot, emptyCounts]);

// ---------------------
// Drag UI (páginas)
// ---------------------
const openWtsListingModal = useCallback((itemId: number) => {
  setWtsListingItemId(itemId);
  setWtsListingModalOpen(true);
}, []);

const [modalItemId, setModalItemId] = useState<number | null>(null);

  const [modalSlotIndex, setModalSlotIndex] = useState<number | null>(null);
  const [modalAssignedStable, setModalAssignedStable] = useState<SlotItem | null>(null);

  // ✅ Transform SOLO del modal (no afecta al grid)
  const [modalViewRot, setModalViewRot] = useState<number>(0);
  const [modalViewFlipH, setModalViewFlipH] = useState<boolean>(false);

 

  // ✅ FX (cambio de divisa) cacheado
  const [fxPairRate, setFxPairRate] = useState<Record<string, number>>({}); // "USD:EUR" -> 0.92
  // ✅ FX loading/error por par (USD:EUR, USD:GBP, etc.)
const [fxPairLoading, setFxPairLoading] = useState<Record<string, boolean>>({});
const [fxPairError, setFxPairError] = useState<Record<string, string>>({});
const fxPairKey = useCallback((base: string, quote: string) => `${base}:${quote}`, []);

  const fetchFxPair = useCallback(async (base: string, quote: string) => {
  if (!base || !quote) return null;
  if (base === quote) return 1;

  try {
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const rates = json?.rates ?? {};

    const rate = Number(rates[quote]);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("Moneda no soportada");

    return rate; // 1 base = rate quote
  } catch (err) {
    return null;
  }
}, []);
const getFxRate = useCallback(
  async (base: string, quote: string) => {
    const key = fxPairKey(base, quote);
    if (!base || !quote) return null;

    // misma moneda: rate = 1 y fuera
    if (base === quote) {
      setFxPairLoading((p) => ({ ...p, [key]: false }));
      setFxPairError((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
      setFxPairRate((p) => ({ ...p, [key]: 1 }));
      return 1;
    }
// Bloqueo de scroll del body cuando hay modales abiertos
// Solo bloquear el scroll del body si hay algún modal abierto, pero nunca hacer scrollTo(0,0)
useEffect(() => {
  const isAnyModalOpen = itemModalOpen || pagesOpen || wttOfferOpen || wttWantOpen || buyPagesOpen || stockModalOpen || wtsListingModalOpen;
  if (isAnyModalOpen) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
}, [itemModalOpen, pagesOpen, wttOfferOpen, wttWantOpen, buyPagesOpen, stockModalOpen, wtsListingModalOpen]);
    // cache
    const cached = fxPairRate[key];
    if (Number.isFinite(cached) && cached > 0) return cached;

    // evita dobles fetch
    if (fxPairLoading[key]) return null;

    setFxPairLoading((p) => ({ ...p, [key]: true }));
    setFxPairError((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });

    try {
      const rate = await fetchFxPair(base, quote);
      if (!rate || !Number.isFinite(rate) || rate <= 0) {
        setFxPairError((p) => ({ ...p, [key]: "No se pudo obtener el cambio" }));
        return null;
      }
      setFxPairRate((p) => ({ ...p, [key]: rate }));
      return rate;
    } catch {
      setFxPairError((p) => ({ ...p, [key]: "Error al obtener el cambio" }));
      return null;
    } finally {
      // ✅ clave: apaga loading siempre
      setFxPairLoading((p) => ({ ...p, [key]: false }));
    }
  },
  [fxPairRate, fxPairLoading, fetchFxPair]
);
  const readWttOffer = useCallback((itemId: number) => {
    try {
      const raw = localStorage.getItem(`binder:wttOffer:${itemId}`);
      if (!raw) return { qty: 0, ids: [] as number[] };
      const parsed = JSON.parse(raw);
      const qty = Number(parsed?.qty ?? 0);
      const ids = Array.isArray(parsed?.ids)
        ? parsed.ids.filter((x: any) => Number.isFinite(Number(x))).map((x: any) => Number(x))
        : [];
      return { qty: Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0, ids };
    } catch {
      return { qty: 0, ids: [] as number[] };
    }
  }, []);

  const writeWttOffer = useCallback((itemId: number, qty: number, ids: number[]) => {
    try {
      const cleanQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
      const cleanIds = Array.isArray(ids) ? ids.filter((x) => Number.isFinite(Number(x))).map(Number) : [];
      if (!cleanQty && !cleanIds.length) {
        localStorage.removeItem(`binder:wttOffer:${itemId}`);
        return;
      }
      localStorage.setItem(`binder:wttOffer:${itemId}`, JSON.stringify({ qty: cleanQty, ids: cleanIds }));
    } catch {}
  }, []);
function pushPagesModalUndoSnapshot(): void {
  pagesModalUndoStackRef.current.push({
    binderPages: binderPages.map((p) => ({ ...p })),
    pagesCount,
    currentPageIndex,
    pageId,
    layout,
  });

  if (pagesModalUndoStackRef.current.length > 50) {
    pagesModalUndoStackRef.current.shift();
  }
}

async function doPagesModalUndo(): Promise<void> {
  const prev = pagesModalUndoStackRef.current.pop();
  if (!prev) return;

  setError(null);
  setStatus("Deshaciendo cambio de páginas...");

  if (binderId) {
    const targetPages = prev.binderPages
      .slice()
      .sort((a, b) => a.page_index - b.page_index);

    const currentPageIds = new Set(binderPages.map((p) => p.id));
    const targetPageIds = new Set(targetPages.map((p) => p.id));

    for (const p of binderPages) {
      if (!targetPageIds.has(p.id)) {
        await supabase.from("binder_pages").delete().eq("id", p.id);
      }
    }

    for (const p of targetPages) {
      if (!currentPageIds.has(p.id)) {
        await supabase.from("binder_pages").upsert({
          id: p.id,
          binder_id: binderId,
          page_index: p.page_index,
          layout_type: p.layout_type,
        } as any);
      }
    }

    await persistPageOrder(targetPages);
  }

  setBinderPages(prev.binderPages);
  setPagesCount(prev.pagesCount);
  setCurrentPageIndex(prev.currentPageIndex);
  setPageId(prev.pageId);
  setLayout(prev.layout);
  setRefreshTick((t) => t + 1);
}

async function readModalUndoSnapshot(itemId: number): Promise<ModalUndoSnapshot | null> {
 if (!userId) return null;
 if (!Number.isFinite(itemId)) return null;

 const { data, error } = await supabase
  .from("user_item_statuses")
  .select("status, qty")
  .eq("user_id", userId)
  .eq("item_id", itemId);

 if (error) return null;

 const offer = readWttOffer(itemId);

 return {
  itemId,
  dbStatuses: (data ?? []).map((row: any) => ({
   status: String(row.status ?? ""),
   qty: Number(row.qty ?? 0),
  })),
  invCounts: invByItem[itemId] ?? emptyCounts(),
  price: readLS(priceKey(itemId)),
  currency: readLS(currencyKey(itemId)) || "EUR",
  market: readLS(marketKey(itemId)),
  wtsCurrency: readLS(wtsCurrencyKey(itemId)) || "EUR",
  notes: readLS(notesKey(itemId)),
  wttWanted: readWttWanted(itemId),
  wttOffer: offer.ids,
  wttOfferQty: offer.qty,
  customText: modalCustomText,
  customImageUrl: modalCustomImageUrl,
 };
}

async function pushModalUndoSnapshot(itemId: number): Promise<void> {
  const snap = await readModalUndoSnapshot(itemId);
  if (!snap) return;

  modalUndoStackRef.current.push(snap);

  if (modalUndoStackRef.current.length > 50) {
    modalUndoStackRef.current.shift();
  }
}

async function doModalUndo(): Promise<void> {
  const prev = modalUndoStackRef.current.pop();
  if (!prev) return;

  setError(null);
  
  // Determinamos qué estamos deshaciendo para el pop-up/status
  let actionDesc = "cambio";
  
  if (modalAssigned?.is_custom) {
      actionDesc = "PC personalizada"; 
  } else {
      // Comparamos el estado actual con el anterior para ser específicos
      const current = invByItem[prev.itemId] ?? emptyCounts();
      if (current.have !== prev.invCounts.have) actionDesc = "cantidad de 'Tengo'";
      else if (current.wts !== prev.invCounts.wts) actionDesc = "cantidad de 'WTS'";
      else if (current.wtt !== prev.invCounts.wtt) actionDesc = "cantidad de 'WTT'";
      else if (current.on_its_way !== prev.invCounts.on_its_way) actionDesc = "envío (OTW)";
      else if (readLS(notesKey(prev.itemId)) !== prev.notes) actionDesc = "notas";
  }

  setStatus(`Deshecho: ${actionDesc} restaurado/a ✅`); 

  // --- El resto de tu lógica de restauración se mantiene igual ---
  if (modalAssigned?.is_custom && modalSlotIndex != null) {
      // ... lógica de custom PC [cite: 592, 597]
  } else {
      // ... lógica de PC real [cite: 600, 607]
  }
  
  setRefreshTick((t) => t + 1);
 // ✅ CUSTOM PC
 if (modalAssigned?.is_custom && modalSlotIndex != null) {
  setSlotItems((map) => ({
   ...map,
   [modalSlotIndex]: {
    ...(map[modalSlotIndex] ?? {}),
    is_custom: true,
    custom_text: prev.customText ?? "",
    custom_image_url: prev.customImageUrl ?? null,
   },
  }));

  try {
   await supabase
    .from("page_slots")
    .update({
     custom_text: prev.customText ?? "",
     custom_image_url: prev.customImageUrl ?? null,
    })
    .eq("page_id", pageId)
    .eq("slot_index", modalSlotIndex);
  } catch {}

  setStatus("Cambio de PC personalizada deshecho.");
  return;
 }

 if (!userId) return;

 const itemId = prev.itemId;

 await supabase
  .from("user_item_statuses")
  .delete()
  .eq("user_id", userId)
  .eq("item_id", itemId)
  .in("status", ["have", "wtt", "wts", "on_its_way", "wish", "wishlist"]);

 if (prev.dbStatuses.length) {
  await supabase.from("user_item_statuses").upsert(
   prev.dbStatuses.map((row) => ({
    user_id: userId,
    item_id: itemId,
    status: row.status,
    qty: row.qty,
   })) as any,
   { onConflict: "user_id,item_id,status" }
  );
 }

 writeLS(priceKey(itemId), prev.price);
 writeLS(currencyKey(itemId), prev.currency);
 writeLS(marketKey(itemId), prev.market);
 writeLS(wtsCurrencyKey(itemId), prev.wtsCurrency);
 writeLS(notesKey(itemId), prev.notes);
 writeWttWanted(itemId, prev.wttWanted);
 writeWttOffer(itemId, prev.wttOfferQty, prev.wttOffer);

 setInvByItem((map) => ({ ...map, [itemId]: prev.invCounts }));
 setPriceByItem((map) => ({ ...map, [itemId]: prev.price }));
 setCurrencyByItem((map) => ({ ...map, [itemId]: prev.currency }));
 setMarketByItem((map) => ({ ...map, [itemId]: prev.market }));
 setWtsCurrencyByItem((map) => ({ ...map, [itemId]: prev.wtsCurrency }));
 setNotesByItem((map) => ({ ...map, [itemId]: prev.notes }));
 setWttWantedByItem((map) => ({ ...map, [itemId]: prev.wttWanted }));
 setWttOfferByItem((map) => ({ ...map, [itemId]: prev.wttOffer }));
 setWttOfferQtyByItem((map) => ({ ...map, [itemId]: prev.wttOfferQty }));

 setRefreshTick((t) => t + 1);
}
  const persistWttQty = useCallback(
 async (itemId: number, value: number) => {
  if (!userId) return;
  if (!Number.isFinite(itemId)) return;



  const qty = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  if (qty > 0) {
   const up = await supabase
    .from("user_item_statuses")
    .upsert(
     [{ user_id: userId, item_id: itemId, status: "wtt", qty }] as any,
     { onConflict: "user_id,item_id,status" }
    );
   if (up.error) return;
  } else {
   const del = await supabase
    .from("user_item_statuses")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("status", "wtt");
   if (del.error) return;
  }

  setInvByItem((prev: any) => ({
   ...prev,
   [itemId]: { ...(prev?.[itemId] ?? emptyCounts()), wtt: qty },
  }));
 },
[userId, supabase]
);

  



  const [pageReorderBusy, setPageReorderBusy] = useState(false);








  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<number[]>([]);
  const [draggingPageId, setDraggingPageId] = useState<number | null>(null);
const [dragOverPageId, setDragOverPageId] = useState<number | null>(null);
const [isPageDragging, setIsPageDragging] = useState(false);
  const [itemMetaById, setItemMetaById] = useState<Record<number, ItemMeta>>({});
  const [groupNameById, setGroupNameById] = useState<Record<number, string>>({});
  const [albumNameById, setAlbumNameById] = useState<Record<number, string>>({});
  const [versionNameById, setVersionNameById] = useState<Record<number, string>>({});
  const [memberNameById, setMemberNameById] = useState<Record<number, string>>({});

  const [slotItems, setSlotItems] = useState<Record<number, SlotItem>>({});
  const [slotCustom, setSlotCustom] = useState<Record<number, SlotCustom>>({});
  const [placedByItem, setPlacedByItem] = useState<Record<number, number>>({});
  const [invByItem, setInvByItem] = useState<Record<number, StatusCounts>>({});
  const [wttCarousel, setWttCarousel] = useState<WttCarouselItem[]>([]);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [wttWantedByItem, setWttWantedByItem] = useState<Record<number, number[]>>({});
  const [wttOfferByItem, setWttOfferByItem] = useState<Record<number, number[]>>({});
  const [wttOfferQtyByItem, setWttOfferQtyByItem] = useState<Record<number, number>>({});
  
  const [wttWantCatalog, setWttWantCatalog] = useState<WttCarouselItem[]>([]);
  const [wttWantCatalogReady, setWttWantCatalogReady] = useState(false);
  const [wttWantOpen, setWttWantOpen] = useState(false);
  const [wttWantForId, setWttWantForId] = useState<number | null>(null);
  const [wttWantDraft, setWttWantDraft] = useState<number[]>([]);
  const [wttOfferOpen, setWttOfferOpen] = useState(false);
  const [wttOfferForId, setWttOfferForId] = useState<number | null>(null);
  const [wttOfferDraft, setWttOfferDraft] = useState<number[]>([]);
  const [wttOfferQtyDraft, setWttOfferQtyDraft] = useState<number>(0);
  const [wttOfferQ, setWttOfferQ] = useState("");
  const wttOfferQRef = useRef<HTMLInputElement | null>(null);
  const wttOfferScrollRef = useRef<HTMLDivElement | null>(null);
const wttOfferScrollSnapshotRef = useRef<{ top: number; left: number } | null>(null);
  const [wttOfferGroup, setWttOfferGroup] = useState<number | "">("");
  const [showWttFilters, setShowWttFilters] = useState(false);
  const [wttOfferAlbum, setWttOfferAlbum] = useState<number | "">("");
  const [wttOfferVersion, setWttOfferVersion] = useState<string>("");
  const [wttOfferMember, setWttOfferMember] = useState<string>("");
  const [wttOfferUnit, setWttOfferUnit] = useState<"all" | "single" | "unit" | "ot8">("all");
  const [wttWantQ, setWttWantQ] = useState("");
  const [wttWantLoading, setWttWantLoading] = useState(false);
  const [wttWantGroup, setWttWantGroup] = useState<number | "">("");
  const [wttWantAlbum, setWttWantAlbum] = useState<number | "">("");
  const [wttWantVersion, setWttWantVersion] = useState<string>("");
  const [wttWantMember, setWttWantMember] = useState<string>("");
  const [wttWantUnit, setWttWantUnit] = useState<"all" | "single" | "unit" | "ot8">("all");
  const [wttWantGroupNames, setWttWantGroupNames] = useState<Record<number, string>>({});
  const [wttWantAlbumNames, setWttWantAlbumNames] = useState<Record<number, string>>({});
  const [wttWantAlbumRelease, setWttWantAlbumRelease] = useState<Record<number, string | null>>({});
  const [slotFace, setSlotFace] = useState<Record<number, "front" | "back">>({});
 const wttSearchRef = React.useRef<HTMLInputElement | null>(null);
const wttWantScrollRef = React.useRef<HTMLDivElement | null>(null);
const wttWantScrollSnapshotRef = React.useRef<{ top: number; left: number } | null>(null);

 

  const [slotRot, setSlotRot] = useState<Record<number, number>>({});
  const [slotFlipH, setSlotFlipH] = useState<Record<number, boolean>>({});
  const [slotZoom, setSlotZoom] = useState<Record<number, number>>({});
const [shiftFx, setShiftFx] = useState<null | {
  kind: "make" | "close";
  at: number;
  steps: number;
  tick: number;
}>(null);

useEffect(() => {
  if (!activeSkzoo) return;

  const handleMouseMove = (event: MouseEvent) => {
    setMousePos({
      x: event.clientX,
      y: event.clientY,
    });
  };

  window.addEventListener("mousemove", handleMouseMove);
  return () => window.removeEventListener("mousemove", handleMouseMove);
}, [activeSkzoo]);
  const readWttWanted = useCallback((itemId: number) => {
    try {
      const raw = localStorage.getItem(`binder:wttWanted:${itemId}`);
      if (!raw) return [] as number[];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [] as number[];
      return parsed.filter((x) => Number.isFinite(Number(x))).map((x) => Number(x));
    } catch {
      return [] as number[];
    }
  }, []);
const closeLegacyWttPicker = useCallback(() => {
  setWttWantOpen(false);

  if (resumeWttListingAfterLegacyPicker) {
    setStockModalOpen(true);
    setWttListingModalOpen(true);
    setResumeWttListingAfterLegacyPicker(false);
  }
}, [resumeWttListingAfterLegacyPicker]);
  const writeWttWanted = useCallback((itemId: number, ids: number[]) => {
    try {
      if (!ids.length) {
        localStorage.removeItem(`binder:wttWanted:${itemId}`);
        return;
      }
      localStorage.setItem(`binder:wttWanted:${itemId}`, JSON.stringify(ids));
    } catch {}
  }, []);

  const clearWttWanted = useCallback(
    (itemId: number) => {
      setWttWantedByItem((prev) => ({ ...prev, [itemId]: [] }));
      try {
        localStorage.removeItem(`binder:wttWanted:${itemId}`);
      } catch {}
    },
    []
  );

  const openWttWantModal = useCallback(
    (itemId: number) => {
      setWttWantForId(itemId);
      const stored = wttWantedByItem[itemId] ?? readWttWanted(itemId);
      setWttWantDraft(stored ?? []);
      setWttWantQ("");
      setWttWantGroup("");
      setWttWantAlbum("");
      setWttWantVersion("");
      setWttWantMember("");
      setWttWantUnit("all");
      setWttWantOpen(true);
    },
    [readWttWanted, wttWantedByItem]
  );

  const openWttOfferModal = useCallback(
    (itemId: number) => {
      setWttOfferForId(itemId);
      const storedIds = wttOfferByItem[itemId] ?? readWttOffer(itemId).ids;
      const storedQty = wttOfferQtyByItem[itemId] ?? readWttOffer(itemId).qty;
      setWttOfferDraft(storedIds ?? []);
      setWttOfferQtyDraft(Number.isFinite(storedQty) ? Math.max(0, Math.floor(storedQty)) : 0);
      setWttOfferQ("");
      setWttOfferGroup("");
      setWttOfferAlbum("");
      setWttOfferVersion("");
      setWttOfferMember("");
      setWttOfferUnit("all");
      setWttOfferOpen(true);
    },
    [readWttOffer, wttOfferByItem, wttOfferQtyByItem]
  );

 useEffect(() => {
 if (!wttOfferOpen) return;
 requestAnimationFrame(() => wttOfferQRef.current?.focus());
}, [wttOfferOpen]);

// ✅ REPARADO: Snapshot de scroll para el modal "Mis trades (WTT Offer)"
React.useLayoutEffect(() => {
  const snap = wttOfferScrollSnapshotRef.current;
  const el = wttOfferScrollRef.current;
  if (!snap || !el) return;

  // Restauración inmediata
  el.scrollTop = snap.top;
  el.scrollLeft = snap.left;

  // Refuerzo en el siguiente frame para asegurar la posición tras el pintado de React
  requestAnimationFrame(() => {
    const el2 = wttOfferScrollRef.current;
    if (!el2) return;
    el2.scrollTop = snap.top;
    el2.scrollLeft = snap.left;
    wttOfferScrollSnapshotRef.current = null;
  });
}, [wttOfferDraft]);

// ✅ MANTENER: Snapshot de scroll para el modal "Busco en WTT (WTT Want)"
React.useLayoutEffect(() => {
  const snap = wttWantScrollSnapshotRef.current;
  const el = wttWantScrollRef.current;
  if (!snap || !el) return;

  el.scrollTop = snap.top;
  el.scrollLeft = snap.left;

  requestAnimationFrame(() => {
    const el2 = wttWantScrollRef.current;
    if (!el2) return;
    el2.scrollTop = snap.top;
    el2.scrollLeft = snap.left;
    wttWantScrollSnapshotRef.current = null;
  });
}, [wttWantDraft]);

const saveWttWantDraft = useCallback(async () => {
  if (wttWantForId == null || !userId) return;
  
  await pushModalUndoSnapshot(wttWantForId);

  // 1. Guardamos localmente (como ya hacías)
  setWttWantedByItem((prev) => ({ ...prev, [wttWantForId]: wttWantDraft }));
  writeWttWanted(wttWantForId, wttWantDraft);

  // 2. RECUPERAMOS EL PAÍS (para que el anuncio en Market no salga NULL)
  const countryValue = localStorage.getItem(`binder:market:${wttWantForId}`) || "España";
  const commentValue = localStorage.getItem(`binder:wttMessage:${wttWantForId}`) || ""; // 👈 AÑADE ESTO

  // 3. SUBIMOS A SUPABASE: Guardamos el estado WTT y la lista de IDs que busca
  const { error } = await supabase
    .from("user_item_statuses")
    .upsert([{
      user_id: userId,
      item_id: wttWantForId,
      status: "wtt",
      qty: 1,
      origin_country: countryValue,
      wtt_ids: wttWantDraft,
      market_comment: commentValue // 👈 AÑADE ESTO
    }] as any, { onConflict: "user_id,item_id,status" });

  if (!error) {
    closeLegacyWttPicker();
if (resumeWttListingAfterLegacyPicker) {
  setStockModalOpen(true);
  setWttListingModalOpen(true);
  setResumeWttListingAfterLegacyPicker(false);
}
    setStatus("¡Anuncio de intercambio publicado!");
    await avisarFavoritos(userId, 'market_id', wttWantForId);
    
  } else {
    console.error("Error subiendo WTT:", error.message);
  }
}, [wttWantForId, wttWantDraft, userId, supabase, writeWttWanted, pushModalUndoSnapshot]);
const savewttOfferDraft = useCallback(async () => {
    if (wttOfferForId == null || !userId) {
      setWttOfferOpen(false);
      return;
    }

    try {
      // Forzamos mínimo 1 si hay cartas seleccionadas
      const qty = wttOfferDraft.length > 0 ? Math.max(1, wttOfferQtyDraft) : 0;
      const nextIds = qty > 0 ? wttOfferDraft : [];

      // 1. Guardamos localmente
      setWttOfferByItem((prev) => ({ ...prev, [wttOfferForId]: nextIds }));
      setWttOfferQtyByItem((prev) => ({ ...prev, [wttOfferForId]: qty }));
      writeWttOffer(wttOfferForId, qty, nextIds);

     // 2. Subimos a Supabase
  const countryValue = localStorage.getItem(`binder:market:${wttOfferForId}`) || "España";
  const commentValue = localStorage.getItem(`binder:wttMessage:${wttOfferForId}`) || ""; // 👈 ATRAPAMOS EL COMENTARIO

  if (qty > 0) {
    await supabase
      .from("user_item_statuses")
      .upsert([{
        user_id: userId,
        item_id: wttOfferForId,
        status: "wtt",
        qty: qty,
        origin_country: countryValue,
        wtt_ids: nextIds,
        market_comment: commentValue // 👈 LO SUBIMOS A LA BD
      }] as any, { onConflict: "user_id,item_id,status" });
          
        setInvByItem((prev: any) => ({
          ...prev,
          [wttOfferForId]: { ...(prev?.[wttOfferForId] ?? emptyCounts()), wtt: qty },
          
        }));
        setStatus("¡Anuncio de intercambio publicado con éxito! ✅");
        await avisarFavoritos(userId, 'market_id', wttOfferForId);
       
      } else {
        await supabase
          .from("user_item_statuses")
          .delete()
          .eq("user_id", userId)
          .eq("item_id", wttOfferForId)
          .eq("status", "wtt");
          
        setInvByItem((prev: any) => ({
          ...prev,
          [wttOfferForId]: { ...(prev?.[wttOfferForId] ?? emptyCounts()), wtt: 0 },
        }));
      }
    } catch (error) {
      console.error("Error guardando WTT:", error);
    } finally {
      // ✅ ESTO GARANTIZA QUE EL MODAL SE CIERRE SIEMPRE
      setWttOfferOpen(false);
    }
  }, [wttOfferForId, wttOfferDraft, wttOfferQtyDraft, writeWttOffer, userId, supabase, emptyCounts]);

 

useEffect(() => {
  if (!wttOfferOpen) return;

  const onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    const isTextField =
      tag === "textarea" ||
      tag === "input" ||
      tag === "select";

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();

      if ((wttOfferDraft?.length ?? 0) > 0) {
        setWttOfferDraft([]);
        return;
      }

      setWttOfferOpen(false);
      return;
    }

    if (e.key === "Enter") {
      if (isTextField) return;

      e.preventDefault();
      e.stopPropagation();
      savewttOfferDraft(); // ✅ AHORA SÍ: Guarda al presionar Enter
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);

}, [wttOfferOpen, wttOfferDraft, setWttOfferDraft, savewttOfferDraft]);




  useEffect(() => {
 if (wttWantForId == null) return;
 if (wttWantedByItem[wttWantForId]?.length) return;
 const stored = readWttWanted(wttWantForId);
 if (stored.length) {
 setWttWantedByItem((prev) => ({ ...prev, [wttWantForId]: stored }));
 }
}, [wttWantForId, wttWantedByItem, readWttWanted]);

useEffect(() => {
 if (!wttWantOpen) return;
 requestAnimationFrame(() => {
 wttSearchRef.current?.focus();
 });
}, [wttWantOpen]);



useEffect(() => {
 if (!wttWantCatalog.length) return;
 const gIds = Array.from(
      new Set(wttWantCatalog.map((i) => i.group_id).filter((x): x is number => typeof x === "number"))
    );
    const aIds = Array.from(
      new Set(wttWantCatalog.map((i) => i.album_id).filter((x): x is number => typeof x === "number"))
    );

    const missingG = gIds.filter((id) => !wttWantGroupNames[id]);
    const missingA = aIds.filter((id) => !wttWantAlbumNames[id]);
    if (!missingG.length && !missingA.length) return;

    let cancelled = false;
    const run = async () => {
      const [gRes, aRes] = await Promise.all([
        missingG.length ? supabase.from("groups").select("id, name").in("id", missingG) : Promise.resolve({ data: [] }),
        missingA.length ? supabase.from("albums").select("id, name, release_date").in("id", missingA) : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      if (gRes.data?.length) {
        setWttWantGroupNames((prev) => {
          const next = { ...prev };
          for (const r of gRes.data as any[]) next[Number(r.id)] = String(r.name ?? "");
          return next;
        });
      }
      if (aRes.data?.length) {
        setWttWantAlbumNames((prev) => {
          const next = { ...prev };
          for (const r of aRes.data as any[]) next[Number(r.id)] = String(r.name ?? "");
          return next;
        });
        setWttWantAlbumRelease((prev) => {
          const next = { ...prev };
          for (const r of aRes.data as any[]) next[Number(r.id)] = r.release_date ?? null;
          return next;
        });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [wttWantCatalog, wttWantGroupNames, wttWantAlbumNames, supabase]);
  // Tamaños base PC (vertical) — para el GRID (no pisar slotW de SlotBox)
const pageSlotW = 120;
const pageSlotH = 190;
const pageSlotFrame = Math.max(pageSlotW, pageSlotH);

  const [slotContain, setSlotContain] = useState<Record<number, boolean>>({});
  const [pageFace, setPageFace] = useState<"front" | "back">("front");
 const [pageContainAll, setPageContainAll] = useState<boolean>(false);
const [pageRotateAll, setPageRotateAll] = useState<boolean>(false);
const [pageShowBackAll, setPageShowBackAll] = useState<boolean>(false);
const [pageShowBackAllUI, setPageShowBackAllUI] = useState<boolean>(false);
 const [layout, setLayout] = useState<LayoutType>("3x3");
 // ... otros useState arriba (por ejemplo pageRotateAll / pageShowBackAll)

// ✅ ZOOM real del grid
const [pageZoom, setPageZoom] = useState(1); // 1 = 100%

const ZOOM_STEP = 0.1;  // 10% por click
const ZOOM_MIN = 0.6;   // 60%
const ZOOM_MAX = 2.0;   // 200%
// ✅ medir tamaño “base” del wrapper escalado (sin contar el transform)
const zoomWrapRef = useRef<HTMLDivElement | null>(null);
const [zoomBaseSize, setZoomBaseSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

useEffect(() => {
  const el = zoomWrapRef.current;
  if (!el) return;

  const measure = () => {
    const w = el.offsetWidth || 0;  // no cambia con transform
    const h = el.offsetHeight || 0; // no cambia con transform
    setZoomBaseSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  };

  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(el);
  return () => ro.disconnect();
}, []);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const zoomOut = () => setPageZoom((z) => clamp(Math.round((z - ZOOM_STEP) * 100) / 100, ZOOM_MIN, ZOOM_MAX));
const zoomIn  = () => setPageZoom((z) => clamp(Math.round((z + ZOOM_STEP) * 100) / 100, ZOOM_MIN, ZOOM_MAX));
const zoomReset = () => setPageZoom(1);
const layoutDef: LayoutDef = useMemo(() => defFor(layout), [layout]);
// ✅ Estado “cara de la página” (si lo sigues usando en algún sitio)

// ✅ Tamaños base PC (NO se tocan)
const SLOT_W = 120;
const SLOT_H = 190;
const SLOT_FRAME = Math.max(SLOT_W, SLOT_H);

// ✅ “A4 virtual” basado en 3x3 PCs (esto mantiene la escala consistente)
const BASE_COLS = 3;
const BASE_ROWS = 3;
const BASE_GAP = 10;
const BASE_ROW_GAP = 12;

const BASE_PAGE_W = BASE_COLS * SLOT_W + (BASE_COLS - 1) * BASE_GAP;
const BASE_PAGE_H = BASE_ROWS * SLOT_H + (BASE_ROWS - 1) * BASE_ROW_GAP;

// ✅ calcula slot size por layout (PC o SPECIAL)
function getSlotDimsForLayout(layoutDef: LayoutDef) {
  const size = (layoutDef.size ?? "pc") as "pc" | "special";

  if (size === "pc") {
    return {
      slotW: SLOT_W,
      slotH: SLOT_H,
      gap: 8,
      rowGap: 10,
    };
  }

  // -----------------------------
  // SPECIAL: A4 según equivalencias (las que me pediste)
  // -----------------------------
  // 1x1 -> A4 = 3x3 PCs
  // 2x2 -> A4 = 4x4 PCs
  // 1x2 -> A4 = 4x4 PCs
  // 1x3 -> A4 = 4x4.5 PCs
  // 1x4 -> A4 = 4x4 PCs
  let a4ColsPc = 3;
  let a4RowsPc = 3;

  switch (layoutDef.key) {
    case "sp_2x2":
      a4ColsPc = 4;
      a4RowsPc = 4;
      break;

    case "sp_1x2":
      a4ColsPc = 4;
      a4RowsPc = 4;
      break;

    case "sp_1x3":
      a4ColsPc = 4;
      a4RowsPc = 4.5; // 3 slots x 1.5 PCs de alto
      break;

    case "sp_1x4":
      a4ColsPc = 4;
      a4RowsPc = 4;
      break;

    case "sp_1x1":
      a4ColsPc = 3;
      a4RowsPc = 3;
      break;

    default:
      // si cae aquí, lo dejamos como 3x3
      break;
  }

  // “A4 virtual” en px usando tus tamaños PC + gaps base
  const a4W = a4ColsPc * SLOT_W + (a4ColsPc - 1) * BASE_GAP;
  const a4H = a4RowsPc * SLOT_H + (a4RowsPc - 1) * BASE_ROW_GAP;

  // Divide ese A4 entre cols/rows del layout SPECIAL
  const cols = layoutDef.cols;
  const rows = layoutDef.rows ?? Math.ceil(layoutDef.slots / Math.max(cols, 1));

  // aire extra para que NO se pisen
  const gap = 22;
  const rowGap = 26;

  const slotW = Math.floor((a4W - (cols - 1) * gap) / cols);
  const slotH = Math.floor((a4H - (rows - 1) * rowGap) / rows);

  return { slotW, slotH, gap, rowGap };
}

const readRotatePrefsKey = useMemo(
  () => (pageId ? `binder:rotatepage:${pageId}` : null),
  [pageId]
);

useEffect(() => {
  const total = binderPages.length; // mejor que pagesCount
  if (total <= 0) return;
  setCurrentPageIndex((idx) => Math.min(Math.max(idx, 0), total - 1));
}, [binderPages.length]);

useEffect(() => {
  if (!pageId) return;

  // limpia estado visual por-slot al cambiar de página
setSlotItems({});
setSlotRot({});
setSlotFlipH({});
setSlotFace({});
setSlotCustom({});
setSlotZoom({}); // ✅ NUEVO
setPageFace("front");
setPageShowBackAll(false); // ✅ recomendable: cada página arranca “front”
setPageShowBackAllUI(false); // ✅ UI del switch también
setPickingSlot(null);
}, [pageId]);

useEffect(() => {
  if (!readRotatePrefsKey) return;
  try {
    const raw = localStorage.getItem(readRotatePrefsKey);
    if (raw === "1") setPageRotateAll(true);
    if (raw === "0") setPageRotateAll(false);
  } catch {}
}, [readRotatePrefsKey]);

const customKey = useCallback(
  (pId: number, slotIndex: number) => `binder:custom:${pId}:${slotIndex}`,
  []
);
  



const loadCustomForSlot = useCallback(
  (pId: number, slotIndex: number): SlotCustom => {
    try {
      const raw = localStorage.getItem(customKey(pId, slotIndex));
      if (!raw) return { text: "", imageDataUrl: null };
      const parsed = JSON.parse(raw);
      return {
        text: typeof parsed?.text === "string" ? parsed.text : "",
        imageDataUrl: typeof parsed?.imageDataUrl === "string" ? parsed.imageDataUrl : null,
      };
    } catch {
      return { text: "", imageDataUrl: null };
    }
  },
  [customKey]
);
const zoomKey = useCallback(
  (pId: number, slotIndex: number) => `binder:slotzoom:${pId}:${slotIndex}`,
  []
);

const loadZoomForSlot = useCallback(
  (pId: number, slotIndex: number): number => {
    try {
      const raw = localStorage.getItem(zoomKey(pId, slotIndex));
      const n = raw != null ? Number(raw) : 1;
      return Number.isFinite(n) && n > 0 ? n : 1;
    } catch {
      return 1;
    }
  },
  [zoomKey]
);


 





const persistZoomForSlot = useCallback(
  (pId: number, slotIndex: number, next: number) => {
    try {
      localStorage.setItem(zoomKey(pId, slotIndex), String(next));
    } catch {}
  },
  [zoomKey]
);
const persistCustomForSlot = useCallback(
  (pId: number, slotIndex: number, next: SlotCustom) => {
    try {
      localStorage.setItem(customKey(pId, slotIndex), JSON.stringify(next));
    } catch {}
  },
  [customKey]
);

const persistRotatePrefs = useCallback(
  (next: boolean) => {
    if (!readRotatePrefsKey) return;
    try {
      localStorage.setItem(readRotatePrefsKey, next ? "1" : "0");
    } catch {}
  },
  [readRotatePrefsKey]
);
const flipElsRef = useRef<Record<number, HTMLDivElement | null>>({});

const togglePageShowBackAll = useCallback(() => {
  if (loading) return;
const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-flip-slot]"));

  // ✅ usa el estado UI para que el “switch” responda instantáneo
  const nextAll = !pageShowBackAllUI;
  const target: "front" | "back" = nextAll ? "back" : "front";
// 1) Estado inmediato (sin esperar a finished)
setSlotFace((prev) => {
  const out: Record<number, "front" | "back"> = { ...prev };
  for (const el of nodes) {
    const raw = el.getAttribute("data-flip-slot");
    const i = raw != null ? Number(raw) : NaN;
    if (!Number.isFinite(i)) continue;
    out[i] = target;
  }
  return out;
  
});
setPageShowBackAll(nextAll);
setPageShowBackAllUI(nextAll);
  // ✅ feedback instantáneo (no espera a la animación)
  setPageShowBackAllUI(nextAll);

  backAllBtnRef.current?.animate(
    [{ transform: "scale(1)" }, { transform: "scale(0.97)" }, { transform: "scale(1)" }],
    { duration: 140, easing: "ease-out" }
  );

  // ✅ deja pintar el switch ANTES de hacer el trabajo pesado
  requestAnimationFrame(() => {
    if (typeof window === "undefined") return;
  if (typeof document === "undefined") return;
    // 1) Encuentra TODOS los wrappers giratorios montados
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-flip-slot]"));
    const anims: Animation[] = [];

    for (const el of nodes) {
      const raw = el.getAttribute("data-flip-slot");
      const i = raw != null ? Number(raw) : NaN;
      if (!Number.isFinite(i)) continue;

      const cur: "front" | "back" = slotFace[i] ?? "front";
      if (cur === target) continue;

      el.getAnimations().forEach((a) => a.cancel());

      const fromY = cur === "front" ? 0 : 180;
      const toY = target === "front" ? 0 : 180;

      anims.push(
        el.animate(
          [{ transform: `rotateY(${fromY}deg)` }, { transform: `rotateY(${toY}deg)` }],
          { duration: 850, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "forwards" }
        )
      );
    }

   const commit = () => {
  setSlotFace((prev) => {
    const out = { ...prev };
    for (const el of nodes) {
      const raw = el.getAttribute("data-flip-slot");
      const i = raw != null ? Number(raw) : NaN;
      if (!Number.isFinite(i)) continue;
      out[i] = target;
    }
    return out;
  });

  setPageShowBackAll(nextAll);
  setPageShowBackAllUI(nextAll);
};

if (anims.length === 0) {
  commit();
  return;
}

Promise.allSettled(anims.map((a) => a.finished)).then(commit);
  });
}, [loading, pageShowBackAllUI, slotFace]);
const togglePageRotateAll = useCallback(() => {
  setPageRotateAll((prev) => {
    const next = !prev;
    persistRotatePrefs(next);
    return next;
  });
}, [persistRotatePrefs]);
const triggerBiasHearts = useCallback((pcId: number) => {
  setBiasHeartBursts((prev) => ({
    ...prev,
    [pcId]: (prev[pcId] ?? 0) + 1,
  }));
}, []);

// ✅ NUEVO: el modal se gobierna con un booleano estable
const [itemModalOpen, setItemModalOpen] = React.useState(false);

useEffect(() => { 
    // Forzamos la carga si cualquiera de estos modales se abre
    if (!itemModalOpen && !wttOfferOpen && !wttWantOpen) return; 
    if (wttWantCatalogReady && wttWantCatalog.length > 0) return; 

    const run = async () => {
      setWttWantLoading(true);
      const res = await supabase.from("items").select("id, name, image_url, group_id, album_id, version, member").order("id", { ascending: true });
      if (!res.error && res.data) {
        const list = res.data.map((r: any) => ({
          id: Number(r.id),
          name: r.name,
          image_url: r.image_url,
          group_id: r.group_id,
          album_id: r.album_id,
          version: r.version,
          member: r.member
        }));
        setWttWantCatalog(list);
        setWttWantCatalogReady(true);
      }
      setWttWantLoading(false);
    };
    void run();


  }, [itemModalOpen, wttOfferOpen, wttWantOpen, supabase]); // Dependencias críticas
// ✅ Para “contar” las explosiones de corazones por PC
const [biasHeartBursts, setBiasHeartBursts] = useState<Record<number, number>>({});

const openItemModal = (slotIndex: number, assigned: any) => {
  if (!assigned) return;

  // ✅ abre SIEMPRE el modal (esto ya no depende del stock)
  setItemModalOpen(true);

  setModalItemId(typeof assigned.id === "number" ? assigned.id : null);
  setModalSlotIndex(slotIndex);
  ensurePriceMarketLoaded(assigned.id);

  // (si aquí cargas notas, etc. déjalo tal cual)
};

const closeItemModal = () => {
  // ✅ cierra SOLO aquí (X o click fuera)
  setItemModalOpen(false);

  setModalItemId(null);
  setModalSlotIndex(null);
  setStockModalOpen(false);
};



const readContainPrefsKey = useMemo(
  () => (pageId ? `binder:contain:${pageId}` : null),
  [pageId]
);

  useEffect(() => {
    if (!readContainPrefsKey) return;
    try {
      const raw = localStorage.getItem(readContainPrefsKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { all?: boolean; bySlot?: Record<string, boolean> };
      if (typeof parsed?.all === "boolean") setPageContainAll(parsed.all);
      if (parsed?.bySlot && typeof parsed.bySlot === "object") {
        const next: Record<number, boolean> = {};
        for (const [k, v] of Object.entries(parsed.bySlot)) {
          const n = Number(k);
          if (Number.isFinite(n)) next[n] = Boolean(v);
        }
        setSlotContain(next);
      }
    } catch {}
  }, [readContainPrefsKey]);

  const persistContainPrefs = useCallback(
    (nextAll: boolean, nextBySlot: Record<number, boolean>) => {
      if (!readContainPrefsKey) return;
      try {
        const bySlot: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(nextBySlot)) bySlot[String(k)] = Boolean(v);
        localStorage.setItem(readContainPrefsKey, JSON.stringify({ all: nextAll, bySlot }));
      } catch {}
    },
    [readContainPrefsKey]
  );

  const fetchItemMeta = useCallback(
  async (itemId: number) => {
    if (!Number.isFinite(itemId)) return null;

    const existing = itemMetaById[itemId];
    if (existing) return existing;

    const res = await supabase
      .from("items")
.select("id, name, image_url, back_image_url, group_id, album_id, version, member, member_id") // 👈 AÑADE member_id AQUÍ
// 
      .eq("id", itemId)            // ✅ CLAVE
      .single();

    if (res.error || !res.data) return null;

    const row = res.data as any;

    const resolved = withResolvedPcImages({
      image_url: row.image_url ?? null,
      back_image_url: row.back_image_url ?? null,
    });
    const meta: ItemMeta = {
      id: Number(row.id),
      name: row.name ?? null,
      image_url: resolved.image_url ?? null,
      back_image_url: resolved.back_image_url ?? null,
      group_id: typeof row.group_id === "number" ? row.group_id : null,
      album_id: typeof row.album_id === "number" ? row.album_id : null,
      version: typeof row.version === "string" ? row.version : null, // ✅
      member: typeof row.member === "string" ? row.member : null,   // ✅
    };

    setItemMetaById((prev) => ({ ...prev, [itemId]: meta }));
    return meta;
  },
  [itemMetaById]
);

  const fetchNameIfNeeded = useCallback(
    async (table: "groups" | "albums" | "versions" | "members", id: number) => {
      if (!Number.isFinite(id)) return null;

           // 👇 AQUÍ estabas eligiendo el cache, pero faltaba el caso "albums"
      const cache =
        table === "groups"
          ? groupNameById
          : table === "albums"
          ? albumNameById
          : table === "versions"
          ? versionNameById
          : memberNameById;

      if (cache[id]) return cache[id];

     const res =
 table === "members"
  ? await supabase.from("members").select("member_id, name").eq("member_id", id).single()
  : await supabase.from(table).select("id, name").eq("id", id).single();

if (res.error || !res.data) return null;

const name = String((res.data as any).name ?? "").trim();
if (!name) return null;

if (table === "groups") setGroupNameById((prev) => ({ ...prev, [id]: name }));
if (table === "albums") setAlbumNameById((prev) => ({ ...prev, [id]: name }));
if (table === "versions") setVersionNameById((prev) => ({ ...prev, [id]: name }));
if (table === "members") setMemberNameById((prev) => ({ ...prev, [id]: name }));

return name;
    },
    [groupNameById, albumNameById, versionNameById, memberNameById]
  );
  const MAX_FREE_PAGES = 12;
const MAX_FREE_SEPARATORS = 5;

// Filtramos para contar independientemente
const realPagesCount = binderPages.filter(p => p.layout_type !== 'separator').length;
const separatorsCount = binderPages.filter(p => p.layout_type === 'separator').length;

// El "canAddPage" original ya no lo usaremos directamente, pero lo dejamos por si acaso
const canAddPage = realPagesCount < MAX_FREE_PAGES;
const goToPurchasePages = () => {
  router.push("/shop"); // cambia esta ruta/ancla por la tuya real
};
const standardPages = binderPages.filter(p => p.layout_type !== 'separator');
const totalPages = Math.max(standardPages.length, 1);
const currentPageInStandard = standardPages.findIndex(p => p.id === pageId) + 1;

const pageLabel = layout === 'separator' 
  ? `SEPARADOR (${binderPages.filter(p => p.layout_type === 'separator').findIndex(p => p.id === pageId) + 1}/5)`
  : `${currentPageInStandard > 0 ? currentPageInStandard : 1}/${totalPages}`;

// ✅ Narrow para ItemPicker (evita rojos TS)
const pickerUserId = typeof userId === "string" && userId.trim() ? userId : null;
const pickerBinderId = typeof binderId === "number" ? binderId : null;

const [applyAll, setApplyAll] = useState<boolean>(false);
const [layoutHover, setLayoutHover] = useState<LayoutType | null>(null);
const [unlockedLayouts, setUnlockedLayouts] = useState<Set<string>>(new Set());
const [pickingSlot, setPickingSlot] = useState<number | null>(null);
const layoutBoxRef = useRef<HTMLDivElement | null>(null);
const [layoutOpen, setLayoutOpen] = useState(false);

useEffect(() => {
  const loadLayoutUnlocks = async () => {
    if (!profile?.id) {
      setUnlockedLayouts(new Set());
      return;
    }
    const { data } = await supabase
      .from("user_vip_unlocks")
      .select("unlock_key")
      .eq("user_id", profile.id);
    const keys = (data || [])
      .map((r: any) => String(r.unlock_key || ""))
      .filter((k: string) => k.startsWith("layout:"))
      .map((k: string) => k.replace(/^layout:/, ""));
    setUnlockedLayouts(new Set(keys));
  };
  void loadLayoutUnlocks();
}, [profile?.id]);

useEffect(() => {
 if (pickingSlot == null) return;

 const onKeyDown = (e: KeyboardEvent) => {
  if (e.key !== "Escape") return;
  e.preventDefault();
  setPickingSlot(null);
 };

 document.addEventListener("keydown", onKeyDown);
 return () => document.removeEventListener("keydown", onKeyDown);
}, [pickingSlot]);

// Thumbs (para carrusel)
// ---------------------
// Página 73 del PDF
type ThumbMeta = {
  url: string | null;
  back_image_url?: string | null; // 👈 ¡AÑADE ESTA LÍNEA!
  itemId: number | null;
  isCustom: boolean;
  // ... resto igual
  isWanted: boolean;
  custom_text?: string | null;  // 👈 AÑADE ESTA LÍNEA
  custom_color?: string | null; // 👈 AÑADE ESTA LÍNEA
  member: string | null;
  name: string | null;
  have: number;
  wtt: number;
  wts: number;
  onItsWay: number;
  wish: number;
  stockTotal: number;
  // ✅ AÑADE ESTAS DOS LÍNEAS PARA QUITAR EL ERROR:
  rot: number;
  flipH: boolean;
};

type PageThumbsMap = Record<number, Record<number, ThumbMeta>>;
// pageId -> slotIndex -> meta
const [pageThumbs, setPageThumbs] = useState<PageThumbsMap>({});
// ... (tus refs/estados anteriores)
// --- LÓGICA DE NAVEGACIÓN DEL MODAL (ANTERIOR / SIGUIENTE) ---

  // 1. Generamos una lista lineal de todos los slots ocupados (o custom) ordenados por página y luego por índice de slot
  const orderedOccupiedSlots = useMemo(() => {
    const list: Array<{ pageId: number; slotIndex: number }> = [];
    
    // Iteramos por las páginas en orden
    const orderedPages = [...binderPages].sort((a, b) => a.page_index - b.page_index);
    
    for (const page of orderedPages) {
      const thumbsForPage = pageThumbs[page.id];
      if (!thumbsForPage) continue;
      
      // Obtenemos los índices de slot ocupados en esta página, ordenados
      const slotIndices = Object.keys(thumbsForPage)
        .map(Number)
        .filter(idx => !isNaN(idx))
        .sort((a, b) => a - b);
        
      for (const slotIdx of slotIndices) {
        list.push({ pageId: page.id, slotIndex: slotIdx });
      }
    }
    return list;
  }, [binderPages, pageThumbs]);

  // 2. Encontramos el índice actual en esa lista lineal
  const currentModalListIndex = useMemo(() => {
    if (!itemModalOpen || pageId === null || modalSlotIndex === null) return -1;
    return orderedOccupiedSlots.findIndex(
      (s) => s.pageId === pageId && s.slotIndex === modalSlotIndex
    );
  }, [itemModalOpen, pageId, modalSlotIndex, orderedOccupiedSlots]);

  const canPrevModal = currentModalListIndex > 0;
  const canNextModal = currentModalListIndex >= 0 && currentModalListIndex < orderedOccupiedSlots.length - 1;

  // 3. Funciones para navegar
  const handleModalPrev = useCallback(() => {
    if (!canPrevModal) return;
    const prevSlot = orderedOccupiedSlots[currentModalListIndex - 1];
    
    // Si la carta está en otra página, cambiamos de página
    if (prevSlot.pageId !== pageId) {
      const newPageIndex = binderPages.findIndex(p => p.id === prevSlot.pageId);
      if (newPageIndex >= 0) setCurrentPageIndex(newPageIndex);
      setPageId(prevSlot.pageId);
    }
    
    // Necesitamos obtener la info de la carta asignada en ese slot
    // Como pageThumbs tiene la información, la reconstruimos para el modal
    const meta = pageThumbs[prevSlot.pageId]?.[prevSlot.slotIndex];
    if (meta) {
        const fakeAssigned = {
            id: meta.itemId ?? -1,
            is_custom: meta.isCustom,
            custom_text: meta.custom_text,
            custom_image_url: meta.url !== "/mock-pcs/groups/not-available.png" && meta.isCustom ? meta.url : null,
            custom_back_image_url: meta.back_image_url,
            member_id: (meta as any).member_id,
            is_wanted: meta.isWanted,
            custom_color: meta.custom_color
        };
        openItemModal(prevSlot.slotIndex, fakeAssigned);
    }
  }, [canPrevModal, currentModalListIndex, orderedOccupiedSlots, pageId, binderPages, pageThumbs]);

  const handleModalNext = useCallback(() => {
    if (!canNextModal) return;
    const nextSlot = orderedOccupiedSlots[currentModalListIndex + 1];
    
    // Si la carta está en otra página, cambiamos de página
    if (nextSlot.pageId !== pageId) {
       const newPageIndex = binderPages.findIndex(p => p.id === nextSlot.pageId);
       if (newPageIndex >= 0) setCurrentPageIndex(newPageIndex);
       setPageId(nextSlot.pageId);
    }
    
    // Reconstruimos la carta asignada para el modal
    const meta = pageThumbs[nextSlot.pageId]?.[nextSlot.slotIndex];
    if (meta) {
        const fakeAssigned = {
            id: meta.itemId ?? -1,
            is_custom: meta.isCustom,
            custom_text: meta.custom_text,
            custom_image_url: meta.url !== "/mock-pcs/groups/not-available.png" && meta.isCustom ? meta.url : null,
            custom_back_image_url: meta.back_image_url,
            member_id: (meta as any).member_id,
            is_wanted: meta.isWanted,
            custom_color: meta.custom_color
        };
        openItemModal(nextSlot.slotIndex, fakeAssigned);
    }
  }, [canNextModal, currentModalListIndex, orderedOccupiedSlots, pageId, binderPages, pageThumbs]);
const lastPageDragRef = useRef<PageDragPayload | null>(null);

// ✅ para NO cerrar el modal mientras arrastras
const pageDraggingRef = useRef(false);

// ✅ para pintar el hueco de drop (animación)
const [pageDragFromId, setPageDragFromId] = useState<number | null>(null);
const [pageDragOverId, setPageDragOverId] = useState<number | null>(null);
  const [modalPageDragFromId, setModalPageDragFromId] = useState<number | null>(null);

  const [modalPageDragOverId, setModalPageDragOverId] = useState<number | null>(null);
// --- NUEVOS ESTADOS PARA DRAG MANUAL EN MÓVIL ---
// Almacena las coordenadas (x, y) del toque actual
const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null);
// Almacena el ID de la página que se está moviendo visualmente
const [movingPageId, setMovingPageId] = useState<number | null>(null);
// Referencia para guardar la posición inicial del toque y calcular el desplazamiento
const touchStartRef = useRef<{ x: number; y: number; pageId: number } | null>(null);
// ... (lo siguiente que tengas)
const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const isLongPressActive = useRef(false);
// Dentro de BinderClient, con los demás useState
const [mobileMoveSourceId, setMobileMoveSourceId] = useState<number | null>(null);

const loadPageThumbs = useCallback(async () => {
    if (!binderPages?.length) return;
    const pageIds = binderPages.map((p) => p.id).filter((x) => Number.isFinite(x));
    if (pageIds.length === 0) return;

    // ✅ SEGURO: Solo pedimos columnas que existen físicamente en la tabla 'page_slots'
   const slotsRes = await supabase
  .from("page_slots")
  // 👇 AÑADE custom_back_image_url AQUÍ:
.select("page_id, slot_index, item_id, is_wanted, is_custom, custom_text, custom_image_url, custom_back_image_url, rot, flip_h, custom_color")  .in("page_id", pageIds);

    if (slotsRes.error) {
      console.error("Error cargando carrusel:", slotsRes.error.message || slotsRes.error);
      return;
    }
    // ... resto de la lógica de procesamiento
    const slotRows = (slotsRes.data ?? []) as any[];

    // 2. Pedimos los datos de las PCs
    const itemIds = Array.from(new Set(slotRows.map((r) => r.item_id).filter(id => id != null)));
    
    let itemsData: any[] = [];
    if (itemIds.length > 0) {
     const itemsRes = await supabase
  .from("items")
  // 👇 AÑADE back_image_url AQUÍ:
  .select("id, image_url, back_image_url, name, member")
  .in("id", itemIds);
      if (!itemsRes.error) itemsData = itemsRes.data ?? [];
    }

    // 3. Calculamos stock para los badges
    const countsByItem: Record<number, StatusCounts> = {};
    if (userId && itemIds.length > 0) {
      const statusRes = await supabase
        .from("user_item_statuses")
        .select("item_id, status, qty")
        .eq("user_id", userId)
        .in("item_id", itemIds);

      if (!statusRes.error) {
        for (const row of (statusRes.data ?? []) as any[]) {
          const itemId = Number(row.item_id);
          const st = String(row.status ?? "");
          const isWish = st === "wish" || st === "wishlist";
          const qty = Number.isFinite(row.qty) ? Math.max(0, Math.floor(row.qty)) : (isWish ? 1 : 0);
          
          if (!countsByItem[itemId]) countsByItem[itemId] = emptyCounts();
          const c = countsByItem[itemId];
          
          if (st === "have") c.have += qty;
          else if (st === "wtt") c.wtt += qty;
          else if (st === "wts") c.wts += qty;
          else if (st === "on_its_way" || st === "otw") c.on_its_way += qty;
          else if (isWish) c.wish += Math.max(1, qty);
        }
      }
    }

    // 4. Construimos el mapa final (Page -> Slot -> Datos)
    const next: PageThumbsMap = {};

   // Página 75-76 del PDF (Dentro de loadPageThumbs)
for (const r of slotRows) {
  const pid = Number(r.page_id);
  const sid = Number(r.slot_index);
  if (!next[pid]) next[pid] = {};

  const itemData = itemsData.find(i => Number(i.id) === Number(r.item_id));
  let url = r.is_custom
    ? (r.custom_image_url ?? "")
    : resolveMockPcImageUrl(itemData?.image_url ?? "") || itemData?.image_url || "";

  const counts = countsByItem[Number(r.item_id)] ?? emptyCounts();
  const stockTotal = Number(counts.have) + Number(counts.wtt) + Number(counts.wts) + Number(counts.on_its_way);

 // Página 75 del PDF (Paso 4 de loadPageThumbs)
next[pid][sid] = {
  url: url || "/mock-pcs/groups/not-available.png",
  // 👇 AÑADE ESTA LÍNEA PARA GUARDAR LA TRASERA
  back_image_url: r.is_custom
    ? (r.custom_back_image_url ?? null)
    : resolveMockPcBackUrl(itemData?.image_url, itemData?.back_image_url),
  itemId: r.item_id,
  isCustom: !!r.is_custom,
  // ... resto igual
  isWanted: !!r.is_wanted,
  member: itemData?.member ?? null,
name: r.is_custom ? (r.custom_text || (itemData?.name ?? null)) : (itemData?.name ?? null),
               custom_text: r.custom_text ?? null, // 👈 AÑADIDO
               custom_color: r.custom_color ?? null, // 👈 AÑADIDO
  have: counts.have, 
  wtt: counts.wtt, 
  wts: counts.wts,
  onItsWay: counts.on_its_way, 
  wish: counts.wish,
  stockTotal,
  // ✅ TypeScript ya no marcará rojo aquí:
  rot: r.rot ?? 0,
  flipH: !!r.flip_h
};
}

    setPageThumbs(next);
  }, [binderPages, supabase, refreshTick, userId]);

useEffect(() => {
  void loadPageThumbs();
}, [loadPageThumbs, refreshTick]);


useEffect(() => {
  if (!layoutOpen) return;

  const onDown = (e: any) => {
    if (!layoutBoxRef.current) return;
    if (!layoutBoxRef.current.contains(e.target as Node)) {
      setLayoutOpen(false);
    }
  };
  document.addEventListener("mousedown", onDown as any);
  return () => document.removeEventListener("mousedown", onDown as any);
}, [layoutOpen]);
useEffect(() => {
  if (!skzooOpen) return;
  const onDown = (e: MouseEvent) => {
    if (skzooBoxRef.current && !skzooBoxRef.current.contains(e.target as Node)) {
      setSkzooOpen(false);
    }
  };
  document.addEventListener("mousedown", onDown);
  return () => document.removeEventListener("mousedown", onDown);
}, [skzooOpen]);
  const slots = useMemo(
    () => Array.from({ length: layoutDef.slots }, (_, i) => i + 1),
    [layoutDef.slots]
  );
  const extras = getExtrasCount(layout);
  const baseSlots = extras > 0 ? slots.slice(0, slots.length - extras) : slots;
  const extraSlots = extras > 0 ? slots.slice(slots.length - extras) : [];

  type UserItemStatusRow = {
 item_id: number;
 status: string;
 qty: number | null;
};
const loadInvForIds = useCallback(
 async (ids: number[]) => {
 if (!userId) return;
 const uniq = Array.from(new Set(ids.map((x) => Number(x)))).filter((x) => Number.isFinite(x));
 if (uniq.length === 0) return;
 const chunkSize = 200;
const allRows: any[] = [];

for (let i = 0; i < uniq.length; i += chunkSize) {
  const chunk = uniq.slice(i, i + chunkSize);

  const res = await supabase
    .from("user_item_statuses")
    .select("item_id, status, qty")
    .eq("user_id", userId)
    .in("item_id", chunk);

  if (res.error) {
    throw new Error(res.error.message);
  }

  if (res.data) {
    allRows.push(...res.data);
  }
}
const rows = allRows as UserItemStatusRow[];

const nextMap: Record<number, StatusCounts> = {};
for (const id of uniq) nextMap[id] = emptyCounts();

for (const row of rows) {
  const itemId = Number(row.item_id);
  if (!Number.isFinite(itemId)) continue;

  const st = String(row.status ?? "");
  const isWish = st === "wish" || st === "wishlist";

  // ✅ si wish viene como check sin qty, cuenta como 1
  const qtyRaw = row.qty == null ? (isWish ? 1 : 0) : Number(row.qty);
  const qty = Number.isFinite(qtyRaw) ? Math.max(0, Math.floor(qtyRaw)) : 0;

  const c = nextMap[itemId] ?? emptyCounts();

  if (st === "have") c.have += qty;
  if (st === "wtt") c.wtt += qty;
  if (st === "wts") c.wts += qty;
  if (st === "on_its_way" || st === "otw") c.on_its_way += qty;
  if (isWish) c.wish += qty;
}

      setInvByItem((prev) => ({ ...prev, ...nextMap }));
    },
    [userId]
  );
  const wttIds = useMemo(() => {
  const ids: number[] = [];
  for (const [k, c] of Object.entries(invByItem)) {
    const id = Number(k);
    if (!Number.isFinite(id)) continue;
    const counts = c ?? emptyCounts();
    if ((counts.wtt ?? 0) > 0) ids.push(id);
  }
  return ids;
}, [invByItem]);

useEffect(() => {
  let cancelled = false;

  const run = async () => {
    if (wttIds.length === 0) {
      if (!cancelled) setWttCarousel([]);
      return;
    }

    const res = await supabase
      .from("items")
      .select("id, name, image_url, version, member")
      .in("id", wttIds);

    if (res.error) return;

    const list: WttCarouselItem[] = (res.data ?? []).map((r: any) => ({
      id: Number(r.id),
      name: r.name ?? undefined,
      image_url: r.image_url ?? undefined,
      version: typeof r.version === "string" ? r.version : undefined,
      member: typeof r.member === "string" ? r.member : undefined,
    }));

    if (!cancelled) setWttCarousel(list);
  };

  run();

  return () => {
    cancelled = true;
  };
}, [wttIds]);

  const wttCatalogById = useMemo(() => {
    const m: Record<number, WttCarouselItem> = {};
    for (const it of wttWantCatalog) m[it.id] = it;
    return m;
  }, [wttWantCatalog]);


  useEffect(() => {
    if (!itemModalOpen) return;
    if (modalItemId == null) return;
    const ids = wttWantedByItem[modalItemId] ?? readWttWanted(modalItemId);
    if (!ids.length) return;

    const missing = ids.filter((id) => !wttCatalogById[id]);
    if (!missing.length) return;

    let cancelled = false;
    const run = async () => {
      const res = await supabase
        .from("items")
        .select("id, name, image_url, group_id, album_id, version, member")
        .in("id", missing);
      if (cancelled) return;
      if (!res.error && res.data?.length) {
        const list: WttCarouselItem[] = (res.data ?? []).map((r: any) => ({
          id: Number(r.id),
          name: r.name ?? undefined,
          image_url: r.image_url ?? undefined,
          group_id: typeof r.group_id === "number" ? r.group_id : undefined,
          album_id: typeof r.album_id === "number" ? r.album_id : undefined,
          version: r.version ?? undefined,
          member: r.member ?? undefined,
        }));
        setWttWantCatalog((prev) => {
          const map = new Map<number, WttCarouselItem>();
          for (const it of prev) map.set(it.id, it);
          for (const it of list) map.set(it.id, it);
          return Array.from(map.values());
        });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [itemModalOpen, modalItemId, wttWantedByItem, readWttWanted, wttCatalogById, supabase]);

  useEffect(() => {
    if (!itemModalOpen) return;
    if (modalItemId == null) return;
    const ids = wttOfferByItem[modalItemId] ?? readWttOffer(modalItemId).ids;
    if (!ids.length) return;

    const missing = ids.filter((id) => !wttCatalogById[id]);
    if (!missing.length) return;

    let cancelled = false;
    const run = async () => {
      const res = await supabase
        .from("items")
        .select("id, name, image_url, group_id, album_id, version, member")
        .in("id", missing);
      if (cancelled) return;
      if (!res.error && res.data?.length) {
        const list: WttCarouselItem[] = (res.data ?? []).map((r: any) => ({
          id: Number(r.id),
          name: r.name ?? undefined,
          image_url: r.image_url ?? undefined,
          group_id: typeof r.group_id === "number" ? r.group_id : undefined,
          album_id: typeof r.album_id === "number" ? r.album_id : undefined,
          version: r.version ?? undefined,
          member: r.member ?? undefined,
        }));
        setWttWantCatalog((prev) => {
          const map = new Map<number, WttCarouselItem>();
          for (const it of prev) map.set(it.id, it);
          for (const it of list) map.set(it.id, it);
          return Array.from(map.values());
        });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [itemModalOpen, modalItemId, wttOfferByItem, readWttOffer, wttCatalogById, supabase]);

  const wttWantedForModal = useMemo(() => {
    if (modalItemId == null) return [] as WttCarouselItem[];
    const ids = wttWantedByItem[modalItemId] ?? readWttWanted(modalItemId);
    return ids.map((id) => wttCatalogById[id]).filter(Boolean) as WttCarouselItem[];
  }, [modalItemId, wttWantedByItem, wttCatalogById, readWttWanted]);

  const wttOfferForModal = useMemo(() => {
    if (modalItemId == null) return [] as WttCarouselItem[];
    const ids = wttOfferByItem[modalItemId] ?? readWttOffer(modalItemId).ids;
    return ids.map((id) => wttCatalogById[id]).filter(Boolean) as WttCarouselItem[];
  }, [modalItemId, wttOfferByItem, wttCatalogById, readWttOffer]);

  const wttOfferQtyForModal = useMemo(() => {
    if (modalItemId == null) return 0;
    const localQty = wttOfferQtyByItem[modalItemId] ?? readWttOffer(modalItemId).qty ?? 0;
    if (localQty > 0) return localQty;
    return invByItem[modalItemId]?.wtt ?? 0;
  }, [modalItemId, wttOfferQtyByItem, readWttOffer, invByItem]);

  
type PersistSlotPayload =
  | { kind: "empty" }
  | { kind: "real"; itemId: number; custom_text?: null; custom_image_url?: null }
  | { kind: "custom"; custom_text: string; custom_image_url: string | null };

function normRot(v: number) {
  const n = Number(v ?? 0);
  const r = Number.isFinite(n) ? n : 0;
  return ((r % 360) + 360) % 360;
}
async function persistSlotStateForPage(
  pId: number,
  slotIndex: number,
  payload: PersistSlotPayload,
  rot: number,
  flipH: boolean
) {
  if (!pId) return { ok: false as const, error: "No pageId" };

  if (payload.kind === "empty") {
    const del = await supabase
      .from("page_slots")
      .delete()
      .eq("page_id", pId)
      .eq("slot_index", slotIndex);

    if (del.error) return { ok: false as const, error: del.error.message };
    return { ok: true as const, error: null as string | null };
  }

  const base = {
    page_id: pId,
    slot_index: slotIndex,
    rot: normRot(rot),
    flip_h: Boolean(flipH),
  };

  if (payload.kind === "real") {
    const up = await supabase
      .from("page_slots")
      .upsert(
        {
          ...base,
          item_id: payload.itemId,
          is_custom: false,
          custom_text: null,
          custom_image_url: null,
        },
        { onConflict: "page_id,slot_index" }
      );

    if (up.error) return { ok: false as const, error: up.error.message };
    return { ok: true as const, error: null as string | null };
  }

  const up = await supabase
  .from("page_slots")
  .upsert({
    ...base,
    item_id: null,
    is_custom: true,
    custom_text: payload.custom_text ?? "",
    custom_image_url: payload.custom_image_url ?? null,
    custom_color: (payload as any).custom_color ?? null, // 👈 AÑADIDO
      },
      { onConflict: "page_id,slot_index" }
    );

  if (up.error) return { ok: false as const, error: up.error.message };
  return { ok: true as const, error: null as string | null };
}
// ✅ Guarda un slot: real/custom/vacío (DB source of truth)
const persistSlotState = useCallback(
  async (
    slotIndex: number,
    payload: PersistSlotPayload,
    rot: number,
    flipH: boolean
  ) => {
    if (!pageId) return { ok: false as const, error: "No pageId" };

    // Vacío => borramos fila
    if (payload.kind === "empty") {
      const del = await supabase
        .from("page_slots")
        .delete()
        .eq("page_id", pageId)
        .eq("slot_index", slotIndex);

      if (del.error) return { ok: false as const, error: del.error.message };
      return { ok: true as const, error: null as string | null };
    }

    const base = {
      page_id: pageId,
      slot_index: slotIndex,
      rot: normRot(rot),
      flip_h: Boolean(flipH),
    };

    // Real
    if (payload.kind === "real") {
      const up = await supabase
        .from("page_slots")
        .upsert(
          {
            ...base,
            item_id: payload.itemId,
            is_custom: false,
            custom_text: null,
            custom_image_url: null,
          },
          { onConflict: "page_id,slot_index" }
        );

      if (up.error) return { ok: false as const, error: up.error.message };
      return { ok: true as const, error: null as string | null };
    }

    // Custom
    const up = await supabase
      .from("page_slots")
      .upsert(
        {
          ...base,
          item_id: null,
          is_custom: true,
          custom_text: payload.custom_text ?? "",
          custom_image_url: payload.custom_image_url ?? null,
          custom_color: (payload as any).custom_color ?? null,
        },
        { onConflict: "page_id,slot_index" }
      );

    if (up.error) return { ok: false as const, error: up.error.message };
    return { ok: true as const, error: null as string | null };
  },
  [pageId]
);



// ✅ Persist swap que respeta custom/real/vacío
const persistSwapSafe = useCallback(
  async (fromSlot: number, toSlot: number) => {
    const fromItem = slotItems[fromSlot] ?? null;
    const toItem = slotItems[toSlot] ?? null;

    const fromRot = slotRot[fromSlot] ?? 0;
    const fromFlip = slotFlipH[fromSlot] ?? false;

    const toRot = toItem ? (slotRot[toSlot] ?? 0) : 0;
    const toFlip = toItem ? (slotFlipH[toSlot] ?? false) : false;

    // Destino (toSlot) recibe fromItem
    const toPayload: PersistSlotPayload =
      !fromItem
        ? { kind: "empty" }
        : fromItem.is_custom
        ? {
            kind: "custom",
            custom_text: fromItem.custom_text ?? "",
            custom_image_url: fromItem.custom_image_url ?? null,
          }
        : { kind: "real", itemId: fromItem.id };

    // Origen (fromSlot) recibe toItem (o vacío)
    const fromPayload: PersistSlotPayload =
      !toItem
        ? { kind: "empty" }
        : toItem.is_custom
        ? {
            kind: "custom",
            custom_text: toItem.custom_text ?? "",
            custom_image_url: toItem.custom_image_url ?? null,
          }
        : { kind: "real", itemId: toItem.id };

    const [a, b] = await Promise.all([
      persistSlotState(toSlot, toPayload, fromRot, fromFlip),
      persistSlotState(fromSlot, fromPayload, toRot, toFlip),
    ]);

    if (!a.ok) return a;
    if (!b.ok) return b;
    return { ok: true as const, error: null as string | null };
  },
  [slotItems, slotRot, slotFlipH, persistSlotState]
);
 
const [swapFxSlots, setSwapFxSlots] = useState<Record<number, number>>({});
const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
 const onDropSwap = useCallback(
  async (p: DragPayload, toSlot: number) => {
    if (!pageId) return;
    // ✅ guardar estado ANTES del cambio
   await pushUndoSnapshot();

    const fromPageId = p.fromPageId;
    const fromSlot = p.fromSlot;

    // mismo slot misma página: nada
    if (fromPageId === pageId && fromSlot === toSlot) return;

    // ---------- MISMA PÁGINA (tu lógica actual) ----------
    if (fromPageId === pageId) {
      const fromItem = slotItems[fromSlot];
      if (!fromItem) return;

      const toItem = slotItems[toSlot] ?? null;
      if (toItem && toItem.id === fromItem.id) return;

      const prevSlotItems = slotItems;
      const prevFaces = slotFace;
      const prevRots = slotRot;
      const prevFlips = slotFlipH;

      const fromRot = slotRot[fromSlot] ?? 0;
      const fromFlip = slotFlipH[fromSlot] ?? false;
      const toRot = toItem ? (slotRot[toSlot] ?? 0) : 0;
      const toFlip = toItem ? (slotFlipH[toSlot] ?? false) : false;

      setSwapFxSlots((prev) => ({ ...prev, [fromSlot]: Date.now(), [toSlot]: Date.now() }));
      window.setTimeout(() => {
        setSwapFxSlots((prev) => {
          const next = { ...prev };
          delete next[fromSlot];
          delete next[toSlot];
          return next;
        });
      }, 260);

      setSlotItems((prev) => {
        const next = { ...prev };
        next[toSlot] = fromItem;
        if (toItem) next[fromSlot] = toItem;
        else delete next[fromSlot];
        return next;
      });

      setSlotFace((prev) => {
        const next = { ...prev };
        const fromFace = prev[fromSlot] ?? "front";
        const toFace = prev[toSlot] ?? "front";
        next[toSlot] = fromFace;
        if (toItem) next[fromSlot] = toFace;
        else delete next[fromSlot];
        return next;
      });

      setSlotRot((prev) => {
        const next = { ...prev };
        next[toSlot] = fromRot;
        if (toItem) next[fromSlot] = toRot;
        else delete next[fromSlot];
        return next;
      });

      setSlotFlipH((prev) => {
        const next = { ...prev };
        next[toSlot] = fromFlip;
        if (toItem) next[fromSlot] = toFlip;
        else delete next[fromSlot];
        return next;
      });

      const res = await persistSwapSafe(fromSlot, toSlot);
      if (!res.ok) {
        setSlotItems(prevSlotItems);
        setSlotFace(prevFaces);
        setSlotRot(prevRots);
        setSlotFlipH(prevFlips);
        setError(res.error || "Error guardando drag&drop");
        setStatus("Error guardando drag&drop");
        return;
      }

      setStatus("Orden actualizado ✅ ");
      return;
    }

    // ---------- OTRA PÁGINA (NUEVO) ----------
    // Construye "fromItem" desde el snapshot del drag
    const fromIsCustom = Boolean(p.is_custom);
    const fromItemSnapshot: SlotItem = fromIsCustom
      ? ({
          id: p.itemId,
          name: p.name ?? "PC personalizada",
          image_url: null,
          back_image_url: null,
          is_custom: true,
          custom_text: p.custom_text ?? "",
          custom_image_url: p.custom_image_url ?? null,
        } as any)
      : ({
          id: p.itemId,
          name: p.name ?? null,
          image_url: p.image_url ?? null,
          back_image_url: p.back_image_url ?? null,
        } as any);

    const fromRot = Number(p.rot ?? 0);
    const fromFlip = Boolean(p.flipH);
    const fromFace: "front" | "back" = p.face === "back" ? "back" : "front";

    const toItem = slotItems[toSlot] ?? null;
    const toRot = toItem ? (slotRot[toSlot] ?? 0) : 0;
    const toFlip = toItem ? (slotFlipH[toSlot] ?? false) : false;
    const toFace: "front" | "back" = (slotFace[toSlot] ?? "front") as any;

    // payload DB origen/destino
    const toPayload: PersistSlotPayload =
      fromIsCustom
        ? { kind: "custom", custom_text: p.custom_text ?? "", custom_image_url: p.custom_image_url ?? null }
        : { kind: "real", itemId: p.itemId };

    const fromPayload: PersistSlotPayload =
      !toItem
        ? { kind: "empty" }
        : (toItem as any).is_custom
          ? {
              kind: "custom",
              custom_text: (toItem as any).custom_text ?? "",
              custom_image_url: (toItem as any).custom_image_url ?? null,
            }
          : { kind: "real", itemId: toItem.id };

    // 👇 aquí necesitamos poder persistir indicando page_id explícito
    const [a, b] = await Promise.all([
      persistSlotStateForPage(pageId, toSlot, toPayload, fromRot, fromFlip),
      persistSlotStateForPage(fromPageId, fromSlot, fromPayload, toRot, toFlip),
    ]);

    if (!a.ok) {
      setError(a.error || "Error guardando drag&drop");
      setStatus("Error guardando drag&drop");
      return;
    }
    if (!b.ok) {
      setError(b.error || "Error guardando drag&drop");
      setStatus("Error guardando drag&drop");
      return;
    }

    // UI: solo podemos pintar seguro la página actual
    setSlotItems((prev) => ({ ...prev, [toSlot]: fromItemSnapshot }));
    setSlotRot((prev) => ({ ...prev, [toSlot]: fromRot }));
    setSlotFlipH((prev) => ({ ...prev, [toSlot]: fromFlip }));
    setSlotFace((prev) => ({ ...prev, [toSlot]: fromFace }));

    // fuerza refresh para que al volver a la página origen ya esté correcto
    setRefreshTick((t) => t + 1);
    setStatus("Movida a otra página ✅ ");
  },
  [pageId, slotItems, slotFace, slotRot, slotFlipH, persistSwapSafe]
);
  

  const applyShiftState = useCallback(
    (next: Map<number, { item: SlotItem | null; rot: number; flip: boolean; face: "front" | "back" }>) => {
      const nextItems: Record<number, SlotItem> = {};
      const nextRot: Record<number, number> = {};
      const nextFlip: Record<number, boolean> = {};
      const nextFace: Record<number, "front" | "back"> = {};

      for (const [slot, st] of next.entries()) {
        if (!st.item) continue;
        nextItems[slot] = st.item;
        nextRot[slot] = st.rot ?? 0;
        nextFlip[slot] = Boolean(st.flip);
        nextFace[slot] = st.face ?? "front";
      }

      setSlotItems(nextItems);
      setSlotRot(nextRot);
      setSlotFlipH(nextFlip);
      setSlotFace(nextFace);
    },
    []
  );

  const persistSlotsBulk = useCallback(
  async (
    next: Map<
      number,
      { item: SlotItem | null; rot: number; flip: boolean; face: "front" | "back" }
    >
  ) => {
    if (!pageId) return { ok: false, error: "No pageId" };

   const upserts: Array<{
    page_id: number;
    slot_index: number;
    item_id: number | null;
    member_id: number | null;
    rot: number;
    flip_h: boolean;
    is_custom: boolean;
    custom_text: string | null;
    custom_image_url: string | null;
    custom_color?: string | null; // 👈 AÑADE ESTA LÍNEA AQUÍ
  }> = [];

    const deletes: number[] = [];

    const norm = (r: number) => ((Number(r ?? 0) % 360) + 360) % 360;

    for (const n of slots) {
      const st =
        next.get(n) ??
        ({ item: null, rot: 0, flip: false, face: "front" } as const);

      const it = st.item;

      if (!it) {
        // ✅ vacío de verdad => borrar fila
        deletes.push(n);
        continue;
      }

      const isCustom = Boolean((it as any).is_custom);

     upserts.push({
 page_id: pageId,
 slot_index: n,
 // ✅ si es custom, item_id debe ser NULL
 item_id: isCustom ? null : it.id,
member_id: (it as any).member_id != null ? Number((it as any).member_id) : null,
 rot: norm(st.rot),
 flip_h: Boolean(st.flip),
 // ✅ custom fields
 is_custom: isCustom,
  custom_text: isCustom ? ((it as any).custom_text ?? "") : null,
                 custom_image_url: isCustom ? ((it as any).custom_image_url ?? null) : null,
                 custom_color: isCustom ? ((it as any).custom_color ?? null) : null, // 👈 AÑADE ESTA LÍNEA
               });
             }
    // 1) borra SOLO los slots realmente vacíos
    if (deletes.length > 0) {
      const del = await supabase
        .from("page_slots")
        .delete()
        .eq("page_id", pageId)
        .in("slot_index", deletes);

      if (del.error) return { ok: false, error: del.error.message };
    }

    // 2) upsert del resto (reales + custom)
    if (upserts.length > 0) {
      const up = await supabase
        .from("page_slots")
        .upsert(upserts, { onConflict: "page_id,slot_index" });

      if (up.error) return { ok: false, error: up.error.message };
    }

    return { ok: true, error: null as string | null };
  },
  [pageId, slots]
);

  const makeRoomAt = useCallback(
    async (atSlot: number, steps = 1) => {
      if (!pageId) return;
      if (isShifting) return;

      const last = layoutDef.slots;
      if (atSlot < 1 || atSlot > last) return;

      for (let i = last - steps + 1; i <= last; i++) {
        if (slotItems[i]) {
          setError("No hay espacio para hacer hueco: libera el último slot primero.");
          setStatus("No se pudo hacer hueco");
          return;
        }
      }

      setIsShifting(true);
      setError(null);

      const state = new Map<number, { item: SlotItem | null; rot: number; flip: boolean; face: "front" | "back" }>();
      for (let i = 1; i <= last; i++) {
        state.set(i, {
          item: slotItems[i] ?? null,
          rot: slotRot[i] ?? 0,
          flip: slotFlipH[i] ?? false,
          face: slotFace[i] ?? "front",
        });
      }
setShiftFx({ kind: "make", at: atSlot, steps, tick: Date.now() });
      for (let i = last; i >= atSlot; i--) {
        const cur = state.get(i);
        if (!cur || !cur.item) continue;
        const dest = i + steps;
        if (dest > last) continue;
        state.set(dest, cur);
        state.set(i, { item: null, rot: 0, flip: false, face: "front" });
      }

      applyShiftState(state);
      const res = await persistSlotsBulk(state);
      if (!res.ok) {
        setError(res.error || "Error haciendo hueco");
        setStatus("Error haciendo hueco");
        setRefreshTick((t) => t + 1);
      } else {
        setStatus("Hueco creado ✅");
      }

      setIsShifting(false);
    },
    [pageId, isShifting, layoutDef.slots, slotItems, slotRot, slotFlipH, slotFace, applyShiftState, persistSlotsBulk]
  );
  const makeRoomAtGlobal = useCallback(
  async (atSlot: number, steps = 1) => {
    if (!binderId) return;
    if (!pageId) return;
    if (isShifting) return;

    // página actual dentro del binder
    const curPageIdx = binderPages.findIndex((p) => p.id === pageId);
    if (curPageIdx < 0) return;

    // pages afectadas: desde la actual hasta el final
    const affectedPages = binderPages.slice(curPageIdx);
    if (affectedPages.length === 0) return;

    // slots por página (OJO: puede variar según layout_type)
    const pageSlotCounts = affectedPages.map((p) => {
      const def = defFor(p.layout_type);
      return def.slots;
    });

    const totalSlots = pageSlotCounts.reduce((a, b) => a + b, 0);
    if (totalSlots <= 0) return;

    // convierte (atSlot en página actual) a “global index” dentro de affectedPages (1..totalSlots)
    if (atSlot < 1) return;
    const firstPageSlots = pageSlotCounts[0];
    if (atSlot > firstPageSlots) return;

    const startGlobal = atSlot; // porque empezamos en la primera página del slice
    const lastGlobal = totalSlots;

    // si los últimos "steps" slots (del binder) están ocupados, no se puede
    // (necesitamos hueco al final del binder para empujar)
    const lastPage = affectedPages[affectedPages.length - 1];
    const lastPageSlots = pageSlotCounts[pageSlotCounts.length - 1];

    // lee ocupación DB SOLO de páginas afectadas
    setIsShifting(true);
    setError(null);
    setStatus("Haciendo hueco...");

    const pageIds = affectedPages.map((p) => p.id);

    const rowsRes = await supabase
      .from("page_slots")
      .select("page_id, slot_index, item_id, rot, flip_h, is_custom, custom_text, custom_image_url")
      .in("page_id", pageIds);

    if (rowsRes.error) {
      setError(rowsRes.error.message);
      setStatus("Error haciendo hueco");
      setIsShifting(false);
      return;
    }

    const rows = (rowsRes.data ?? []) as Array<{
      page_id: number;
      slot_index: number;
      item_id: number | null;
      rot: number | null;
      flip_h: boolean | null;
      is_custom: boolean | null;
      custom_text: string | null;
      custom_image_url: string | null;
    }>;

    // helper: (globalIndex 1..totalSlots) -> {page_id, slot_index}
    const globalToLocal = (g: number) => {
      let acc = 0;
      for (let i = 0; i < affectedPages.length; i++) {
        const count = pageSlotCounts[i];
        if (g <= acc + count) {
          const localSlot = g - acc; // 1..count
          return { page_id: affectedPages[i].id, slot_index: localSlot };
        }
        acc += count;
      }
      // fallback (no debería)
      return { page_id: lastPage.id, slot_index: lastPageSlots };
    };

    // map de ocupación por global index
    const occ = new Map<number, (typeof rows)[number]>();

    // indexa filas a global
    for (const r of rows) {
      // calcula global de esa fila dentro de affectedPages
      let acc = 0;
      for (let i = 0; i < affectedPages.length; i++) {
        const pid = affectedPages[i].id;
        const count = pageSlotCounts[i];
        if (r.page_id === pid) {
          const g = acc + Number(r.slot_index);
          if (g >= 1 && g <= totalSlots) occ.set(g, r);
          break;
        }
        acc += count;
      }
    }

    // check: últimos slots libres
    for (let g = lastGlobal - steps + 1; g <= lastGlobal; g++) {
      if (occ.get(g)) {
        setError("No hay espacio para hacer hueco: libera el último slot del binder primero.");
        setStatus("No se pudo hacer hueco");
        setIsShifting(false);
        return;
      }
    }

    // anima en la página actual (solo FX visual de la página actual)
    setShiftFx({ kind: "make", at: atSlot, steps, tick: Date.now() });

    // shift global: de atrás hacia delante
    for (let g = lastGlobal; g >= startGlobal; g--) {
      const from = g - steps;
      if (from < startGlobal) continue;
      const moving = occ.get(from);
      if (moving) {
        occ.set(g, moving);
        occ.delete(from);
      }
    }

    // Persistencia:
    // opción simple y robusta: borrar page_slots de páginas afectadas y reinsertar las ocupadas.
    const delRes = await supabase.from("page_slots").delete().in("page_id", pageIds);
    if (delRes.error) {
      setError(delRes.error.message);
      setStatus("Error haciendo hueco");
      setIsShifting(false);
      setRefreshTick((t) => t + 1);
      return;
    }

    const upserts: Array<{
      page_id: number;
      slot_index: number;
      item_id: number | null;
      rot: number;
      flip_h: boolean;
      is_custom: boolean;
      custom_text: string | null;
      custom_image_url: string | null;
    }> = [];

    for (const [g, r] of occ.entries()) {
      const loc = globalToLocal(g);
      upserts.push({
        page_id: loc.page_id,
        slot_index: loc.slot_index,
        item_id: r.is_custom ? null : r.item_id,
        rot: Number(r.rot ?? 0),
        flip_h: Boolean(r.flip_h ?? false),
        is_custom: Boolean(r.is_custom ?? false),
        custom_text: r.is_custom ? (r.custom_text ?? "") : null,
        custom_image_url: r.is_custom ? (r.custom_image_url ?? null) : null,
      });
    }

    if (upserts.length > 0) {
      const insRes = await supabase
        .from("page_slots")
        .insert(upserts);

      if (insRes.error) {
        setError(insRes.error.message);
        setStatus("Error haciendo hueco");
        setIsShifting(false);
        setRefreshTick((t) => t + 1);
        return;
      }
    }

    setStatus("Hueco creado ✅ ");
    setIsShifting(false);

    // recarga la página actual desde DB
    setRefreshTick((t) => t + 1);
  },
  [binderId, pageId, binderPages, isShifting, setShiftFx, supabase]
);

const closeGapAtGlobal = useCallback(
  async (atSlot: number, steps = 1) => {
    if (!binderId) return;
    if (!pageId) return;
    if (isShifting) return;

    const curPageIdx = binderPages.findIndex((p) => p.id === pageId);
    if (curPageIdx < 0) return;

    const affectedPages = binderPages.slice(curPageIdx);
    if (affectedPages.length === 0) return;

    const pageSlotCounts = affectedPages.map((p) => {
      const def = defFor(p.layout_type);
      return def.slots;
    });

    const totalSlots = pageSlotCounts.reduce((a, b) => a + b, 0);
    if (totalSlots <= 0) return;

    if (atSlot < 1) return;
    const firstPageSlots = pageSlotCounts[0];
    if (atSlot > firstPageSlots) return;

    const startGlobal = atSlot;
    const lastGlobal = totalSlots;

    setIsShifting(true);
    setError(null);
    setStatus("Cerrando hueco...");

    const pageIds = affectedPages.map((p) => p.id);

    const rowsRes = await supabase
      .from("page_slots")
      .select("page_id, slot_index, item_id, rot, flip_h, is_custom, custom_text, custom_image_url")
      .in("page_id", pageIds);

    if (rowsRes.error) {
      setError(rowsRes.error.message);
      setStatus("Error cerrando hueco");
      setIsShifting(false);
      return;
    }

    const rows = (rowsRes.data ?? []) as Array<{
      page_id: number;
      slot_index: number;
      item_id: number | null;
      rot: number | null;
      flip_h: boolean | null;
      is_custom: boolean | null;
      custom_text: string | null;
      custom_image_url: string | null;
    }>;

    const globalToLocal = (g: number) => {
      let acc = 0;
      for (let i = 0; i < affectedPages.length; i++) {
        const count = pageSlotCounts[i];
        if (g <= acc + count) {
          const localSlot = g - acc;
          return { page_id: affectedPages[i].id, slot_index: localSlot };
        }
        acc += count;
      }
      const lastPage = affectedPages[affectedPages.length - 1];
      const lastPageSlots = pageSlotCounts[pageSlotCounts.length - 1];
      return { page_id: lastPage.id, slot_index: lastPageSlots };
    };

    const occ = new Map<number, (typeof rows)[number]>();
    for (const r of rows) {
      let acc = 0;
      for (let i = 0; i < affectedPages.length; i++) {
        const pid = affectedPages[i].id;
        const count = pageSlotCounts[i];
        if (r.page_id === pid) {
          const g = acc + Number(r.slot_index);
          if (g >= 1 && g <= totalSlots) occ.set(g, r);
          break;
        }
        acc += count;
      }
    }

    setShiftFx({ kind: "close", at: atSlot, steps, tick: Date.now() });

    for (let g = startGlobal; g <= lastGlobal; g++) {
      const from = g + steps;
      if (from > lastGlobal) {
        occ.delete(g);
        continue;
      }
      const moving = occ.get(from);
      if (moving) occ.set(g, moving);
      else occ.delete(g);
    }

    const delRes = await supabase.from("page_slots").delete().in("page_id", pageIds);
    if (delRes.error) {
      setError(delRes.error.message);
      setStatus("Error cerrando hueco");
      setIsShifting(false);
      setRefreshTick((t) => t + 1);
      return;
    }

    const upserts: Array<{
      page_id: number;
      slot_index: number;
      item_id: number | null;
      rot: number;
      flip_h: boolean;
      is_custom: boolean;
      custom_text: string | null;
      custom_image_url: string | null;
    }> = [];

    for (const [g, r] of occ.entries()) {
      const loc = globalToLocal(g);
      upserts.push({
        page_id: loc.page_id,
        slot_index: loc.slot_index,
        item_id: r.item_id ?? null,
        rot: Number(r.rot ?? 0),
        flip_h: Boolean(r.flip_h ?? false),
        is_custom: Boolean(r.is_custom ?? false),
        custom_text: r.custom_text ?? null,
        custom_image_url: r.custom_image_url ?? null,
      });
    }

    if (upserts.length) {
      const upRes = await supabase.from("page_slots").upsert(upserts, { onConflict: "page_id,slot_index" });
      if (upRes.error) {
        setError(upRes.error.message);
        setStatus("Error cerrando hueco");
        setIsShifting(false);
        setRefreshTick((t) => t + 1);
        return;
      }
    }

    setStatus("Hueco cerrado ✅");
    setIsShifting(false);
    setRefreshTick((t) => t + 1);
  },
  [binderId, pageId, binderPages, isShifting, setShiftFx, supabase]
);
const lastSlotDragRef = useRef<DragPayload | null>(null);


function setDragData(dt: DataTransfer, json: string) {
  dt.setData("application/json", json);
  // Importante: evita que el navegador muestre el contenido de text/plain como “label”
  dt.setData("text/plain", "\u200B"); // zero-width space
  dt.effectAllowed = "move";
  hideDragGhost(dt);
}
  const closeGapAt = useCallback(
    async (atSlot: number, steps = 1) => {
      if (!pageId) return;
      if (isShifting) return;

      const last = layoutDef.slots;
      if (atSlot < 1 || atSlot > last) return;

      setIsShifting(true);
      setError(null);
setShiftFx({ kind: "close", at: atSlot, steps, tick: Date.now() });
      const state = new Map<number, { item: SlotItem | null; rot: number; flip: boolean; face: "front" | "back" }>();
      for (let i = 1; i <= last; i++) {
        state.set(i, {
          item: slotItems[i] ?? null,
          rot: slotRot[i] ?? 0,
          flip: slotFlipH[i] ?? false,
          face: slotFace[i] ?? "front",
        });
      }

      for (let i = atSlot; i <= last; i++) {
        const from = i + steps;
        if (from > last) {
          state.set(i, { item: null, rot: 0, flip: false, face: "front" });
          continue;
        }
        const incoming = state.get(from) ?? { item: null, rot: 0, flip: false, face: "front" };
        state.set(i, incoming);
      }

      for (let i = last - steps + 1; i <= last; i++) {
        if (i >= 1 && i <= last) state.set(i, { item: null, rot: 0, flip: false, face: "front" });
      }

      applyShiftState(state);
      const res = await persistSlotsBulk(state);
      if (!res.ok) {
        setError(res.error || "Error cerrando hueco");
        setStatus("Error cerrando hueco");
        setRefreshTick((t) => t + 1);
      } else {
        setStatus("Hueco cerrado ✅");
      }

      setIsShifting(false);
    },
    [pageId, isShifting, layoutDef.slots, slotItems, slotRot, slotFlipH, slotFace, applyShiftState, persistSlotsBulk]
  );

const LayoutMiniPreview = ({
  layoutKey,
  size = "carousel",
  thumbs, // 👈 Fuente de verdad
  refreshTick,
  pageWidth,
  pageHeight,
}: {
  layoutKey: LayoutType;
  size?: "carousel" | "picker" | "modal";
  thumbs?: Record<number, ThumbMeta>;
  refreshTick: number;
  pageWidth?: number;
  pageHeight?: number;
}) => {
  const def = defFor(layoutKey);
  const thumbMap = thumbs ?? {}; // 👈 Usamos thumbs, no una carga interna
  const extras = getExtrasCount(layoutKey);
  const baseCount = def.slots - extras;
  const cols = def.cols;

  const preset = size === "modal"
  ? { maxW: 220, maxH: 310, padding: 10 } // 👈 ¡Corregido! Antes era 850x650
  : size === "picker"
  ? { maxW: 110, maxH: 76, padding: 4 }
  : { maxW: 80, maxH: 114, padding: 0 };

  const { slotW, slotH, gap: previewGap, rowGap: previewRowGap } = getSlotDimsForLayout(def);
  const baseRows = Math.ceil(baseCount / cols);
  const rowW = cols * slotW + (cols - 1) * previewGap;
  const naturalW = rowW;
  const naturalH = baseRows * slotH + (baseRows - 1) * previewRowGap + (extras > 0 ? previewRowGap + slotH : 0);
  
  const scale = Math.min(preset.maxW / naturalW, preset.maxH / naturalH, 1);
  const baseSlotsArr = Array.from({ length: baseCount }, (_, i) => i + 1);
  const extraSlotsArr = extras > 0 ? Array.from({ length: extras }, (_, i) => baseCount + 1 + i) : [];
  const rows = Array.from({ length: baseRows }, (_, r) => baseSlotsArr.slice(r * cols, (r + 1) * cols));
  

// Página 101 del PDF (Dentro de LayoutMiniPreview)
const Cell = ({ isExtra, meta }: { isExtra?: boolean; meta?: any }) => { 
  const url = meta?.url ?? "";
  const counts: StatusCounts = {
    have: Number(meta?.have ?? 0),
    wtt: Number(meta?.wtt ?? 0),
    wts: Number(meta?.wts ?? 0),
    on_its_way: Number(meta?.onItsWay ?? 0),
    wish: Number(meta?.wish ?? 0),
  };

  const st = statusColors(counts);
  const wish = Number(meta?.wish ?? 0) > 0;
  const otw = Number(meta?.onItsWay ?? 0) > 0;
  
  const isBias = meta?.itemId ? checkIsBias(meta.itemId, meta.member || meta.name || "") : false;
  const extraCount = Number(meta?.stockTotal ?? 0) > 1 ? Number(meta?.stockTotal ?? 0) - 1 : 0;
  const badgeFont = size === "modal" ? 10 : size === "picker" ? 8 : 7;
  const badgePad = size === "modal" ? "2px 6px" : "1px 5px";

  // ✅ Capturamos la rotación y flip guardados [cite: 1531]
  const rot = meta?.rot ?? 0;
  const flip = meta?.flipH ?? false;

  // ✅ Nueva lógica: detectamos si el slot debe estar en horizontal (90º o 270º)
  const isHorizontal = rot % 180 !== 0;

  return ( 
    <div 
    key={refreshTick} // 👈 Esto fuerza a React a destruir y recrear la miniatura
    style={{ 
      // ✅ Si es horizontal, intercambiamos los valores de slotW y slotH [cite: 938, 955]
      width: isHorizontal ? slotH : slotW, 
      height: isHorizontal ? slotW : slotH, 
      borderRadius: 10, 
      border: `1.5px solid ${st.border}`, 
      background: st.bg, 
      overflow: "hidden", 
      position: "relative", 
      boxShadow: extraCount > 0 ? `0 8px 18px ${st.border}55` : `0 3px 10px ${st.border}22`, 
      transition: "all .2s ease",
      // Añadimos centrado para que la rotación interna no desfase la imagen
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}> 
      {url ? ( 
        <div style={{ 
          // La imagen interna siempre mantiene el tamaño base rectangular [cite: 933]
          width: slotW, 
          height: slotH,
          // ✅ Aplicamos rotación y volteo [cite: 1530]
          transform: `rotate(${rot}deg) scaleX(${flip ? -1 : 1})`,
          transition: "transform 0.2s ease",
          flexShrink: 0
        }}>
          {meta?.isWanted ? ( 
            <WesternWantedFrame name={prettyText(meta?.member || meta?.name || "")} variant="slot"> 
              <img src={url} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> 
            </WesternWantedFrame> 
          ) : ( 
            <img src={url} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> 
          )}
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: isExtra ? "var(--state-warning-bg)" : "var(--binder-mini-empty-bg)",
          }}
        />
      )}

 


        {/* ✅ CORAZÓN DE BIAS (Pág. 27 del PDF) */}
        {isBias && (
          <div style={{
            position: "absolute",
            left: size === "modal" ? 4 : 2,
            bottom: size === "modal" ? 4 : 2,
            zIndex: 10,
            display: "flex",
            filter: "drop-shadow(0 1px 2px color-mix(in srgb, var(--bg-card) 90%, transparent))"
          }}>
            <Heart size={size === "modal" ? 14 : 10} fill="var(--color-primary)" color="var(--color-primary)" strokeWidth={0} />
          </div>
        )}

        {wish && (
          <span style={{ position: "absolute", top: 4, left: 4, padding: badgePad, borderRadius: 999, border: "1px solid var(--state-warning-border)", background: "color-mix(in srgb, var(--state-warning-bg) 96%, transparent)", color: "var(--state-warning-fg)", fontWeight: 900, fontSize: badgeFont, lineHeight: 1 }}>WISH</span>
        )}
        {!wish && otw && (
          <span style={{ position: "absolute", top: 4, left: 4, padding: badgePad, borderRadius: 999, border: "1px solid var(--state-info-border)", background: "color-mix(in srgb, var(--state-info-bg) 96%, transparent)", color: "var(--state-info-fg)", fontWeight: 900, fontSize: badgeFont, lineHeight: 1 }}>OTW</span>
        )}
        {!wish && extraCount > 0 && (
          <span style={{ position: "absolute", right: 4, bottom: 4, minWidth: size === "modal" ? 22 : 18, height: size === "modal" ? 22 : 18, padding: size === "modal" ? "0 6px" : "0 5px", borderRadius: 999, border: "1px solid var(--state-warning-border)", background: "color-mix(in srgb, var(--state-warning-bg) 85%, var(--state-warning-border) 15%)", color: "var(--state-warning-fg)", fontWeight: 950, fontSize: badgeFont, lineHeight: size === "modal" ? "20px" : "16px", textAlign: "center" }}>+{extraCount}</span>
        )}
      </div>
    );
  };

 
   // Página 103 del PDF (Final de LayoutMiniPreview)

  return ( 
    <div 
      style={{ 
        width: preset.maxW, 
        height: preset.maxH, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        overflow: "hidden" 
      }} 
      aria-hidden="true"
      key={refreshTick} // 👈 PEGA ESTO AQUÍ: Es la "llave" que fuerza la actualización simultánea
    > 
      <div style={{ transform: `scale(${scale})`, transformOrigin: "center center", padding: preset.padding }}> 
        <div style={{ display: "flex", flexDirection: "column", gap: previewRowGap }}> 
          {rows.map((rowSlots, idx) => ( 
            <div key={idx} style={{ 
              width: rowW, 
              display: "flex", 
              gap: previewGap, 
              justifyContent: rowSlots.length < cols ? "center" : "flex-start",
              alignItems: "center", // ✅ Asegúrate de que esto esté para evitar el efecto cuadrado
              minHeight: slotH     // ✅ Y esto también
            }}> 
              {rowSlots.map((s) => ( 
                <Cell key={s} meta={thumbMap[s]} /> 
              ))} 
            </div> 
          ))}
        </div>
      </div>
    </div>
  );
};
 const PageThumb = ({ 
  pageId, 
  layoutKey, 
  active, 
  onClick, 
  title, 
  size = "carousel", 
  pageNumber, 
  draggable = false, 
  onDragStart, 
  onDragEnter,
  onDrop, 
  onDragOver, 
  onDragEnd, 
  onDragLeave, 
  showPageNumber = true, 
  onDeletePage, 
  refreshTick, 
  pageWidth,
  pageHeight,
}: {
  pageId: number;
  layoutKey: LayoutType;
  active: boolean;
  onClick: () => void;
  title: string;
  size?: "carousel" | "modal";
  pageNumber?: number;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  showPageNumber?: boolean;
  onDeletePage?: (pageId: number) => void;
  refreshTick: number;
  pageWidth?: number;
  pageHeight?: number;
}) => {

  const def = defFor(layoutKey);
  
  const cols = def.cols;
  const total = def.slots;
  // 🟢 miniaturas reales por página/slot
const thumbMap = pageThumbs[pageId] ?? {};
  // ... arriba tienes: const def = defFor(layoutKey); const cols = def.cols; etc.

const ex = getExtrasCount(layoutKey);
const baseCount = total - ex;

 return ( 
  <div 
    style={{ 
      borderRadius: 12, 
      border: active
        ? "2px solid var(--state-info-border)"
        : "1px solid var(--binder-thumb-idle-border)", 
      background: active
        ? "var(--state-info-bg)"
        : "var(--binder-thumb-idle-bg)", 
      cursor: "pointer", 
      padding: 8, 
      position: "relative", 
      transition: "all 140ms ease", 
      boxShadow: active
        ? "0 0 18px var(--binder-thumb-active-glow)"
        : "var(--binder-thumb-idle-shadow)",
    }} 
    onClick={onClick} 
    title={title} 
    draggable={draggable} 
    onDragStart={onDragStart}
    onDragEnter={onDragEnter}
    onDragOver={onDragOver} 
    onDragLeave={onDragLeave} 
    onDrop={onDrop} 
    onDragEnd={(e: React.DragEvent<HTMLDivElement>) => onDragEnd?.(e)} 
    className={`pageThumb pageThumb--${size}`} 
    data-refresh-tick={refreshTick} 
  >
{showPageNumber && typeof pageNumber === "number" ? (
  <div className="pageNumBadge" aria-hidden="true">
    {pageNumber}
  </div>
) : null}

{onDeletePage ? (
  <button
    type="button"
    className="pageDeleteBtn iconDangerHover"
    title={t('binders.actions.delete')}
    onClick={(e) => {
      e.stopPropagation();
      onDeletePage(pageId);
    }}
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 950,
    }}
  >
    ✕
  </button>
) : null}

<div
  className="pageThumbPreview"
  style={{
    aspectRatio: "1 / 1",
  }}
>

<LayoutMiniPreview 
  layoutKey={layoutKey} 
  thumbs={thumbMap} // 👈 Cambia 'thumbMap=' por 'thumbs='
  size={size === "modal" ? "modal" : "carousel"} 
  refreshTick={refreshTick} 
  pageWidth={pageWidth} 
  pageHeight={pageHeight} 
/>
</div>
{showPageNumber && typeof pageNumber === "number" ? (
  <div className="pageNumBadge" aria-hidden="true">
    {pageNumber}
  </div>
) : null}
    </div>
  );
};

 const persistPageOrder = useCallback(
    async (nextPages: Array<{ id: number; page_index: number; layout_type: LayoutType }>) => {
      if (!binderId) return { ok: false, error: "No binderId" };
      if (pageReorderBusy) return { ok: false, error: "Busy" };
      setPageReorderBusy(true);

      try {
        // Hacemos las actualizaciones UNA A UNA (secuencial) para no saturar la base de datos
        // Fase 1: Mover a zona segura temporal (índices 10000+)
        for (let i = 0; i < nextPages.length; i++) {
          const { error } = await supabase
            .from("binder_pages")
            .update({ page_index: 10000 + i })
            .eq("id", nextPages[i].id);
          if (error) throw error;
        }

        // Fase 2: Aplicar el índice real y definitivo
        for (let i = 0; i < nextPages.length; i++) {
          const { error } = await supabase
            .from("binder_pages")
            .update({ page_index: i })
            .eq("id", nextPages[i].id);
          if (error) throw error;
        }

        const normalized = nextPages.map((p, idx) => ({ ...p, page_index: idx }));
        setBinderPages(normalized);
        setPagesCount(normalized.length);
        setPageReorderBusy(false);
        return { ok: true, error: null as string | null };

      } catch (err: any) {
        setPageReorderBusy(false);
        return { ok: false, error: err.message || "Error al reordenar las páginas" };
      }
    },
    [binderId, pageReorderBusy]
  );
const deleteMultiplePages = useCallback(async () => {

if (!binderId || selectedForDeletion.length === 0) return;

if (loading || pageReorderBusy) return;

  const totalPages = binderPages.length;
  if (totalPages - selectedForDeletion.length < 1) {
    setError("Debes dejar al menos una página en el binder.");
    setStatus("Acción no permitida");
    return;
  }

  const ok = await showConfirm(
    t("common.confirm"),
    `¿Seguro que quieres borrar estas ${selectedForDeletion.length} páginas? Se perderán las cartas colocadas en ellas.`,
  );
  if (!ok) return;

  setLoading(true);
  setError(null);
  setStatus(`Borrando ${selectedForDeletion.length} páginas...`);

  // 1. Borramos las cartas de esas páginas
  const delSlots = await supabase.from("page_slots").delete().in("page_id", selectedForDeletion);
  if (delSlots.error) {
    setError(delSlots.error.message);
    setLoading(false);
    return;
  }

  // 2. Borramos las páginas
  const delPages = await supabase.from("binder_pages").delete().in("id", selectedForDeletion);
  if (delPages.error) {
    setError(delPages.error.message);
    setLoading(false);
    return;
  }

  // 3. Recargamos las páginas que quedan y las reordenamos
  const fresh = await supabase
    .from("binder_pages")
    .select("id, page_index, layout_type")
    .eq("binder_id", binderId)
    .order("page_index", { ascending: true });

  if (fresh.error) {
    setError(fresh.error.message);
    setLoading(false);
    return;
  }

  const remaining = (fresh.data ?? []).map((p: any) => ({
    id: Number(p.id),
    page_index: typeof p.page_index === "number" ? p.page_index : 0,
    layout_type: p.layout_type as LayoutType,
  }));

  const reorder = await persistPageOrder(remaining);
  if (!reorder.ok) {
    setError(reorder.error || "Error reindexando páginas");
  }

  setPagesCount(remaining.length);
  setCurrentPageIndex((prev) => Math.min(prev, Math.max(0, remaining.length - 1)));
  setRefreshTick((t) => t + 1);
  setStatus("Páginas borradas ✅ ");
  
  setDeleteMode(false);
  setSelectedForDeletion([]);
  setLoading(false);
 }, [binderId, loading, pageReorderBusy, selectedForDeletion, binderPages.length, persistPageOrder]);
const readAllPageSlotsSnapshot = useCallback(async () => { 
  const grouped: Record<
    number,
    Array<{
      slot_index: number;
      item_id: number | null;
      face: "front" | "back";
      rot: number;
      flip_h: boolean;
      is_custom: boolean;
      custom_text?: string | null;
      custom_image_url?: string | null;
      custom_back_image_url?: string | null;
      member_id?: number | null;
      is_wanted?: boolean | null;
      custom_color?: string | null; // 👈 AÑADE ESTA LÍNEA AQUÍ
    }>
  > = {};
  if (!binderId) return grouped; 

  const pagesRes = await supabase 
  .from("binder_pages") 
  .select("id") 
  .eq("binder_id", binderId); 
  
  if (pagesRes.error) return grouped; 

  const allPageIds = (pagesRes.data ?? []) 
  .map((p: any) => Number(p.id)) 
  .filter((n: number) => Number.isFinite(n)); 

  if (allPageIds.length > 0) { 
  const slotsRes = await supabase
  .from("page_slots")
  // AÑADIDO is_wanted al select
.select("slot_index, item_id, rot, flip_h, is_custom, custom_text, custom_image_url, custom_back_image_url, member_id, is_wanted, custom_color")  .eq("page_id", pageId);

  if (slotsRes.error) return grouped; 
  
  for (const row of slotsRes.data ?? []) { 
  const pid = Number((row as any).page_id); 
  if (!Number.isFinite(pid)) continue; 
  if (!grouped[pid]) grouped[pid] = []; 
  grouped[pid].push({ 
  slot_index: Number((row as any).slot_index), 
  item_id: (row as any).item_id ?? null, 
  face: (row as any).face === "back" ? "back" : "front", 
  rot: Number((row as any).rot ?? 0), 
  flip_h: Boolean((row as any).flip_h), 
  is_custom: Boolean((row as any).is_custom), 
  custom_color: (row as any).custom_color ?? null,
  custom_text: (row as any).custom_text ?? null, 
  custom_image_url: (row as any).custom_image_url ?? null, 
  custom_back_image_url: (row as any).custom_back_image_url ?? null,
  member_id: (row as any).member_id ?? null, // 👈 AÑADIDO
  is_wanted: Boolean((row as any).is_wanted) // 👈 AÑADIDO
  }); 
  } 
  } 

  if (pageId) { 
  const activePageSlots: any[] = []; 
  for (const [slotStr, item] of Object.entries(slotItems)) { 
  const slotIndex = Number(slotStr); 
  if (!item) continue; 
  const isCustom = Boolean((item as any).is_custom); 
  activePageSlots.push({ 
  slot_index: slotIndex, 
  item_id: isCustom ? null : item.id, 
  face: slotFace[slotIndex] ?? "front", 
  rot: slotRot[slotIndex] ?? 0, 
  flip_h: slotFlipH[slotIndex] ?? false, 
  is_custom: isCustom, 
  custom_text: isCustom ? ((item as any).custom_text ?? null) : null, 
  custom_image_url: isCustom ? ((item as any).custom_image_url ?? null) : null, 
  custom_back_image_url: isCustom ? ((item as any).custom_back_image_url ?? null) : null,
  member_id: (item as any).member_id ?? null, // 👈 AÑADIDO
  is_wanted: Boolean((item as any).is_wanted) // 👈 AÑADIDO
  }); 
  } 
  grouped[pageId] = activePageSlots; 
  } 
  return grouped; 
 }, [binderId, pageId, slotItems, slotFace, slotRot, slotFlipH]);

  async function pushUndoSnapshot(): Promise<void> {
    const snapshot: any = {
      binderPages: binderPages.map((p) => ({ ...p })),
      pagesCount,
      currentPageIndex,
      pageId,
      layout,
      slotItems: { ...slotItems },
      slotRot: { ...slotRot },
      slotFlipH: { ...slotFlipH },
      slotFace: { ...slotFace },
      slotCustom: { ...slotCustom },
      placedByItem: { ...placedByItem },
      allPageSlots: await readAllPageSlotsSnapshot(),
      invByItem: { ...invByItem },
      priceByItem: { ...priceByItem },
      currencyByItem: { ...currencyByItem },
      marketByItem: { ...marketByItem },
      wtsCurrencyByItem: { ...wtsCurrencyByItem },
      notesByItem: { ...notesByItem },
      wttWantedByItem: { ...wttWantedByItem },
      wttOfferByItem: { ...wttOfferByItem },
      wttOfferQtyByItem: { ...wttOfferQtyByItem },
    };

    undoStackRef.current.push(snapshot);

    if (undoStackRef.current.length > 50) {
      undoStackRef.current.shift();
    }
  }

async function doUndo(): Promise<void> { 
  const prev = undoStackRef.current.pop(); 
  if (!prev) return; 
  setError(null); 
  setStatus("Deshaciendo cambio..."); 

  if (binderId) { 
  const targetPages = prev.binderPages 
  .slice() 
  .sort((a, b) => a.page_index - b.page_index); 
  const currentPageIds = new Set(binderPages.map((p) => p.id)); 
  const targetPageIds = new Set(targetPages.map((p) => p.id)); 

  for (const p of binderPages) { 
  if (!targetPageIds.has(p.id)) { 
  await supabase.from("binder_pages").delete().eq("id", p.id); 
  } 
  } 
  for (const p of targetPages) { 
  if (!currentPageIds.has(p.id)) { 
  await supabase.from("binder_pages").upsert({ 
  id: p.id, 
  binder_id: binderId, 
  page_index: p.page_index, 
  layout_type: p.layout_type, 
  } as any); 
  } 
  } 
  await persistPageOrder(targetPages); 

  const targetPageldsList = targetPages.map((p) => p.id); 
  if (targetPageldsList.length > 0) { 
  // 1. PREPARAMOS LOS DATOS ANTES DE BORRAR
  const rowsToInsert: any[] = []; 
  for (const pid of targetPageldsList) { 
  const rows = prev.allPageSlots[pid] || []; 
  for (const row of rows) { 
  rowsToInsert.push({ 
  page_id: pid, 
  slot_index: row.slot_index, 
  item_id: row.item_id ?? null, 
  face: row.face ?? "front", 
  rot: row.rot ?? 0, 
  flip_h: row.flip_h ?? false, 
  is_custom: Boolean(row.is_custom), 
  custom_text: row.custom_text ?? null, 
  custom_image_url: row.custom_image_url ?? null, 
  custom_back_image_url: row.custom_back_image_url ?? null,
  member_id: row.member_id ?? null, // 👈 AÑADIDO
  is_wanted: Boolean(row.is_wanted) // 👈 AÑADIDO
  }); 
  } 
  } 
  // 2. AHORA SÍ, BORRAMOS Y VOLVEMOS A INSERTAR CON SEGURIDAD
  await supabase.from("page_slots").delete().in("page_id", targetPageldsList); 

  if (rowsToInsert.length > 0) { 
  const { error } = await supabase.from("page_slots").insert(rowsToInsert); 
  if (error) console.error("Error restaurando BD al deshacer:", error.message); 
  } 
  } 
  } 
  
  setBinderPages(prev.binderPages); 
  setPagesCount(prev.pagesCount); 
  setCurrentPageIndex(prev.currentPageIndex); 
  setPageId(prev.pageId); 
  setLayout(prev.layout); 
  setSlotItems(prev.slotItems); 
  setSlotRot(prev.slotRot); 
  setSlotFlipH(prev.slotFlipH); 
  setSlotFace(prev.slotFace); 
  setSlotCustom(prev.slotCustom); 
  setPlacedByItem(prev.placedByItem);
  setInvByItem(prev.invByItem); 
  setPriceByItem(prev.priceByItem); 
  setCurrencyByItem(prev.currencyByItem); 
  setMarketByItem(prev.marketByItem); 
  setWtsCurrencyByItem(prev.wtsCurrencyByItem); 
  setNotesByItem(prev.notesByItem); 
  setWttWantedByItem(prev.wttWantedByItem); 
  setWttOfferByItem(prev.wttOfferByItem); 
  setWttOfferQtyByItem(prev.wttOfferQtyByItem); 

  setStatus("Cambio deshecho ✅"); 
  setRefreshTick((t) => t + 1); 
 }
 const reorderPagesInState = useCallback(
 async (dragPageId: number, dropPageId: number) => {
  if (dragPageId === dropPageId) return;

  const cur = [...binderPages].sort((a, b) => a.page_index - b.page_index);
  const fromIdx = cur.findIndex((p) => p.id === dragPageId);
  const toIdx = cur.findIndex((p) => p.id === dropPageId);
  if (fromIdx < 0 || toIdx < 0) return;

  // ✅ guardar estado ANTES del cambio
  if (pagesOpen) {
    pushPagesModalUndoSnapshot();
  } else {
    await pushUndoSnapshot();
  }

  const next = [...cur];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);

  const res = await persistPageOrder(next);
  if (!res.ok) {
    setError(res.error || "Error reordenando páginas");
    setStatus("Error reordenando páginas");
    setRefreshTick((t) => t + 1);
  } else {
    setStatus("Orden de páginas guardado ✅");
  }
 },
 [
 binderPages,
 persistPageOrder,
 pushUndoSnapshot,
 pagesOpen,
]
);
const movePcToPageFromCarousel = useCallback(
  async (drag: DragPayload, toPageId: number) => {
    // ✅ guardar estado ANTES del cambio
   await pushUndoSnapshot();

    // 1) localizar la página destino y cuántos slots tiene
    const destPage = binderPages.find((x) => x.id === toPageId);
    if (!destPage) return;

    const def = defFor(destPage.layout_type);
    const totalSlots = def.slots;

    // 2) leer ocupación real en DB para esa página
    const { data, error } = await supabase
      .from("page_slots")
      .select("slot_index")
      .eq("page_id", toPageId);


    if (error) {
      setError(error.message);
      setStatus("Error moviendo PC");
      return;
    }

    const used = new Set<number>((data ?? []).map((r: any) => Number(r.slot_index)));
    let freeSlot: number | null = null;
    for (let i = 1; i <= totalSlots; i++) {
      if (!used.has(i)) {
        freeSlot = i;
        break;
      }
    }

    if (!freeSlot) {
      setError("No hay espacio en esa página");
      setStatus("No hay espacio en esa página");
      return;
    }

    // 3) construir payload destino (real/custom)
    const toPayload: PersistSlotPayload =
      drag.is_custom
        ? {
            kind: "custom",
            custom_text: drag.custom_text ?? "",
            custom_image_url: drag.custom_image_url ?? null,
          }
        : { kind: "real", itemId: drag.itemId };

    const toRot = Number(drag.rot ?? 0);
    const toFlip = Boolean(drag.flipH);

    // 4) vaciar origen
    const fromPayload: PersistSlotPayload = { kind: "empty" };

    await Promise.all([
      persistSlotStateForPage(toPageId, freeSlot, toPayload, toRot, toFlip),
      persistSlotStateForPage(drag.fromPageId, drag.fromSlot, fromPayload, 0, false),
    ]);

    setStatus("Movida a otra página ✅");
    setRefreshTick((t) => t + 1);
  },
  [binderPages, supabase, persistSlotStateForPage]
);
useEffect(() => { 
    let cancelled = false; 
    const run = async () => { 
      setLoading(true); 
      setError(null); 
      
      // 1. Obtenemos los datos del usuario desde Supabase
      const { data: userData, error: userErr } = await supabase.auth.getUser(); 
      
      if (userErr || !userData.user) { 
        if (!cancelled) { 
          setError(userErr?.message || "No user"); 
          setStatus("No hay sesión. Ve a /login"); 
          setLoading(false); 
        } 
        return; 
      } 
      
     const user = userData.user;
  // LEEMOS TU PLAN DE LA BASE DE DATOS
  const { data: profileData } = await supabase.from('profiles').select('plan_type, extra_pages, extra_separators').eq('user_id', user.id).single();
  
  // 2. ASIGNACIÓN DEL ID Y LÍMITES
  if (!cancelled) {
    setEmail(user.email ?? null);
    setUserId(user.id); 
    setUserPlan(profileData?.plan_type || "free");
    setExtraPages(profileData?.extra_pages || 0);
    setExtraSeparators(profileData?.extra_separators || 0);
  }

     
     // 1. Extraemos el ID real de la URL (?binderId=XX)
  const realIdFromUrl = searchParams.get("binderId");
  const bld = realIdFromUrl ? Number(realIdFromUrl) : null;

  if (bld) {
    setBinderId(bld);
   // Cambia el select para pedir también la portada (asegúrate de poner el nombre de tu columna real, yo asumo que es cover_url)
const { data: bInfo } = await supabase
  .from("binders")
  .select("title, color, cover_url") // 👈 AÑADE TU COLUMNA AQUÍ
  .eq("id", bld)
  .single();

if (bInfo) {
  setBinderTitle(bInfo.title || "Sin título");
  setBinderColor(bInfo.color || "var(--color-primary)");
  setCoverUrl(bInfo.cover_url || null); // 👈 GUÁRDALA AQUÍ
}
  }
      /* Asegurar que exista al menos una página */ 
      const pagesCheck = await supabase 
        .from("binder_pages") 
        .select("id, page_index, layout_type") 
        .eq("binder_id", bld) 
        .order("page_index", { ascending: true }); 
      
      if (pagesCheck.error) { 
        if (!cancelled) { 
          setError(pagesCheck.error.message); 
          setLoading(false); 
        } 
        return; 
      } 

      // ... resto del código de carga de slots y páginas (línea 2277 en adelante)

if (!pagesCheck.data || pagesCheck.data.length === 0) {
 const createdFirstPage = await supabase
  .from("binder_pages")
  .insert({
   binder_id: bld,
   page_index: 0,
   layout_type: "3x3",
  })
  .select("id, layout_type, page_index")
  .single();

 if (createdFirstPage.error || !createdFirstPage.data) {
  if (!cancelled) {
   setError(createdFirstPage.error?.message || "No se pudo crear la primera página");
   setLoading(false);
  }
  return;
 }
}

const { data: pageData, error: pageError } = await supabase
 .from("binder_pages")
 .select("id, layout_type, page_index")
 .eq("binder_id", bld)
 .order("page_index", { ascending: true })
 .range(currentPageIndex, currentPageIndex)
 .single();

if (pageError || !pageData) {
 if (!cancelled) {
  setError(pageError?.message || "No se encontró la página actual");
  setLoading(false);
 }
 return;
}

      setPageId(pageData.id);
      if (pageData.layout_type) {
        setLayout(pageData.layout_type as any);
      }

   
      
      if (!cancelled) setLoading(false);
    };

    void run();
    return () => { cancelled = true; };
  }, [binderFromUrlNum, currentPageIndex, refreshTick]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!binderId) return;

      const res = await supabase
        .from("binder_pages")
        .select("id, page_index, layout_type")
        .eq("binder_id", binderId)
        .order("page_index", { ascending: true });

      if (res.error) return;

      const list = (res.data ?? [])
        .map((r: { id: number; page_index: number | null; layout_type: unknown }) => ({
          id: r.id,
          page_index: typeof r.page_index === "number" ? r.page_index : 0,
          layout_type: isLayoutType(r.layout_type) ? (r.layout_type as LayoutType) : "3x3",
        }))
        .sort((a, b) => a.page_index - b.page_index);

      if (!cancelled) {
        setBinderPages(list);
        setPagesCount(list.length);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [binderId, refreshTick]); // 👈 añade refreshTick

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!binderId) return;

      const pagesRes = await supabase.from("binder_pages").select("id").eq("binder_id", binderId);
      if (pagesRes.error) return;

      const pageIds = (pagesRes.data ?? [])
        .map((r: { id: number }) => r.id)
        .filter(Boolean);
      if (pageIds.length === 0) return;

      const slotsRes = await supabase.from("page_slots").select("item_id").in("page_id", pageIds);
      if (slotsRes.error) return;

      const counts: Record<number, number> = {};
      for (const r of slotsRes.data ?? []) {
        const itemId = r.item_id as number | null;
        if (!itemId) continue;
        counts[itemId] = (counts[itemId] ?? 0) + 1;
      }

      if (!cancelled) setPlacedByItem(counts);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [binderId, pageId, refreshTick]);

 

  


  useEffect(() => { 
  let cancelled = false; 
  type PageSlotRow = { 
    slot_index: number; 
    item_id: number | null; 
    rot: number | null; 
    flip_h: boolean | null; 
    is_custom: boolean | null; 
    custom_text: string | null; 
    custom_image_url: string | null; 
    is_wanted?: boolean | null; // 👈 AÑADIDO
    custom_color?: string | null;
  }; 
  const run = async () => { 
  if (!pageId) return; 
  setError(null); 
  const slotsRes = await supabase 
  .from("page_slots") 
  // 👇 ESTA ES LA LÍNEA QUE DEBES CAMBIAR 👇
  .select("slot_index, item_id, rot, flip_h, is_custom, custom_text, custom_image_url, custom_back_image_url, member_id, is_wanted, custom_color") 
  .eq("page_id", pageId); 
  
  if (slotsRes.error) { 
  if (!cancelled) setError(slotsRes.error.message); 
  return; 
  } 
  const rows = (slotsRes.data ?? []) as PageSlotRow[]; 
  const itemIds = Array.from(
    new Set(
      rows
        .map((r) => Number(r.item_id))
        .filter((x) => Number.isFinite(x)),
    ),
  );
  const itemsById = new Map<number, SlotItem>();
  if (itemIds.length > 0) {
    const itemsRes = await supabase
  .from("items")
  .select("id, name, image_url, back_image_url, member, member_id")
  .in("id", itemIds);

if (!itemsRes.error) {
  for (const it of (itemsRes.data ?? []) as DbItemRow[]) {
    const id = Number(it.id);
    if (!Number.isFinite(id)) continue;
    itemsById.set(id, {
      id,
      name: it.name,
      ...withResolvedPcImages({
        image_url: it.image_url ?? null,
        back_image_url: it.back_image_url ?? null,
      }),
      member: it.member ?? null,
      member_id: it.member_id ?? null,
    });
  }
}
  }

  const map: Record<number, SlotItem> = {};
  const rotMap: Record<number, number> = {};
  const flipMap: Record<number, boolean> = {};

  for (const r of rows) {
    const si = r.slot_index;
    const rotRaw = Number(r.rot ?? 0);
    const rotNorm = Number.isFinite(rotRaw) ? ((rotRaw % 360) + 360) % 360 : 0;
    rotMap[si] = rotNorm;
    flipMap[si] = Boolean(r.flip_h ?? false);

    if (r.item_id) { 
    const it = itemsById.get(Number(r.item_id)); 
    map[si] = it 
    ? ({ ...it, member_id: (r as any).member_id, is_wanted: (r as any).is_wanted } as any) // 👈 AÑADIDO
    : ({ id: r.item_id, name: null, image_url: null, back_image_url: null, member_id: (r as any).member_id, is_wanted: (r as any).is_wanted } as any); // 👈 AÑADIDO
 } else if (r.is_custom) {
                  map[si] = {
                    id: -Number(`${Date.now()}${si}`),
                    name: r.custom_text || "PC personalizada",
                    is_custom: true,
                    custom_text: r.custom_text ?? "",
                    custom_image_url: r.custom_image_url ?? null,
                    custom_color: (r as any).custom_color ?? null, // 👈 ASEGÚRATE DE QUE ESTA LÍNEA ESTÉ AQUÍ
                    custom_back_image_url: (r as any).custom_back_image_url ?? null,
      member_id: (r as any).member_id ?? null,
      is_wanted: (r as any).is_wanted ?? false
    } as any;
  }
  }

  if (!cancelled) {
    setSlotItems(map);
    setSlotRot(rotMap);
    setSlotFlipH(flipMap);
    const nextFace: Record<number, "front" | "back"> = {};
    for (const s of slots) nextFace[s] = "front";
    setSlotFace(nextFace);
    setPageFace("front");
    if (userId && itemIds.length > 0) await loadInvForIds(itemIds);
  }
};

    run();
    return () => {
      cancelled = true;
    };
  }, [pageId, userId, loadInvForIds, refreshTick]);

 const changeLayout = async (next: LayoutType) => {
    if (!binderId || !pageId) return;

    setLoading(true);
    setError(null);
    setStatus("Comprobando espacios...");

    const nextDef = defFor(next);
    const affectedPageIds = applyAll ? binderPages.map(p => p.id) : [pageId];

    // 1. Obtener todos los slots actuales del binder
    const { data: allSlots, error: slotsErr } = await supabase
      .from("page_slots")
      .select("*")
      .in("page_id", binderPages.map(p => p.id));

    if (slotsErr) {
      setError("Error leyendo el binder.");
      setLoading(false);
      return;
    }

    // 2. Identificar slots que se van a quedar "fuera"
    const orphans = (allSlots || []).filter(
      s => affectedPageIds.includes(s.page_id) && s.slot_index > nextDef.slots
    );

    let newAssignments = [];
    let orphansToDelete = [];
    let newPagesCreated = 0;

    if (orphans.length > 0) {
      // 3. Calcular huecos libres actuales
      const validOccupied = new Set(
        (allSlots || [])
          .filter(s => !(affectedPageIds.includes(s.page_id) && s.slot_index > nextDef.slots))
          .map(s => `${s.page_id}_${s.slot_index}`)
      );

      const availableSlots = [];
      const orderedPages = [...binderPages].sort((a, b) => a.page_index - b.page_index);
      let maxPageIndex = orderedPages[orderedPages.length - 1]?.page_index ?? 0;

      for (const p of orderedPages) {
        const capacity = affectedPageIds.includes(p.id) ? nextDef.slots : defFor(p.layout_type).slots;
        for (let i = 1; i <= capacity; i++) {
          if (!validOccupied.has(`${p.id}_${i}`)) {
            availableSlots.push({ page_id: p.id, slot_index: i });
          }
        }
      }

      // 4. Lógica de AUTOCREACIÓN de páginas o BLOQUEO
      if (availableSlots.length < orphans.length) {
        const missingSlots = orphans.length - availableSlots.length;
        const newPageCapacity = nextDef.slots; // Asumimos que las nuevas páginas usan el formato elegido
        const pagesNeeded = Math.ceil(missingSlots / newPageCapacity);

        // Comprobamos si nos pasamos del límite gratuito
        if (binderPages.length + pagesNeeded > MAX_FREE_PAGES) {
          setLoading(false);
          setStatus("");
          const confirmBuy = await showConfirm(
            t("common.confirm"),
            `Al reducir el formato, ${orphans.length} photocards se quedan sin espacio.\n\nAñadir las páginas necesarias superaría tu límite gratuito (${MAX_FREE_PAGES} páginas).\n\n¿Quieres ampliar tu binder para realizar este cambio?`
          );
          if (confirmBuy) {
            setBuyPagesOpen(true); // Abre el modal de compra que ya tienes configurado
          }
          return; // Abortamos el proceso para no borrar cartas
        } else {
          // Hay margen para crear páginas gratis
          const confirmCreate = await showConfirm(
            t("common.confirm"),
            `Al reducir el formato, ${orphans.length} photocards necesitan un nuevo hueco.\n\nSe crearán ${pagesNeeded} página(s) nueva(s) automáticamente al final de tu binder para no perder ninguna carta.\n\n¿Deseas continuar?`
          );
          if (!confirmCreate) {
            setLoading(false);
            setStatus("");
            return;
          }

          setStatus("Creando páginas necesarias...");
          for (let i = 0; i < pagesNeeded; i++) {
            maxPageIndex++;
            const ins = await supabase
              .from("binder_pages")
              .insert({ binder_id: binderId, page_index: maxPageIndex, layout_type: next })
              .select("id")
              .single();
            
            if (!ins.error && ins.data) {
              newPagesCreated++;
              const newPageId = ins.data.id;
              // Añadir los slots recién salidos del horno a la lista de disponibles
              for (let s = 1; s <= newPageCapacity; s++) {
                availableSlots.push({ page_id: newPageId, slot_index: s });
              }
            }
          }
        }
      } else {
        // Había espacio de sobra desde el principio
        const confirm = await showConfirm(
          t("common.confirm"),
          `Al reducir el formato, ${orphans.length} photocards se moverán automáticamente a los huecos libres de tu binder.\n\n¿Deseas continuar?`
        );
        if (!confirm) {
          setLoading(false);
          setStatus("");
          return;
        }
      }

      // 5. Mapear las cartas huérfanas a sus nuevos destinos (ahora 100% garantizado que hay espacio)
      for (let i = 0; i < orphans.length; i++) {
        const orphan = orphans[i];
        const targetSlot = availableSlots[i]; 
        newAssignments.push({
          ...orphan, 
          page_id: targetSlot.page_id,
          slot_index: targetSlot.slot_index,
        });
        orphansToDelete.push(orphan);
      }
    }

    setStatus("Guardando formato...");

    // A) Actualizar formatos en DB
    if (applyAll) {
      const upd = await supabase.from("binder_pages").update({ layout_type: next }).eq("binder_id", binderId);
      if (upd.error) { setError(upd.error.message); setLoading(false); return; }
    } else {
      const upd = await supabase.from("binder_pages").update({ layout_type: next }).eq("id", pageId);
      if (upd.error) { setError(upd.error.message); setLoading(false); return; }
    }

    // B) Borrar las posiciones antiguas
    if (orphansToDelete.length > 0) {
      for(const o of orphansToDelete) {
        await supabase.from("page_slots")
          .delete()
          .eq("page_id", o.page_id)
          .eq("slot_index", o.slot_index);
      }
    }

    // C) Insertar en las nuevas posiciones
    if (newAssignments.length > 0) {
      const safeAssignments = newAssignments.map(o => ({
        page_id: o.page_id,
        slot_index: o.slot_index,
        item_id: o.item_id,
        member_id: o.member_id,
        rot: o.rot,
        flip_h: o.flip_h,
        face: o.face,
        is_custom: o.is_custom,
        custom_text: o.custom_text,
        custom_image_url: o.custom_image_url,
        custom_back_image_url: o.custom_back_image_url
      }));
      await supabase.from("page_slots").insert(safeAssignments);
    }

    // D) Fin y recarga
    setLayout(next);
    setLoading(false);
    
    // Esto fuerza al useEffect de la línea 1500 aprox. a bajarse las páginas frescas (incluyendo las nuevas)
    setRefreshTick((t) => t + 1); 

    if (newPagesCreated > 0) {
      setStatus(`Formato guardado. Se añadieron ${newPagesCreated} página(s) nueva(s).`);
    } else {
      setStatus(`Formato guardado (${applyAll ? 'todo el binder' : 'esta página'}).`);
    }
  };

 const assignItemToSlot = async (slotIndex: number, itemId: number) => {
  if (!pageId) return;
// ✅ guardar estado ANTES del cambio
    await pushUndoSnapshot();

  // Dentro de assignItemToSlot, busca el bloque if (itemId === -1)
if (itemId === -1) {
  setError(null);
  setStatus("Creando PC personalizada...");
  
  // NUEVO: Si tienes bias configurados, le asignamos el ID del primero 
  // para que el sistema le ponga el corazón automáticamente.
  const defaultMemberId = userBiases && userBiases.length > 0 ? Number(userBiases[0]) : null;

  const up = await supabase
    .from("page_slots")
    .upsert({
      page_id: pageId,
      slot_index: slotIndex,
      item_id: null,
      member_id: defaultMemberId, // 👈 Ahora ya no es null por defecto
      rot: 0,
      flip_h: false,
      is_custom: true,
      custom_text: "",
      custom_image_url: null,
      custom_back_image_url: null,
    }, { onConflict: "page_id,slot_index" });
    if (up.error) {
      setError(up.error.message);
      setStatus("Error guardando PC personalizada");
      return;
      setRefreshTick((t) => t + 1);
    }

    // UI: pintamos placeholder custom
    setSlotRot((prev) => ({ ...prev, [slotIndex]: 0 }));
    setSlotFlipH((prev) => ({ ...prev, [slotIndex]: false }));
    setSlotItems((prev) => ({
      ...prev,
      [slotIndex]: {
        id: -Date.now(),
        name: "PC personalizada",
        is_custom: true,
        member_id: defaultMemberId, // 👈 Importante para la UI inmediata
        custom_text: "",
      } as any,
    }));
}

  // ✅ Reglas para PC real
  const alreadyPlaced = (placedByItem[itemId] ?? 0) >= 1;
  const currentAssigned = slotItems[slotIndex]?.id;
  const isSame = currentAssigned === itemId;

  if (alreadyPlaced && !isSame) {
    setError(`Esta photocard (ID ${itemId}) ya está colocada en el binder. Solo puede aparecer 1 vez.`);
    setStatus("No se pudo colocar");
    return;
  }

  const counts = invByItem[itemId] ?? emptyCounts();
  const have = Number(counts.have ?? 0);
const wtt  = Number(counts.wtt ?? 0);
const wts  = Number(counts.wts ?? 0);
const otw  = Number(counts.on_its_way ?? 0);
const wish = Number(counts.wish ?? 0);


const stockTotal = have + wtt + wts + otw;
const wishFlag = wish > 0;
  // ✅ ahora permitimos colocar si tiene stock O si está marcada en wish
  if (!(stockTotal > 0 || wishFlag)) {
    setError(`No tienes stock y tampoco está marcada en Wish (ID ${itemId}).`);
    setStatus("No se pudo colocar");
    return;
  }

  setError(null);
  setStatus("Guardando en el slot...");

  const itRes = await supabase
 .from("items")
 .select("id, name, image_url, back_image_url, member_id, group_id, album_id, version, member")
 .eq("id", itemId)
 .single();

const itemMemberId =
 !itRes.error && itRes.data && (itRes.data as any).member_id != null
  ? Number((itRes.data as any).member_id)
  : null;

const up = await supabase
 .from("page_slots")
 .upsert(
 {
  page_id: pageId,
  slot_index: slotIndex,
  item_id: itemId,
  member_id: itemMemberId,
  rot: 0,
  flip_h: false,
  is_custom: false,
  custom_text: null,
  custom_image_url: null,
 },
 { onConflict: "page_id,slot_index" }
 );

if (up.error) {
 setError(up.error.message);
 setStatus("Error guardando slot");
 return;
}

setSlotRot((prev) => ({ ...prev, [slotIndex]: 0 }));
setSlotFlipH((prev) => ({ ...prev, [slotIndex]: false }));

if (!itRes.error && itRes.data) {
 const it = itRes.data as DbItemRow & { member_id?: number | null };
 const resolved = withResolvedPcImages({
  image_url: it.image_url ?? null,
  back_image_url: it.back_image_url ?? null,
 });
 setSlotItems((prev) => ({
  ...prev,
  [slotIndex]: {
  id: it.id,
  name: it.name,
  image_url: resolved.image_url ?? null,
  back_image_url: resolved.back_image_url ?? null,
    member_id: it.member_id ?? null,
    member: it.member ?? null,
  },
}));
} else {
 setSlotItems((prev) => ({
  ...prev,
  [slotIndex]: {
    id: itemId,
    name: null,
    image_url: null,
    back_image_url: null,
    member_id: null,
    member: null,
  },
}));
}

  setPlacedByItem((prev) => {
    const next = { ...prev };

    if (currentAssigned && currentAssigned !== itemId) {
      next[currentAssigned] = Math.max(0, (next[currentAssigned] ?? 0) - 1);
      if (next[currentAssigned] === 0) delete next[currentAssigned];
    }

    if (!isSame) next[itemId] = (next[itemId] ?? 0) + 1;
    return next;
  });

  setSlotFace((prev) => ({ ...prev, [slotIndex]: pageFace }));
  setStatus("Slot guardado ✅");
  setRefreshTick((t) => t + 1);
    return;
};

  const removeItemFromSlot = useCallback(
    async (slotIndex: number) => {
      if (!pageId) return;
      const assigned = slotItems[slotIndex] ?? null;
      if (!assigned) return;
      // ✅ guardar estado ANTES del cambio
      await pushUndoSnapshot();
      setError(null);
      setStatus("Quitando del slot...");

      const del = await supabase
        .from("page_slots")
        .delete()
        .eq("page_id", pageId)
        .eq("slot_index", slotIndex);

      if (del.error) {
        setError(del.error.message);
        setStatus("Error quitando del slot");
        return;
      }

      setSlotItems((prev) => {
        const next = { ...prev };
        delete next[slotIndex];
        return next;
      });

      setSlotRot((prev) => {
        const next = { ...prev };
        delete next[slotIndex];
        return next;
      });

      setSlotFlipH((prev) => {
        const next = { ...prev };
        delete next[slotIndex];
        return next;
      });

      setSlotFace((prev) => {
        const next = { ...prev };
        delete next[slotIndex];
        return next;
      });

      setPlacedByItem((prev) => {
        const next = { ...prev };
        next[assigned.id] = Math.max(0, (next[assigned.id] ?? 0) - 1);
        if (next[assigned.id] === 0) delete next[assigned.id];
        return next;
      });

      // Fuerza refresh antes de thumbnails
      setRefreshTick((t) => t + 1);

      // Borra la miniatura del estado local inmediatamente
  if (pageId) {
    setPageThumbs((prev) => {
      const next = { ...prev };
      if (next[pageId]) {
        const newThumbs = { ...next[pageId] };
        delete newThumbs[slotIndex];
        next[pageId] = newThumbs;
      }
      return next;
    });
  }
  setRefreshTick((t) => t + 1);

      // Quitar de la preview del carrusel si corresponde
      setWttCarousel((prev) => {
        if (!assigned.id) return prev;
        return prev.filter((item) => item.id !== assigned.id);
      });

      setStatus("Slot liberado ✅ ");
    },
    [pageId, slotItems]
  );

  const closePagesModal = useCallback(() => setPagesOpen(false), []);

  useEffect(() => {
    if (!pagesOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePagesModal();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pagesOpen, closePagesModal]);

const renderPagesModal = () => {
  
  const onDragStartPage = (pageId: number) => (e: React.DragEvent<HTMLDivElement>) => {
    pageDraggingRef.current = true;
    setPageDragFromId(pageId); // Marcamos el ID original
    setModalPageDragFromId(pageId); // ✅ Nuevo: para feedback visual en el modal
    setPageDragOverId(null);

    const payload: PageDragPayload = { pageId };
    lastPageDragRef.current = payload;

    const json = JSON.stringify(payload);
    setDragData(e.dataTransfer, json);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragEndPage = () => {
    pageDraggingRef.current = false;
    setPageDragFromId(null);
    setPageDragOverId(null);
  };

  const onDragEnterPage = (overPageId: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (pageDragFromId == null || pageDragFromId === overPageId) return;
    setPageDragOverId(overPageId);
  };

  const onDragOverPage = (overPageId: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (pageDragFromId == null || pageDragFromId === overPageId) return;
    setPageDragOverId(overPageId);
  };

  const onDragLeavePage = (overPageId: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // si sales del mismo, limpia
    setPageDragOverId((prev) => (prev === overPageId ? null : prev));
  };

  const onDropPage = (dropPageId: number) => async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const raw =
      e.dataTransfer.getData("application/json") ||
      e.dataTransfer.getData("text/plain");

    const p = parsePageDragPayload(raw) ?? lastPageDragRef.current;
    if (!p) return;

    await reorderPagesInState(p.pageId, dropPageId);

    pageDraggingRef.current = false;
    setPageDragFromId(null);
    setPageDragOverId(null);
  };

const ordered = binderPages.slice().sort((a, b) => a.page_index - b.page_index);

 return ( 
    <div 
      onClick={(e) => { 
        if (pageDraggingRef.current) return; 
        if (e.target === e.currentTarget) closePagesModal(); 
      }} 
      style={{ 
        position: "fixed", 
        inset: 0, 
        background: "var(--overlay-medium)", 
        zIndex: 30000, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        padding: isMobile ? "10px" : "18px", 
      }} 
      role="dialog" 
      aria-modal="true" 
    > 
      <div 
        onMouseDown={(e) => e.stopPropagation()} 
        style={{ 
          width: "min(1160px, 96vw)", 
          height: isMobile ? "90vh" : "min(820px, 92vh)", 
          background: "var(--bg-main)", 
          borderRadius: 18, 
          border: "1px solid var(--color-border)", 
          boxShadow: "0 18px 60px color-mix(in srgb, var(--text-main) 20%, transparent)", 
          overflow: "hidden", 
          display: "flex", 
          flexDirection: "column", // Cambiado de grid a flex para mejor control del espacio
        }} 
      > 
        {/* HEADER FIJO */}
        <div 
          style={{ 
            flexShrink: 0,
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between", 
            padding: isMobile ? "10px 14px" : "12px 18px", 
            borderBottom: "1px solid var(--color-border)", 
            background: "var(--bg-soft)", 
          }} 
        > 
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, minWidth: 0 }}> 
            <img 
              src="/branding/logo.png" 
              alt={t('header.logo_alt')} 
              style={{ height: isMobile ? 32 : 42, width: "auto", objectFit: "contain", flex: "0 0 auto" }} 
            /> 
            <div style={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 0 }}> 
              <div 
                style={{ 
                  fontWeight: 900, 
                  color: "var(--color-primary)", 
                  fontSize: isMobile ? 16 : 18,
                  display: "flex", 
                  gap: 8, 
                  alignItems: "center"
                }} 
              > 
             <span style={{ fontSize: isMobile ? 15 : 18 }}>{t('binders.modals.all_pages_title')}</span>
                {pageReorderBusy && ( 
                  <span style={{ fontSize: 10, color: "var(--color-primary)", opacity: 0.8 }}> 
                    {t('common.saving')} 
                  </span> 
                )} 
              </div> 
             {/* Texto "arrastra para reordenar" forzado a una sola línea */}
              <div 
                style={{ 
                  fontSize: 11, 
                  color: "var(--color-primary)", 
                  fontWeight: 800, 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 6,
                  whiteSpace: "nowrap" // 👈 Esto evita que salte de línea
                }} 
              > 
                <span 
                  style={{ 
                    fontSize: 9, 
                    padding: "1px 6px", 
                    borderRadius: 999, 
                    border: "1px solid var(--color-primary)", 
                    background: "var(--surface-frost)", 
                    color: "var(--color-primary)", 
                    fontWeight: 900, 
                  }} 
                > 
                  {t('binders.tip')} 
                </span> 
                <span style={{ whiteSpace: "nowrap" }}>{t('binders.drag_to_reorder')}</span> 
              </div>
            </div> 
          </div> 

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    
   {/* BOTONERA DE BORRADO MÚLTIPLE EN CARRUSEL */}
        {deleteMode ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "10px" }}>
            <button 
              onClick={() => { setDeleteMode(false); setSelectedForDeletion([]); }}
              style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--color-primary)", fontWeight: 800, fontSize: 12, cursor: "pointer" }}
            >{t('common.cancel')}</button>
            <button 
              onClick={deleteMultiplePages}
              disabled={selectedForDeletion.length === 0}
              style={{ padding: "6px 12px", borderRadius: 10, border: "none", background: selectedForDeletion.length > 0 ? "var(--color-primary)" : "var(--color-border)", color: "var(--bg-card)", fontWeight: 800, fontSize: 12, cursor: selectedForDeletion.length > 0 ? "pointer" : "not-allowed" }}
            >{t('binders.actions.delete')} ({selectedForDeletion.length})</button>
          </div>
        ) : (
          <button 
            type="button" 
            onClick={() => setDeleteMode(true)}
            title={t('binders.select_multiple_delete')} 
            style={{ padding: "8px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "var(--color-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "10px" }}
          >
            <Trash2 size={18} strokeWidth={2.5} />
          </button>
        )}

    {/* Los botones que ya tenías */}
    {!deleteMode && (
      <button 
        type="button" 
        onClick={() => { void doPagesModalUndo(); }} 
        title={t('binders.actions.undo')} 
        style={{ ...topBtnStyle, padding: "4px", width: 32, height: 32, justifyContent: "center" }}
      >
        <Undo2 size={16} strokeWidth={2.5} />
      </button>
    )}
    <button 
      type="button" 
      onClick={closePagesModal} 
      title={t('common.close')}
      className="iconDangerHover modalCloseBtn" 
      style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid var(--state-disabled-border)", background: "var(--bg-card)", cursor: "pointer", fontWeight: 900 }}
    >
      ✕
    </button>
  </div>
        </div> 

      {/* CUERPO CON SCROLL INDEPENDIENTE */}
<div 
  style={{ 
    flex: 1,
    padding: isMobile ? "15px 10px" : "20px", 
    overflowY: "auto", 
    overflowX: "hidden", 
    WebkitOverflowScrolling: "touch"
  }} 
> 
  <div 
    style={{ 
      display: "grid", 
      gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", 
      gap: isMobile ? "25px" : "14px", 
      alignItems: "center", // Centrado de las celdas en la grid
      width: "100%" 
    }} 
  > 
    {/* Página 134 del PDF */}
{ordered.map((p, idx) => {
  const active = idx === currentPageIndex;
  
  // ← NUEVO: Variables para el resaltado
  const isTarget = pageDragOverId === p.id || modalPageDragOverId === p.id;
  const isDraggingMe = pageDragFromId === p.id || modalPageDragFromId === p.id;
  
 return (
    <div
      key={p.id}
      draggable={!isMobile} 
      // 1. TODOS LOS EVENTOS EN LA CAJA EXTERIOR
      onDragStart={(e) => {
        if (isMobile) return;
        pageDraggingRef.current = true;
        setPageDragFromId(p.id);
        setModalPageDragFromId(p.id);
        setModalPageDragOverId(null);
        
        const payload = { pageId: p.id };
        lastPageDragRef.current = payload;
        setDragData(e.dataTransfer, JSON.stringify(payload));
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (modalPageDragFromId !== null && modalPageDragFromId !== p.id) {
          setModalPageDragOverId(p.id);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragLeave={() => {
        setModalPageDragOverId(prev => prev === p.id ? null : prev);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        
        const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
        const fromPayload = parsePageDragPayload(raw) ?? lastPageDragRef.current;
        
        // ¡REORDENAMOS SI NO ES LA MISMA PÁGINA!
        if (fromPayload && fromPayload.pageId !== p.id) {
          await reorderPagesInState(fromPayload.pageId, p.id);
        }
        
        pageDraggingRef.current = false;
        setPageDragFromId(null);
        setModalPageDragFromId(null);
        setPageDragOverId(null);
        setModalPageDragOverId(null);
      }}
      onDragEnd={() => {
        pageDraggingRef.current = false;
        setPageDragFromId(null);
        setModalPageDragFromId(null);
        setPageDragOverId(null);
        setModalPageDragOverId(null);
      }}
      // El clic de navegación también lo pasamos aquí
      onClick={() => {
        if (!pageDragFromId && !modalPageDragFromId) {
          setCurrentPageIndex(idx);
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: isMobile ? '240px' : '280px',
        aspectRatio: '3 / 4.2',
        margin: '0 auto',
        borderRadius: 12,
        cursor: 'pointer',
        border: active
          ? '3px solid var(--state-info-border)'
          : (isTarget && !isDraggingMe
          ? '2px solid var(--color-accent-blue)'
          : '1px solid var(--state-disabled-border)'),
        boxShadow: isTarget && !isDraggingMe
          ? '0 0 0 5px color-mix(in srgb, var(--color-primary) 30%, transparent), 0 0 30px color-mix(in srgb, var(--color-accent-blue) 35%, transparent)'
          : '0 10px 25px color-mix(in srgb, var(--text-main) 8%, transparent)',
        background: isTarget && !isDraggingMe ? 'var(--surface-float)' : 'var(--bg-card)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isDraggingMe ? 0.4 : 1,
        transition: 'all 160ms ease',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* 2. HALO ROSA EXTRA */}
      {isTarget && !isDraggingMe && (
        <div style={{
          position: 'absolute',
          inset: -6,
          borderRadius: 16,
          border: '3px solid var(--color-accent-blue)',
          background: 'color-mix(in srgb, var(--color-accent-blue) 25%, transparent)',
          boxShadow: '0 0 20px color-mix(in srgb, var(--color-accent-blue) 40%, transparent)',
          zIndex: 999,
          pointerEvents: 'none',
        }} />
        
      )}
{/* EL CHECKBOX VISUAL DEL CARRUSEL */}
{deleteMode && (
  <div style={{
    position: 'absolute', inset: 0, zIndex: 10,
    background: selectedForDeletion.includes(p.id) ? "color-mix(in srgb, var(--color-primary) 20%, transparent)" : "color-mix(in srgb, var(--bg-card) 40%, transparent)",
    border: selectedForDeletion.includes(p.id) ? "3px solid var(--color-primary)" : "none",
    borderRadius: "8px", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: "4px",
    pointerEvents: "none" /* 👈 ESTO ES LA CLAVE PARA QUE NO BLOQUEE EL CLIC */
  }}>
    <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: selectedForDeletion.includes(p.id) ? "var(--color-primary)" : "var(--bg-card)", border: selectedForDeletion.includes(p.id) ? "none" : "2px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bg-card)", fontSize: "10px", fontWeight: 900 }}>
      {selectedForDeletion.includes(p.id) && "✓"}
    </div>
  </div>
)}
     {/* 3. ADIÓS ESCUDO INVISIBLE: Ya podemos interactuar con el interior */}
      <div style={{ width: '100%', height: '100%' }}>
        <PageThumb
          pageId={p.id}
          layoutKey={p.layout_type}
          active={active}
          size="modal"
          pageNumber={idx + 1}
          showPageNumber={true}
          refreshTick={refreshTick}
          pageWidth={780}
          pageHeight={1100}
          title={`Ir a página ${idx + 1}`}
          onClick={() => {
            if (!pageDragFromId && !modalPageDragFromId) {
              setCurrentPageIndex(idx);
            }
          }}
          draggable={false} 
          
        
          onDeletePage={async (id) => {
            const ok = await showConfirm(
              t("common.confirm"),
              `¿Borrar la página ${idx + 1}? Se perderán los slots colocados en esa página.`,
            );
            if (ok) {
              deletePageById(id);
            }
          }}
        />
      </div>
   
      </div>

  );
})
}

  </div> 
</div>
      </div> 
    </div> 
  );};
const BuyPagesModal = () => (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setBuyPagesOpen(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay-medium)",
        zIndex: 35000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          // 👇 AQUI ESTÁN LOS CAMBIOS 👇
          width: "min(420px, 92vw)", // Antes era 1240px
          height: "auto",            // Antes era 900px (ahora se adapta al texto)
          // 👆 ---------------------- 👆
          background: "var(--bg-main)",
          borderRadius: 18,
          border: "1px solid var(--color-primary)",
          boxShadow: "0 18px 60px color-mix(in srgb, var(--color-primary) 20%, transparent)",
          overflow: "hidden",
          display: "flex",           // Mejoramos el layout a flex
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--color-primary)",
// ... el resto de tu modal sigue igual ...
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontWeight: 900, color: "var(--color-primary)" }}>{t('binders.modals.limit_reached')}</div>
        <button
          type="button"
          onClick={() => setBuyPagesOpen(false)}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--color-secondary)",
            background: "var(--bg-soft)",
            cursor: "pointer",
            fontWeight: 900,
            color: "var(--color-primary)",
          }}
          title={t('common.close')}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: 16, textAlign: "left" }}>
        <div style={{ color: "var(--color-primary)", fontWeight: 800, lineHeight: 1.4 }}>
          {t('binders.modals.max_pages_msg')}
        </div>
        <div style={{ marginTop: 8, color: "var(--text-muted)", lineHeight: 1.45 }}>
          {t('binders.modals.buy_more_pages')}
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setBuyPagesOpen(false)}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
                  border: "1px solid var(--color-accent-blue)",
              background: "var(--bg-soft)",
              cursor: "pointer",
              fontWeight: 900,
               color: "var(--color-primary)",
            }}
          >
            {t('binders.modals.not_now')}
          </button>

          <button
            type="button"
            onClick={() => {
              setBuyPagesOpen(false);
              goToPurchasePages();
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid var(--color-accent-blue)",
              background: "var(--bg-soft)",
              cursor: "pointer",
              fontWeight: 900,
              color: "var(--color-primary)",
            }}
          >
            {t('binders.modals.buy_pages_btn')}
          </button>
        </div>
      </div>
    </div>
  </div>
);
const BuySeparatorsModal = () => (
  <div
    onMouseDown={(e) => { if (e.target === e.currentTarget) setBuySeparatorsOpen(false); }}
    style={{ position: "fixed", inset: 0, background: "var(--overlay-medium)", zIndex: 35000, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
    role="dialog"
    aria-modal="true"
  >
    <div style={{ width: "min(420px, 92vw)", height: "auto", background: "var(--bg-main)", borderRadius: 18, border: "1px solid var(--color-primary)", boxShadow: "0 18px 60px color-mix(in srgb, var(--color-primary) 20%, transparent)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 900, color: "var(--color-primary)" }}>{t('binders.modals.limit_reached')}</div>
        <button type="button" onClick={() => setBuySeparatorsOpen(false)} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--color-secondary)", background: "var(--bg-soft)", cursor: "pointer", fontWeight: 900, color: "var(--color-primary)" }}>✕</button>
      </div>
      <div style={{ padding: 16, textAlign: "left" }}>
        <div style={{ color: "var(--color-primary)", fontWeight: 800, lineHeight: 1.4 }}>
          {t('binders.modals.max_separators_msg')}
        </div>
        <div style={{ marginTop: 8, color: "var(--text-muted)", lineHeight: 1.45 }}>
          {t('binders.modals.buy_more_separators')}
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" onClick={() => setBuySeparatorsOpen(false)} style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--color-accent-blue)", background: "var(--bg-soft)", cursor: "pointer", fontWeight: 900, color: "var(--color-primary)" }}>{t('binders.modals.not_now')}</button>
          <button type="button" onClick={() => { setBuySeparatorsOpen(false); router.push("/shop"); }} style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--color-accent-blue)", background: "var(--bg-soft)", cursor: "pointer", fontWeight: 900, color: "var(--color-primary)" }}>{t('binders.modals.buy_separators_btn')}</button>
        </div>
      </div>
    </div>
  </div>
);

// ======================
// MODAL: helpers + wiring
// ======================

// ✅ Persist rot/flip que funciona para real/custom/vacío (usa persistSlotState)
const persistTransformForSlotSafe = useCallback(
  async (slotIndex: number, rot: number, flipH: boolean) => {
    const assigned = slotItems[slotIndex] ?? null;
    if (!assigned) return { ok: true as const, error: null as string | null };

    if (assigned.is_custom) {
      return await persistSlotState(
        slotIndex,
        {
          kind: "custom",
          custom_text: assigned.custom_text ?? "",
          custom_image_url: assigned.custom_image_url ?? null,
        },
        rot,
        flipH
      );
    }

    return await persistSlotState(slotIndex, { kind: "real", itemId: assigned.id }, rot, flipH);
  },
  [slotItems, persistSlotState]
);

// ✅ meta + nombres para el modal (solo reales)
const modalAssigned = useMemo(() => {
  if (modalSlotIndex == null) return null;
  return slotItems[modalSlotIndex] ?? null;
}, [modalSlotIndex, slotItems]);

useEffect(() => {
  if (modalAssigned != null) setModalAssignedStable(modalAssigned);
}, [modalAssigned]);

const modalIsCustom = Boolean(modalAssigned?.is_custom);

const modalCounts = useMemo(() => {
  if (!modalAssigned || modalIsCustom) return emptyCounts();
  return invByItem[modalAssigned.id] ?? emptyCounts();
}, [modalAssigned, modalIsCustom, invByItem]);

const modalInBinder = useMemo(() => {
  if (!modalAssigned) return 0;
  if (modalIsCustom) return 1;
  return placedByItem[modalAssigned.id] ?? 0;
}, [modalAssigned, modalIsCustom, placedByItem]);

const modalFace = useMemo(() => {
  if (modalSlotIndex == null) return "front" as const;
  return slotFace[modalSlotIndex] ?? "front";
}, [modalSlotIndex, slotFace]);

// ✅ Transform REAL del slot (grid + DB)
const modalSlotRot = useMemo(() => {
  if (modalSlotIndex == null) return 0;
  return slotRot[modalSlotIndex] ?? 0;
}, [modalSlotIndex, slotRot]);

const modalSlotFlipH = useMemo(() => {
  if (modalSlotIndex == null) return false;
  return slotFlipH[modalSlotIndex] ?? false;
}, [modalSlotIndex, slotFlipH]);

useEffect(() => {
  if (modalSlotIndex == null) return;

  // Al abrir o cambiar de slot en modal, copia el estado REAL al estado de VISTA
  setModalViewRot(modalSlotRot);
  setModalViewFlipH(modalSlotFlipH);
}, [modalSlotIndex, modalSlotRot, modalSlotFlipH]);

// ✅ Transform de VISTA del modal (preview grande)
const modalRot = modalViewRot;
const modalFlipH = modalViewFlipH;

// Cache meta de item real
const modalMeta = useMemo(() => {
  if (!modalAssigned || modalIsCustom) return null;
  return itemMetaById[modalAssigned.id] ?? null;
}, [modalAssigned, modalIsCustom, itemMetaById]);

// Si no hay meta aún, la pedimos al abrir el modal
useEffect(() => {
  if (!modalAssigned || modalIsCustom) return;

  let cancelled = false;
  const run = async () => {
    const meta = await fetchItemMeta(modalAssigned.id);
    if (!meta || cancelled) return;

    if (typeof meta.group_id === "number") await fetchNameIfNeeded("groups", meta.group_id);
    if (typeof meta.album_id === "number") await fetchNameIfNeeded("albums", meta.album_id);
    // ✅ version/member ya vienen como texto: no se busca nada
  };

  run();

  return () => {
    cancelled = true;
  };
}, [modalAssigned, modalIsCustom, fetchItemMeta, fetchNameIfNeeded]);

const modalNames = useMemo(() => {
  if (modalIsCustom) return { group: "Custom", album: "—", version: "—", member: "—" };

  const g =
    typeof modalMeta?.group_id === "number"
      ? (groupNameById[modalMeta.group_id] ?? `#${modalMeta.group_id}`)
      : "—";

  const a =
    typeof modalMeta?.album_id === "number"
      ? (albumNameById[modalMeta.album_id] ?? `#${modalMeta.album_id}`)
      : "—";

  const v = modalMeta?.version ?? "—"; // ✅ texto directo
  const m = modalMeta?.member ?? "—";  // ✅ texto directo

  return { group: g, album: a, version: v, member: m };
}, [modalIsCustom, modalMeta, groupNameById, albumNameById]);

// ✅ Guardado de custom (texto/imagen) a DB y refresco UI
const saveCustomToDb = useCallback(
    async (
      slotIndex: number,
      nextText: string,
      nextFrontImgUrl: string | null,
      nextBackImgUrl: string | null,
      rot: number,
      flipH: boolean,
      forceMemberId?: number | null // 👈 NUEVO PARÁMETRO
    ) => {
      if (!pageId) return { ok: false as const, error: "No pageId" };

      // Respetamos el bias que tuviera, o guardamos el nuevo si nos lo pasan
      const currentSlot = slotItems[slotIndex];
      const midToSave = forceMemberId !== undefined ? forceMemberId : ((currentSlot as any)?.member_id ?? null);

      const up = await supabase
        .from("page_slots")
        .upsert(
          {
            page_id: pageId,
            slot_index: slotIndex,
            item_id: null,
            member_id: midToSave, // 👈 GUARDAMOS EL BIAS AQUÍ
            is_custom: true,
            custom_text: nextText,
            custom_image_url: nextFrontImgUrl,
            custom_back_image_url: nextBackImgUrl,
            rot: ((Number(rot ?? 0) % 360) + 360) % 360,
            flip_h: Boolean(flipH),
          },
          { onConflict: "page_id,slot_index" }
        );
      if (up.error) return { ok: false as const, error: up.error.message };
      return { ok: true as const, error: null as string | null };
    },
    [pageId, slotItems] // 👈 NUEVA DEPENDENCIA
  );

    

// estado local del editor custom en el modal
const [modalCustomBusy, setModalCustomBusy] = useState(false);


const modalCustomText = useMemo(() => {
  if (!modalAssigned?.is_custom) return "";
  return modalAssigned.custom_text ?? "";
}, [modalAssigned]);
const [betterPhotoBusy, setBetterPhotoBusy] = useState(false);

const submitBetterPhoto = useCallback(
  async (side: "front" | "back", file: File) => {
    if (betterPhotoBusy) return;

    // Si no hay contexto suficiente, salimos (evita crashes)
    if (!userId || !binderId || !pageId || modalSlotIndex == null || modalItemId == null) {
      console.warn("submitBetterPhoto: falta contexto (userId/binderId/pageId/modalSlotIndex/modalItemId)");
      return;
    }

    setBetterPhotoBusy(true);
    try {
      // ✅ Aquí más adelante conectaremos subida a Supabase:
      // - subir file a SUBMISSIONS_BUCKET
      // - insertar registro en una tabla (pc_submissions) con userId/binderId/pageId/itemId/slotIndex/side/url
      console.log("Better photo:", { side, name: file.name, size: file.size, modalItemId, modalSlotIndex });

    } catch (err) {
      console.error(err);
    } finally {
      setBetterPhotoBusy(false);
    }
  },
  [betterPhotoBusy, userId, binderId, pageId, modalSlotIndex, modalItemId]
);
const modalCustomImageUrl = useMemo(() => {
  if (!modalAssigned?.is_custom) return null;
  return modalAssigned.custom_image_url ?? null;
}, [modalAssigned]);
const modalCustomBackImageUrl = useMemo(() => {
  if (!modalAssigned?.is_custom) return null;
  return (modalAssigned as any).custom_back_image_url ?? null;
}, [modalAssigned]);

const [modalCustomIsBias, setModalCustomIsBias] = useState(false);

 useEffect(() => {
    if (modalAssigned?.is_custom) {
      const mid = (modalAssigned as any).member_id;
      
      // 1. Miramos si hay algo guardado en la memoria del navegador para este slot
      const localSaved = typeof window !== "undefined" ? localStorage.getItem(`customPc:bias:${modalSlotIndex}`) : null;

      if (localSaved !== null) {
        setModalCustomIsBias(localSaved === "true");
      } else {
        // Si no hay nada en memoria, usamos lo que diga la base de datos o comparamos con el contexto
        const biasList = (userBiases || []).map(Number);
        setModalCustomIsBias(mid != null && (mid === 999 || biasList.includes(Number(mid))));
      }
    } else {
      setModalCustomIsBias(false);
    }
  }, [modalAssigned, userBiases, modalSlotIndex]);

 const handleToggleCustomBias = useCallback(async (val: boolean) => {
  if (modalSlotIndex == null || !modalAssigned?.is_custom) return;

  setModalCustomIsBias(val); // Actualiza el check visualmente al instante

  // 1. Persistencia rápida en el navegador
  if (typeof window !== "undefined") {
    localStorage.setItem(`customPc:bias:${modalSlotIndex}`, String(val));
  }

  // 2. Definimos el ID: 999 si es Bias, null si no lo es
  const newMid = val ? 999 : null;

  // 3. ¡IMPORTANTE! Actualizamos el estado local del Binder para que el corazón 
  // aparezca o desaparezca sin tener que refrescar la página
  setSlotItems((prev) => ({
    ...prev,
    [modalSlotIndex]: {
      ...prev[modalSlotIndex]!,
      member_id: newMid // Esto hace que la lógica checkIsBias se dispare
    } as any
  }));

  // 4. Explosión de corazones manual si se marca
  if (val) {
    const container = document.getElementById(`hearts-container-${modalSlotIndex}`);
    if (container) {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          const h = document.createElement("div");
          h.className = "floating-heart-new";
          h.innerHTML = "❤";
          h.style.cssText = `position: absolute; bottom: 20%; left: ${Math.random() * 80 + 10}%; font-size: 28px; color: var(--state-danger-fg); text-shadow: 0 0 6px color-mix(in srgb, var(--color-secondary) 60%, transparent); z-index: 99999; pointer-events: none; animation: heartFlyUp 1.2s ease-out forwards;`;
          container.appendChild(h);
          setTimeout(() => h.remove(), 1200);
        }, i * 100);
      }
    }
  }

  // 5. Guardamos en la base de datos (con el nuevo member_id)
  await saveCustomToDb(
    modalSlotIndex,
    modalCustomText,
    modalCustomImageUrl,
    modalCustomBackImageUrl,
    modalSlotRot,
    modalSlotFlipH,
    newMid // Guardamos 999 o null
  );
}, [modalSlotIndex, modalAssigned, saveCustomToDb, modalCustomText, modalCustomImageUrl, modalCustomBackImageUrl, modalSlotRot, modalSlotFlipH]);

  const setModalCustomText = useCallback(
    async (v: string) => {
      if (modalSlotIndex == null || !modalAssigned?.is_custom) return;

      await pushModalUndoSnapshot(modalAssigned?.id ?? DUMMY_ITEM_ID);

      // Mantenemos el member_id actual al editar el texto para no perder el corazón
      const currentMid = (modalAssigned as any).member_id;

      // Optimista UI
      setSlotItems((prev) => ({
        ...prev,
        [modalSlotIndex]: {
          ...prev[modalSlotIndex]!,
          is_custom: true,
          custom_text: v,
          member_id: currentMid,
        },
      }));

      setModalCustomBusy(true);
      const res = await saveCustomToDb(
        modalSlotIndex,
        v,
        modalCustomImageUrl,
        modalCustomBackImageUrl,
        modalSlotRot,
        modalSlotFlipH,
        currentMid
      );
      setModalCustomBusy(false);

      if (!res.ok) {
        setError(res.error || "Error guardando texto custom");
        setStatus("Error guardando texto custom");
      }
    },
    [modalSlotIndex, modalAssigned, modalCustomImageUrl, modalCustomBackImageUrl, modalSlotRot, modalSlotFlipH, saveCustomToDb, pushModalUndoSnapshot]
  );
const uploadCustomImage = useCallback(
  async (file: File, slotIndex: number) => {
    if (!userId || !binderId || !pageId) return { ok: false as const, error: "No user/binder/page" };

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const safeExt = ext.match(/^(png|jpg|jpeg|webp)$/) ? ext : "jpg";

    const path =
      `${userId}/binder_${binderId}/page_${pageId}/slot_${slotIndex}/` +
      `custom_${Date.now()}.${safeExt}`;

    const up = await supabase.storage.from(CUSTOM_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
      cacheControl: "3600",
    });

    if (up.error) return { ok: false as const, error: up.error.message };

    const pub = supabase.storage.from(CUSTOM_BUCKET).getPublicUrl(path);
    const publicUrl = pub.data.publicUrl;

    if (!publicUrl) return { ok: false as const, error: "No public URL" };
    return { ok: true as const, error: null as string | null, publicUrl };
  },
  [userId, binderId, pageId]
);
const pickModalCustomImage = useCallback(

  async (file: File, side: "front" | "back") => { // ✅ Quitamos el = "front" para que TypeScript no se queje

    // 1. Validaciones iniciales de seguridad

    if (modalSlotIndex == null) return;

    if (!modalAssigned?.is_custom) return;


    // 2. Guardar estado previo para el botón Deshacer

    await pushModalUndoSnapshot(modalAssigned?.id ?? DUMMY_ITEM_ID);

    setModalCustomBusy(true);

    setStatus("Subiendo imagen…");


    // 3. Subir la imagen a Supabase

    const up = await uploadCustomImage(file, modalSlotIndex);

    if (!up.ok) {

      setModalCustomBusy(false);

      setError(up.error || "Error subiendo imagen");

      return;

    }


    const nextUrl = up.publicUrl;

    const current = slotItems[modalSlotIndex];


    // 4. Actualizar la imagen en el slot (UI local)

    setSlotItems((prev) => ({

      ...prev,

      [modalSlotIndex]: {

        ...prev[modalSlotIndex]!,

        is_custom: true,

        custom_text: modalCustomText,

        [side === "front" ? "custom_image_url" : "custom_back_image_url"]: nextUrl,

      },

    }));


    // 5. AUTO-GIRO: Forzamos la cara según el lado subido

    setSlotFace((prev) => ({ ...prev, [modalSlotIndex]: side }));


    // 6. Persistencia en Base de Datos (✅ Corregido para que no guarde 'null')

    const saved = await saveCustomToDb(

      modalSlotIndex,

      modalCustomText,

      side === "front" ? nextUrl : (current?.custom_image_url ?? null),

      side === "back" ? nextUrl : ((current as any)?.custom_back_image_url ?? null),

      modalSlotRot,

      modalSlotFlipH

    );


    setModalCustomBusy(false);


    if (!saved.ok) {

      setError(saved.error || "Error guardando configuración en DB");

    } else {

      setStatus("Imagen guardada ✅");

    }

  },

  [

    modalSlotIndex,

    modalAssigned,

    uploadCustomImage,

    saveCustomToDb,

    modalCustomText,

    modalSlotRot,

    modalSlotFlipH,

    pushModalUndoSnapshot,

    slotItems,

    setSlotFace,

    setSlotItems

  ]

);
// ✅ PASO A: helper único para subir imagen custom y devolver la URL (o null)

const clearModalCustomImage = useCallback(
 async () => {
  if (modalSlotIndex == null) return;
  if (!modalAssigned?.is_custom) return;

  await pushModalUndoSnapshot(modalAssigned?.id ?? DUMMY_ITEM_ID);

  setModalCustomBusy(true);

  setSlotItems((prev) => ({
   ...prev,
   [modalSlotIndex]: {
    ...prev[modalSlotIndex]!,
    is_custom: true,
    custom_text: modalCustomText,
    custom_image_url: null,
   },
  }));

const saved = await saveCustomToDb(
  modalSlotIndex,
  modalCustomText,
  null,
  modalCustomBackImageUrl,
  modalSlotRot,
  modalSlotFlipH
);

  setModalCustomBusy(false);

  if (!saved.ok) {
   setError(saved.error || "Error quitando imagen");
   setStatus("Error quitando imagen");
   return;
  }

  setStatus("Imagen quitada ✅ ");
 },
 [
  modalSlotIndex,
  modalAssigned,
  saveCustomToDb,
  modalCustomText,
  modalSlotRot,
  modalSlotFlipH,
  pushModalUndoSnapshot,
 ]
);
// ✅ Eliminar PC del slot (deja el hueco vacío) + persiste en DB
const clearSlot = useCallback(
  async (slotIndex: number) => {
    if (!pageId) return;

    // Optimista UI: borra asignación y estados del slot
    setSlotItems((prev) => {
      const next = { ...prev };
      delete (next as any)[slotIndex];
      return next;
    });
    setSlotRot((prev) => {
      const next = { ...prev };
      delete (next as any)[slotIndex];
      return next;
    });
    setSlotFlipH((prev) => {
      const next = { ...prev };
      delete (next as any)[slotIndex];
      return next;
    });
    setSlotFace((prev) => {
      const next = { ...prev };
      delete (next as any)[slotIndex];
      return next;
    });
    setSlotCustom((prev) => {
      const next: Record<number, SlotCustom> = { ...prev };
      delete (next as any)[slotIndex];
      return next;
    });   // Si ese slot estaba abierto en modal, cerramos
    if (modalSlotIndex === slotIndex) closeItemModal();

    // DB: elimina el registro del slot (queda vacío)
    const del = await supabase
      .from("page_slots")
      .delete()
      .eq("page_id", pageId)
      .eq("slot_index", slotIndex);

    if (del.error) {
      setError(del.error.message);
      setStatus("Error eliminando photocard");
      return;
    }
// LIBERA LA PC PARA EL PICKER: Si había una carta, restamos 1 al contador de "colocadas"
  const assigned = slotItems[slotIndex];
  if (assigned && assigned.id != null) {
    setPlacedByItem((prev) => {
      const next = { ...prev };
      const currentCount = next[assigned.id] ?? 0;
      if (currentCount > 1) {
        next[assigned.id] = currentCount - 1;
      } else {
        delete next[assigned.id];
      }
      return next;
    });
  }

  setStatus("Photocard eliminada ✅ "); // Esto ya deberías tenerlo
  
  
  // AÑADE ESTO: Borra la miniatura localmente para que desaparezca del carrusel y formato
  if (pageId) {
    setPageThumbs((prev) => {
      const next = { ...prev };
      if (next[pageId]) {
        const newThumbs = { ...next[pageId] };
        delete newThumbs[slotIndex];
        next[pageId] = newThumbs;
      }
      return next;
    });
  }
  
  },
  [pageId, modalSlotIndex, closeItemModal]
 );
 
  // ✅ SlotBox: frame cuadrado también cuando el slot está girado (horizontal individual)

// --- DISEÑO CARTEL WANTED DEFINITIVO (CORREGIDO) ---
const WesternWantedFrame = ({
  children,
  name,
  variant = "slot", // 'slot' para el grid, 'modal' para la vista grande
}: {
  children: React.ReactNode;
  name: string;
  variant?: "slot" | "modal";
}) => {
  const isSlot = variant === "slot";
  const nameLength = name?.length ?? 0;

  // --- CONFIGURACIÓN DE TAMAÑOS REALES ---
  // En el SLOT (Grid): Pequeñito para que quepa en la carta (10px o 8px si es largo)
  // En el MODAL (Info): Grande y potente (28px o 22px si es largo)
  const fontSizeConfig = isSlot 
    ? (nameLength > 12 ? "8px" : "10px") 
    : (nameLength > 12 ? "22px" : "28px");

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
      {/* Contenedor de la PC (Hueco negro) */}
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

      {/* ÁREA DEL NOMBRE: Ahora con tamaños independientes y centrados */}
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
          fontSize: fontSizeConfig, // <--- Aplicamos el tamaño corregido
          letterSpacing: isSlot ? "0px" : "-0.5px",
          pointerEvents: "none",
        }}
      >
        {name}
      </div>
    </div>
  );
};

const SlotBox = ({ 
  slotIndex, 
  invByItem, 
  emptyCounts, 
  placedByItem,
  modalZoom, // 👈 AÑADE ESTO AQUÍ
}: { 
  slotIndex: number; 
  invByItem: Record<number, StatusCounts>; 
  emptyCounts: () => StatusCounts; 
  placedByItem: Record<number, number>;
  modalZoom: number; // 👈 Y ESTO AQUÍ TAMBIÉN
}) => {
  const assigned = slotItems[slotIndex] ?? null;
  const neonOrange = "color-mix(in srgb, var(--state-warning-border) 90%, transparent)";
  const slotRef = useRef<HTMLDivElement | null>(null);
  const flipWrapRef = useRef<HTMLDivElement | null>(null);
  const itemId = assigned?.id ?? null;
   useEffect(() => {
  if (!itemId) return;
  if ((assigned as any)?.is_custom) return;
  if (itemMetaById[itemId]) return;
  void fetchItemMeta(itemId);
}, [itemId, assigned, itemMetaById, fetchItemMeta]);
const counts =
    assigned && !(assigned as any)?.is_custom && itemId
      ? (invByItem[itemId] ?? emptyCounts())
      : emptyCounts();

  const st = statusColors(counts);
  const stockTotal = stockTotalOf(counts);
  
  // 👇 NUEVA LÓGICA DE CÁLCULO DE EXTRAS 👇
  const placedCount = itemId ? (placedByItem[itemId] ?? 1) : 1; 
  const extraCount = Math.max(0, stockTotal - placedCount);
  const uiWishlist = Number(counts.wish ?? 0); //
  const isMulti = extraCount > 0;

  const prevItemRef = useRef<number | null>(itemId);

  
 // ==========================================
 // LÓGICA DE CORAZONES
 // ==========================================
 
// --- INICIO CAMBIO CORAZONES REACTIVOS ---
const isBiasPC = useMemo(() => {
  if (!assigned) return false;
  
  // 1. Extraemos el ID y el nombre directamente del objeto 'assigned'
  // Esto garantiza que si handleToggleCustomBias cambia el ID, React lo vea aquí.
  const mid = (assigned as any).member_id;
  const rawMember = (assigned as any).member ?? (assigned as any).custom_text ?? "";

  // 2. Usamos la función maestra del GlobalContext
  return checkIsBias(mid, rawMember);
}, [assigned, userBiases, checkIsBias]); 
// --- FIN CAMBIO CORAZONES REACTIVOS ---



   // Función de ráfaga
 const burstHearts = () => {
 if (!isBiasPC) return;

 const container = document.getElementById(`hearts-container-${slotIndex}`);
 if (!container) {
  return;
 }

 for (let i = 0; i < 8; i++) {
  setTimeout(() => {
    const h = document.createElement("div");
    h.className = "floating-heart-new";
    h.innerHTML = "❤";

    h.style.cssText = `
      position: absolute;
      bottom: 20%;
      left: ${Math.random() * 80 + 10}%;
      font-size: 28px;
color: var(--state-danger-fg);
text-shadow: 0 0 6px color-mix(in srgb, var(--color-secondary) 60%, transparent);
      z-index: 99999;
      pointer-events: none;
      animation: heartFlyUp 1.2s ease-out forwards;
    `;

    container.appendChild(h);
    setTimeout(() => h.remove(), 1200);
  }, i * 100);
}}
  // ==========================================
  // HASTA AQUÍ
  // ==========================================

  useEffect(() => {
    if (prevItemRef.current !== itemId) {
      slotRef.current?.animate(
        [
          { boxShadow: "0 0 0 transparent", backgroundColor: "transparent" },
          { boxShadow: "0 10px 22px var(--overlay-faint)", backgroundColor: "color-mix(in srgb, var(--state-info-bg) 80%, var(--color-accent-blue) 20%)" },
          { boxShadow: "0 0 0 transparent", backgroundColor: "transparent" },
        ],
        { duration: 260, easing: "ease-out" }
      );

      prevItemRef.current = itemId;
    }
  }, [itemId]);
  
  const face = slotFace[slotIndex] ?? "front";
  // ✅ NUEVO: cara visual (la que se anima)
const [visualFace, setVisualFace] = useState<"front" | "back">(face);
useEffect(() => {
 setVisualFace(face);
}, [itemId]);

 const rot = slotRot[slotIndex] ?? 0;
const flip = slotFlipH[slotIndex] ?? false;
const zoom = slotZoom[slotIndex] ?? loadZoomForSlot(pageId!, slotIndex); // ✅ NUEVO

const prevFaceRef = useRef<"front" | "back">(face);
const rotNorm = ((rot % 360) + 360) % 360;

// 🔥 rotación efectiva del “sleeve”: pageRotateAll (90º) + rot del slot
const sleeveBaseRot = pageRotateAll ? 90 : 0;
const sleeveRot = ((sleeveBaseRot + rotNorm) % 360 + 360) % 360;

// ✅ la carta cuenta como “quarter turn” según la rotación FINAL real
const effectiveQuarterTurn = sleeveRot % 180 !== 0;
const modalQuarterTurn = rotNorm % 180 !== 0; // si lo sigues usando en otras partes, déjalo
const useSquareFrame = effectiveQuarterTurn;



const { slotW, slotH } = getSlotDimsForLayout(layoutDef);

  // TAMAÑO NATIVO DE LA CARTA (Siempre rectangular)
  const nativeW = layoutDef.size === "special" ? slotW : pageSlotW;
  const nativeH = layoutDef.size === "special" ? slotH : pageSlotH;

  const frameW =
    layoutDef.size === "special"
      ? slotW
      : useSquareFrame
      ? pageSlotFrame
      : pageSlotW;
  const frameH =
    layoutDef.size === "special"
      ? slotH
      : useSquareFrame
      ? pageSlotFrame
      : pageSlotH;

  // Eliminamos el fitScale (ya no lo necesitamos)


const badge = assigned ? dominantBadge(counts) : { key: null, label: "", bg: "var(--bg-card)", border: "var(--state-disabled-border)" };



   // ... (unas líneas arriba tienes: const face = slotFace[slotIndex] ?? "front"; etc.)

const frontUrl = assigned?.is_custom
  ? (assigned.custom_image_url ?? undefined) 
  : (assigned?.image_url ? resolveMockPcImageUrl(assigned.image_url) : undefined);

const backUrl = assigned?.is_custom
  ? ((assigned as any).custom_back_image_url ?? DEFAULT_BACK_URL)
  : resolveMockPcBackUrl(assigned?.image_url, assigned?.back_image_url);


    







const fitThis =
  layoutDef.size === "special" ? true : Boolean(pageContainAll || slotContain[slotIndex]);




 const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
  if (!assigned) return;
  if (!pageId) return;

  const payload: DragPayload = {
    fromPageId: pageId,
    fromSlot: slotIndex,
    itemId: assigned.id,

    is_custom: Boolean((assigned as any).is_custom),
    custom_text: (assigned as any).custom_text ?? null,
    custom_image_url: (assigned as any).custom_image_url ?? null,

    rot: slotRot[slotIndex] ?? 0,
    flipH: slotFlipH[slotIndex] ?? false,
    face: (slotFace[slotIndex] ?? "front") as "front" | "back",

    name: assigned.name ?? null,
    image_url: assigned.image_url ?? null,
    back_image_url: assigned.back_image_url ?? null,
  };

  lastSlotDragRef.current = payload;
  setDragData(e.dataTransfer, JSON.stringify(payload));
};

// Busca o actualiza los handlers de Drag en el carrusel (Página 253 aprox)
const handleDragEnd = () => {
  setPageDragFromId(null);
  setPageDragOverId(null);
  pageDraggingRef.current = false;
};
const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
e.preventDefault();
e.dataTransfer.dropEffect = "move";
if (lastSlotDragRef.current) setDragOverSlot(slotIndex);
e.stopPropagation();
};

const handleDragLeave = () => {
  setDragOverSlot((cur) => (cur === slotIndex ? null : cur));
};

const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  e.stopPropagation();
  setDragOverSlot(null);

  const raw =
    e.dataTransfer.getData("application/json") ||
    e.dataTransfer.getData("text/plain");

  const p = parseDragPayload(raw) ?? lastSlotDragRef.current;
  if (!p) return;
  if (!pageId) return;

  const fromSlotNum = Number(p.fromSlot);
  if (!Number.isFinite(fromSlotNum)) return;

  // ✅ misma página: tu swap de siempre
  if (p.fromPageId === pageId) {
 await onDropSwap(p, slotIndex);
    return;
  }

  // ✅ cross-page: swap entre páginas (destino <-> origen)
  const destItem = slotItems[slotIndex] ?? null;
  const destRot = destItem ? (slotRot[slotIndex] ?? 0) : 0;
  const destFlip = destItem ? (slotFlipH[slotIndex] ?? false) : false;

  // lo que “viaja” al destino
  const toPayload: PersistSlotPayload =
    p.is_custom
      ? {
          kind: "custom",
          custom_text: p.custom_text ?? "",
          custom_image_url: p.custom_image_url ?? null,
        }
      : { kind: "real", itemId: p.itemId };

  const toRot = Number(p.rot ?? 0);
  const toFlip = Boolean(p.flipH);

  // lo que vuelve al origen (lo que hubiera en destino, o vacío)
  const fromPayload: PersistSlotPayload =
    !destItem
      ? { kind: "empty" }
      : destItem.is_custom
        ? {
            kind: "custom",
            custom_text: destItem.custom_text ?? "",
            custom_image_url: destItem.custom_image_url ?? null,
          }
        : { kind: "real", itemId: destItem.id };

  const [a, b] = await Promise.all([
    persistSlotStateForPage(pageId, slotIndex, toPayload, toRot, toFlip),
    persistSlotStateForPage(p.fromPageId, fromSlotNum, fromPayload, destRot, destFlip),
  ]);

  if (!a.ok || !b.ok) {
    setError((a.error || b.error) ?? "Error moviendo entre páginas");
    setStatus("Error moviendo entre páginas");
    setRefreshTick((t) => t + 1);
    return;
  }

  setStatus("Movida a otra página ✅ ");
  setRefreshTick((t) => t + 1);


  if (!a.ok || !b.ok) {
    setError((a.error || b.error) ?? "Error moviendo entre páginas");
    setStatus("Error moviendo entre páginas");
    setRefreshTick((t) => t + 1);
    return;
  }

  setStatus("Movida a otra página ✅ ");
  setRefreshTick((t) => t + 1);
};

    const hasRightNeighbor =
      ((slotIndex - 1) % layoutDef.cols) !== layoutDef.cols - 1 &&
      slotIndex < layoutDef.slots;

    const seamActive = hoverSeam === slotIndex;
    const isRightNeighborOfActiveSeam = hoverSeam === slotIndex - 1;

    const rightAssigned = hasRightNeighbor ? (slotItems[slotIndex + 1] ?? null) : null;
    const canCloseHere = hasRightNeighbor && !rightAssigned;

   const onRotate90 = async (e: React.MouseEvent<HTMLButtonElement>) => {
  e.stopPropagation();
  if (!assigned) return;

  const nextRot = ((rot + 90) % 360 + 360) % 360;
  setSlotRot((prev) => ({ ...prev, [slotIndex]: nextRot }));

  const res = await persistTransformForSlotSafe(slotIndex, nextRot, flip);
  if (!res.ok) {
    setError(res.error || "Error guardando rotación");
    setStatus("Error guardando rotación");
  }
};

const onRotateMinus90 = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!assigned) return;
    await pushUndoSnapshot(); // <-- AÑADIDO
    const nextRot = ((rot - 90) % 360 + 360) % 360;
  setSlotRot((prev) => ({ ...prev, [slotIndex]: nextRot }));

  const res = await persistTransformForSlotSafe(slotIndex, nextRot, flip);
  if (!res.ok) {
    setError(res.error || "Error guardando rotación");
    setStatus("Error guardando rotación");
  }
};

const onRotatePlus90 = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!assigned) return;
    await pushUndoSnapshot(); // <-- AÑADIDO
    const nextRot = ((rot + 90) % 360 + 360) % 360;

  
  setSlotRot((prev) => ({ ...prev, [slotIndex]: nextRot }));

  const res = await persistTransformForSlotSafe(slotIndex, nextRot, flip);
  if (!res.ok) {
    setError(res.error || "Error guardando rotación");
    setStatus("Error guardando rotación");
  }
};

const onFlipH = async (e: React.MouseEvent<HTMLButtonElement>) => {
  e.stopPropagation();
  if (!assigned) return;
  const nextFlip = !flip;
  setSlotFlipH((prev) => ({ ...prev, [slotIndex]: nextFlip }));

const res = await persistTransformForSlotSafe(slotIndex, rot, nextFlip);
      if (!res.ok) {
        setError(res.error || "Error guardando flip");
        setStatus("Error guardando flip");
      }
    };

    // ⇆: toggle 0/90 (ahora la rotación mueve el sleeve)
    const toggleHorizontal = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!assigned) return;

      const cur = ((slotRot[slotIndex] ?? 0) % 360 + 360) % 360;
      const nextRot = cur === 90 ? 0 : 90;

      setSlotRot((prev) => ({ ...prev, [slotIndex]: nextRot }));

const res = await persistTransformForSlotSafe(slotIndex, nextRot, flip);
      if (!res.ok) {
        setError(res.error || "Error guardando orientación");
        setStatus("Error guardando orientación");
      }
    };
const currencyPrettyLabel = (code: string) => {
  const map: Record<string, string> = {
    EUR: "Europa · EUR",
    USD: "Estados Unidos · USD",
    GBP: "Reino Unido · GBP",
    JPY: "Japón · JPY",
    KRW: "Corea del Sur · KRW",
    CNY: "China · CNY",
    AUD: "Australia · AUD",
    CAD: "Canadá · CAD",
    CHF: "Suiza · CHF",
    HKD: "Hong Kong · HKD",
    SGD: "Singapur · SGD",
    NZD: "Nueva Zelanda · NZD",
    SEK: "Suecia · SEK",
    NOK: "Noruega · NOK",
    DKK: "Dinamarca · DKK",
    INR: "India · INR",
    BRL: "Brasil · BRL",
    MXN: "México · MXN",
  };
  return map[code] ?? code;
};

const currencySelectStyle: CSSProperties = {
  height: 30,
  padding: "6px 8px",
  borderRadius: 10,
  border: "1px solid var(--color-primary)",
  background: "var(--bg-main)",
  color: "var(--color-primary)",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 12%, transparent)",
};
    const iconBtnStyle: React.CSSProperties = {
  width: 23,
  height: 23,
  borderRadius: 8,
  border: "1px solid var(--state-disabled-border)",
  background: "var(--surface-float)",
  backdropFilter: "blur(8px)",
  fontWeight: 900,
  fontSize: 13,
  color: "var(--icon-color, var(--text-muted))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: "var(--icon-shadow, 0 10px 24px var(--overlay-faint))",
};

    const seamShift = !pageRotateAll ? 14 : 0;
    const outerShift =
      seamActive ? -seamShift : isRightNeighborOfActiveSeam ? seamShift : 0;
const fx = shiftFx;
const fxActive = Boolean(fx);
const swapFxOn = Boolean(swapFxSlots[slotIndex]); // (esto ya lo tienes)

useEffect(() => {
  if (!swapFxOn) return;
  slotRef.current?.animate(
    [
      { boxShadow: "0 0 0 transparent", filter: "brightness(1)", transform: "translateZ(0)" },
      { boxShadow: "0 12px 26px color-mix(in srgb, var(--text-main) 14%, transparent)", filter: "brightness(1.03)", transform: "translateZ(0)" },
      { boxShadow: "0 0 0 transparent", filter: "brightness(1)", transform: "translateZ(0)" },
    ],
    { duration: 260, easing: "cubic-bezier(.2,.9,.2,1)" }
  );
}, [swapFxOn]);

const fxRange = useMemo(() => {
  if (!fx || !Number.isFinite(layoutDef.slots)) return null;

  const last = layoutDef.slots;
  const start = Math.max(1, Math.min(fx.at, last));
  const steps = Math.max(1, Math.floor(fx.steps));
  // En makeRoomAt(atSlot): los items se desplazan hacia la derecha desde atSlot..(last-steps)
  if (fx.kind === "make") {
    const end = Math.max(start, last - steps);
    return { start, end, dir: "right" as const };
  }

  // En closeGapAt(atSlot): los items se “corren” hacia la izquierda desde atSlot..(last-steps)
  if (fx.kind === "close") {
    const end = Math.max(start, last - steps);
    return { start, end, dir: "left" as const };
  }

  return null;
}, [fx, layoutDef.slots]);

const inFxRange =
  fxRange ? slotIndex >= fxRange.start && slotIndex <= fxRange.end : false;

// “punto de acción” donde se entiende “aquí estoy insertando/cerrando”
const isFxAnchor = fx ? slotIndex === fx.at : false;

// leve escalonado: cuanto más lejos del anchor, más tarde empieza
const fxDelayMs = fx && inFxRange ? Math.min(220, Math.abs(slotIndex - fx.at) * 28) : 0;

const fxAnim =
  fx && inFxRange
    ? fx.kind === "make"
      ? "shiftSlideRight"
      : "shiftSlideLeft"
    : "none";

  function onToggleFaceAnimated(e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
 e.stopPropagation();

 const curFace = visualFace;
 const nextFace: "front" | "back" = curFace === "front" ? "back" : "front";
 const el = flipWrapRef.current;

 if (!el) {
  setVisualFace(nextFace);
  setSlotFace((prev) => ({ ...prev, [slotIndex]: nextFace }));
  return;
 }

const base = `scaleX(${flip ? -1 : 1})`;
 const fromY = curFace === "front" ? 0 : 180;
 const toY = nextFace === "front" ? 0 : 180;

 el.getAnimations().forEach((a) => a.cancel());

 const anim = el.animate(
  [
   { transform: `${base} rotateY(${fromY}deg)` },
   { transform: `${base} rotateY(${toY}deg)` },
  ],
  {
   duration: 850,
   easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
   fill: "forwards",
  }
 );

 setVisualFace(nextFace);

 anim.finished
  .then(() => {
   setSlotFace((prev) => ({ ...prev, [slotIndex]: nextFace }));
   prevFaceRef.current = nextFace;
  })
  .catch(() => {});
}

  return (
  <div
      className="pcSlotWrap" // <--- ASEGÚRATE DE QUE TIENE ESTA CLASE
     onMouseEnter={() => {
 if (!isBiasPC) return;
 burstHearts();
}}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
   
      style={{
        width: frameW,
        height: frameH,
        borderRadius: 12,
        userSelect: "none",
        position: "relative",
        overflow: "visible",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: outerShift ? `translateX(${outerShift}px)` : "translateX(0)",
        transition: "transform 160ms ease",
      }}
    >
      {/* 1. SEAM CONTROLS (Hacer/Cerrar hueco) */}
      {hasRightNeighbor && (
        <div
          onMouseEnter={() => setHoverSeam(slotIndex)}
          onMouseLeave={() => setHoverSeam(null)}
          style={{
            animation: fxAnim !== "none" ? `${fxAnim} 260ms cubic-bezier(.2,.9,.2,1) ${fxDelayMs}ms both` : undefined,
            position: "absolute",
            left: "100%",
            top: 0,
            width: seamActive ? 44 : 12,
            height: "100%",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
          }}
          aria-hidden="true"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              opacity: seamActive ? 1 : 0,
              transform: seamActive ? "scale(1)" : "scale(0.96)",
              pointerEvents: seamActive ? "auto" : "none",
              transition: "opacity 140ms ease, transform 140ms ease",
            }}
          >
            <button
              type="button"
              disabled={isShifting || !canCloseHere}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => closeGapAtGlobal(slotIndex + 1, 1)}
              style={{
                boxShadow: "0 8px 18px var(--overlay-faint)",
                width: 26,
                height: 26,
                borderRadius: 999,
                border: "1px solid var(--state-disabled-border)",
                background: "var(--bg-card)",
                fontWeight: 900,
                cursor: isShifting || !canCloseHere ? "not-allowed" : "pointer",
                opacity: isShifting || !canCloseHere ? 0.45 : 1,
                lineHeight: 1,
              }}
            >
              ⟪
            </button>
            <button
              type="button"
              disabled={isShifting}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => makeRoomAtGlobal(slotIndex + 1, 1)}
              style={{
                boxShadow: "0 8px 18px var(--overlay-faint)",
                width: 26,
                height: 26,
                borderRadius: 999,
                border: "1px solid var(--state-disabled-border)",
                background: "var(--bg-card)",
                fontWeight: 900,
                cursor: isShifting ? "not-allowed" : "pointer",
                opacity: isShifting ? 0.45 : 1,
                lineHeight: 1,
              }}
            >
              ⟫
            </button>
          </div>
        </div>
      )}

      {/* 2. FEEDBACK ANIMACIONES (Shift/Drag) */}
      {fxActive && (inFxRange || isFxAnchor) && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: 16,
            border: isFxAnchor ? "2px solid var(--color-accent-blue)" : "1px solid color-mix(in srgb, var(--color-accent-blue) 55%, transparent)",
            boxShadow: isFxAnchor
              ? "0 0 0 6px color-mix(in srgb, var(--color-accent-blue) 16%, transparent), 0 14px 30px var(--overlay-faint)"
              : "0 0 0 4px color-mix(in srgb, var(--color-accent-blue) 10%, transparent)",
            background: isFxAnchor ? "color-mix(in srgb, var(--color-accent-blue) 8%, transparent)" : "transparent",
            pointerEvents: "none",
            opacity: isFxAnchor ? 1 : 0.9,
            animation: isFxAnchor ? "shiftPulse 520ms ease-out 1" : "none",
            zIndex: 200,
          }}
        />
      )}

      {dragOverSlot === slotIndex &&
        lastSlotDragRef.current &&
        lastSlotDragRef.current.fromSlot !== slotIndex && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: -6,
              borderRadius: 16,
              border: "2px solid color-mix(in srgb, var(--color-accent-blue) 95%, transparent)",
              background: "color-mix(in srgb, var(--color-accent-blue) 12%, transparent)",
              boxShadow: "0 18px 40px color-mix(in srgb, var(--color-accent-blue) 22%, transparent)",
              pointerEvents: "none",
              zIndex: 210,
            }}
          />
      )}

      {assigned ? (
        <>
        {/* 3. LA CARTA (BASE) */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: nativeW,
            height: nativeH,
            // La rotación se aplica al contenedor físico de la carta
            transform: `translate(-50%, -50%) rotate(${sleeveRot}deg)`,
            transformOrigin: "center center",
            transition: "transform 160ms ease",
            zIndex: 1,
          }}>

            {/* 👇 NUEVO: CARTAS EXTRA (EFECTO MAZO CON LA IMAGEN REAL) 👇 */}
            {isMulti && (
              <>
                {/* Carta inferior (más profunda) */}
                <div style={{
                  position: "absolute", inset: 0,
                  transform: "translate(6px, 6px)",
                  borderRadius: 12, border: "1px solid var(--state-disabled-fg)",
                  overflow: "hidden", 
                  // Filtro para hacerla más grisácea y oscura, dando sombra real
                  filter: "brightness(0.6) grayscale(0.2)", 
                  boxShadow: "0 8px 16px var(--overlay-soft)"
                }}>
                  <ImageWithExtensionFallback src={frontUrl || "/mock-pcs/groups/not-available.png"} style={{ width: '100%', height: '100%', objectFit: fitThis ? 'contain' : 'cover' }} alt="" />
                </div>
                
                {/* Carta intermedia */}
                <div style={{
                  position: "absolute", inset: 0,
                  transform: "translate(3px, 3px)",
                  borderRadius: 12, border: "1px solid var(--state-disabled-border)",
                  overflow: "hidden", 
                  filter: "brightness(0.8) grayscale(0.1)" // Ligeramente oscurecida
                }}>
                  <ImageWithExtensionFallback src={frontUrl || "/mock-pcs/groups/not-available.png"} style={{ width: '100%', height: '100%', objectFit: fitThis ? 'contain' : 'cover' }} alt="" />
                </div>
              </>
            )}

           {/* CARTA PRINCIPAL */}
<div style={{
  width: "100%", height: "100%",
  background: st.bg,
  borderRadius: 12, overflow: "hidden",
  boxShadow: isMulti ? "none" : "0 4px 12px color-mix(in srgb, var(--text-main) 8%, transparent)",
  border: `1.5px solid ${st.border}`,
  cursor: "pointer", position: "relative"
}}
ref={slotRef}
draggable={true}
onDragStart={handleDragStart}
onDragEnd={handleDragEnd}
onMouseEnter={() => {
  if (!isBiasPC) return;
  burstHearts();
}}
onClick={() => openItemModal(slotIndex, assigned)}
>
  <div style={{ width: "100%", height: "100%", perspective: 900 }}>
    <div
      data-flip-slot={slotIndex}
      ref={flipWrapRef}
      style={{
        width: "100%",  
        height: "100%",
        position: "absolute",
        transformStyle: "preserve-3d",
        transition: "none",
        transform: `scaleX(${flip ? -1 : 1}) rotateY(${visualFace === "front" ? 0 : 180}deg)`,
        willChange: "transform",
      }}
    >
{/* LADO FRONTAL (FRONT) */}
<div style={{
  position: "absolute", inset: 0,
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  overflow: modalZoom > 1 ? "visible" : "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
}}>
  {((z: number, item: any, wishlist: number) => {
    // 1. Definimos la imagen frontal correctamente (soporta real y custom) 
    const frontImg = item?.is_custom
      ? item.custom_image_url
      : item?.image_url;

    // 2. Lógica de título para el marco (Stray Kids / OT8 / Miembros) 
    let headerTitle = "WANTED";
    if (item) {
      const rawMember: string = String(item?.member ?? item?.custom_text ?? "");
      const memberAliases = ["bang chan", "lee know", "changbin", "hyunjin", "han", "felix", "seungmin", "i.n", "in"];
      const norm = rawMember.toLowerCase().replace(/,|\+|\/|\|/g, " ").replace(/\s+/g, " ").trim();
      const headerParts: string[] = memberAliases
        .filter((m) => (m.includes(" ") ? norm.includes(m) : new RegExp(`\\b${m}\\b`, "i").test(norm)))
        .map((m) => (m === "i.n" || m === "in" ? "I.N" : m.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")));
      
      const rawLower = rawMember.trim().toLowerCase();
      if (rawLower.includes("ot8") || rawLower.includes("all")) {
        headerTitle = "OT8";
      } else if (!headerParts.length) {
        headerTitle = rawMember || "WANTED";
      } else if (headerParts.length === 1) {
        headerTitle = headerParts[0];
      } else if (headerParts.length === 2) {
        headerTitle = `${headerParts[0]} + ${headerParts[1]}`;
      } else if (headerParts.length > 2) {
        headerTitle = `${headerParts[0]} + ${headerParts[1]}\n+ ${headerParts.length - 2} más`;
      }
    }

    // 3. Renderizado final: Con marco si es Wanted, o imagen limpia si no [cite: 1553]
    if (item?.is_wanted === true && wishlist > 0) {
      return (
        <WesternWantedFrame name={headerTitle} variant="modal">
          <img 
            src={frontImg || "/mock-pcs/groups/not-available.png"} 
            style={{ 
              width: '100%', height: '100%', 
              objectFit: z > 1 ? "contain" : "cover", 
              filter: 'sepia(0.2)',
              transform: `scale(${z})`, 
              transition: "transform 0.2s ease" 
            }} 
            alt="" 
          /> 
        </WesternWantedFrame>
      );
    } else {
      return (
        <img
          src={frontImg || "/mock-pcs/groups/not-available.png"}
          style={{
            width: '100%', height: '100%', 
            objectFit: z > 1 ? "contain" : "cover",
            transform: `scale(${z})`,
            transition: "transform 0.2s ease"
          }}
          alt=""
        />
      );
    }
  })(modalZoom, assigned, uiWishlist)} 
</div>

{/* LADO TRASERO (BACK) */}
<div style={{ 
  position: "absolute", inset: 0, transform: "rotateY(180deg)", 
  backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
  overflow: modalZoom > 1 ? "visible" : "hidden",
  display: "flex", alignItems: "center", justifyContent: "center"
}}> 
  <ImageWithExtensionFallback
    src={backUrl}
    frontSrcForBack={assigned?.is_custom ? undefined : assigned?.image_url ?? undefined}
    fallbackSrc={DEFAULT_BACK_URL}
    style={{ 
      width: "100%", height: "100%", 
      objectFit: modalZoom > 1 ? "contain" : "cover", 
      transform: `scale(${modalZoom})`,
      transition: "transform 0.2s ease" 
    }} 
    alt="" 
  /> 
</div>
   </div>
    </div>
    </div>
  </div>



   

  {/* CAPA DE CORAZONES */}
 <div
  id={`hearts-container-${slotIndex}`}
  className="heartsBurstArea"
  style={{
   position: "absolute",
   inset: 0,
   pointerEvents: "none",
   zIndex: 900,
   overflow: "visible",
  }}
 />

 {isBiasPC && (
 <button
  type="button"
  className="pcFixedHeart"
  onMouseDown={(e) => e.stopPropagation()}
  onClick={(e) => {
   e.stopPropagation();
   burstHearts();
  }}
  style={{
   position: "absolute",
   left: 8,
   bottom: 8,
   zIndex: 910,
   width: 26,
   height: 26,
   display: "flex",
   alignItems: "center",
   justifyContent: "center",
   border: "none",
   background: "transparent",
   padding: 0,
   cursor: "pointer",
  }}
 >
  <Heart size={18} fill="var(--color-primary)" color="var(--color-primary)" strokeWidth={0} />
 </button>
)}
   {/* CONTROLES (Los botones de siempre) */}
  {isMulti && (
    <div className="pcQtyBadgeCentered" style={{ zIndex: 960 }}>
      +{extraCount} {/* 👈 CAMBIADO A extraCount */}
    </div>
  )}
<div className="pcControls" onMouseDown={(e) => e.stopPropagation()} style={{ zIndex: 1000 }}>
 <button type="button" onClick={onRotateMinus90} style={iconBtnStyle}>⟲</button>
 <button type="button" onClick={onRotatePlus90} style={iconBtnStyle}>⟳</button>
 <button type="button" onClick={onToggleFaceAnimated} style={iconBtnStyle}>⇄</button>
</div>

    <div className="pcDeleteCorner" onMouseDown={(e) => e.stopPropagation()} style={{ zIndex: 950 }}>
      <button
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          const ok = await showConfirm(t("common.confirm"), "¿Eliminar esta photocard?");
          if (ok) await clearSlot(slotIndex);
        }}
        className="iconDangerHover modalCloseBtn"
        style={{ ...iconBtnStyle, width: 24, height: 24, background: 'color-mix(in srgb, var(--bg-card) 90%, transparent)' }}
      >
        ✕
      </button>
    </div>
  </>
) : (
  <button type="button" onClick={() => setPickingSlot(slotIndex)} style={{ width: '100%', height: '100%', borderRadius: 12, border: '1px dashed var(--state-info-border)', background: 'var(--state-info-bg)', fontSize: 24, color: 'var(--state-info-border)', cursor: 'pointer', zIndex: 1 }}>+</button>
)}
</div>
);
};
const anyQuarterTurn = useMemo(() => {
  if (pageRotateAll) return true;
  for (const v of Object.values(slotRot)) {
    const rotNorm = ((Number(v ?? 0) % 360) + 360) % 360;
    if (rotNorm % 180 !== 0) return true;
  }
  return false;
}, [pageRotateAll, slotRot]);

const { slotW: gridSlotW, slotH: gridSlotH, gap: baseGap, rowGap: baseRowGap } = useMemo(
  () => getSlotDimsForLayout(layoutDef),
  [layoutDef]
);

const isSpecial = (layoutDef.size ?? "pc") === "special";
const gridSlotFrame = Math.max(gridSlotW, gridSlotH);
const gridFrameW = anyQuarterTurn ? gridSlotFrame : gridSlotW;


// ✅ Más aire en special para que no se pisen
const gridGap = isSpecial
  ? Math.max(baseGap, Math.round(gridSlotFrame * 0.08))
  : Math.max(baseGap, Math.round(gridSlotFrame * 0.06));

const gridRowGap = isSpecial
  ? Math.max(baseRowGap, Math.round(gridSlotFrame * 0.10))
  : Math.max(baseRowGap, Math.round(gridSlotFrame * 0.08));

// ✅ A4 “visual” en pantalla (ajústalo a tu gusto)
const PAGE_W = 780;
const PAGE_H = 1100;
const PAGE_PAD = 18;

const contentW = PAGE_W - PAGE_PAD * 2;
const contentH = PAGE_H - PAGE_PAD * 2;





// ejemplo
const gap = isSpecial ? 22 : 12;
const rowGap = isSpecial ? 26 : 14;




  const goPrev = () => setCurrentPageIndex((p) => Math.max(0, p - 1));
const goNext = () =>
  setCurrentPageIndex((p) => Math.min(Math.max(binderPages.length - 1, 0), p + 1));
const createNewPage = useCallback(async (forcedLayout?: LayoutType) => { 
  if (!binderId) return; 
  if (loading || pageReorderBusy) return; 
  const finalLayout = forcedLayout || layout; 

  
  // 1. LEEMOS LA BASE DE DATOS EN TIEMPO REAL AL HACER CLIC
  const { data: profileData } = await supabase
    .from('profiles')
    .select('plan_type, extra_pages, extra_separators')
    .eq('user_id', userId)
    .single();


  const extrasP = profileData?.extra_pages || 0;
  const extrasS = profileData?.extra_separators || 0;
const rawPlan = (profileData?.plan_type || "free").toLowerCase().trim();
  const currentPlan = profile?.is_premium && rawPlan === 'free' ? 'mensual' : rawPlan;
  // 2. CALCULAMOS LOS LÍMITES REALES (Plan + Compras de Shop)
  const maxPages = (currentPlan === 'anual' ? 60 : currentPlan === 'mensual' ? 30 : 12) + extrasP;
  const maxSeparators = (currentPlan === 'anual' ? 30 : currentPlan === 'mensual' ? 15 : 5) + extrasS;

  const realPagesCount = binderPages.filter(p => p.layout_type !== 'separator').length; 
  const sepCount = binderPages.filter(p => p.layout_type === 'separator').length; 
  
  const isAdmin = isAdminTeamEmail(email);

  // 3. APLICAMOS EL BLOQUEO (CON INMUNIDAD ADMIN ACTIVADA 🛡️)
  if (finalLayout === 'separator') {
    if (!isAdmin && sepCount >= maxSeparators) {
      setBuySeparatorsOpen(true);
      return;
    }
  } else {
    if (!isAdmin && realPagesCount >= maxPages) {
      setBuyPagesOpen(true);
      return;
    }
  }
  
  setStatus("Creando...");
  setLoading(true);
  setLoading(true);

  // 3. El resto del código de creación sigue igual
  const lastRes = await supabase
    .from("binder_pages")
    .select("page_index")
    .eq("binder_id", binderId)
    .order("page_index", { ascending: false })
    .limit(1);

  const nextIndex = (lastRes.data?.[0]?.page_index ?? -1) + 1;

  const ins = await supabase
    .from("binder_pages")
    .insert({ binder_id: binderId, page_index: nextIndex, layout_type: finalLayout })
    .select("id")
    .single();

  if (!ins.error && ins.data) {
    const newPage = { id: ins.data.id, page_index: nextIndex, layout_type: finalLayout };
    const newBinderPages = [...binderPages, newPage].sort((a,b) => a.page_index - b.page_index);
    
    setBinderPages(newBinderPages);
    setPagesCount(newBinderPages.length);
    setCurrentPageIndex(newBinderPages.length - 1);
    
    setRefreshTick((t) => t + 1);
    setStatus(finalLayout === 'separator' ? "Separador añadido ✨" : "Página añadida ✅");
  } else {
    setError(ins.error?.message || "Error al crear");
  }
  setLoading(false);
}, [binderId, layout, binderPages, MAX_ALLOWED_PAGES, MAX_ALLOWED_SEPARATORS,loading, pageReorderBusy]);

const deletePageById = useCallback(
 async (targetPageId: number) => {
  if (!binderId) return;
  if (loading || pageReorderBusy) return;

  if (binderPages.length <= 1) {
    setError("No puedes borrar la última página del binder.");
    setStatus("Acción no permitida");
    return;
  }

  // ✅ guardar estado ANTES del cambio
  if (pagesOpen) {
    pushPagesModalUndoSnapshot();
  } else {
    await pushUndoSnapshot();
  }

  setError(null);
  setStatus("Borrando página.");
  setLoading(true);

  const delSlots = await supabase.from("page_slots").delete().eq("page_id", targetPageId);
  if (delSlots.error) {
   setError(delSlots.error.message);
   setStatus("Error borrando slots");
   setLoading(false);
   return;
  }

  const delPage = await supabase.from("binder_pages").delete().eq("id", targetPageId);
  if (delPage.error) {
   setError(delPage.error.message);
   setStatus("Error borrando página");
   setLoading(false);
   return;
  }

  const fresh = await supabase
   .from("binder_pages")
   .select("id, page_index, layout_type")
   .eq("binder_id", binderId)
   .order("page_index", { ascending: true });

  if (fresh.error) {
   setError(fresh.error.message);
   setStatus("Error leyendo páginas tras borrar");
   setLoading(false);
   return;
  }

  const remaining = (fresh.data ?? []).map((p: any) => ({
   id: Number(p.id),
   page_index: typeof p.page_index === "number" ? p.page_index : 0,
   layout_type: p.layout_type as LayoutType,
  }));

  const reorder = await persistPageOrder(remaining);
  if (!reorder.ok) {
   setError(reorder.error || "Error reindexando páginas");
   setStatus("Error reindexando páginas");
   setLoading(false);
   return;
  }

  setPagesCount(remaining.length);

  setCurrentPageIndex((prev) => {
   const ordered = remaining.slice().sort((a, b) => a.page_index - b.page_index);
   return Math.min(prev, Math.max(0, ordered.length - 1));
  });

  setRefreshTick((t) => t + 1);
 setStatus("Página borrada ✅"); 
  setLoading(false); 
 }, [ 
  binderId, 
  pageId, 
  pagesCount, 
  currentPageIndex, 
  binderPages, 
  persistPageOrder,
  // 👇 AÑADE ESTAS DOS LÍNEAS 👇
  loading,
  pageReorderBusy
 ]);

const deleteCurrentPage = useCallback(async () => {
  if (!binderId || !pageId) return;
  if (loading || pageReorderBusy) return;

  if (binderPages.length <= 1) {
    setError("No puedes borrar la última página del binder.");
    setStatus("Acción no permitida");
    return;
  }
  const ok = await showConfirm(
    t("common.confirm"),
    `¿Borrar la página ${currentPageIndex + 1}? Se perderán los slots colocados en esa página.`,
  );
  if (!ok) return;

  await deletePageById(pageId);
}, [
  binderId,
  pageId,
  loading,
  pageReorderBusy,
  binderPages.length,
  currentPageIndex,
  deletePageById,
]);
// --- LÓGICA DE MOVIMIENTO POR BOTONES (SOLO MÓVIL) ---
  const handleMobileMoveClick = async (targetPageId: number) => {
    if (!mobileMoveSourceId || mobileMoveSourceId === targetPageId) {
      setMobileMoveSourceId(null);
      return;
    }

    setStatus("Reordenando páginas...");
    if (navigator.vibrate) navigator.vibrate(50); // Pequeña vibración al confirmar

    // Ejecutamos el intercambio real en la base de datos y estado
    await reorderPagesInState(mobileMoveSourceId, targetPageId);
    
    // Limpiamos la selección
    setMobileMoveSourceId(null);
  };
function isLikelyImageUrl(u: string | null | undefined) {
  if (!u) return false;
  const clean = u.split("?")[0].toLowerCase();
  return PC_IMAGE_FILENAME_EXT_RE.test(clean);
}
function prettyLabel(s: string | null | undefined) {
  const raw = (s ?? "").trim();
  if (!raw || raw === "—") return "";
  return raw
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPrettyTitle(args: {
  isCustom: boolean;
  assigned: SlotItem;
  names: { member: string; version: string };
}) {
  if (args.isCustom) return "PC personalizada";

  const member = prettyLabel(args.names.member);
  const version = prettyLabel(args.names.version);

  const nice = [member, version].filter(Boolean).join(" · ");
  return nice || `Item ${args.assigned.id}`;
}
const clean = (s: string) =>
  (s ?? "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

const prettyText = (s: string) => {
  const raw = clean(s);
  if (!raw || raw === "—") return "";

  const keepUpper = new Set(["PC", "OT8", "WTS", "WTT", "GO", "USA", "UK", "CD", "DVD", "ID", "I.N", "SKZ", "SKZ2020"]);

  return raw
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      const upper = w.toUpperCase();
      if (keepUpper.has(upper)) return upper;
      if (/^\d/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
};

type BinderItemModalProps = {
 open: boolean;
 onClose: () => void;
 doModalUndo: () => void | Promise<void>;
 slotIndex: number;
 assigned: any;
 face: "front" | "back";
 rot: number;
 flipH: boolean;
 onToggleFace: () => void;
 onRotateLeft: () => void;
 onRotateRight: () => void;
 onToggleFlipH: () => void;
customIsBias: boolean;
  onToggleCustomBias: (v: boolean) => void;
 meta: any;
 names: any;
 counts: StatusCounts;
 inBinder: number;
// ✅ Moneda del precio WTS (independiente)
wtsCurrencyByItem: Record<number, string>;
setWtsCurrencyByItem: React.Dispatch<React.SetStateAction<Record<number, string>>>;
wtsCurrencyKey: (itemId: number) => string;
// ✅ NUEVO: abrir modal WTS automáticamente
onBecameWts: (itemId: number) => void;

  // 👇 AÑADE ESTO (NUEVO)
  onRemoveItem: () => void;
  onEditStock?: () => void;

  // Custom editing (solo si is_custom)
  customText: string;
  customImageUrl: string | null;
  onChangeCustomText: (v: string) => void;
  onPickCustomImage: (file: File, side: "front" | "back") => void;
  onClearCustomImage: () => void;

   // ✅ Better photo (solo real items)
 onSubmitBetterPhoto: (side: "front" | "back", file: File) => void;
 betterPhotoBusy?: boolean;
  // ✅ Stock modal (controlado desde padre)
 stockModalOpen: boolean;
 setStockModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
 // ✅ Modal WTS (controlado desde padre)
 wtsListingModalOpen: boolean;
 // ✅ carrusel WTT
 wttCarousel: WttCarouselItem[];
 clearWttWanted: (itemId: number) => void;
 // ✅ Notas (texto libre)
 notes: string;
 onChangeNotes: (v: string) => void;
 

  // ✅ Mercado / FX
  modalItemId: number | null;
  marketByItem: Record<number, string>;
  currencyByItem: Record<number, string>;
  fxPairKey: (base: string, target: string) => string;
  fxPairRate: Record<string, number>;
  fxPairLoading: Record<string, boolean>;
  fxPairError: Record<string, string | undefined>;
  setFxPairLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setFxPairRate: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  fetchFxPair: (base: string, target: string) => Promise<number | null>;
  // ✅ NUEVAS PROPS PARA NAVEGACIÓN
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  t: (k: string) => string;
  showAlert: (title: string, message: string) => void;
};

function BinderItemModal({
 open,
 onClose,
 doModalUndo,
 slotIndex,
 assigned,
 face,
 rot,
 flipH,
 onToggleFace,
 onRotateLeft,
 onRotateRight,
 onToggleFlipH,
 meta,
 names,
 counts: countsProp,
 inBinder,
 onRemoveItem,
  customText,
  customImageUrl,
   onChangeCustomText,
 onPickCustomImage,
 onClearCustomImage,
 onSubmitBetterPhoto,
 betterPhotoBusy = false,
 stockModalOpen,
 setStockModalOpen,
 wtsListingModalOpen,
 wttCarousel,
 clearWttWanted,
 notes,
 onChangeNotes,
 modalItemId,
 marketByItem,
 currencyByItem,
  customIsBias,
  onToggleCustomBias,

  // ✅ NUEVO – moneda independiente del precio WTS
  wtsCurrencyByItem,
  setWtsCurrencyByItem,
  wtsCurrencyKey,
  onBecameWts,
  fxPairKey,
  fxPairRate,
  fxPairLoading,
  fxPairError,
  setFxPairLoading,
  setFxPairRate,
  fetchFxPair,
  // ✅ NUEVAS PROPS PARA NAVEGACIÓN
  canPrev,
  canNext,
  onPrev,
  onNext,
  t,
  showAlert,
}: BinderItemModalProps) {

  const isCustom = Boolean(assigned?.is_custom);
  const activeItemId = !isCustom && typeof modalItemId === "number" ? modalItemId : null;
// ✅ counts “real” (estado guardado)
const counts =
  activeItemId != null
    ? (invByItem[activeItemId] ?? emptyCounts())
    : emptyCounts();
  const marketBaseCurrency = "USD";
// ✅ FX LOCAL para “Precio de mercado” (evita bucles con estado global)
const [marketFxRate, setMarketFxRate] = React.useState<number | null>(null);
const [marketFxLoading, setMarketFxLoading] = React.useState(false);
const [marketFxErr, setMarketFxErr] = React.useState<string>("");
const [wtsViewCurrency, setWtsViewCurrency] = React.useState<string>("EUR");
const [wtsFxRate, setWtsFxRate] = React.useState<number | null>(null);
const [wtsFxLoading, setWtsFxLoading] = React.useState(false);

React.useEffect(() => {
 if (!open) return;
 if (activeItemId == null) return;

 const baseCur = wtsCurrencyByItem[activeItemId] ?? "EUR";

 setWtsViewCurrency(baseCur);
 setWtsFxRate(1);
 setWtsFxLoading(false);
}, [open, activeItemId, wtsCurrencyByItem]);

React.useEffect(() => {
 if (!open) return;

 const onKeyDown = (e: KeyboardEvent) => {
  if (e.key !== "Escape") return;

  if (wtsListingModalOpen) return;

  e.preventDefault();
  e.stopPropagation();

  if (stockModalOpen) {
   setStockModalOpen(false);
   return;
  }

  onClose();
 };

 document.addEventListener("keydown", onKeyDown);
 return () => document.removeEventListener("keydown", onKeyDown);
}, [open, stockModalOpen, wtsListingModalOpen, onClose]);

// ✅ Drafts locales para no “1 letra”
const [draftPrice, setDraftPrice] = React.useState<string>("");
useEffect(() => {
  if (!open) return;
  if (!activeItemId) return;

  const v = priceByItem[activeItemId] ?? "";
  const next = String(v ?? "");

  setDraftPrice((prev) => {
    if (prev === next) return prev; // ✅ evita bucle infinito
    return next;
  });

}, [open, activeItemId, priceByItem]);
const [draftNotes, setDraftNotes] = React.useState<string>(notes ?? "");
const [draftCustomText, setDraftCustomText] = React.useState<string>(customText ?? "");
// ✅ cargar precio WTS guardado para mostrarlo (evita "—")

// ... por aquí ya tienes cosas tipo:
// const [stockModalOpen, setStockModalOpen] = useState(false);
// const counts = invByItem[activeItemId] ?? emptyCounts();
// ✅ UI face del modal (para animar sin que React lo pise)
const [modalFaceUI, setModalFaceUI] = React.useState<"front" | "back">(face);
React.useEffect(() => {
  setModalFaceUI(face);
}, [face]);
const [stockDraft, setStockDraft] = useState<StatusCounts>(emptyCounts());
const [wttDisplay, setWttDisplay] = useState(0);
const [stockDirty, setStockDirty] = useState(false);
const [stockSaving, setStockSaving] = useState(false);
const stockOpenedRef = React.useRef(false);
// ✅ inicializa el borrador solo al abrir el modal
// ⌨️ Enter = Guardar | Esc = Cancelar
useEffect(() => {
  if (!stockModalOpen) return;

  const onKeyDown = (e: KeyboardEvent) => {
    if (wtsListingModalOpen) return; // Si el modal de precio está arriba, ignora el Enter aquí
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();

    const isTextField =
      tag === "textarea" ||
      (tag === "input" &&
        !["button", "checkbox", "radio", "range", "file", "color"].includes(
          (target as HTMLInputElement)?.type
        ));

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();

      if (stockSaving) return;

      setStockModalOpen(false);
    }

    if (e.key === "Enter") {
      if (isTextField) return;

      e.preventDefault();
      e.stopPropagation();

      if (stockSaving) return;

      saveStockDraft();
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [stockModalOpen, stockSaving]);

useEffect(() => {
  if (!stockModalOpen) {
    stockOpenedRef.current = false;
    return;
  }
  if (stockOpenedRef.current) return;
  stockOpenedRef.current = true;

  if (activeItemId == null) return;
  const current = invByItem[activeItemId] ?? emptyCounts();
  const wishVal = (current as any).wish ?? (current as any).wishlist ?? 0;
  const baseDraft = {
    have: current.have ?? 0,
    wtt: current.wtt ?? 0,
    wts: current.wts ?? 0,
    on_its_way: current.on_its_way ?? 0,
  };
  const normalizedDraft = wishVal > 0
    ? { ...baseDraft, have: 0, wtt: 0, wts: 0, on_its_way: 0 }
    : baseDraft;
  setStockDraft({
    ...normalizedDraft,
    wish: wishVal,
  } as any);
  setWttDisplay(normalizedDraft.wtt ?? 0);
  setStockDirty(false);
}, [stockModalOpen, activeItemId]);
// ✅ Abrir automáticamente el modal de “Publicar venta” al marcar WTS (sin esperar a Guardar)
const wtsPromptedRef = React.useRef(false);

useEffect(() => {
  if (!stockModalOpen) {
    wtsPromptedRef.current = false;
    return;
  }
  if (activeItemId == null) return;

  const prev = invByItem[activeItemId] ?? emptyCounts();
  const prevWts = Number(prev?.wts ?? 0);
  const nextWts = Number((stockDraft as any)?.wts ?? 0);

  // Solo 1 vez por apertura del modal de stock
  if (!wtsPromptedRef.current && prevWts === 0 && nextWts > 0) {
    wtsPromptedRef.current = true;
    onBecameWts(activeItemId);
  }
}, [stockModalOpen, activeItemId, stockDraft, invByItem, onBecameWts]);
// 👇 NUEVO: CHIVATO PARA DETECTAR WTT 👇
                 const wttListingPromptedRef = React.useRef(false);
                 // ✅ Disparo inmediato del modal WTT al detectar el incremento en el borrador

  


const persistWttFlag = useCallback(async (value: number) => {
  if (!userId || activeItemId == null) return;

  // Recuperamos el país por defecto para el anuncio
  const countryValue = localStorage.getItem(`binder:market:${activeItemId}`) || "España";
  const commentValue = localStorage.getItem(`binder:wttMessage:${activeItemId}`) || ""; // 👈 AÑADE ESTO

  if (value > 0) {
    await supabase
      .from("user_item_statuses")
      .upsert([{
        user_id: userId,
        item_id: activeItemId,
        status: "wtt",
        qty: 1,
        origin_country: countryValue, 
        market_comment: commentValue // 👈 AÑADE ESTO
      }] as any, { onConflict: "user_id,item_id,status" });
  } else {
    await supabase
      .from("user_item_statuses")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", activeItemId)
      .eq("status", "wtt");
  }


    setInvByItem((prev: any) => ({
      ...prev,
      [activeItemId]: { ...(prev?.[activeItemId] ?? emptyCounts()), wtt: value > 0 ? 1 : 0 },
    }));
  },
  [userId, activeItemId, supabase]
);

// 2. Función para el flag de WISH (Lista de deseos)
const persistWishFlag = useCallback(
  async (value: number) => {
    if (!userId) return;
    if (activeItemId == null) return;

    // Guardamos snapshot para poder deshacer si es necesario
    await pushModalUndoSnapshot(activeItemId);

    if (value > 0) {
      const up = await supabase
        .from("user_item_statuses")
        .upsert(
          [{ user_id: userId, item_id: activeItemId, status: "wishlist", qty: 1 }] as any,
          { onConflict: "user_id,item_id,status" }
        );
      if (up.error) return;

      // limpia legacy "wish"
      await supabase
        .from("user_item_statuses")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", activeItemId)
        .eq("status", "wish");

      // WISH es exclusivo: borra el resto de estados reales en DB
      await supabase
        .from("user_item_statuses")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", activeItemId)
        .in("status", ["have", "wtt", "wts", "on_its_way"]);

      if (typeof activeItemId === "number") {
        clearWttWanted(activeItemId);
      }
      setWttWantDraft([]);

      // limpia trades seleccionadas y cantidad
      setWttOfferByItem((prev) => ({ ...prev, [activeItemId]: [] }));
      setWttOfferQtyByItem((prev) => ({ ...prev, [activeItemId]: 0 }));
      writeWttOffer(activeItemId, 0, []);

      // refleja también en estado local
      setInvByItem((prev: any) => ({
        ...prev,
        [activeItemId]: {
          ...(prev?.[activeItemId] ?? emptyCounts()),
          have: 0,
          wtt: 0,
          wts: 0,
          on_its_way: 0,
          wish: 1,
        },
      }));
      return;
    }

    const del = await supabase
      .from("user_item_statuses")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", activeItemId)
      .in("status", ["wish", "wishlist"]);
    if (del.error) return;

    setInvByItem((prev: any) => {
  const next = { ...prev };
  if (activeItemId != null) {
    next[activeItemId] = {
      ...(prev?.[activeItemId] ?? emptyCounts()),
      wish: value > 0 ? 1 : 0,
      // Mantenemos el valor de is_wanted si ya existía
      is_wanted: (prev?.[activeItemId] as any)?.is_wanted ?? false,
      ...(value > 0 ? { have: 0, wtt: 0, wts: 0, on_its_way: 0 } : {})
    };
  }
  return next;
});
  setRefreshTick((t) => t + 1); // Esto fuerza a que la biblioteca y el binder se redibujen [cite: 1675, 1714]
  },
  [userId, activeItemId, supabase, clearWttWanted, pushModalUndoSnapshot]
);

// 3. Función para subir imagen en PC personalizada con auto-giro
// 3. Función para subir imagen en PC personalizada con auto-giro (CORREGIDA)
// 3. Función para subir imagen en PC personalizada con auto-giro (CORREGIDA)



/// ✅ Lo que se pinta en la UI del bloque Stock
const uiCounts: StatusCounts =
  stockModalOpen ? stockDraft : counts;

// ✅ al abrir el modal, clonamos el estado actual a un borrador local
// (desactivado) sincronización automática del borrador al abrir el modal de stock
const saveStockDraft = useCallback(async () => {
 if (!userId) return;
 if (activeItemId == null) return;

 await pushModalUndoSnapshot(activeItemId);

 setStockSaving(true);
 try {
    // Normaliza: wish es 0/1
    const wishDraft = (stockDraft as any)?.wish ?? 0;
    const next = {
      have: Math.max(0, Math.floor(stockDraft.have ?? 0)),
      wtt: Math.max(0, Math.floor(stockDraft.wtt ?? 0)),
      wts: Math.max(0, Math.floor(stockDraft.wts ?? 0)),
      on_its_way: Math.max(0, Math.floor(stockDraft.on_its_way ?? 0)),
      wish: wishDraft > 0 ? 1 : 0,
    };
// ✅ detectar transición a WTS para abrir modal "Publicar venta"
const prev = invByItem[activeItemId] ?? emptyCounts();
const prevWts = Number(prev?.wts ?? 0);
const nextWts = Number(next?.wts ?? 0);
const becameWts = prevWts === 0 && nextWts > 0;
    // ✅ WISH es exclusivo: fuerza el resto a 0 al guardar
    if (next.wish > 0) {
      next.have = 0;
      next.wtt = 0;
      next.wts = 0;
      next.on_its_way = 0;
    }

    // ✅ base común para todas las filas
    const base = { user_id: userId, item_id: activeItemId };

    const rows: any[] = [];
    const toDelete: string[] = [];

   const pushRow = (status: string, qty: number) => {
    if (qty > 0) {
      let extraData = {};
      // Si estamos guardando stock de WTT, le adjuntamos el comentario
     if (status === "wtt") {
  const wttComment = localStorage.getItem(`binder:wttMessage:${activeItemId}`) || "";
  const countryVal = localStorage.getItem(`binder:market:${activeItemId}`) || "España";
  
  // 👇 MAGIA 3: Leemos directo de la memoria profunda para evitar cruces de datos
              const wttIds = readWttOffer(activeItemId).ids ?? [];
  
      extraData = { market_comment: wttComment, origin_country: countryVal, wtt_ids: wttIds };
  }
      rows.push({ ...base, status, qty, ...extraData });
    } else {
      toDelete.push(status);
    }
  };

    pushRow("have", next.have);
    pushRow("wtt", next.wtt);
    pushRow("wts", next.wts);
    pushRow("on_its_way", next.on_its_way);
    pushRow("wishlist", next.wish);

    if (rows.length) {
      const up = await supabase
        .from("user_item_statuses")
        .upsert(rows as any, { onConflict: "user_id,item_id,status" });
      if (up.error) throw new Error(up.error.message);
    }

    if (toDelete.length) {
      const del = await supabase
        .from("user_item_statuses")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", activeItemId)
        .in("status", toDelete);
      if (del.error) throw new Error(del.error.message);
    }


    // ✅ reflejar en UI (ya “commit”)
    setInvByItem((prev: any) => ({
      ...prev,
      [activeItemId]: { ...(prev?.[activeItemId] ?? emptyCounts()), ...next },
    }));

    // ✅ si WISH está activo, limpiar WTT buscados y flag
    if (next.wish > 0 && typeof activeItemId === "number") {
      clearWttWanted(activeItemId);
      setWttWantDraft([]);
      void persistWttFlag(0);
    }
    // ✅ NUEVO: Limpieza absoluta de WTT (cartas seleccionadas) si guardamos con 0
      if (next.wtt === 0 && typeof activeItemId === "number") {
        setWttOfferByItem((prev: any) => ({ ...prev, [activeItemId]: [] }));
        setWttOfferQtyByItem((prev: any) => ({ ...prev, [activeItemId]: 0 }));
        try { writeWttOffer(activeItemId, 0, []); } catch(e) {}
      }
// ✅ si acaba de activar WTS o WTT, abrimos su modal correspondiente
                // ✅ Dentro de saveStockDraft, al final del bloque try:
if (becameWts) {
  setWtsListingItemId(activeItemId);
  setWtsListingModalOpen(true);
} else if (next.wtt > 0) { // 👈 Si ha marcado WTT, abrimos directamente el modal de detalles
  setWttListingItemId(activeItemId);
  setWttListingModalOpen(true);
}
    setStockDirty(false);
    setStockModalOpen(false); // ✅ SOLO se cierra aquí
  } catch (e: any) {
    console.error(e);
    // si tienes setError/setStatus, aquí puedes avisar
    // setError(String(e?.message ?? e));
  } finally {
    setStockSaving(false);
  }
}, [userId, activeItemId, stockDraft, supabase, clearWttWanted]);
React.useEffect(() => {
  if (!open) return;

  setDraftNotes(notes ?? "");
  setDraftCustomText(customText ?? "");

  // ✅ cargar tu precio WTS guardado (para mostrarlo en “Tu precio (WTS)”)
  if (!isCustom && activeItemId != null) {
    const stored = priceByItem[activeItemId] ?? readLS(priceKey(activeItemId)) ?? "";
    setDraftPrice(String(stored ?? ""));
  }
}, [open, notes, customText, isCustom, activeItemId, priceByItem, readLS, priceKey]);

  // ✅ Zoom SOLO del modal (no del grid)
const [showTools, setShowTools] = React.useState(false);  
  const [modalZoom, setModalZoom] = React.useState<number>(1);
  React.useEffect(() => {
  if (!open) return;
  setModalZoom(1);
  }, [open, slotIndex]);

  const [savedMarketRefUsd, setSavedMarketRefUsd] = React.useState("");
  const [marketConsultLoading, setMarketConsultLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || isCustom || activeItemId == null) {
      setSavedMarketRefUsd("");
      return;
    }
    try {
      setSavedMarketRefUsd(localStorage.getItem(marketRefUsdStorageKey(activeItemId)) ?? "");
    } catch {
      setSavedMarketRefUsd("");
    }
  }, [open, isCustom, activeItemId]);

  const onConsultMarketRef = React.useCallback(async () => {
    if (activeItemId == null) return;
    setMarketConsultLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const tok = s.session?.access_token;
      if (!tok) throw new Error("login");
      const res = await fetch("/api/market-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ itemId: activeItemId }),
      });
      const data = (await res.json()) as { error?: string; usdMedian?: number };
      if (!res.ok) throw new Error(data?.error || "err");
      const n = Number(data.usdMedian);
      if (!Number.isFinite(n)) throw new Error("bad");
      const sval = String(Math.round(n * 100) / 100);
      try {
        localStorage.setItem(marketRefUsdStorageKey(activeItemId), sval);
      } catch {
        /* ignore */
      }
      setSavedMarketRefUsd(sval);
    } catch {
      showAlert(t("common.error"), t("binders.item_info.market_consult_error"));
    } finally {
      setMarketConsultLoading(false);
    }
  }, [activeItemId, showAlert, t, supabase]);

  const marketRawStr =
    open && !isCustom && activeItemId != null ? savedMarketRefUsd : "";

  const targetCurrency =
    open && !isCustom && activeItemId != null ? (currencyByItem[activeItemId] ?? "EUR") : "EUR";

  React.useEffect(() => {
  if (!open) return;
  if (isCustom) return;
  if (activeItemId == null) return;

  // USD -> USD: sin fetch
  if (targetCurrency === "USD") {
    setMarketFxRate(1);
    setMarketFxErr("");
    setMarketFxLoading(false);
    return;
  }

  let cancelled = false;

  setMarketFxLoading(true);
  setMarketFxErr("");

  fetchFxPair(marketBaseCurrency, targetCurrency)
    .then((r) => {
      if (cancelled) return;
      if (typeof r === "number" && Number.isFinite(r) && r > 0) {
        setMarketFxRate(r);
        setMarketFxErr("");
      } else {
        setMarketFxRate(null);
        setMarketFxErr("No disponible");
      }
    })
    .catch(() => {
      if (cancelled) return;
      setMarketFxRate(null);
      setMarketFxErr("No disponible");
    })
    .finally(() => {
      if (cancelled) return;
      setMarketFxLoading(false);
    });

  return () => {
    cancelled = true;
  };
}, [open, isCustom, activeItemId, targetCurrency, marketBaseCurrency, fetchFxPair]);

  const marketBaseValue = (() => {
    const raw = String(marketRawStr ?? "").replace(",", ".").trim();
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  })();

  const marketShownConverted =
    marketBaseValue == null
      ? null
      : targetCurrency === "USD"
        ? marketBaseValue
        : marketFxRate != null && Number.isFinite(marketFxRate) && marketFxRate > 0
          ? marketBaseValue * marketFxRate
          : null;
    const headerBtn: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid var(--state-disabled-border)",
    background: "var(--bg-card)",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
    color: "var(--text-main)",
  };
const [marketPrice, setMarketPrice] = useState("");
 const iconBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",

  padding: "6px 10px",
  borderRadius: 10,

  background: "var(--bg-card)",

  color: "var(--color-primary)",                 // 👈 morado del sistema
  fontWeight: 600,
  fontSize: 12,

  border: "1px solid var(--color-primary)",      // 👈 borde rosa suave

  boxShadow: "0 1px 4px color-mix(in srgb, var(--color-primary) 15%, transparent)",

  cursor: "pointer",

  transition: "all 0.15s ease",
};
const currencySelectStyle: CSSProperties = { 
  height: 30, 
  padding: "6px 8px", 
  borderRadius: 10, 
  border: "1px solid var(--color-primary)", 
  background: "var(--bg-main)", 
  color: "var(--color-primary)", 
  fontSize: 12, 
  fontWeight: 900, 
  cursor: "pointer", 
  boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 12%, transparent)", 
 };
  const dangerBtn: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--bg-soft)",
  color: "var(--color-primary)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 10px color-mix(in srgb, var(--color-primary) 10%, transparent)",
};

    const subtleCard: CSSProperties = {
  background: "var(--bg-main)",
  border: "1px solid var(--color-border)",
  borderRadius: 18,
  boxShadow: "0 8px 24px color-mix(in srgb, var(--color-primary) 10%, transparent)",
};



  if (!open) return null;
// SUSTITUYE las líneas 4532 a 4537 por este bloque:
const frontImg = isCustom ? customImageUrl : (meta?.image_url ?? null);
const backImg = isCustom
  ? ((assigned as any)?.custom_back_image_url ?? DEFAULT_BACK_URL)
  : resolveMockPcBackUrl(meta?.image_url ?? assigned?.image_url, meta?.back_image_url ?? assigned?.back_image_url);
  const modalObjectFit = modalZoom > 1 ? "contain" : "cover"; 
const currentImgUrl = face === "front" ? frontImg : backImg;
const imgUrl = face === "front" ? frontImg : backImg;
// ✅ flip “puerta” en el MODAL: animar primero y luego confirmar estado (igual que binder)
const modalFlipWrapRef = React.useRef<HTMLDivElement | null>(null);

const onToggleFaceAnimated = React.useCallback(() => {
  const curFace = modalFaceUI;
  const nextFace: "front" | "back" = curFace === "front" ? "back" : "front";

  const el = modalFlipWrapRef.current;
  if (!el) {
    setModalFaceUI(nextFace);
    onToggleFace();
    return;
  }

  const base = `scaleX(${flipH ? -1 : 1})`;
  const fromY = curFace === "front" ? 0 : 180;
  const toY = nextFace === "front" ? 0 : 180;

  el.getAnimations().forEach((a) => a.cancel());

  const anim = el.animate(
    [{ transform: `${base} rotateY(${fromY}deg)` }, { transform: `${base} rotateY(${toY}deg)` }],
    {
      duration: 850,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      fill: "forwards",
    }
  );

  // UI inmediato (se ve perfecto aunque React tarde 1 tick)
  setModalFaceUI(nextFace);

  anim.finished
    .then(() => onToggleFace()) // persiste en el slot
    .catch(() => {});
}, [modalFaceUI, flipH, onToggleFace]);


const prettyGroup = names?.group ?? "-";
const prettyAlbum = names?.album ?? "—";
const prettyVersion = prettyText(names?.version ?? "—");
// ✅ para que el marco se adapte cuando rotamos 90º/270º (igual idea que binder)



  // ✅ NUEVO: título del modal = miembro(s), con 2 líneas si hace falta
 const rawMember: string = String(names?.member ?? (names as any)?.member_name ?? "");

// ✅ parse “inteligente” para combos separados por espacio sin romper "Lee Know"
const memberAliases = [
  "bang chan",
  "lee know",
  "changbin",
  "hyunjin",
  "han",
  "felix",
  "seungmin",
  "i.n",
  "in",
];

const norm = rawMember
  .toLowerCase()
  .replace(/,|\+|\/|\|/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const headerParts: string[] = memberAliases
  .filter((m) => (m.includes(" ") ? norm.includes(m) : new RegExp(`\\b${m}\\b`, "i").test(norm)))
  .map((m) => {
    // “bang chan” → “Bang Chan”, “lee know” → “Lee Know”, “i.n” → “I.N”
    const pretty =
      m === "i.n" || m === "in"
        ? "I.N"
        : m
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
  return prettyText(pretty);
});
// ✅ alias local: BD usa "wishlist", UI puede venir como "wish"
const uiWishlist = (uiCounts as any).wishlist ?? (uiCounts as any).wish ?? 0;
const uiHave = uiCounts.have ?? 0;
const uiWttDisplay = wttOfferQtyForModal;
const uiWts = uiCounts.wts ?? 0;
const uiOtw = uiCounts.on_its_way ?? 0;

// ✅ helper mini para no repetir estilos
const chipStyle = (border: string, bg: string, color: string) => ({
  fontSize: 11,
  padding: "2px 10px",
  borderRadius: 999,
  border,
  background: bg,
  color,
  fontWeight: 900,
  letterSpacing: 0.3,
});

const headerTitle = (() => {
  if (isCustom) return "PC personalizada";

  const raw = rawMember.trim();
  const rawLower = raw.toLowerCase();

  const isOT8 =
    rawLower.includes("ot8") ||
    rawLower.includes("all") ||
    rawLower.includes("all members") ||
    rawLower.includes("stray kids");

  if (isOT8) {
    return "OT8";
  }

  const fallbackPrettyMember = prettyText(rawMember || names?.member || (names as any)?.member_name || "").trim();

  if (!headerParts.length) {
    return fallbackPrettyMember || "Photocard";
  }

  if (headerParts.length === 1) return headerParts[0];
  if (headerParts.length === 2) return `${headerParts[0]} + ${headerParts[1]}`;
  return `${headerParts[0]} + ${headerParts[1]}\n+ ${headerParts.length - 2} más`;
})();

  const rightPanelContent = !isCustom ? (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ ...subtleCard, padding: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div style={{ fontWeight: 950, color: "var(--color-primary)" }}>{t("binders.item_info.info_title")}</div>

          <button
            type="button"
            onClick={async () => {
              const ok = await showConfirm(t("common.confirm"), "¿Eliminar esta photocard del slot?");
              if (!ok) return;
              onRemoveItem();
            }}
            style={dangerBtn}
            title={t('binders.remove_pc')}
          >
            🗑
          </button>
        </div>

        <div style={{ display: "grid", rowGap: 10 }}>
          {[
            { k: t("binders.picker.group"), v: prettyGroup },
            { k: t("binders.picker.album"), v: prettyAlbum },
            { k: t("binders.picker.version"), v: prettyVersion },
          ].map((r) => (
            <div
              key={r.k}
              style={{
                display: "grid",
                gridTemplateColumns: "90px 1fr",
                alignItems: "center",
                columnGap: 10,
                padding: "6px 2px",
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-primary)" }}>{r.k}</div>
              <div
                style={{
                  fontWeight: 950,
                  color: "var(--text-main)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "left",
                }}
                title={r.v}
              >
                {r.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stock + precio (mismo patrón visual que library) */}
      <div style={{ ...subtleCard, padding: 14 }}>
        <div style={{ fontWeight: 950, marginBottom: 10, color: "var(--color-primary)" }}>
          {t("binders.item_info.price_title")}
        </div>
        <div className="library-stock-row" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 950, marginBottom: 10, color: "var(--color-primary)" }}>
              {t("library.stock_title")}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-main)", lineHeight: 1.7 }}>
              {t("library.status_have")}: <b>{uiCounts.have}</b>
              <br />
              {t("binders.statuses.wtt")}: <b>{uiWttDisplay}</b>
              <br />
              {t("binders.statuses.wts")}: <b>{uiCounts.wts}</b>
              <br />
              {t("library.status_otw")}: <b>{uiCounts.on_its_way}</b>
              <br />
              {t("library.status_wish")}: <b>{uiWishlist}</b>
            </div>
  {/* Checkbox WISH debajo del stock */}

  <label style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginTop: 10,
    padding: "8px 10px", borderRadius: 10, border: "1px solid var(--state-disabled-border)",
    background: "var(--bg-card)", cursor: "pointer"
  }}>
    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-main)" }}>{t('binders.statuses.wish')} </span>
    <input
      type="checkbox"
      checked={uiWishlist > 0}
      onChange={async (e) => {
        const checked = e.target.checked;
        persistWishFlag(checked ? 1 : 0);
        // Si se desactiva WISH, también quitamos la decoración
        if (!checked && (assigned as any)?.is_wanted) {
          setSlotItems(prev => ({
            ...prev,
            [modalSlotIndex!]: { ...prev[modalSlotIndex!]!, is_wanted: false } as any
          }));
          await supabase.from("page_slots").update({ is_wanted: false }).eq("page_id", pageId).eq("slot_index", modalSlotIndex);
          setRefreshTick(t => t + 1);
        }
      }}
      style={{ width: 18, height: 18, accentColor: "var(--color-primary)", cursor: "pointer" }}
    />
  </label>


  {/* Botón "Añadir decoración" persistente: visible si WISH está activo o la decoración está puesta */}
  {/* Botón "Añadir decoración" persistente: visible si WISH está activo o la decoración está puesta */}
  {(uiWishlist > 0 || (assigned as any)?.is_wanted) && (
    <label style={{
      marginTop: "4px", padding: "10px 12px",
      backgroundColor: "var(--bg-main)", borderRadius: "14px",
      border: "1px dashed var(--color-primary)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      cursor: "pointer", transition: "all 0.2s ease"
    }}>
      <span style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)" }}>{t('binders.actions.add_decoration')}</span>
      <input
        type="checkbox"
        style={{ width: "16px", height: "16px", accentColor: "var(--color-primary)", cursor: "pointer" }}
        checked={!!(assigned as any)?.is_wanted}
       // Localiza el checkbox "Añadir decoración" en la página 163 del PDF
onChange={async (e) => {
  const val = e.target.checked;
  
  // 1. Actualizamos el "cerebro" del Grid principal
  setSlotItems(prev => ({ 
    ...prev, 
    [modalSlotIndex!]: { ...prev[modalSlotIndex!]!, is_wanted: val } as any 
  }));

  // 2. ACTUALIZAMOS EL "CEREBRO" DEL CARRUSEL (¡Esto es lo que faltaba!)
  if (pageId != null && modalSlotIndex != null) {
    setPageThumbs(prev => {
      const next = { ...prev };
      if (next[pageId] && next[pageId][modalSlotIndex]) {
        next[pageId] = {
          ...next[pageId],
          [modalSlotIndex]: {
            ...next[pageId][modalSlotIndex],
            isWanted: val // Al cambiar esto, el poster aparece en el círculo azul
          }
        };
      }
      return next;
    });
  }

  // 3. Guardamos en la base de datos
  await supabase
    .from("page_slots")
    .update({ is_wanted: val })
    .eq("page_id", pageId)
    .eq("slot_index", modalSlotIndex);
 }}
      />
    </label>
  )}


{/* NUEVO: Botón Western justo debajo de Wish si está activo */}

  {/* ⬆️ HASTA AQUÍ */}

  {/* lo que tengas debajo sigue igual */}

          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={() => setStockModalOpen(true)}
              disabled={uiWishlist > 0}
             style={{
 padding: "6px 10px",
 borderRadius: 10,
 border: "1px solid var(--color-border)",
 background: "var(--bg-card)",
 color: "var(--color-primary)",
 cursor: uiWishlist > 0 ? "not-allowed" : "pointer",
 fontWeight: 900,
 fontSize: 12,
 opacity: uiWishlist > 0 ? 0.6 : 1,
 boxShadow: uiWishlist > 0 ? "none" : "0 4px 12px color-mix(in srgb, var(--color-primary) 14%, transparent)",
}}
            >
              {t("binders.actions.update_stock")}
            </button>

            {stockModalOpen && (
              <div
                role="dialog"
                aria-modal="true"
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "var(--overlay-medium)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 99999,
                  padding: 18,
                }}
                onMouseDown={(e) => {
  e.stopPropagation();

  // ✅ si hay cambios pendientes, guarda y cierra
  if (e.target === e.currentTarget) {
    if (stockSaving) return;
    if (stockDirty) {
      void saveStockDraft();
      return;
    }
    setStockModalOpen(false);
  }
}}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <div
  data-stock-modal="1"
  style={{
    width: "min(280px, 92vw)",
    borderRadius: 18,
    background: "var(--bg-card)",
    border: "1px solid var(--state-disabled-border)",
    boxShadow: "0 22px 60px color-mix(in srgb, var(--text-main) 22%, transparent)",
    padding: 16,
  }}

                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                   <button
  type="button"
  title={t('common.close')}
  onClick={(e) => {
    e.stopPropagation();
    if (stockSaving) return;
    setStockModalOpen(false);
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = "var(--bg-soft)";
    e.currentTarget.style.borderColor = "var(--color-primary)";
    e.currentTarget.style.color = "var(--color-primary)";
    e.currentTarget.style.boxShadow = "0 4px 12px color-mix(in srgb, var(--color-primary) 18%, transparent)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = "var(--bg-card)";
    e.currentTarget.style.borderColor = "var(--color-primary)";
    e.currentTarget.style.color = "var(--color-primary)";
    e.currentTarget.style.boxShadow = "none";
  }}
  style={{
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid var(--color-primary)",
    background: "var(--bg-card)",
    cursor: stockSaving ? "not-allowed" : "pointer",
    fontWeight: 950,
    color: "var(--color-primary)",
    boxShadow: "none",
    transition: "all 0.15s ease",
  }}
>
  ✕
</button>

                    <div
  style={{
    fontWeight: 900,
    color: "var(--color-primary)",
    fontSize: 18,
  }}
>
  {t("binders.actions.edit_stock")}
</div>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}> 
  {(() => { 
 const setCount = (key: string, value: number) => {
    const intendedNext = Math.max(0, value);

    // 1. Actualizamos el estado de forma puramente matemática (sin efectos secundarios)
    setStockDraft((prevDraft) => {
      const prevVal = (prevDraft as any)?.[key] ?? 0;
      if (prevVal === intendedNext) return prevDraft; // Si no cambia, cortamos aquí

      return {
        ...(prevDraft ?? emptyCounts()),
        [key]: intendedNext,
        // Si añadimos stock físico, apagamos la Wishlist automáticamente
        ...(intendedNext > 0 ? { wish: 0 } : {}),
      } as any;
    });

    // 2. Sincronizamos la UI visual y marcamos que hay cambios sin guardar
    if (key === "wtt") setWttDisplay(intendedNext);
    setStockDirty(true);
  };

    // Lista corregida con WTT incluido
    const rows = [ 
      { key: "have", label: t("library.status_have") }, 
      { key: "wtt", label: t("binders.statuses.wtt") }, 
      { key: "wts", label: t("binders.statuses.wts") }, 
      { key: "on_its_way", label: t("library.status_otw") }, 
    ]; 

    return ( 
      <> 
        {rows.map((row) => { 
          const current = (stockDraft as any)?.[row.key] ?? 0; 

          return ( 
            <div 
              key={row.key} 
              style={{ 
                borderRadius: 14, 
                border: "1px solid var(--bg-soft)", 
                background: "var(--state-disabled-bg)", 
                padding: "10px 14px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "flex-start", 
                gap: 46, 
                minHeight: 72, 
              }} 
            > 
              <div 
                style={{ 
                  fontWeight: 900, 
                  color: "var(--color-primary)", 
                  fontSize: 16, 
                  textAlign: "left", 
                  minWidth: 90, 
                }} 
              > 
                {row.label} 
              </div> 

              <div 
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: "26px 32px", 
                  gridTemplateRows: "20px 20px", 
                  columnGap: 6, 
                  rowGap: 3, 
                  alignItems: "center", 
                  justifyItems: "center", 
                  flex: "0 0 auto", 
                }} 
              > 
                <div 
                  style={{ 
                    gridColumn: "1 / 2", 
                    gridRow: "1 / 3", 
                    minWidth: 24, 
                    textAlign: "center", 
                    fontWeight: 900, 
                    color: "var(--color-primary)", 
                    fontSize: 16, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                  }} 
                >
      {current}
    </div>

  <button
type="button"
onMouseDown={(e) => e.stopPropagation()}
onClick={(e) => {
e.stopPropagation();
const nextVal = current + 1;
setCount(row.key, nextVal);

if (row.key === "wtt" && current === 0) {
setStockModalOpen(false);
setWttListingItemId(activeItemId);
setWttListingModalOpen(true);
}
}}
style={{
gridColumn: "2 / 3",
gridRow: "1 / 2",
width: 32,
height: 28,
borderRadius: 8,
border: "1px solid var(--library-stock-step-minus-border)",
background: "var(--library-stock-step-minus-bg)",
color: "var(--library-stock-step-minus-fg)",
cursor: "pointer",
fontWeight: 900,
fontSize: 16,
display: "flex",
alignItems: "center",
justifyContent: "center",
}}
>
+
</button>

    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        setCount(row.key, current - 1);
      }}
      style={{
        gridColumn: "2 / 3",
        gridRow: "2 / 3",
        width: 32,
        height: 28,
        borderRadius: 8,
        border: "1px solid var(--library-stock-step-minus-border)",
        background: "var(--library-stock-step-minus-bg)",
        color: "var(--library-stock-step-minus-fg)",
        cursor: "pointer",
        fontWeight: 900,
        fontSize: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      title={t('common.subtract_one')}
    >
      −
    </button>
  </div>
</div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                             
                  {/* ✅ FOOTER: Guardar / Cancelar */}
<div
  style={{
    display: "flex",
    justifyContent: "flex-start",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTop: "1px solid var(--state-disabled-border)",
  }}
  onMouseDown={(e) => e.stopPropagation()}
  onClick={(e) => e.stopPropagation()}
>
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      if (stockSaving) return;
      setStockModalOpen(false);
    }}
    style={{
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid var(--color-primary)",
    background: "var(--bg-card)",
    color: "var(--color-primary)",
    fontWeight: 900,
    cursor: "pointer",
  }}
>
  {t("common.cancel")}
</button>

  <button
    type="button"
    disabled={stockSaving}
    onClick={async (e) => {
      e.stopPropagation();
      await saveStockDraft();
    }}
    style={{
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid var(--color-primary)",
  background: "var(--bg-soft)",
  color: "var(--color-primary)",
  cursor: stockSaving ? "not-allowed" : "pointer",
  fontWeight: 950,
  opacity: stockSaving ? 0.6 : 1,
  boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 25%, transparent)",
}}
  >
    {stockSaving ? t("binders.actions.saving") : t("common.save")}
  </button>
</div>
                </div>
              </div>
            )}
          </div>
        </div>

          <div
            className="library-stock-price-col"
            style={{ minWidth: 200, maxWidth: 280, flex: "1 1 200px", display: "grid", gap: 10, alignContent: "start" }}
          >
            <div style={{ borderRadius: 14, border: "1px solid var(--color-border)", background: "var(--bg-card)", padding: 8 }}>
              <div style={{ fontWeight: 950, marginBottom: 6, color: "var(--color-primary)", fontSize: 12 }}>{t("binders.item_info.your_price")}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", width: "100%" }}>
                <input
                  value={(() => {
                    if (activeItemId == null) return "—";
                    const stored = priceByItem[activeItemId] ?? readLS(priceKey(activeItemId)) ?? "";
                    const raw = String(stored).trim();
                    if (!raw) return "—";
                    const baseCur = wtsCurrencyByItem[activeItemId] ?? "EUR";
                    if (wtsViewCurrency === baseCur) return formatPrice(raw);
                    if (wtsFxRate == null) return "—";
                    const base = Number(raw.replace(",", "."));
                    return formatPrice(base * wtsFxRate);
                  })()}
                  disabled
                  placeholder={t("library.modal.price_unset")}
                  style={{
                    flex: "1 1 88px",
                    minWidth: 0,
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
                {uiCounts.wts > 0 ? (
                  <>
                    <select
                      value={wtsViewCurrency}
                      onChange={async (e) => {
                        const next = e.target.value || "EUR";
                        setWtsViewCurrency(next);
                        if (activeItemId == null) return;
                        const baseCur = wtsCurrencyByItem[activeItemId] ?? "EUR";
                        if (next === baseCur) {
                          setWtsFxRate(1);
                          return;
                        }
                        setWtsFxLoading(true);
                        try {
                          const r = await fetchFxPair(baseCur, next);
                          setWtsFxRate(r);
                        } finally {
                          setWtsFxLoading(false);
                        }
                      }}
                      style={{
                        height: 34,
                        padding: "4px 8px",
                        borderRadius: 10,
                        border: "1px solid var(--color-primary)",
                        background: "var(--bg-main)",
                        color: "var(--color-primary)",
                        fontSize: 11,
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      {!binderFxCurrencyOptions.some((c) => c.code === wtsViewCurrency) ? (
                        <option value={wtsViewCurrency}>{wtsViewCurrency}</option>
                      ) : null}
                      {binderFxCurrencyOptions.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.symbol} {c.name} — {c.code}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeItemId != null) onBecameWts(activeItemId);
                      }}
                      style={{ ...iconBtnStyle, flex: "0 0 auto", width: 32, height: 30 }}
                    >
                      <RotateCw size={14} strokeWidth={2.4} />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div style={{ borderRadius: 14, border: "1px solid var(--color-border)", background: "var(--bg-card)", padding: 8 }}>
              <div style={{ fontWeight: 950, marginBottom: 6, color: "var(--color-primary)", fontSize: 12 }}>{t("binders.item_info.market_price")}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={
                    marketFxLoading && marketBaseValue != null && targetCurrency !== "USD"
                      ? "…"
                      : marketShownConverted != null
                        ? formatPrice(marketShownConverted)
                        : "—"
                  }
                  disabled
                  placeholder={t("library.modal.price_unset")}
                  style={{
                    flex: "1 1 88px",
                    minWidth: 0,
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
                <select
                  value={targetCurrency}
                  onChange={async (e) => {
                    if (activeItemId == null) return;
                    const cur = e.target.value || "EUR";
                    setCurrencyByItem((prev) => ({ ...prev, [activeItemId]: cur }));
                    writeLS(currencyKey(activeItemId), cur);
                    await getFxRate("USD", cur);
                  }}
                  style={{
                    height: 34,
                    padding: "4px 8px",
                    borderRadius: 10,
                    border: "1px solid var(--color-primary)",
                    background: "var(--bg-main)",
                    color: "var(--color-primary)",
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {!binderFxCurrencyOptions.some((c) => c.code === targetCurrency) ? (
                    <option value={targetCurrency}>{targetCurrency}</option>
                  ) : null}
                  {binderFxCurrencyOptions.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.name} — {c.code}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={marketConsultLoading || activeItemId == null}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onConsultMarketRef();
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--color-primary)",
                    background: marketConsultLoading ? "var(--state-disabled-bg)" : "var(--bg-soft)",
                    color: "var(--color-primary)",
                    fontWeight: 900,
                    fontSize: 11,
                    cursor: marketConsultLoading || activeItemId == null ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {marketConsultLoading ? t("binders.item_info.market_consulting") : t("binders.item_info.consult_market_price")}
                </button>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.35 }}>
                {marketBaseValue != null
                  ? `${t("binders.item_info.market")}: ${formatPrice(marketBaseValue)} USD${
                      targetCurrency !== "USD" && marketShownConverted != null
                        ? ` → ${formatPrice(marketShownConverted)} ${targetCurrency}`
                        : ""
                    }`
                  : t("binders.item_info.market_no_reference")}
              </div>
              <div style={{ fontSize: 10, color: "var(--color-primary)", marginTop: 4, fontWeight: 700 }}>
                {t("binders.item_info.market_stub_note")}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* WTT + NOTAS */}
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ ...subtleCard, padding: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 10,
            }}
          >
         <div style={{ fontWeight: 950, color: "var(--color-primary)" }}>{t('binders.looking_for_wtt')}</div>

            <button
              type="button"
              onClick={() => {
                if (activeItemId == null) return;
                openWttOfferModal(activeItemId);
              }}
              disabled={uiWishlist > 0}
              style={{
  padding: "6px 10px",
  borderRadius: 10,

  background: "var(--bg-soft)",
  border: "1px solid var(--color-border)",

  color: "var(--color-primary)",
  fontWeight: 900,
  fontSize: 12,

  cursor: "pointer",

  boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 18%, transparent)",
}}
            >
              {t('binders.my_trades')}
            </button>
          </div>

          {uiWttDisplay > 0 && wttOfferForModal?.length ? (
            <div
              style={{
                display: "flex",
                gap: 10,
                overflowX: "auto",
                overflowY: "hidden",
                flexWrap: "nowrap",
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                paddingBottom: 6,
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
                alignItems: "center",
                height: 112,
                maxHeight: 112,
                scrollbarGutter: "stable",
              }}
            >
              {wttOfferForModal.map((w, idx) => (
                <ImageWithExtensionFallback
                  key={`${w.id ?? "wtt"}-${idx}`}
                  src={w.image_url ?? "/mock-pcs/groups/not-available.png"}
                  alt=""
                  draggable={false}
                  title={w.name ?? ""}
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
          ) : wttOfferForModal.length > 0 ? null : (
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {t('binders.no_wtt_items')}
            </div>
          )}

          
        </div>
      </div>

      {wttWantOpen && wttWantForId === activeItemId && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay-medium)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100000,
            padding: 18,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) 
            closeLegacyWttPicker();
if (resumeWttListingAfterLegacyPicker) {
  setStockModalOpen(true);
  setWttListingModalOpen(true);
  setResumeWttListingAfterLegacyPicker(false);
}
          }}
        >
          <div
 style={{
  width: "min(980px, 96vw)",
  height: "min(740px, 92vh)",
  background: "var(--bg-card)",
  borderRadius: 18,
  border: "1px solid var(--state-disabled-border)",
  boxShadow: "0 22px 60px color-mix(in srgb, var(--text-main) 22%, transparent)",
  overflow: "hidden",
  display: "grid",
  gridTemplateRows: "58px auto minmax(0, 1fr) 64px",
  minHeight: 0,
 }}
 onMouseDown={(e) => e.stopPropagation()}
>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid var(--state-disabled-border)",
              }}
            >
              <div style={{ fontWeight: 950 }}>{t('binders.select_wtt_looking')}</div>
              <button
                type="button"
                onClick={() => closeLegacyWttPicker()}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid var(--state-disabled-border)",
                  background: "var(--bg-card)",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid var(--state-disabled-border)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <select
                  value={wttWantGroup}
                  onChange={(e) => setWttWantGroup(e.target.value ? Number(e.target.value) : "")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--state-disabled-border)" }}
                >
                  <option value="">{t('binders.picker.group')} {t('binders.picker.all_masculine')}</option>
                  {Array.from(
                    new Set(
                      wttWantCatalog
                        .map((i) => i.group_id)
                        .filter((x): x is number => typeof x === "number")
                    )
                  )
                    .map((id) => ({ id, name: wttWantGroupNames[id] ?? `#${id}` }))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>

                <select
                  value={wttWantAlbum}
                  onChange={(e) => setWttWantAlbum(e.target.value ? Number(e.target.value) : "")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--state-disabled-border)" }}
                >
                  <option value="">{t('binders.picker.album')} {t('binders.picker.all_masculine')}</option>
                  {Array.from(
                    new Set(
                      wttWantCatalog
                        .filter((i) => (wttWantGroup === "" ? true : i.group_id === wttWantGroup))
                        .map((i) => i.album_id)
                        .filter((x): x is number => typeof x === "number")
                    )
                  )
                    .map((id) => ({
                      id,
                      name: wttWantAlbumNames[id] ?? `#${id}`,
                      release_date: wttWantAlbumRelease[id] ?? null,
                    }))
                    .sort((a, b) => {
                      const da = a.release_date ? new Date(a.release_date).getTime() : Number.POSITIVE_INFINITY;
                      const db = b.release_date ? new Date(b.release_date).getTime() : Number.POSITIVE_INFINITY;
                      if (da !== db) return da - db;
                      return a.name.localeCompare(b.name, "es");
                    })
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>

                <select
                  value={wttWantVersion}
                  onChange={(e) => setWttWantVersion(e.target.value || "")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--state-disabled-border)" }}
                >
                  <option value="">{t('binders.picker.version')} {t('binders.picker.all_feminine')}</option>
                  {Array.from(
                    new Set(
                      wttWantCatalog
                        .filter((i) => (wttWantGroup === "" ? true : i.group_id === wttWantGroup))
                        .filter((i) => (wttWantAlbum === "" ? true : i.album_id === wttWantAlbum))
                        .map((i) => (i.version ?? "").trim())
                        .filter(Boolean)
                    )
                  )
                    .sort((a, b) => a.localeCompare(b))
                    .map((v) => (
                      <option key={v} value={v}>
                        {prettyText(v)}
                      </option>
                    ))}
                </select>

                <select
                  value={wttWantUnit}
                  onChange={(e) => setWttWantUnit(e.target.value as any)}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--state-disabled-border)" }}
                >
                  <option value="all">{t('binders.picker.type')} {t('binders.picker.all_masculine')}</option>
                  <option value="single">{t('binders.picker.type_selfie')}</option>
                  <option value="unit">{t('binders.picker.type_unit')}</option>
                  <option value="ot8">OT8</option>
                </select>

                <select
                  value={wttWantMember}
                  onChange={(e) => setWttWantMember(e.target.value || "")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--state-disabled-border)" }}
                >
                  <option value="">{t('binders.picker.member')} {t('binders.picker.all_masculine')}</option>
                  {[
                    { value: "bang-chan", label: "Bang Chan" },
                    { value: "lee-know", label: "Lee Know" },
                    { value: "changbin", label: "Changbin" },
                    { value: "hyunjin", label: "Hyunjin" },
                    { value: "han", label: "Han" },
                    { value: "felix", label: "Felix" },
                    { value: "seungmin", label: "Seungmin" },
                    { value: "in", label: "I.N" },
                  ]
                    .filter((m) => {
                     const available = wttWantCatalog.some((it) => {
  if (wttWantGroup !== "" && it.group_id !== wttWantGroup) return false;
  if (wttWantAlbum !== "" && it.album_id !== wttWantAlbum) return false;
  if (wttWantVersion !== "" && (it.version ?? "").trim() !== wttWantVersion) return false;
  // Ajuste aquí: añadimos || ""
  if (wttWantUnit !== "all" && unitTypeFromMember(it.member || it.name || "") !== wttWantUnit) return false;
  // Ajuste aquí: añadimos || ""
  return memberMatches(it.member || "", m.value);
});
                      return available;
                    })
                    .map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                </select>
              </div>

        <input
 ref={wttSearchRef}
 value={wttWantQ}
 onChange={(e) => setWttWantQ(e.target.value)}
 placeholder={t('binders.picker.search_placeholder')}
 style={{
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--state-disabled-border)",
 }}
/>
            </div>

        <div
 ref={wttWantScrollRef}
 style={{
  padding: 16,
  overflow: "auto",
  minHeight: 0,
  WebkitOverflowScrolling: "touch",
  overflowAnchor: "none",
 }}
>
 {wttWantLoading ? (
  <div style={{ color: "var(--text-muted)" }}>{t('common.loading')}</div>
 ) : (
  <div
   style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 12,
   }}
  >
                  {wttWantCatalog
                    .filter((it) => {
                     if (wttWantGroup !== "" && it.group_id !== wttWantGroup) return false;
if (wttWantAlbum !== "" && it.album_id !== wttWantAlbum) return false;
if (wttWantVersion !== "" && (it.version ?? "").trim() !== wttWantVersion) return false;
// Ajuste aquí: it.member || ""
if (wttWantMember !== "" && !memberMatches(it.member || "", wttWantMember)) return false;
// Ajuste aquí: it.member || ""
if (wttWantUnit !== "all" && unitTypeFromMember(it.member || it.name || "") !== wttWantUnit) return false;

const q = normText(wttWantQ);
if (!q) return true;
const hay = normText(
  [
    it.name ?? "",
    it.member ?? "", // Aquí el nullish coalescing ?? ya lo maneja bien, pero puedes poner it.member || "" por consistencia
    it.version ?? "",
    wttWantGroupNames[it.group_id ?? -1] ?? "",
    wttWantAlbumNames[it.album_id ?? -1] ?? "",
  ].join(" ")
);
return hay.includes(q);
                    })
                    .map((it) => {
                      const selected = wttWantDraft.includes(it.id);
                      return (
                  <button
 key={it.id}
 type="button"
 onMouseDown={(e) => {
  e.preventDefault();
 }}
 onClick={() => {
  const scroller = wttWantScrollRef.current;
  wttWantScrollSnapshotRef.current = {
   top: scroller?.scrollTop ?? 0,
   left: scroller?.scrollLeft ?? 0,
  };

  setWttWantDraft((prev) =>
   prev.includes(it.id)
    ? prev.filter((x) => x !== it.id)
    : [...prev, it.id]
  );
 }}
 style={{
  borderRadius: 14,
  border: "2px solid",
  borderColor: selected ? "var(--color-accent-blue)" : "transparent",
  background: selected ? "var(--state-info-bg)" : "var(--bg-card)",
  boxShadow: selected
    ? "0 0 0 1px var(--state-info-border), 0 8px 18px color-mix(in srgb, var(--text-main) 6%, transparent)"
    : "0 0 0 1px var(--state-disabled-border), 0 8px 18px color-mix(in srgb, var(--text-main) 6%, transparent)",
  padding: 8,
  cursor: "pointer",
  textAlign: "left",
}}
>
                          <div
                            style={{
                              width: "100%",
                              aspectRatio: "2 / 3",
                              borderRadius: 10,
                              overflow: "hidden",
                              background: "var(--bg-main)",
                            }}
                          >
                            <ImageWithExtensionFallback
                              src={it.image_url ?? "/mock-pcs/groups/not-available.png"}
                              alt=""
                              draggable={false}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderTop: "1px solid var(--state-disabled-border)",
              }}
            >
             <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 900 }}>
  Seleccionadas: {wttOfferDraft.length}
</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                 onClick={() => closeLegacyWttPicker()}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--state-disabled-border)",
                    background: "var(--bg-card)",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setWttWantDraft([])}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--state-disabled-border)",
                    background: "var(--bg-card)",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Borrar selección
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveWttWantDraft();
                  }}
                 // Botón Guardar en WTT/WTS

  style={{
    // ... otros estilos
    background: "var(--color-primary)", // Púrpura de la tipografía
    color: "var(--bg-card)",
    border: "none",
    boxShadow: "0 4px 10px color-mix(in srgb, var(--color-primary) 30%, transparent)"
  }}
>
  Guardar
</button>
              </div>
            </div>
          </div>
        </div>
      )}

   {wttOfferOpen && wttOfferForId === activeItemId && ( 
    <div 
      role="dialog" 
      aria-modal="true" 
      style={{ 
        position: "fixed", inset: 0, background: "var(--overlay-medium)", 
        display: "flex", alignItems: "center", justifyContent: "center", 
        zIndex: 100000, padding: isMobile ? "10px" : "20px" 
      }} 
    > 
      <div 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          width: "min(980px, 96vw)", height: isMobile ? "90vh" : "800px", 
          background: "var(--bg-main)", borderRadius: 20, overflow: "hidden", 
          display: "flex", flexDirection: "column", border: "1px solid var(--color-border)"
        }} 
      > 
        {/* HEADER */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--bg-soft)", borderBottom: "1px solid var(--color-border)" }}> 
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}> 
            <img src="/branding/logo.png" alt="" style={{ height: 24, width: "auto" }} /> 
            <div style={{ fontWeight: 950, color: "var(--color-primary)", fontSize: isMobile ? 16 : 18 }}>{t('binders.my_trades')} (WTT)</div> 
          </div> 
          <button onClick={() => setWttOfferOpen(false)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--color-primary)", background: "var(--bg-card)", fontWeight: 900, color: "var(--color-primary)", cursor: "pointer" }}>✕</button> 
        </div> 

     {/* CONTENEDOR DE FILTROS COLAPSABLE */}
<div style={{ flexShrink: 0, background: "var(--bg-soft)", borderBottom: "1px solid var(--state-disabled-border)" }}>
  
  {/* Botón de control de filtros */}
  <div style={{ padding: "8px 12px", display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
    <button
      type="button"
      onClick={() => setShowWttFilters(!showWttFilters)}
      style={{
        background: showWttFilters ? "var(--color-primary)" : "var(--bg-card)",
        color: showWttFilters ? "var(--bg-card)" : "var(--color-primary)",
        border: "1px solid var(--color-primary)",
        padding: "6px 12px",
        borderRadius: "10px",
        fontSize: "12px",
        fontWeight: 900,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6
      }}
    >
      <span>{showWttFilters ? `✕ ${t('common.close_filters')}` : `🔍 ${t('common.filter_list')}`}</span>
    </button>
    
    {/* La búsqueda rápida siempre visible para que el usuario pueda buscar por nombre sin abrir filtros */}
    {!showWttFilters && (
      <input 
        value={wttOfferQ || ""} 
        onChange={(e) => setWttOfferQ(e.target.value)} 
        placeholder={t('common.search')} 
        style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 13, height: "34px" }} 
      />
    )}
  </div>

  {/* Los selectores se muestran solo si showWttFilters es true */}
  {showWttFilters && (
    <div style={{ padding: "0 12px 12px 12px", display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(5, 1fr)", gap: 6 }}>
        
        {/* 1. Grupo */}
        <select 
          value={String(wttOfferGroup ?? "")} 
          onChange={(e) => setWttOfferGroup(e.target.value ? Number(e.target.value) : "")} 
          style={{ padding: "10px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13, width: "100%", height: "42px", background: "var(--bg-card)" }}
        >
          <option value="">{t('binders.picker.group')} ({t('common.all')})</option>
          {Array.from(new Set(wttWantCatalog.map(i => i.group_id).filter(Boolean))).map(id => (
            <option key={String(id)} value={String(id)}>{wttWantGroupNames[id as number] ?? `Grupo ${id}`}</option>
          ))}
        </select>

        {/* 2. Álbum */}
        <select 
          value={String(wttOfferAlbum ?? "")} 
          onChange={(e) => setWttOfferAlbum(e.target.value ? Number(e.target.value) : "")} 
          style={{ padding: "10px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13, width: "100%", height: "42px", background: "var(--bg-card)" }}
        >
          <option value="">{t('binders.picker.album')} ({t('common.all')})</option>
          {Array.from(new Set(wttWantCatalog.filter(i => !wttOfferGroup || i.group_id === wttOfferGroup).map(i => i.album_id).filter(Boolean))).map(id => (
            <option key={String(id)} value={String(id)}>{wttWantAlbumNames[id as number] ?? `Álbum ${id}`}</option>
          ))}
        </select>

        {/* 3. Versión */}
        <select 
          value={wttOfferVersion || ""} 
          onChange={(e) => setWttOfferVersion(e.target.value)} 
          style={{ padding: "10px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13, width: "100%", height: "42px", background: "var(--bg-card)" }}
        >
          <option value="">{t('binders.picker.version')} ({t('common.all_feminine')})</option>
          {Array.from(new Set(wttWantCatalog.filter(i => (!wttOfferGroup || i.group_id === wttOfferGroup) && (!wttOfferAlbum || i.album_id === wttOfferAlbum)).map(i => i.version).filter(Boolean))).sort().map(v => (
            <option key={String(v)} value={String(v)}>{prettyText(String(v))}</option>
          ))}
        </select>

        {/* 4. Miembro */}
        <select 
          value={wttOfferMember || ""} 
          onChange={(e) => setWttOfferMember(e.target.value)} 
          style={{ padding: "10px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13, width: "100%", height: "42px", background: "var(--bg-card)" }}
        >
          <option value="">{t('binders.picker.member')} ({t('common.all')})</option>
          <option value="bang-chan">Bang Chan</option>
          <option value="lee-know">Lee Know</option>
          <option value="changbin">Changbin</option>
          <option value="hyunjin">Hyunjin</option>
          <option value="han">Han</option>
          <option value="felix">Felix</option>
          <option value="seungmin">Seungmin</option>
          <option value="in">I.N</option>
        </select>

        {/* 5. Tipo */}
        <select 
          value={wttOfferUnit || "all"} 
          onChange={(e) => setWttOfferUnit(e.target.value as any)} 
          style={{ padding: "10px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13, width: "100%", height: "42px", background: "var(--bg-card)" }}
        >
          <option value="all">{t('binders.picker.type')} ({t('common.all')})</option>
          <option value="single">{t('binders.picker.type_selfie')}</option>
          <option value="unit">{t('binders.picker.type_unit')}</option>
          <option value="ot8">OT8</option>
        </select>
      </div>
      
      {/* Input de búsqueda movido aquí dentro cuando los filtros están abiertos */}
      <input 
        value={wttOfferQ || ""} 
        onChange={(e) => setWttOfferQ(e.target.value)} 
        placeholder={t('binders.picker.search_placeholder')} 
        style={{ padding: "12px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 14, width: "100%", height: "44px", background: "var(--bg-card)" }} 
      />
    </div>
  )}
</div>

       {/* ÁREA DE CARTAS (SCROLL BLINDADO) */}
<div 
  ref={wttOfferScrollRef} // <--- ASIGNA LA REFERENCIA AQUÍ
  style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "12px" }}
  onScroll={(e) => e.stopPropagation()}
>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10, paddingBottom: 40 }}>
         {wttWantCatalog
              .filter(it => {
                if (wttOfferGroup && it.group_id !== wttOfferGroup) return false;
                if (wttOfferAlbum && it.album_id !== wttOfferAlbum) return false;
                if (wttOfferVersion && it.version !== wttOfferVersion) return false;
                if (wttOfferMember && !memberMatches(it.member || "", wttOfferMember)) return false;
                if (wttOfferUnit !== "all" && unitTypeFromMember(it.member || it.name || "") !== wttOfferUnit) return false;
                if (wttOfferQ && !normText(`${it.member} ${it.name}`).includes(normText(wttOfferQ))) return false;
                return true;
              })
              .map((it) => {
                const selected = wttOfferDraft.includes(it.id);
                return (
                  <label 
                    key={it.id} 
                    style={{ 
                      position: "relative", 
                      padding: 4, 
                      borderRadius: 12, 
                      cursor: "pointer",
                      border: selected ? "3px solid var(--color-accent-blue)" : "1px solid var(--state-disabled-border)",
                      background: selected ? "var(--state-info-bg)" : "var(--bg-card)",
                      display: "block",
                      // Esto asegura que el scroll no se bloquee al deslizar sobre una carta
                      touchAction: "pan-y",
                      WebkitTapHighlightColor: "transparent"
                    }}
                  >
                    {/* INPUT INVISIBLE QUE GESTIONA EL ESTADO SIN SALTOS */}
                 
<input
  type="checkbox"
  checked={selected}
  onChange={() => {
    // 1. CAPTURAMOS EL SCROLL ACTUAL
    const scroller = wttOfferScrollRef.current;
    if (scroller) {
      wttOfferScrollSnapshotRef.current = {
        top: scroller.scrollTop,
        left: scroller.scrollLeft
      };
    }

    // 2. ACTUALIZAMOS EL ESTADO (esto provocará el re-render)
    setWttOfferDraft(prev =>
      prev.includes(it.id) ? prev.filter(x => x !== it.id) : [...prev, it.id]
    );
  }}
                      style={{ 
                        position: "absolute", 
                        opacity: 0, 
                        inset: 0, 
                        width: "100%", 
                        height: "100%", 
                        margin: 0, 
                        cursor: "pointer",
                        zIndex: 2
                      }}
                    />

                    <ImageWithExtensionFallback 
                      src={it.image_url ?? "/mock-pcs/groups/not-available.png"} 
                      style={{ 
                        width: "100%", 
                        aspectRatio: "3/4", 
                        objectFit: "cover", 
                        borderRadius: 8, 
                        display: "block",
                        pointerEvents: "none" 
                      }} 
                    />

                    {selected && (
                      <div style={{ 
                        position: "absolute", top: 4, right: 4, background: "var(--color-accent-blue)", 
                        color: "var(--bg-card)", width: 20, height: 20, borderRadius: "50%", 
                        display: "flex", alignItems: "center", justifyContent: "center", 
                        fontSize: 10, fontWeight: 900, zIndex: 3
                      }}>✓</div>
                    )}
                  </label>
                );
              })}
          </div>
        </div>

        {/* FOOTER FIJO */}
        <div style={{ flexShrink: 0, padding: "12px 16px", background: "var(--bg-card)", borderTop: "1px solid var(--state-disabled-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)" }}>{wttOfferDraft.length} {t('binders.selected_plural')}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setWttOfferDraft([])} style={{ ...whitePinkBtnStyle, padding: "6px 10px", fontSize: 11 }}>{t('binders.clear_selection')}</button>
            <button onClick={() => setWttOfferOpen(false)} style={{ ...whitePinkBtnStyle, padding: "6px 10px", fontSize: 11 }}>{t('common.cancel')}</button>
            <button onClick={() => savewttOfferDraft()} 
 style={{ ...softPinkBtnStyle, padding: "6px 12px", fontSize: 12 }}
>{t('common.save_and_publish')}</button>
          </div>
        </div>
      </div> 
    </div> 
  )}
    </div>
  ) : (
    // =========================
    // MODAL CUSTOM (PC PERSONALIZADA)
    // =========================
    <div
      style={{
        display: "grid",
        rowGap: 14,
        alignContent: "start",
      }}
    >
      <div style={{ ...subtleCard, padding: 14 }}>
        <div style={{ fontWeight: 950, color: "var(--text-main)", lineHeight: 1.15 }}>
          {t('binders.custom_pc.title')}
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <textarea
            value={draftCustomText}
            onChange={(e) => setDraftCustomText(e.target.value)}
            onBlur={() => onChangeCustomText(draftCustomText)}
            placeholder={t('binders.custom_pc.placeholder')}
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
background: "var(--bg-card)",
color: "var(--text-main)",
              outline: "none",
              resize: "none",
              fontWeight: 800,
          
              boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
  <label
    style={{
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid var(--color-border)",
      background: "var(--bg-card)",
      cursor: "pointer",
      fontWeight: 800,
      boxShadow: "0 8px 18px color-mix(in srgb, var(--text-main) 6%, transparent)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
    }}
    title={t('common.upload_image')}
  >
    Subir anverso
    
   <input 
    type="file" 
    accept="image/*" 
    style={{ display: "none" }} 
    onClick={(e) => {
      // 🚨 CANDADO: Evita que se abra la carpeta de Windows/Mac
      if (!profile?.is_premium && !isAdmin) {
        e.preventDefault(); 
        showAlert("Ventaja VIP 👑", "Subir imágenes personalizadas es exclusivo para cuentas Premium.");
      }
    }}
    onChange={(e) => { 
      const f = e.target.files?.[0]; 
      if (f) onPickCustomImage(f, "front"); 
      e.currentTarget.value = ""; 
    }} 
  />
  </label>
  <label
    style={{
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid var(--color-border)",
      background: "var(--bg-card)",
      cursor: "pointer",
      fontWeight: 800,
      boxShadow: "0 8px 18px color-mix(in srgb, var(--color-primary) 6%, transparent)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
    }}
    title={t('common.upload_image')}
  >
    Subir reverso
    
    <input 
    type="file" 
    accept="image/*" 
    style={{ display: "none" }} 
    onClick={(e) => {
      if (!profile?.is_premium && !isAdmin) {
        e.preventDefault(); 
        showAlert("Ventaja VIP 👑", "Subir imágenes personalizadas es exclusivo para cuentas Premium.");
      }
    }}
    onChange={(e) => { 
      const f = e.target.files?.[0]; 
      if (f) onPickCustomImage(f, "back"); 
      e.currentTarget.value = ""; 
    }} 
  />
  </label>
{/* CHECKBOX DE BIAS */}
        <label
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px",
            borderRadius: 12,
            border: customIsBias ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
            background: customIsBias ? "var(--bg-soft)" : "var(--bg-card)",
            cursor: "pointer",
            fontWeight: 800,
            boxShadow: customIsBias ? "0 8px 18px color-mix(in srgb, var(--color-primary) 12%, transparent)" : "0 8px 18px color-mix(in srgb, var(--color-primary) 6%, transparent)",
            transition: "all 140ms ease",
          }}
          title={t('binders.custom_pc.is_bias')}
        >
         <input
            type="checkbox"
            checked={customIsBias}
            onChange={(e) => onToggleCustomBias(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--color-primary)", cursor: "pointer" }}
          />
 
          <span style={{ fontSize: 14, color: customIsBias ? "var(--color-primary)" : "var(--text-muted)" }}>
            💖 Esta PC es de mi Bias
          </span>
        </label>
  {customImageUrl && ( 
    <button 
      type="button" 
      onClick={onClearCustomImage} 
      style={{ 
        ...dangerBtn, 
        width: "100%", 
        padding: "12px", 
        marginBottom: isMobile ? "40px" : "0", // 👈 Empuja el botón hacia arriba del borde real
        background: "var(--bg-card)", 
        fontWeight: 800, 
      }} 
    > 
      Quitar imagen 
    </button> 
  )} 
</div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
  aria-modal="true"
      onMouseDown={(e) => {
        const t = e.target as HTMLElement | null;

        // ✅ Si el click viene desde el modal de stock, NO cierres el modal grande
        if (t?.closest?.('[data-stock-modal="1"]')) return;

        // ✅ Cierra solo si realmente pinchas en el fondo del overlay
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => {
        const t = e.target as HTMLElement | null;

        // ✅ blindaje extra: si el click viene desde el modal de stock, ignóralo
        if (t?.closest?.('[data-stock-modal="1"]')) return;

        e.stopPropagation();
      }}
  
 
  style={{ 
    position: "fixed", 
    inset: 0, 
    background: "var(--overlay-medium)", 
    zIndex: 9999, 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    padding: isMobile ? "10px" : "18px",

  }}
>
      <div 
    onMouseDown={(e) => e.stopPropagation()} 
    onClick={(e) => e.stopPropagation()} 
    style={{ 
      width: isMobile ? "96vw" : "auto", 
      maxWidth: "980px", 
      height: isMobile ? "90vh" : "auto", // Altura máxima en móvil
      maxHeight: "92vh", 
      background: "var(--bg-main)", 
      borderRadius: 18, 
      border: "1px solid var(--color-border)", 
      overflowY: "auto", // 👈 AQUÍ ES DONDE VA EL SCROLL
      display: "flex", 
      flexDirection: "column",
      WebkitOverflowScrolling: "touch"
    }} 
  >
    
{/* 1. HEADER DEL MODAL */}
  <div
  style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 16px",
  borderBottom: "1px solid var(--color-border)",
  background: "var(--bg-soft)",
  flexShrink: 0,
  }}
  >
  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
  <img src="/branding/logo.png" alt="" style={{ height: 28, width: "auto", objectFit: "contain" }} />
  <div style={{ fontSize: 22, fontWeight: 950, color: "var(--color-primary)", whiteSpace: "pre-line", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis" }}>
  {headerTitle}
  </div>
  </div>
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
  
  {/* ✅ BOTONES DE NAVEGACIÓN AÑADIDOS AQUÍ */}
  <button
    type="button"
    onClick={onPrev}
    disabled={!canPrev}
    style={{ ...iconBtnStyle, padding: "8px", width: 36, height: 36, opacity: canPrev ? 1 : 0.45, cursor: canPrev ? "pointer" : "not-allowed" }}
    title={t('common.previous')}
  >
    <ChevronLeft size={18} strokeWidth={2.6} />
  </button>
  <button
    type="button"
    onClick={onNext}
    disabled={!canNext}
    style={{ ...iconBtnStyle, padding: "8px", width: 36, height: 36, opacity: canNext ? 1 : 0.45, cursor: canNext ? "pointer" : "not-allowed" }}
    title={t('common.next')}
  >
    <ChevronRight size={18} strokeWidth={2.6} />
  </button>
  {/* ✅ FIN DE BOTONES DE NAVEGACIÓN */}

  <button
  type="button"
  onClick={() => { void doModalUndo(); }}
  title={t('binders.actions.undo')}
  style={{ ...iconBtnStyle, padding: "8px", width: 36, height: 36 }}
  >
  <Undo2 size={18} strokeWidth={2.5} />
  </button>
  <button type="button" onClick={onClose} style={iconBtnStyle} title={t('common.close')} className="iconDangerHover modalCloseBtn">
  ✕
  </button>
  </div>
  </div>

  {/* 2. CUERPO DEL MODAL (Ajuste definitivo de scroll) */} 
  <div 
    style={{ 
      display: "flex", 
      flexDirection: isMobile ? "column" : "row", 
      width: "100%",
      height: "auto", 
      overflowY: "visible", // Cambiamos a visible aquí
      padding: isMobile ? "10px 10px 120px 10px" : "20px", 
      backgroundColor: "var(--bg-main)", 
      gap: 15
    }} 
  >
   {/* COLUMNA IZQUIERDA: CARTA Y ZOOM (NAVEGACIÓN TOTAL) */}
  <div 
    style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      width: isMobile ? "100%" : "420px", 
      flexShrink: 0, 
      background: "var(--bg-main)", 
      padding: isMobile ? "10px" : "20px", 
      borderRadius: "20px", 
      border: "1px solid var(--bg-soft)",
      position: "relative"
    }} 
  > 
    {/* ÁREA DE VISUALIZACIÓN TIPO LUPA */}
    <div style={{ 
      width: "100%", 
      height: isMobile ? "380px" : "480px", 
      position: "relative", 
      overflow: "auto", // ✅ Permite scroll en todas direcciones
      borderRadius: 14,
      background: "var(--state-disabled-border)",
      display: "block", // ✅ Cambiado de flex a block para scroll real
      WebkitOverflowScrolling: "touch"
    }}> 
      {(() => { 
        const sleeveRot = ((rot % 360) + 360) % 360; 
        const fImg = isCustom ? customImageUrl : (meta?.image_url ?? null);
        const bImg = isCustom 
          ? ((assigned as any)?.custom_back_image_url ?? DEFAULT_BACK_URL) 
          : resolveMockPcBackUrl(meta?.image_url ?? assigned?.image_url, meta?.back_image_url ?? assigned?.back_image_url);

        return ( 
          /* Contenedor de expansión: crea el espacio necesario para que el scroll llegue a los bordes */
          <div style={{ 
            width: "100%",
            height: "100%",
            minWidth: 320 * modalZoom,
            minHeight: 480 * modalZoom,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "100px" // ✅ Margen de seguridad para que la carta no choque con los bordes
          }}> 
            <div style={{ 
              width: 320, 
              height: 480, 
              flexShrink: 0,
              position: "relative",
              transform: `scale(${modalZoom}) rotate(${sleeveRot}deg)`, 
              transition: "transform 0.2s ease-out",
              zIndex: 1
            }}> 
              <div style={{ 
                width: "100%", height: "100%", 
                borderRadius: 14, overflow: "hidden", 
                border: "1px solid var(--state-disabled-border)", background: "var(--bg-card)", 
                boxShadow: "0 10px 30px var(--overlay-faint)"
              }}> 
                <div style={{ width: "100%", height: "100%", position: "relative", perspective: 1200 }}> 
                  <div ref={modalFlipWrapRef} style={{ 
                    width: "100%", height: "100%", position: "absolute", 
                    transformStyle: "preserve-3d", 
                    transform: `scaleX(${flipH ? -1 : 1}) rotateY(${modalFaceUI === "front" ? 0 : 180}deg)` 
                  }}> 
                    {/* FRONT */} 
                    <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}> 
                      {((assigned as any)?.is_wanted === true && uiWishlist > 0) ? ( 
                        <WesternWantedFrame name={headerTitle || "WANTED"} variant="modal"> 
                          <ImageWithExtensionFallback src={fImg || "/mock-pcs/groups/not-available.png"} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> 
                        </WesternWantedFrame> 
                      ) : ( 
                        <ImageWithExtensionFallback src={fImg || "/mock-pcs/groups/not-available.png"} style={{ width: '100%', height: '100%', objectFit: "cover" }} alt="" /> 
                      )} 
                    </div> 
                    {/* BACK */} 
                    <div style={{ position: "absolute", inset: 0, transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}> 
                      <ImageWithExtensionFallback
                        src={bImg || DEFAULT_BACK_URL}
                        frontSrcForBack={isCustom ? undefined : (meta?.image_url ?? assigned?.image_url) ?? undefined}
                        fallbackSrc={DEFAULT_BACK_URL}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        alt=""
                      /> 
                    </div> 
                  </div> 
                </div> 
              </div> 
            </div> 
          </div> 
        ); 
      })()} 
    </div> 

    {/* PANEL DE CONTROL (FIJO) */}
    <div style={{ 
      marginTop: 15, display: "flex", flexDirection: "column", gap: 12, width: "100%", alignItems: "center"
    }}>
      <div style={{ display: "flex", gap: 10 }}> 
        <button type="button" onClick={onRotateLeft} style={{...iconBtnStyle, width: 40, height: 40, fontSize: 18}}>⟲</button> 
        <button type="button" onClick={onRotateRight} style={{...iconBtnStyle, width: 40, height: 40, fontSize: 18}}>⟳</button> 
        <button type="button" onClick={onToggleFaceAnimated} style={{...iconBtnStyle, width: 40, height: 40, fontSize: 18}}>⇄</button> 
      </div> 

      <div style={{ 
        display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", 
        borderRadius: "99px", background: "var(--bg-card)", border: "1px solid var(--color-border)", 
        boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 15%, transparent)" 
      }}> 
        <button type="button" onClick={() => setModalZoom((z) => Math.max(0.6, z - 0.2))} style={{...iconBtnStyle, border: "none", boxShadow: "none"}}>−</button> 
        <span style={{ fontSize: 12, fontWeight: 900, color: "var(--color-primary)", minWidth: 40, textAlign: "center" }}>{Math.round(modalZoom * 100)}%</span>
        <button type="button" onClick={() => setModalZoom((z) => Math.min(3.0, z + 0.2))} style={{...iconBtnStyle, border: "none", boxShadow: "none"}}>+</button> 
        <button type="button" onClick={() => setModalZoom(1)} style={{
          marginLeft: 5, padding: "4px 10px", borderRadius: 8, border: "1px solid var(--color-primary)", 
          background: "var(--bg-soft)", color: "var(--color-primary)", fontWeight: 900, fontSize: 10, cursor: "pointer"
        }}>Reset</button> 
      </div> 

 
 

 

 {/* ✅ BOTÓN GUARDAR CAMBIOS VISUALES CORREGIDO */}
  <button 
    type="button" 
    onClick={async () => { 
      if (modalSlotIndex == null) return; 
      setStatus("Guardando cambios visuales..."); 

      // Recuperamos los datos actuales para no borrar el reverso al guardar
      const current = slotItems[modalSlotIndex];
      const frontImg = current?.custom_image_url ?? null;
      const backImg = (current as any)?.custom_back_image_url ?? null;

      // Guardamos la transformación y las imágenes actuales
      await saveCustomToDb( 
        modalSlotIndex, 
        modalCustomText, 
        frontImg, // 👈 Pasamos la imagen de la memoria, no null
        backImg,  // 👈 Pasamos el reverso de la memoria, no null
        modalViewRot, 
        modalViewFlipH,
        (current as any)?.member_id // Mantenemos el bias
      ); 

      setRefreshTick(t => t + 1); 
      await loadPageThumbs(); 
      
      setStatus("¡Cambios guardados! ✅"); 
      setTimeout(() => setStatus(""), 2000); 
    }} 
    style={{ 
      ...topBtnStyle, 
      background: "var(--color-primary)", 
      color: "var(--bg-card)", 
      border: "none", 
      padding: "8px 20px", 
      fontSize: "13px" 
    }} 
  > 
    Guardar cambios 
  </button>

      </div>
    </div>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
       <div>{rightPanelContent}</div>
       {!isCustom && (
        <div style={{ padding: "15px", borderRadius: 16, background: "var(--bg-soft)", border: "1px solid var(--color-border)" }}>
          <div style={{ fontWeight: 900, color: "var(--color-primary)", marginBottom: 8 }}>Notas</div>
          <textarea
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            onBlur={() => onChangeNotes(draftNotes)}
            placeholder={t('binders.item_info.free_notes')}
            rows={3}
            style={{ width: "100%", padding: "10px", borderRadius: 12, border: "1px solid var(--color-border)", fontWeight: 700, fontSize: 13, resize: "none" }}
          />
        </div>
      )}
    </div>
  </div>
    </div>
      </div>
  );
} // <--- AQUÍ TERMINA BinderItemModal

// 👇 PÉGALO JUSTO AQUÍ, EN ESTE ESPACIO 👇

// ==========================================
// ATAJO DE TECLADO: CTRL+Z / CMD+Z
// ==========================================
useEffect(() => {
  const handleGlobalUndo = (e: KeyboardEvent) => {
    // Detecta Ctrl + Z (Windows/Linux) o Cmd + Z (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      // Ignora si está pulsando Shift (eso sería Rehacer, que de momento no tenemos)
      if (e.shiftKey) return;

      // Si el usuario está escribiendo en un input, textarea o buscador,
      // dejamos que el navegador haga el "Deshacer texto" nativo y no intervenimos.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || target?.isContentEditable;
      
      if (isTyping) return;

      // Prevenimos cualquier otra acción por defecto del navegador
      e.preventDefault();
      e.stopPropagation();

      // Averiguamos qué modal está abierto para disparar el "Deshacer" correcto
      const isItemModalOpen = modalItemId != null && modalSlotIndex != null;

      if (isItemModalOpen) {
        void doModalUndo();
      } else if (pagesOpen) {
        void doPagesModalUndo();
      } else {
        void doUndo(); // Deshacer principal del binder
      }
    }
  };

  window.addEventListener("keydown", handleGlobalUndo);
  return () => window.removeEventListener("keydown", handleGlobalUndo);
}, [pagesOpen, modalItemId, modalSlotIndex, doUndo, doPagesModalUndo, doModalUndo]);

  

  // You need to define the state hook above in your component:
  // const [profileMenuOpen, setProfileMenuOpenState] = useState(false);


  

// [Página 233 aprox. de tu código]
return (
  <div
    className="binder-page-shell"
    // ✅ PASO 2: Pega esto aquí para limpiar el rastro al soltar fuera
    onDragOver={(e) => { if (!isMobile) e.preventDefault(); }}
    onMouseUp={() => {
      setPageDragFromId(null);
      setPageDragOverId(null);
    }}
    onDragEnd={() => {
      setPageDragFromId(null);
      setPageDragOverId(null);
    }}
  >
   
    {/* El resto de tu código sigue igual... */}
  <div style={{ 
    width: "100%", 
    maxWidth: "100vw", 
    overflowX: "hidden", 
    margin: isMobile ? "0 auto" : "40px auto", 
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  }}>
      
      

      <style jsx global>{`
      /* Añadir en tu bloque <style jsx global> */
.status-popup {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--text-main);
  color: white;
  padding: 10px 20px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 13px;
  box-shadow: 0 8px 20px var(--overlay-soft);
  z-index: 100000;
  pointer-events: none;
  animation: slideUpFade 0.3s ease-out;
}


  /* Badge de cantidad centrado (SIEMPRE VISIBLE) */
  .pcQtyBadgeCentered {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 960;
    padding: 3px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-card) 95%, transparent);
    border: 1px solid var(--state-disabled-border);
    font-size: 11px;
    font-weight: 950;
    color: var(--text-main);
    box-shadow: 0 4px 10px var(--overlay-faint);
    opacity: 1 !important; /* 👈 ESTO FUERZA A QUE SIEMPRE SE VEA */
    pointer-events: none;
  }

  /* Botón eliminar inferior derecho */
  .pcDeleteCorner {
    position: absolute;
    bottom: 10px;
    right: 10px;
    z-index: 101;
    opacity: 0;
    transform: translateY(4px);
    transition: all 140ms ease;
  }

  @keyframes float {
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-15px) rotate(2deg); }
  100% { transform: translateY(0px) rotate(0deg); }
}

/* Forzamos que se vea en móvil */
.floating-pc {
  animation: float 4s ease-in-out infinite;
  will-change: transform; /* Esto activa la GPU del móvil */
  display: block !important; /* Evita que algún estilo lo oculte */
}
  
  /* Ajuste para el badge xN centrado si hay hover */
  .pcSlotWrap:hover .pcQtyBadgeCentered {
    transform: translateX(-50%) translateY(0);
  }

@keyframes slideUpFade {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
  /* Declaración de la fuente personalizada */
  @font-face {
    font-family: 'TanTangkiwood';
    src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
  }

  ${activeSkzoo ? `
    html, body, .pcSlot, .pickerCard, button, a, [role="button"] {
      cursor: default !important;
    }
    /* ... resto de tu lógica del cursor ... */
  ` : ''}
  
  /* Aplicar la fuente a los elementos que quieras */
  .tan-font {
    font-family: 'TanTangkiwood', sans-serif !important;
    text-transform: uppercase; /* Esta fuente suele lucir mejor en mayúsculas */
  }




    


        /* ✅ SOLO carrusel: “emergentes” a la mitad */
/* ✅ SOLO carrusel: número IGUAL que la X (círculo 16x16) */
/* Número de página idéntico a la X en el carrusel */
 .pagesCarousel .pageThumb .pageNumBadge {
  left: 8px !important;
  bottom: 8px !important;
  width: 16px !important;
  height: 16px !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 10px !important;
  border-radius: 999px !important;
  line-height: 1 !important;
 }


.pagesCarousel .pageDeleteBtn{
  right: 8px;
  bottom: 8px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  font-size: 10px;
  box-shadow: 0 6px 14px var(--overlay-faint);
}
@media (hover: hover) {
 .pageThumb .pageNumBadge {
  position: absolute;
  left: 6px;       /* Antes 10px */
  bottom: 6px;     /* Antes 10px */
  padding: 4px 8px; /* Antes 6px 10px */
  border-radius: 999px;
  border: 1px solid var(--state-info-border);
  background: var(--surface-float);
  backdrop-filter: blur(8px);
  font-weight: 900;
  font-size: 10px; /* Antes 12px */
  color: var(--state-info-fg);
  box-shadow: 0 10px 24px var(--overlay-faint);
  pointer-events: none;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 140ms ease, transform 140ms ease;
  z-index: 50;
 }
@keyframes dropPulse {
  0% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 30px color-mix(in srgb, var(--color-primary) 80%, transparent); }
  100% { transform: scale(1); opacity: 0.6; }
}



/* En móvil/tablet (sin hover), mejor que se vea siempre */
@media (hover: none) {
  .pageThumb .pageNumBadge {
    opacity: 1;
    transform: translateY(0);
  }
}
 .pageThumb{
  position: relative;
  overflow: visible; /* ✅ por si algún contenedor lo recorta */
}
  /* ✅ el preview debajo */
.pageThumbPreview{
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}


/* Número de página: visible en móvil, emergente en hover */
.pageThumb .pageNumBadge {
  position: absolute;
  left: 10px;
  bottom: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--state-info-border);
  background: var(--surface-float);
  backdrop-filter: blur(8px);
  font-weight: 900;
  font-size: 12px;
  color: var(--state-info-fg);
  box-shadow: 0 10px 24px var(--overlay-faint);
  pointer-events: none;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 140ms ease, transform 140ms ease;
}
/* Añadir dentro de <style jsx global> */
.pageThumb {
  -webkit-touch-callout: none; /* Desactiva el menú contextual de imagen en iOS */
  touch-action: none;          /* Imprescindible para que el drag funcione en táctil */
}

/* Opcional: un feedback visual cuando el usuario mantiene pulsado en móvil */
.pageThumb:active {
  cursor: grabbing;
  transform: scale(1.05);
}
/* ❌ botón borrar */
.pageDeleteBtn{
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid var(--state-disabled-border);
  background: var(--surface-float);
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 24px var(--overlay-faint);
  font-weight: 950;
  cursor: pointer;
  color: var(--state-danger-fg);
  display: inline-flex;
  align-items: center;
  justify-content: center;

  opacity: 0;
  transform: translateY(2px) scale(0.98);
  pointer-events: none;
  transition: opacity 140ms ease, transform 140ms ease, border-color 140ms ease, background 140ms ease;
}
@keyframes liveHeartFly {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-150px) translateX(20px) scale(1.5); opacity: 0; }
}
@media (hover: hover){
  .pageThumb:hover .pageDeleteBtn{
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }
  .pageDeleteBtn:hover{
    border-color: var(--state-danger-border);
    background: color-mix(in srgb, var(--state-danger-bg) 95%, transparent);
  }
}

/* En móvil/tablet: visible siempre */
@media (hover: none){
  .pageDeleteBtn{
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }
}
  .pageThumb .pageNumBadge{
  position:absolute;
  left:10px;
  bottom:10px;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid var(--state-info-border);
  background:var(--surface-float);
  backdrop-filter:blur(8px);
  font-weight:900;
  font-size:12px;
  color:var(--state-info-fg);
  box-shadow:0 10px 24px var(--overlay-faint);
  pointer-events:none;
  opacity:0;
  transform:translateY(2px);
  transition:opacity 140ms ease, transform 140ms ease;
}

@media (hover: hover){
  .pageThumb:hover .pageNumBadge{
    opacity:1;
    transform:translateY(0);
  }
}
/* ✅ controles por encima */
.pageThumb .pageNumBadge{
  z-index: 50;
}

.pageDeleteBtn{
  z-index: 60;
}
@media (hover: none){
  .pageThumb .pageNumBadge{
    opacity:1;
    transform:translateY(0);
  }
}

@keyframes shiftSlideRight {
  0% { transform: translateX(0); }
  45% { transform: translateX(10px); }
  100% { transform: translateX(0); }
}

@keyframes shiftSlideLeft {
  0% { transform: translateX(0); }
  45% { transform: translateX(-10px); }
  100% { transform: translateX(0); }
}

@keyframes shiftPulse {
  0% { opacity: 0; transform: scale(0.98); }
  35% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.01); }
}

          .pcSlot {
            position: relative;
          }
          .pcSlotWrap {
            position: relative;
          }
         .pcControls {
 position: absolute;
 top: 8px;
 left: 50%;
 transform: translateX(-50%) translateY(-2px);
 display: flex;
 gap: 6px;
 opacity: 0;
 pointer-events: none;
 transition: opacity 120ms ease, transform 120ms ease;
 z-index: 60;
}
.pcControlsBottom{
 position: absolute;
 left: 50%;
 bottom: 10px;
 transform: translateX(-50%) translateY(4px) scale(0.98);
 display: flex;
 gap: 6px;
 opacity: 0;
 pointer-events: none;
 transition: opacity 140ms ease, transform 140ms ease;
 z-index: 80;
}
.pcControlsBottom button{
 color: var(--state-danger-fg);
}
@media (hover: hover){
 .pcControlsBottom button:hover{
 border-color: var(--state-danger-border);
 background: var(--state-danger-bg);
 color: var(--state-danger-fg);
 }
}
@media (hover: hover){
 .pcSlotWrap:hover .pcControlsBottom{
 opacity: 1;
 pointer-events: auto;
 transform: translateX(-50%) translateY(0) scale(1);
 }
}

/* móvil/tablet */
@media (hover: none){
  .pcControlsBottom{
    opacity: 1;
    pointer-events: auto;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@media (hover: hover) {
  .pcSlotWrap:hover .pcControlsBottom{
    opacity: 1;
    pointer-events: auto;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@media (hover: none) {
  .pcControlsBottom{
    opacity: 1;
    pointer-events: auto;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

/* ✅ Badge ×N emergente (como controles) */
.pcQtyBadge{
  position: absolute;
  left: 8px;
bottom: 8px;
  z-index: 260;

  padding: 3px 7px;
  border-radius: 999px;
  border: 1px solid var(--overlay-faint);
  background: var(--surface-float);
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 24px var(--overlay-faint);

  font-size: 11px;
  font-weight: 950;
  color: var(--text-main);

  display: inline-flex;
  align-items: center;
  gap: 5px;

  pointer-events: none;

  /* 👇 emergente */
  opacity: 0;
  transform: translateY(2px) scale(0.94);
  transform-origin: bottom right;
  transition: opacity 140ms ease, transform 140ms ease;
}

/* desktop: aparece al hover del slot */
@media (hover: hover){
  .pcSlotWrap:hover .pcQtyBadge{
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* móvil/tablet: visible siempre (no hay hover) */
@media (hover: none){
  .pcQtyBadge{
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.pcSlot.swapFx {
  animation: swapPop 260ms ease-out;
  will-change: transform;
}
  .swapFx {
  animation: swapPop 0.26s ease;
}

.iconDangerHover {
  border: 1px solid var(--state-disabled-border);
  background: var(--bg-card);
  color: var(--icon-color, var(--text-muted));
  --icon-color: var(--text-muted);
}

.modalCloseBtn {
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
  --icon-shadow: 0 10px 24px var(--overlay-faint);
}

@media (hover: hover) {
  .modalCloseBtn:hover:not(:disabled) {
    transform: translateY(-1px);
    --icon-shadow: 0 8px 18px var(--overlay-faint);
    border-color: var(--state-disabled-border);
  }
}

.modalCloseBtn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

@media (hover: hover) {
  .iconDangerHover:hover:not(:disabled) {
    border-color: var(--state-danger-border);
    background: var(--state-danger-bg);
    --icon-color: var(--state-danger-fg);
    --icon-shadow: 0 8px 18px color-mix(in srgb, var(--state-danger-fg) 18%, transparent);
  }
}
  
         @media (hover: hover) {
  .pcSlotWrap:hover .pcControls {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(-50%) translateY(0);
  }
}
  
.modalPcWrap { position: relative; }

.modalPcControls{
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 8px;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-2px);
  transition: opacity 140ms ease, transform 140ms ease;
  z-index: 80;
}

.modalPcControls button{
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid var(--state-disabled-border);
  background: var(--surface-float);
  backdrop-filter: blur(8px);
  font-weight: 950;
  cursor: pointer;
  box-shadow: 0 10px 24px var(--overlay-faint);
}

@media (hover: hover){
  .modalPcWrap:hover .modalPcControls{
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }
}

@media (hover: none){
  .modalPcControls{
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }
}
          
/* Tooltip para PC personalizada (dummy) */
.customTipWrap{
  position: relative;
}

/* Tooltip para PC personalizada (DENTRO del slot, 2 líneas) */
.customTip{
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translateX(-50%) translateY(-50%) scale(0.98);

  /* ancho relativo al slot, no a la pantalla */
  width: calc(100% - 16px);
  max-width: 220px;

  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid var(--state-disabled-border);
  background: var(--surface-float-strong);
  backdrop-filter: blur(8px);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--text-main) 16%, transparent);

  color: var(--text-main);
  font-size: 12px;
  line-height: 1.25;
  font-weight: 700;
  text-align: left;

  /* ✅ 2 líneas máximo */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: visible;
  text-overflow: ellipsis;
  white-space: normal;
  word-break: break-word;

  /* ✅ no bloquea clicks de botones */
  pointer-events: none;

  z-index: 40;
  opacity: 0;
  transition: opacity 140ms ease, transform 140ms ease;
}

/* ✅ vuelve el “emergente” al pasar el ratón por el slot */
@media (hover: hover){
  .pcSlot:hover .customTip{
    opacity: 1;
    transform: translateX(-50%) translateY(-50%) scale(1);
  }
}

/* móvil/tablet (sin hover): lo ocultamos para no molestar */
@media (hover: none){
  .customTip{ display:none; }
}
  /* === NUEVO SISTEMA DE CORAZONES (PASO FINAL) === */

  /* Contenedor de la ráfaga: ocupa todo el slot pero deja salir los corazones */
  .heartsBurstArea {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 150;
    overflow: visible;
  }

  /* El corazón que vuela */
 .floating-heart-new {
    position: absolute;
    bottom: 20%;
    font-size: 24px;
    z-index: 9999 !important;
    pointer-events: none;
    animation: heartFlyUp 1.2s ease-out forwards;
  }

  @keyframes heartFlyUp {
    0% { transform: translateY(0) scale(0.5); opacity: 0; }
    30% { opacity: 1; transform: translateY(-20px) scale(1.2); }
    100% { transform: translateY(-160px) translateX(30px) scale(1.5); opacity: 0; }
  }

  /* Animación: sube, se desplaza un poco a la derecha y desaparece */
  @keyframes heartFlyUp {
    0% { 
      transform: translateY(0) scale(0.8); 
      opacity: 0; 
    }
    20% { 
      opacity: 1; 
    }
    100% { 
      transform: translateY(-160px) translateX(30px) scale(1.6); 
      opacity: 0; 
    }
  }
/* === CONTROLES EMERGENTES (Rotar, Eliminar, Badge xN) === */
  
  /* Estado base: invisibles y un poco desplazados hacia abajo */
  .pcControls, 
  .pcDeleteCorner, 
  .pcQtyBadgeCentered {
    opacity: 0 !important;
    pointer-events: none !important;
    transition: all 150ms ease-in-out !important;
    transform: translateY(5px) !important;
  }

  /* Estado Hover: Cuando el ratón entra en el Slot, aparecen */
  .pcSlotWrap:hover .pcControls,
  .pcSlotWrap:hover .pcDeleteCorner,
  .pcSlotWrap:hover .pcQtyBadgeCentered {
    opacity: 1 !important;
    pointer-events: auto !important;
    transform: translateY(0) !important;
  }

  /* Posicionamiento específico para que no se muevan */
  .pcControls {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%) translateY(5px) !important;
    display: flex;
    gap: 6px;
  }
  
  .pcSlotWrap:hover .pcControls {
    transform: translateX(-50%) translateY(0) !important;
  }

  .pcDeleteCorner {
    position: absolute;
    bottom: 10px;
    right: 10px;
  }

  .pcQtyBadgeCentered {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%) translateY(5px) !important;
    padding: 3px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-card) 95%, transparent);
    border: 1px solid var(--state-disabled-border);
    font-size: 11px;
    font-weight: 900;
    color: var(--text-main);
    box-shadow: 0 4px 10px var(--overlay-faint);
  }

  .pcSlotWrap:hover .pcQtyBadgeCentered {
    transform: translateX(-50%) translateY(0) !important;
  }

  /* === SISTEMA DE CORAZONES === */

  .pcFixedHeart {
 position: absolute;
 bottom: 8px;
 left: 8px;
 z-index: 450;
 width: 26px;
 height: 26px;
 display: flex;
 align-items: center;
 justify-content: center;
 background: transparent;
 border: none;
 box-shadow: none;
 pointer-events: auto;
 padding: 0;
}

  .heartsBurstArea {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 400;
    overflow: visible;
  }

  .floating-heart-new {
    position: absolute;
    bottom: 20%;
    font-size: 20px;
    user-select: none;
    z-index: 600;
    animation: heartFlyUp 1.2s ease-out forwards;
  }

  @keyframes heartFlyUp {
    0% { transform: translateY(0) scale(0.5); opacity: 0; }
    20% { opacity: 1; transform: translateY(-20px); }
    100% { transform: translateY(-140px) translateX(30px) scale(1.5); opacity: 0; }
  }
.pagesCarousel::-webkit-scrollbar {
  display: none; /* Oculta la barra nativa para usar nuestra barra de progreso */
}
.pagesCarousel {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

/* Estilo para el botón deslizador */
.custom-range-slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  background: var(--bg-card);
  border: 2px solid var(--color-primary); /* O usa binderColor si es dinámico */
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px var(--overlay-faint);
}

.custom-range-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: var(--bg-card);
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px var(--overlay-faint);
}

        `}</style>
{binderPages.length > 0 && (
  <div style={{ width: "100%", marginTop: 14 }}>
    
    {/* TÍTULO + BOTÓN VOLVER */}
    <div style={{ 
      width: "100%", 
      maxWidth: isMobile ? 390 : 1120, 
      margin: "0 auto 15px auto", 
      padding: isMobile ? "0 12px" : "0 20px", 
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 4, height: 24, background: binderColor || "var(--color-primary)", borderRadius: 2 }} />
        <h2 style={{ margin: 0, fontSize: isMobile ? 22 : 32, fontWeight: 950, color: "var(--text-main)", letterSpacing: "-0.5px" }}>
          {binderTitle}
        </h2>
      </div>

      <button 
        onClick={() => router.push('/binders')}
        style={{
          ...topBtnStyle,
          padding: "8px 12px",
          fontSize: 12,
          background: "var(--bg-card)",
          display: "flex",
          alignItems: "center",
          gap: 6
        }}
      >
        <Undo2 size={14} /> {isMobile ? "" : "Mis Binders"}
      </button>
    </div>

  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: 10 }}>
    
    {/* ✅ BLOQUE DE TIP INFORMATIVO (Solo visible en móvil) */}
    {isMobile && (
        <div style={{ 
            marginBottom: 12, 
            padding: "8px 16px", 
            borderRadius: 12, 
            background: "var(--bg-main)", 
            border: "1px dashed var(--color-primary)",
            width: "fit-content",
            maxWidth: "90%"
        }}>
            <div style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 800, lineHeight: 1.4 }}>
                {mobileMoveSourceId === null 
                    ? "💡 Tip: Toca una página para moverla de sitio." 
                    : "✨ Ahora toca el hueco donde quieras colocarla."}
            </div>
        </div>
    )}

    <div style={{ 
        width: "100%", 
        maxWidth: isMobile ? 390 : 1120, 
        display: "flex", 
        flexDirection: isMobile ? "column" : "row", 
        alignItems: "center", 
        justifyContent: "center", 
        gap: 15 
    }}>


       {/* CARRUSEL DE PÁGINAS */}
<div
  id="pagesCarouselContainer"
  className="pagesCarousel"
  style={{
    display: "flex",         // 👈 VITAL para alinear en horizontal
    alignItems: "center",    // 👈 Centra los elementos verticalmente
    gap: "16px",             // 👈 Añade separación entre miniaturas
    width: "100%",           // 👈 Ocupa todo el ancho
    overflowX: "auto",
    overflowY: "visible",    // Mantiene la luz visible
    padding: "25px 20px",    
    minHeight: "180px",
    boxSizing: "border-box"
  }}
>
        {/* CONTENEDOR DEL CARRUSEL DE PÁGINAS */}

{binderPages
  .slice()
  .sort((a, b) => a.page_index - b.page_index)
  .map((p, idx) => {
    const active = idx === currentPageIndex;
    const isSelectedToMove = mobileMoveSourceId === p.id;
    
    // Estados de iluminación (leídos directamente desde el root de BinderClient)
   const isTarget = pageDragOverId === p.id;
const isDraggingMe = pageDragFromId === p.id;


   return (
          <div
            key={`carousel-page-${p.id}`}
            onClick={() => {
              if (deleteMode) {
                // MODO SELECCIÓN: Marcamos o desmarcamos
                setSelectedForDeletion(prev =>
                  prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                );
              } else {
                // MODO NORMAL: Cambiamos de página
                if (!pageDragFromId) setCurrentPageIndex(idx);
              }
            }}
            style={{
              flex: "0 0 auto",
              position: "relative",
              padding: "8px 6px",
              zIndex: isTarget ? 150 : 1,
              cursor: deleteMode ? "pointer" : "default" // Cursor click en modo borrar
            }}
          >
            {/* ✅ LA LUZ ROSA DE DRAG & DROP */}
            {isTarget && !isDraggingMe && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 16,
                  border: "3px solid var(--color-primary)",
                  background: "color-mix(in srgb, var(--color-primary) 25%, transparent)",
                  boxShadow: "0 0 20px color-mix(in srgb, var(--color-primary) 50%, transparent)",
                  zIndex: 0,
                  pointerEvents: "none",
                  animation: "dropPulse 400ms ease-out infinite"
                }}
              />
            )}

            {/* MARCO SELECCIÓN (Móvil) */}
            {isSelectedToMove && (
              <div style={{ position: "absolute", inset: 2, borderRadius: 14, border: "3px solid var(--color-primary)", zIndex: 5, pointerEvents: "none" }} />
            )}

            {/* ✅ CONTENEDOR PRINCIPAL CON OPACIDAD (Igual que en "Ver Todas") */}
            <div style={{
              opacity: isDraggingMe ? 0.3 : (deleteMode && !selectedForDeletion.includes(p.id) ? 0.6 : 1),
              transition: "opacity 0.2s ease",
              position: "relative",
              zIndex: 10
            }}>

              {/* ✅ CHECKBOX DEL MODO BORRAR (Circulito gigante) */}
              {deleteMode && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: selectedForDeletion.includes(p.id) ? "color-mix(in srgb, var(--color-primary) 20%, transparent)" : "transparent",
                  pointerEvents: 'none' // Deja pasar el clic al div padre
                }}>
                  <div style={{
                    width: 28, height: 28,
                    borderRadius: '50%',
                    background: selectedForDeletion.includes(p.id) ? "var(--color-primary)" : "var(--bg-card)",
                    border: "2px solid var(--color-border)",
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: "var(--bg-card)", fontWeight: 900, fontSize: 14,
                    boxShadow: "0 4px 10px var(--overlay-faint)"
                  }}>
                    {selectedForDeletion.includes(p.id) ? "✓" : ""}
                  </div>
                </div>
              )}

              {/* ✅ CONTENEDOR DRAG & DROP (Bloqueado durante el borrado) */}
              <div
                draggable={!isMobile && !deleteMode}
                onDragStart={(e) => {
                  if (isMobile || deleteMode) return;
                  pageDraggingRef.current = true;
                  setPageDragFromId(p.id);
                  setPageDragOverId(null);
                  const payload = { pageId: p.id };
                  lastPageDragRef.current = payload;
                  setDragData(e.dataTransfer, JSON.stringify(payload));
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (deleteMode) return;
                  if (pageDragFromId !== null && pageDragFromId !== p.id) {
                    setPageDragOverId(p.id);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (deleteMode) return;
                  e.dataTransfer.dropEffect = "move";
                }}
                onDragLeave={() => setPageDragOverId(null)}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (deleteMode) return;
                  const raw = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
                  const fromPayload = parsePageDragPayload(raw) ?? lastPageDragRef.current;
                  if (!fromPayload) return;
                  await reorderPagesInState(fromPayload.pageId, p.id);
                  pageDraggingRef.current = false;
                  setPageDragFromId(null);
                  setPageDragOverId(null);
                }}
                onDragEnd={() => {
                  pageDraggingRef.current = false;
                  setPageDragFromId(null);
                  setPageDragOverId(null);
                }}
                style={{
                  // 🔥 EL ESCUDO: Si estamos borrando, desactiva los botones internos
                  pointerEvents: deleteMode ? "none" : "auto" 
                }}
              >
                <PageThumb
                  pageId={p.id}
                  layoutKey={p.layout_type}
                  active={active && !deleteMode}
                  size="carousel"
                  pageNumber={idx + 1}
                  showPageNumber={true}
                  refreshTick={refreshTick}
                  title={`Ir a página ${idx + 1}`}
                  onClick={() => {}} // Ya lo maneja el padre
                  draggable={false}
                  onDeletePage={deleteMode ? undefined : async (id) => {
                    const ok = await showConfirm(
                      t("common.confirm"),
                      `¿Borrar la página ${idx + 1}? Se perderán los slots colocados.`,
                    );
                    if (ok) {
                      deletePageById(id);
                    }
                  }}
                />
              </div>

              {/* BOTÓN MÓVIL VER PÁGINA */}
              {isMobile && isSelectedToMove && !deleteMode && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrentPageIndex(idx); setMobileMoveSourceId(null); }}
                    style={{ background: "var(--bg-card)", border: "1px solid var(--state-disabled-border)", borderRadius: "8px", fontSize: "10px", padding: "5px 10px", fontWeight: 800, color: "var(--color-primary)" }}
                  >
                    Ver esta página
                  </button>
                </div>
              )}
            </div>
          </div>
        );
})}
        </div>
        
  


      </div>

      {/* ✅ BARRA DESLIZADORA PURAMENTE DE NAVEGACIÓN (MÓVIL) */}
      {isMobile && binderPages.length > 1 && (
        <div style={{ width: "70%", marginTop: 10, marginBottom: 20 }}>
          <input 
            type="range"
            min="0"
            max={100} // Usamos porcentaje para un scroll más fino
            defaultValue={0}
            onInput={(e) => {
              const val = parseInt((e.target as HTMLInputElement).value);
              const container = document.getElementById("pagesCarouselContainer");
              if (container) {
                // ✅ Mueve el scroll basándose en el porcentaje del slider
                const maxScroll = container.scrollWidth - container.clientWidth;
                const scrollTarget = (val / 100) * maxScroll;
                container.scrollTo({ left: scrollTarget, behavior: "auto" });
              }
            }}
            style={{
              width: "100%",
              height: "6px",
              appearance: "none",
              background: "var(--state-disabled-border)",
              borderRadius: "10px",
              outline: "none",
            }}
            className="custom-range-slider"
          />
        </div>
      )}

     
    </div>
  </div>
)}

{/* ✅ Guía y bloque de controles debajo del carrusel */}
<div
  style={{
    marginTop: 14,
    display: "flex",
    justifyContent: "center",
    gap: 10,
    alignItems: "center",
    width: "100%",
    maxWidth: isMobile ? 390 : 1120,
    marginLeft: "auto",
    marginRight: "auto",
    paddingLeft: isMobile ? 12 : 0,
    paddingRight: isMobile ? 12 : 0,
    boxSizing: "border-box",
    flexWrap: "wrap",
  }}
>
{/* CONTENEDOR DE SELECTORES Y BOTÓN VER TODAS */}
<div 
  style={{ 
    marginTop: 14, 
    display: "flex", 
    justifyContent: "center", 
    gap: 10, 
    alignItems: "center", 
    width: "100%", 
    maxWidth: isMobile ? 390 : 1120, 
    marginLeft: "auto", 
    marginRight: "auto", 
    paddingLeft: isMobile ? 12 : 0, 
    paddingRight: isMobile ? 12 : 0, 
    boxSizing: "border-box", 
    flexWrap: "wrap", 
  }} 
> 
  {/* Selector de Cursor SKZOO */}
  <div ref={skzooBoxRef} style={{ position: "relative", display: "inline-block" }}> 
    <button 
      type="button" 
      onClick={() => setSkzooOpen(!skzooOpen)} 
      style={{ 
        ...topBtnStyle, 
        minWidth: 120, 
        justifyContent: "space-between", 
        border: activeSkzoo ? "2px solid var(--binder-btn-outline-fg)" : "1px solid var(--binder-btn-outline-border)", 
        background: activeSkzoo ? "var(--bg-soft)" : "var(--binder-btn-outline-bg)" 
      }} 
    > 
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}> 
        <span style={{ fontSize: 13, color: "var(--binder-btn-outline-fg)", fontWeight: 900 }}>Cursor</span> 
        {activeSkzoo && <img src={activeSkzoo.img} style={{ width: 20, height: 20, objectFit: "contain" }} alt="" />} 
      </div> 
      <span style={{ fontSize: 10, opacity: 0.55, color: "var(--binder-btn-outline-fg)" }}>{skzooOpen ? "▲" : "▼"}</span> 
    </button> 
    {skzooOpen && ( 
      <div style={{ 
        position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 1100, 
        width: 260, background: "var(--bg-card)", border: "1px solid var(--state-disabled-border)", borderRadius: 14, 
        boxShadow: "0 12px 32px var(--overlay-faint)", padding: 10, 
        maxHeight: "450px", overflowY: "auto" 
      }}> 
        <button 
          onClick={() => { 
            setActiveSkzoo(null); 
            setSkzooOpen(false); 
            localStorage.removeItem("binder:skzoo-cursor"); 
          }} 
          style={{ 
            width: "100%", height: 38, marginBottom: 12, borderRadius: 10, 
            border: "1px solid var(--state-disabled-border)", background: "var(--state-disabled-bg)", cursor: "pointer", 
            display: "flex", alignItems: "center", justifyContent: "center", 
            fontSize: 12, fontWeight: 800, color: "var(--text-muted)", gap: 8 
          }} 
        > 
          <span style={{ fontSize: 14 }}>🚫 </span> {t("binders.remove_custom_cursor")} 
        </button> 
        <input 
          type="text" 
          placeholder={t("binders.search_cursor_placeholder")} 
          value={cursorQuery} 
          onChange={(e) => setCursorQuery(e.target.value)} 
          style={{ 
            width: "100%", padding: "8px 10px", borderRadius: 8, 
            border: "1px solid var(--state-disabled-border)", fontSize: 12, marginBottom: 12, outline: "none" 
          }} 
        /> 
        {(() => { 
          const allMascots = CURSOR_GROUPS.flatMap(g => g.mascots); 
          const favMascots = allMascots.filter(m => 
            favorites.includes(m.id) && 
            (m.name + (m as any).artist).toLowerCase().includes(cursorQuery.toLowerCase()) 
          ); 
          if (favMascots.length === 0) return null; 
          return ( 
            <div style={{ marginBottom: 16, borderBottom: "1px solid var(--state-disabled-bg)", paddingBottom: 12 }}> 
              <div style={{ fontSize: 10, fontWeight: 900, color: "var(--color-primary)", textTransform: "uppercase", marginBottom: 8 }}>⭐ {t("common.my_favorites")}</div> 
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}> 
                {favMascots.map(m => ( 
                  <button key={`fav-${m.id}`} onClick={() => { setActiveSkzoo(m); setSkzooOpen(false); }} style={{ borderRadius: 10, position: "relative", border: activeSkzoo?.id === m.id ? "2px solid var(--color-accent-blue)" : "1px solid var(--state-disabled-border)", background: "var(--bg-card)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 4px" }}>
                    <span onClick={(e) => toggleFavorite(e, m.id)} style={{ position: "absolute", top: 2, left: 2, fontSize: 10 }}>⭐ </span> 
                    <img src={m.img} style={{ width: 28, height: 28, objectFit: "contain" }} alt="" /> 
                    <span style={{ fontSize: 8, fontWeight: 800, marginTop: 4, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.1 }}>{m.name}</span> 
                  </button> 
                ))} 
              </div> 
            </div> 
          ); 
        })()} 
        {CURSOR_GROUPS.map(group => { 
          const filtered = group.mascots.filter(m => 
            m.name.toLowerCase().includes(cursorQuery.toLowerCase()) || 
            m.artist.toLowerCase().includes(cursorQuery.toLowerCase()) 
          ); 
          if (filtered.length === 0) return null; 
          return ( 
            <div key={group.groupName} style={{ marginBottom: 16 }}> 
              <div style={{ fontSize: 10, fontWeight: 900, color: "var(--state-disabled-fg)", textTransform: "uppercase", marginBottom: 8 }}>{group.groupName}</div> 
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}> 
                {filtered.map(it => ( 
                  <button key={it.id} onClick={() => { setActiveSkzoo(it); setSkzooOpen(false); }} style={{ borderRadius: 10, position: "relative", border: activeSkzoo?.id === it.id ? "2px solid var(--color-accent-blue)" : "1px solid var(--state-disabled-border)", background: "var(--bg-card)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 4px" }}>
                    <span onClick={(e) => toggleFavorite(e, it.id)} style={{ position: "absolute", top: 2, left: 2, fontSize: 10, opacity: favorites.includes(it.id) ? 1 : 0.2 }}>⭐ </span> 
                    <img src={it.img} style={{ width: 28, height: 28, objectFit: "contain" }} alt="" /> 
                    <span style={{ fontSize: 8, fontWeight: 800, marginTop: 4, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.1 }}>{it.name}</span> 
                  </button> 
                ))} 
              </div> 
            </div> 
          ); 
        })} 
      </div> 
    )} 
  </div> 

  {/* Selector de Formato */}
  <div ref={layoutBoxRef} style={{ position: "relative", display: "inline-block" }}> 
    <button 
      type="button" 
      onClick={() => setLayoutOpen((v) => !v)} 
      style={{ 
        ...topBtnStyle, 
        display: "inline-flex", 
        alignItems: "center", 
        justifyContent: "space-between", 
        gap: 10, 
        minWidth: 120 
      }} 
      title={t("binders.change_format")} 
    > 
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}> 
        <span style={{ fontSize: 14, color: "var(--binder-btn-outline-fg)", fontWeight: 900 }}>{t("binders.format")}</span> 
        <div style={{ width: 44, height: 32, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}> 
          <div style={{ transform: "scale(0.5)", transformOrigin: "center" }}> 
            <LayoutMiniPreview layoutKey={layout} size="carousel" refreshTick={refreshTick} /> 
          </div> 
        </div> 
      </div> 
      <span style={{ fontSize: 10, opacity: 0.55, color: "var(--binder-btn-outline-fg)" }}>{layoutOpen ? "▲" : "▼"}</span> 
    </button> 
    {layoutOpen && ( 
      <div style={{ 
        position: "absolute", top: "calc(100% + 8px)", left: isMobile ? "auto" : 0, 
        right: isMobile ? 0 : "auto", zIndex: 1000, width: "260px", 
        background: "var(--bg-card)", border: "1px solid var(--state-disabled-border)", borderRadius: 12, 
        boxShadow: "0 12px 32px var(--overlay-faint)", overflow: "hidden" 
      }}> 
        <div style={{ padding: 12, borderBottom: "1px solid var(--state-disabled-border)" }}> 
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}> 
            <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}> 
              <button 
                type="button" 
                onClick={() => setApplyAll(false)} 
                style={{ 
                  flex: 1, padding: "6px 8px", borderRadius: 12, border: "1px solid var(--state-disabled-border)", 
                  background: !applyAll ? "var(--bg-soft)" : "var(--bg-card)", color: "var(--text-main)", fontWeight: 800, 
                  fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" 
                }} 
              > 
                {t("binders.scope_page")} 
              </button> 
              <button 
                type="button" 
                onClick={() => setApplyAll(true)} 
                style={{ 
                  flex: 1, padding: "6px 8px", borderRadius: 12, border: "1px solid var(--state-disabled-border)", 
                  background: applyAll ? "var(--bg-soft)" : "var(--bg-card)", color: "var(--text-main)", fontWeight: 800, 
                  fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" 
                }} 
              > 
                {t("binders.scope_all")} 
              </button> 
            </div> 
          </div> 
        </div> 
        <div style={{ maxHeight: 240, background: "var(--bg-main)", overflow: "auto", padding: 6 }}> 
          {LAYOUTS.map((l) => { 
            const isSelected = layout === l.key; 
            const isHover = layoutHover === l.key; 
            const bg = isSelected ? "var(--bg-soft)" : isHover ? "var(--state-info-bg)" : "var(--bg-card)"; 
            const border = isSelected ? "var(--color-accent-blue)" : isHover ? "var(--state-info-border)" : "var(--state-disabled-border)"; 
            const isSpec = (l as any).size === "special"; 
            return ( 
            <button 
    key={l.key} 
    type="button" 
    onMouseEnter={() => setLayoutHover(l.key)} 
    onMouseLeave={() => setLayoutHover(null)} 
    onClick={async () => { 
      // 🚨 BLOQUEO VIP PARA LAYOUTS ESPECIALES 🚨
      const needsUnlock = isSpec && !profile?.is_premium && !isAdmin && !unlockedLayouts.has(l.key);
      if (needsUnlock) {
        if (!profile?.id) return;
        const cost = getLayoutUnlockCost(String(l.key));
        const balance = Number(profile?.puntos || 0);
        if (balance < cost) {
          showAlert(t("common.error"), `Necesitas ${cost} K-oins para desbloquear este layout.`);
          return;
        }
        const ok = await showConfirm(
          t("shop.confirm_modal.btn_confirm"),
          `Desbloquear este layout por ${cost} K-oins?`,
        );
        if (!ok) return;
        const unlockRes = await supabase
          .from("user_vip_unlocks")
          .upsert({ user_id: profile.id, unlock_key: unlockKeyForLayout(String(l.key)) }, { onConflict: "user_id,unlock_key" });
        if (unlockRes.error) {
          showAlert(t("common.error"), unlockRes.error.message);
          return;
        }
        const nextKoins = Math.max(0, balance - cost);
        const pointsRes = await supabase
          .from("profiles")
          .update({ puntos: nextKoins })
          .eq("user_id", profile.id);
        if (pointsRes.error) {
          showAlert(t("common.error"), pointsRes.error.message);
          return;
        }
        setUnlockedLayouts((prev) => {
          const next = new Set(prev);
          next.add(String(l.key));
          return next;
        });
        const localProfileStr = localStorage.getItem("me:profile");
        if (localProfileStr) {
          const parsed = JSON.parse(localProfileStr);
          parsed.puntos = nextKoins;
          localStorage.setItem("me:profile", JSON.stringify(parsed));
        }
        refreshGlobal();
        showAlert("Desbloqueado", `Layout desbloqueado por ${cost} K-oins.`);
      }
      
      await changeLayout(l.key); 
      setLayoutOpen(false); 
    }} 
    style={{ width: "100%", textAlign: "center", padding: 6, borderRadius: 14, border: `1px solid ${border}`, background: bg, cursor: "pointer", marginBottom: 10, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }} 
  >
                {isSpec && ( 
                  <span aria-hidden="true" style={{ position: "absolute", top: 8, right: 10, width: 24, height: 24, borderRadius: 999, background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}> 
                    <img src="/ui/premium-medal.png" style={{ width: 16, height: 16 }} alt={t('common.premium_account')} />
                  </span> 
                )} 
                <div style={{ marginTop: 6 }}> 
                  <LayoutMiniPreview layoutKey={l.key} size="picker" refreshTick={refreshTick} /> 
                </div> 
              </button> 
            ); 
          })} 
        </div> 
      </div> 
    )} 
  </div> 

  {/* Botón Ver todas */}
  <button 
    type="button" 
    onClick={() => setPagesOpen(true)} 
    style={{ 
      ...topBtnStyle, 
      minWidth: isMobile ? "auto" : 120, 
      justifyContent: "center", 
      gap: 8 
    }} 
  > 
    <span style={{ fontSize: 14, color: "var(--binder-btn-outline-fg)", fontWeight: 900 }}> 
      {`🔍 ${t("binders.picker.view_all")}`}
    </span> 
  </button>
</div>

   <div
  style={{
    display: "flex",
    alignItems: isMobile ? "flex-start" : "center",
    justifyContent: isMobile ? "space-between" : "center",
    gap: 10,
    width: "100%",
  }}
>
   
{/* CONTENEDOR MAESTRO DE BOTONES: Organizado en 3 filas centradas */}
  <div style={{ 
    width: "100%", 
    maxWidth: "100vw", 
    padding: isMobile ? "0 15px" : "0 20px", 
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 15,
    marginBottom: "20px"
  }}>

    {/* FILA 1: Cursor y Formato (Reutilizamos la lógica del contenedor padre) */}
    <div style={{ 
      display: "flex", 
      gap: 10, 
      width: "100%", 
      justifyContent: "center", 
      flexWrap: "wrap",
      alignItems: "center"
    }}>
       {/* Los selectores de Cursor y Formato ya están definidos arriba en tu código, 
           así que aquí agrupamos las acciones y toggles */}
    </div>

    {/* FILA 2: Acciones (+, Trash, Undo) Y Toggles (Voltear, Reverso) */}
    <div style={{ 
      display: "flex", 
      gap: isMobile ? 10 : 25, 
      justifyContent: "center", 
      width: "100%", 
      flexWrap: "wrap", 
      alignItems: "center" 
    }}>
      {/* Subgrupo Acciones en horizontal */}
   <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
  <button 
    type="button" 
    onClick={() => createNewPage('3x3')} // 👈 FIJO PARA QUE SIEMPRE SEA PÁGINA NORMAL
    style={{ ...topBtnStyle, width: 38, height: 38, padding: 0, justifyContent: "center", fontSize: 18 }} 
  > 
    + 
  </button>
  <button 
    type="button" 
    onClick={() => createNewPage('separator')} // 👈 FIJO PARA QUE SIEMPRE SEA SEPARADOR
    style={{
      ...topBtnStyle,
      width: "auto",
      padding: "0 12px",
      height: 38,
      justifyContent: "center",
      fontSize: 12,
      background: "var(--binder-btn-separator-bg)",
      color: "var(--binder-btn-separator-fg)",
      border: "none",
      boxShadow: "0 4px 14px color-mix(in srgb, var(--color-primary) 22%, transparent)",
    }} 
  > 
    <Bookmark size={14} style={{ marginRight: 6 }} /> {t("binders.actions.add_separator")}
  </button>
        {/* NUEVO BOTÓN DE BORRAR MÚLTIPLE EN EL CARRUSEL */}
  {deleteMode ? (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        onClick={() => { setDeleteMode(false); setSelectedForDeletion([]); }}
        style={{
          padding: "8px 12px",
          borderRadius: "99px",
          border: "1px solid var(--binder-btn-outline-border)",
          background: "var(--binder-btn-outline-bg)",
          color: "var(--binder-btn-outline-fg)",
          fontWeight: 800,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {t("common.cancel")}
      </button>
      <button
        onClick={deleteMultiplePages}
        disabled={selectedForDeletion.length === 0}
        style={{
          padding: "8px 12px",
          borderRadius: "99px",
          border: `2px solid var(--binder-btn-delete-border)`,
          background: selectedForDeletion.length > 0 ? "var(--binder-btn-delete-bg)" : "var(--state-disabled-bg)",
          color: selectedForDeletion.length > 0 ? "var(--binder-btn-delete-fg)" : "var(--state-disabled-fg)",
          fontWeight: 800,
          fontSize: 12,
          cursor: selectedForDeletion.length > 0 ? "pointer" : "not-allowed",
        }}
      >
        {t("binders.actions.delete")} ({selectedForDeletion.length})
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setDeleteMode(true)}
      className="iconDangerHover"
      style={{
        ...topBtnStyle,
        width: 38,
        height: 38,
        padding: 0,
        justifyContent: "center",
        border: `2px solid var(--binder-btn-delete-border)`,
        background: "var(--binder-btn-delete-bg)",
        color: "var(--binder-btn-delete-fg)",
        boxShadow: "0 2px 10px color-mix(in srgb, var(--binder-btn-delete-fg) 14%, transparent)",
      }}
      title={t("binders.select_multiple_delete")}
    >
      <Trash2 size={18} />
    </button>
  )}
        <button 
          type="button" 
          onClick={doUndo} 
          style={{
            ...topBtnStyle,
            width: 38,
            height: 38,
            padding: 0,
            justifyContent: "center",
            border: `1px solid var(--binder-btn-undo-border)`,
            background: "var(--binder-btn-undo-bg)",
            color: "var(--binder-btn-undo-fg)",
          }}
        >
          <Undo2 size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* Subgrupo Toggles */}
      <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
        <button type="button" onClick={togglePageRotateAll} style={{ border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--binder-btn-outline-fg)", fontWeight: 900 }}>{t("binders.actions.flip")}</span>
          <span style={{ width: 30, height: 16, borderRadius: 999, background: pageRotateAll ? "var(--binder-toggle-track-on)" : "var(--state-disabled-bg)", position: "relative", display: "inline-block" }}>
            <span style={{ width: 12, height: 12, borderRadius: 999, background: "var(--bg-card)", position: "absolute", top: 2, left: pageRotateAll ? 16 : 2, transition: "all 0.2s" }} />
          </span>
        </button>
        <button type="button" onClick={togglePageShowBackAll} style={{ border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--binder-btn-outline-fg)", fontWeight: 900 }}>{t("binders.actions.back_side")}</span>
          <span style={{ width: 30, height: 16, borderRadius: 999, background: pageShowBackAll ? "var(--binder-toggle-track-on)" : "var(--state-disabled-bg)", position: "relative", display: "inline-block" }}>
            <span style={{ width: 12, height: 12, borderRadius: 999, background: "var(--bg-card)", position: "absolute", top: 2, left: pageShowBackAll ? 16 : 2, transition: "all 0.2s" }} />
          </span>
        </button>
      </div>
    </div>

   {/* FILA 3: ZOOM Y GUARDADO MAESTRO */}
  <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", width: "100%", marginTop: 10, flexWrap: "wrap" }}>
    <span style={{ fontSize: 13, color: "var(--binder-btn-outline-fg)", fontWeight: 900 }}>{t("binders.zoom")}</span>
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 999, border: "1px solid var(--binder-btn-outline-border)", background: "var(--binder-btn-outline-bg)", boxShadow: "var(--binder-btn-outline-shadow)" }}>
      <button type="button" onClick={zoomOut} style={{ width: 28, height: 28, borderRadius: 999, border: "none", background: "none", color: "var(--binder-btn-outline-fg)", fontWeight: 900, cursor: "pointer" }}>-</button>
      <div style={{ minWidth: 42, textAlign: "center", fontWeight: 950, color: "var(--binder-btn-outline-fg)", fontSize: 12 }}>{Math.round(pageZoom * 100)}%</div>
      <button type="button" onClick={zoomIn} style={{ width: 28, height: 28, borderRadius: 999, border: "none", background: "none", color: "var(--binder-btn-outline-fg)", fontWeight: 900, cursor: "pointer" }}>+</button>
      <button type="button" onClick={zoomReset} style={{ marginLeft: 4, padding: "0 10px", height: 26, borderRadius: 999, border: "1px solid var(--binder-btn-outline-border)", background: "var(--bg-soft)", color: "var(--binder-btn-outline-fg)", fontWeight: 900, fontSize: 11, cursor: "pointer" }}>{t("binders.actions.reset")}</button>
    </div>

    {/* ✅ NUEVO BOTÓN PREVISUALIZAR */}
    <button 
      type="button" 
      onClick={() => setPreviewBinderOpen(true)} 
      title={t("binders.actions.preview")}
      style={{
        ...topBtnStyle,
        padding: "8px 16px",
        fontSize: 13,
        background: "var(--bg-soft)",
        border: "1px solid var(--binder-btn-outline-border)",
        color: "var(--binder-btn-outline-fg)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <BookText size={16} /> {t("binders.actions.preview")}
    </button>

    {/* ✅ BOTÓN MAESTRO DE GUARDADO (TAMAÑO REDUCIDO CON ICONO) */}
    <button 
      type="button" 
      onClick={async () => { 
        if (!pageId) return; 
        setStatus(t("binders.actions.saving")); 
        try { 
          const stateToPersist = new Map(); 
          slots.forEach(n => { 
            stateToPersist.set(n, { 
              item: slotItems[n] || null, 
              rot: slotRot[n] ?? 0, 
              flip: slotFlipH[n] ?? false, 
              face: slotFace[n] ?? "front" 
            }); 
          }); 
          await persistSlotsBulk(stateToPersist); 
          setRefreshTick(t => t + 1); 
          await loadPageThumbs(); 
          setStatus(t("binders.alerts.saved_binder")); 
        } catch (err) { 
          setStatus(t("common.error_saving")); 
        } finally { 
          setTimeout(() => setStatus(""), 3000); 
        } 
      }} 
      title={t("common.save_changes")}
      style={{
        ...topBtnStyle,
        background: "var(--binder-btn-save-bg)",
        color: "var(--binder-btn-save-fg)",
        padding: "8px 16px",
        border: "none",
        boxShadow: "var(--binder-btn-save-shadow)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }} 
    >
      💾 {t("common.save")}
    </button>
  </div>

  </div>
    </div>
      </div>
      {pageId ? (
  <div style={{ display: "flex", justifyContent: "center" }}>
    <div style={{ zoom: pageZoom as any }}>
      
      <div style={{ marginTop: 16 }}>
       {/* --- LÓGICA DE SEPARADOR --- */}
  {layout === 'separator' ? (
    <div style={{
      width: "320px",
      height: "520px", // Un poco más alto para que quepa todo bien
      padding: "30px",
      background: "var(--bg-card)",
      borderRadius: "20px",
      boxShadow: "0 10px 30px var(--overlay-faint)",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      border: `4px solid ${slotItems[1]?.custom_color || binderColor || "var(--color-primary)"}`,
      position: "relative",
      overflow: "hidden"
    }}>
      
      {/* FONDO DE IMAGEN DEL SEPARADOR (Si el usuario ya ha subido una) */}
      {slotItems[1]?.custom_image_url && (
        <img 
          src={slotItems[1].custom_image_url} 
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3, zIndex: 0 }} 
          alt=""
        />
      )}

      {/* CONTENIDO (Por encima de la imagen de fondo) */}
      <div style={{ zIndex: 1, position: "relative", width: "100%" }}>
       <Bookmark size={50} color={slotItems[1]?.custom_color || binderColor || "var(--color-primary)"} style={{ marginBottom: "15px", margin: "0 auto" }} />
        
        <h3 className="tan-font" style={{ color: "var(--text-main)", fontWeight: 950, marginBottom: "15px", fontSize: "18px" }}>
          CONFIGURACIÓN SEPARADOR
        </h3>

        {/* SECCIÓN 1: EL NOMBRE */}
        <div style={{ width: "100%", marginBottom: "20px" }}>
          <p style={{ fontSize: "11px", color: "var(--color-primary)", fontWeight: 900, marginBottom: "8px", textTransform: "uppercase" }}>
            Nombre en la pestaña
          </p>
          <input
            type="text"
            placeholder={t('binders.custom_pc.tab_placeholder')}
            style={{ 
              height: 40, padding: "8px 12px", borderRadius: 12, border: "2px solid var(--color-border)", 
              width: "100%", textAlign: "center", fontSize: "16px", fontWeight: 900, color: "var(--text-main)",
              outline: "none", boxSizing: "border-box"
            }}
            value={slotItems[1]?.name || ""}
            onChange={async (e) => {
               const val = e.target.value;
               setSlotItems(prev => ({
                 ...prev,
                 1: { ...prev[1], id: 999999, is_custom: true, custom_text: val, name: val } as any
               }));
               await persistSlotState(1, { kind: 'custom', custom_text: val, custom_image_url: slotItems[1]?.custom_image_url || null }, 0, false);
            }}
          />
        </div>

        {/* SECCIÓN 2: EL COLOR */}
        <div style={{ width: "100%", marginBottom: "20px" }}>
          <p style={{ fontSize: "11px", color: "var(--color-primary)", fontWeight: 900, marginBottom: "8px", textTransform: "uppercase" }}>
            Color del separador
          </p>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
          {BINDER_ACCENT_SWATCHES.map((c) => {
  const isSelected = slotItems[1]?.custom_color === c; // Comprobamos el color de este separador
  return (
    <button
      key={c}
      type="button"
      onClick={async () => {
        // 1. Lo actualizamos visualmente en la pantalla
        setSlotItems(prev => ({
          ...prev,
          1: { ...prev[1], id: 999999, is_custom: true, custom_color: c } as any
        }));
        // 2. Lo mandamos a guardar a la base de datos
        await persistSlotState(1, { 
          kind: 'custom', 
          custom_text: slotItems[1]?.custom_text || slotItems[1]?.name || "", 
          custom_image_url: slotItems[1]?.custom_image_url || null,
          custom_color: c 
        } as any, 0, false);
      }} 
      style={{ 
        width: 28, height: 28, borderRadius: "50%", background: c, 
        border: isSelected ? "3px solid var(--text-main)" : "2px solid color-mix(in srgb, var(--color-border) 65%, transparent)", 
        cursor: "pointer", transition: "transform 0.1s, box-shadow 0.15s ease",
        boxShadow: isSelected
          ? `0 0 0 1px var(--color-primary), 0 0 12px color-mix(in srgb, ${c} 45%, transparent)`
          : `0 0 8px color-mix(in srgb, ${c} 25%, transparent)`,
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.2)"}
      onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
    />
  );
})}
          </div>
        </div>

        {/* SECCIÓN 3: IMAGEN PERSONALIZADA (¡AHORA SÍ FUNCIONA!) */}
        <div style={{ width: "100%" }}>
          <p style={{ fontSize: "11px", color: "var(--color-primary)", fontWeight: 900, marginBottom: "8px", textTransform: "uppercase" }}>
            Fondo especial
          </p>
          <label style={{ 
            display: "inline-flex", alignItems: "center", justifyContent: "center", 
            background: "var(--bg-soft)", border: "1px solid var(--color-primary)", color: "var(--color-primary)", 
            padding: "10px", borderRadius: "10px", fontWeight: 900, cursor: "pointer", 
            width: "100%", fontSize: "11px", boxSizing: "border-box"
          }}>
            {slotItems[1]?.custom_image_url ? "📷 Cambiar Imagen" : "📷 Subir Imagen"}
           <input 
    type="file" 
    accept="image/*" 
    style={{ display: "none" }} 
    onClick={(e) => {
      if (!profile?.is_premium && !isAdmin) {
        e.preventDefault(); // Bloquea la ventana
        showAlert("Ventaja VIP 👑", "Poner fondos personalizados en los separadores es exclusivo para Premium.");
      }
    }}
    onChange={async (e) => { 
      // Como ya bloqueamos arriba, aquí solo procesamos si hay archivo
      const file = e.target.files?.[0]; 
      if (file) { 
        setStatus("Subiendo imagen..."); 
        const up = await uploadCustomImage(file, 1); 
        if (up.ok && up.publicUrl) { 
          setSlotItems(prev => ({ 
            ...prev, 
            1: { ...(prev[1] || {}), id: 999999, is_custom: true, custom_image_url: up.publicUrl } as any 
          })); 
          await persistSlotState(1, { kind: 'custom', custom_text: slotItems[1]?.custom_text || slotItems[1]?.name || "", custom_image_url: up.publicUrl }, 0, false); 
          setStatus("Imagen actualizada ✨"); 
        } else { 
          setError(up.error || "Error al subir"); 
          setStatus("Error subiendo imagen"); 
        } 
      } 
      e.target.value = ""; 
    }} 
  />
          </label>
        </div>

        <p style={{ fontSize: "10px", color: "var(--state-disabled-fg)", marginTop: "20px", fontStyle: "italic", lineHeight: 1.3 }}>
          * Las pestañas se escalonan solas del 1 al 7.<br/>
          * La imagen se verá al abrir el Modo Lectura.
        </p>
      </div>
    </div>
  ) : (
  /* Aquí sigue tu código normal del grid de slots... */
  <div
    style={{
      display: "grid",
      gridTemplateColumns: `repeat(${layoutDef.cols}, ${gridFrameW}px)`,
      columnGap: baseGap,
      rowGap: baseRowGap,
      justifyContent: "center",
      alignContent: "start",
    }}
  >
    {baseSlots.map((n) => ( 
      <SlotBox key={n} slotIndex={n} invByItem={invByItem} emptyCounts={emptyCounts} placedByItem={placedByItem} modalZoom={pageZoom} /> 
    ))}

            {extras > 0 && (
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", gap: gridGap, marginTop: 8 }}>
                {extraSlots.map((n) => (
                  <SlotBox
                    key={n}
                    slotIndex={n}
                    invByItem={invByItem}
                    emptyCounts={emptyCounts}
                    placedByItem={placedByItem}
                    modalZoom={pageZoom}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
) : (
  <div style={{ marginTop: 30, color: "var(--text-muted)", fontWeight: 800 }}>
    Cargando página…
  </div>
)}
 


<BinderItemModal
 open={modalItemId != null && modalSlotIndex != null}
 onClose={closeItemModal}
 slotIndex={modalSlotIndex ?? 0}
 assigned={(modalAssigned ?? modalAssignedStable) as any}
 face={modalFace}
 rot={modalViewRot}
 flipH={modalViewFlipH}
 doModalUndo={doModalUndo}
 wttCarousel={wttWantedForModal}
 clearWttWanted={clearWttWanted}
 stockModalOpen={stockModalOpen}
 setStockModalOpen={setStockModalOpen}
 wtsListingModalOpen={wtsListingModalOpen}
 wtsCurrencyByItem={wtsCurrencyByItem}
 setWtsCurrencyByItem={setWtsCurrencyByItem}
 wtsCurrencyKey={wtsCurrencyKey}
 onBecameWts={(itemId) => {
  setWtsListingItemId(itemId);
  setWtsListingModalOpen(true);
 }}
 onRemoveItem={() => {
  if (modalSlotIndex == null) return;
  void clearSlot(modalSlotIndex);
  closeItemModal();
 }}
 modalItemId={typeof modalItemId === "number" ? modalItemId : null}
 marketByItem={marketByItem}
 currencyByItem={currencyByItem}
 fxPairKey={fxPairKey}
 fxPairRate={fxPairRate}
 fxPairLoading={fxPairLoading}
 fxPairError={fxPairError}
 setFxPairLoading={setFxPairLoading}
 setFxPairRate={setFxPairRate}
 fetchFxPair={fetchFxPair}
 // ✅ PASAMOS LAS NUEVAS VARIABLES DE NAVEGACIÓN
  canPrev={canPrevModal}
  canNext={canNextModal}
  onPrev={handleModalPrev}
  onNext={handleModalNext}
 notes={
  !modalAssigned?.is_custom && typeof modalItemId === "number"
   ? (notesByItem[modalItemId] ?? "")
   : ""
 }
 onChangeNotes={(v) => {
  if (typeof modalItemId !== "number") return;
  setNotesByItem((prev) => ({ ...prev, [modalItemId]: v }));
  try { localStorage.setItem(`binder:notes:${modalItemId}`, v); } catch {}
 }}
 onToggleFace={async () => { // <-- AÑADIDO 'async'
    if (modalSlotIndex == null) return;
    await pushUndoSnapshot(); // <-- AÑADIDO
    const next = modalFace === "front" ? "back" : "front";
    setSlotFace((prev) => ({ ...prev, [modalSlotIndex]: next }));
  }}
 // Dentro de BinderClient, en el renderizado de <BinderItemModal />
/* EN BinderClient.tsx, DENTRO DE <BinderItemModal /> (Pág. 265) */
onRotateLeft={() => {
  const nextRot = ((modalViewRot - 90) % 360 + 360) % 360;
  setModalViewRot(nextRot);
  
  if (pageId && modalSlotIndex != null) {
    setSlotRot(prev => ({ ...prev, [modalSlotIndex]: nextRot })); // 1. Actualiza grid
    setRefreshTick(t => t + 1); // 2. SEÑAL MÁGICA: Actualiza carrusel y online
    
    // Aquí es donde deberías disparar el persistTransformForSlotSafe para guardar en DB
    void persistTransformForSlotSafe(modalSlotIndex, nextRot, modalViewFlipH);
  }
}}

  onRotateRight={() => {
    const nextRot = ((modalViewRot + 90) % 360 + 360) % 360;
    setModalViewRot(nextRot);

    if (pageId && modalSlotIndex != null) {
      setPageThumbs(prev => {
        const newMap = { ...prev };
        const currentPageSlots = { ...(newMap[pageId] || {}) };
        const currentSlotData = { ...(currentPageSlots[modalSlotIndex] || {}) };
        
        currentSlotData.rot = nextRot;
        currentPageSlots[modalSlotIndex] = currentSlotData;
        newMap[pageId] = currentPageSlots;
        
        return newMap;
      });
      setRefreshTick(t => t + 1);
    }
  }}

  onToggleFlipH={() => {
    const nextFlip = !modalViewFlipH;
    setModalViewFlipH(nextFlip);

    if (pageId && modalSlotIndex != null) {
      setPageThumbs(prev => {
        const newMap = { ...prev };
        const currentPageSlots = { ...(newMap[pageId] || {}) };
        const currentSlotData = { ...(currentPageSlots[modalSlotIndex] || {}) };
        
        currentSlotData.flipH = nextFlip; // Aplicamos volteo
        currentPageSlots[modalSlotIndex] = currentSlotData;
        newMap[pageId] = currentPageSlots;
        
        return newMap;
      });
      setRefreshTick(t => t + 1);
    }
  }}
 meta={modalMeta}
 names={modalNames}
 counts={modalCounts}
 inBinder={modalInBinder}
 customText={modalCustomText}
 customImageUrl={modalCustomImageUrl}
 onChangeCustomText={(v) => void setModalCustomText(v)}

  onPickCustomImage={(file, side) => { if (!modalCustomBusy) void pickModalCustomImage (file, side); }}
 onClearCustomImage={() => { if (!modalCustomBusy) void clearModalCustomImage(); }}
 onSubmitBetterPhoto={submitBetterPhoto}
 betterPhotoBusy={betterPhotoBusy}
 customIsBias={modalCustomIsBias}
  onToggleCustomBias={handleToggleCustomBias}
  t={t}
  showAlert={showAlert}
/>

{/* NAV inferior */}
<div
  style={{
    position: "sticky",
    bottom: 0,
    background: "var(--surface-float)",
    backdropFilter: "blur(10px)",
    borderTop: "1px solid var(--state-disabled-border)",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "center",

    
  }}
>
 <div 
    style={{ 
      width: "100%", maxWidth: 1120, display: "grid", 
      gridTemplateColumns: "1fr auto 1fr", flexWrap: "wrap", alignItems: "center", gap: 10, 
    }} 
  > 
    {/* Columna izquierda: Vacía porque movimos el botón arriba */} 
    <div style={{ display: "flex", justifyContent: "flex-start", paddingLeft: "10px" }}> 
    </div> 

    {/* Columna central: SIEMPRE centrada */} 
    {/* ... (botones Anterior y Siguiente) ... */}
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button
  type="button"
  onClick={goPrev}
  disabled={currentPageIndex <= 0}
  style={{
    ...topBtnStyle, // ✅
    opacity: currentPageIndex <= 0 ? 0.45 : 1,
    cursor: currentPageIndex <= 0 ? "not-allowed" : "pointer",
  }}
>
          ◀ Anterior
        </button>

       <div
  style={{
    fontSize: 14,
    fontWeight: 900,
    color: "var(--color-primary)",
    letterSpacing: 0.2,
  
  }}
>
          Página {pageLabel}
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={currentPageIndex >= Math.max(binderPages.length - 1, 0)}
          style={{
            ...topBtnStyle,
            opacity: currentPageIndex >= Math.max(binderPages.length - 1, 0) ? 0.45 : 1,
  cursor: currentPageIndex >= Math.max(binderPages.length - 1, 0) ? "not-allowed" : "pointer",
}}
        >
          Siguiente ▶
        </button>
      </div>
    </div>

    {/* Columna derecha: vacía (otro “contrapeso”) */}
    <div />
 </div>
</div>
{/* --- SECCIÓN DE MODALES --- */}
      {pagesOpen && renderPagesModal()}
      {buyPagesOpen && <BuyPagesModal />}
      {buySeparatorsOpen && <BuySeparatorsModal />}

      {showOnboarding && userId && (
        <OnboardingForm
          onComplete={() => {
            setShowOnboarding(false);
            window.location.reload();
          }}
        />
      )}

      {/* Popups de estado */}
      {status && (
        <div className="status-popup" aria-live="polite">
          {status}
        </div>
      )}

     {/* Modal WTS */}
<WtsListingModal
open={wtsListingModalOpen}
itemId={wtsListingItemId}
onClose={() => setWtsListingModalOpen(false)}
onSaved={handleWtsListingSaved}
/>
{/* 🔄 Modal WTT (El Rosa) - Configurado para volver al
Stock al cerrar/guardar */}
<WttListingModal
   open={wttListingModalOpen}
   itemId={wttListingItemId}
   initialPublicMessage={
     wttListingItemId != null ? 
     readLS(wttMessageKey(wttListingItemId)) : ""
   }
   onSavePublicMessage={(itemId: number, value: string) => {
     writeLS(wttMessageKey(itemId), value);
   }}
   onClose={() => {
     setWttListingModalOpen(false);
     setStockModalOpen(true);
   }}
   onSaved={() => {
     // 👇 NUEVO COMPORTAMIENTO: Cierra este modal y abre el Picker
     setWttListingModalOpen(false);
     // Ponemos false porque ya NO queremos que vuelva a abrir el modal rosa después
     setResumeWttListingAfterLegacyPicker(false); 
     
     if (wttListingItemId) {
       openWttOfferModal(wttListingItemId); // Abre el picker
     }
   }}
   // Ya no necesitamos onOpenPicker, lo puedes borrar o dejar vacío
 />
      {/* Libro Virtual */}
      {previewBinderOpen && (() => {
     const datosParaElLibro = binderPages.map(page => {
    const def = defFor(page.layout_type);
    const capacity = def.slots;
    const slotsForPage = Array(capacity).fill(null);

    if (page.id === pageId) {
      Object.entries(slotItems).forEach(([idxStr, item]) => {
        const slotIdx = Number(idxStr);
        const arrayIdx = slotIdx - 1;
        if (arrayIdx >= 0 && arrayIdx < capacity && item) {
          
          // OTW y WISH leídos del inventario
          const stock = !item.is_custom ? invByItem[item.id] : null;
          const isOtw = stock ? (stock.on_its_way > 0) : false;

          slotsForPage[arrayIdx] = {
            id: String(item.id),
            image_url: item.is_custom ? item.custom_image_url : item.image_url,
            back_image_url: item.is_custom ? (item as any).custom_back_image_url : item.back_image_url,
            rotation: slotRot[slotIdx] || 0,
            flip: slotFace[slotIdx] === "back",
            name: item.is_custom ? ((item as any).custom_text || item.name) : item.name,
            custom_text: (item as any).custom_text,
            custom_color: (item as any).custom_color,
            // ETIQUETAS AÑADIDAS
            isMissing: (item as any).is_wanted === true,
            isOtw: isOtw
          };
        }
      });
    } else {
      const thumbs = pageThumbs[page.id] || {};
      Object.entries(thumbs).forEach(([idxStr, meta]: [string, any]) => {
        const slotIdx = Number(idxStr);
        const arrayIdx = slotIdx - 1;
        if (arrayIdx >= 0 && arrayIdx < capacity) {
          slotsForPage[arrayIdx] = {
            id: String(meta.itemId),
            image_url: meta.url,
            back_image_url: meta.back_image_url,
            rotation: meta.rot || 0,
            flip: meta.flipH || false,
            name: meta.name,
            custom_text: (meta as any).custom_text || meta.name,
            custom_color: (meta as any).custom_color,
            // ETIQUETAS AÑADIDAS
            isMissing: meta.isWanted === true,
            isOtw: meta.onItsWay > 0
          };
        }
      });
    }
    return { layoutType: page.layout_type, slots: slotsForPage };
  });

        return (
          <VirtualBinder 
            binderName={binderTitle} 
            binderColor={binderColor} 
            coverUrl={coverUrl} 
            pagesData={datosParaElLibro}
            onClose={() => {
              setPreviewBinderOpen(false);
              if (isViewMode) router.push('/binders');
            }} 
          />
        );
      })()}

      {/* 👑 EL PICKER (Al final de todo para Z-INDEX máximo y efecto Boomerang) */} 
     {pickingSlot != null && pickerUserId != null &&
pickerBinderId != null && (
<div
  style={{
    position: "fixed",
    inset: 0,
    zIndex: 999999,
    background: "var(--overlay-medium)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  }}
>
  <div
    style={{
      width: "min(1180px, 96vw)",
      height: isMobile ? "85vh" : "90vh",
      borderRadius: 24,
      background: "var(--bg-card)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column"
    }}
  >
    <ItemPicker
      userId={pickerUserId}
      binderId={pickerBinderId}
      binderTitle={binderTitle}
      placedByItem={placedByItem}
      invByItem={invByItem}
      loadInvForIds={loadInvForIds}
      refreshTick={refreshTick}
      userBiases={userBiases}
      isMobile={isMobile}
      onPick={(itemId) => {
        const s = pickingSlot;
        setPickingSlot(null);
        if (s != null) assignItemToSlot(s, itemId);
        setWttListingModalOpen(true);
      }}
      onClose={() => {
        setPickingSlot(null);
        setWttListingModalOpen(true);
      }}
    />
  </div>
</div>
)}
   </div> 
      {/* Cierres finales del componente */}
      <Footer />
    </div>
  );
}