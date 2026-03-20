  
"use client";
import Header from "../components/header";
import { useState } from "react"; // 1. Asegúrate de tener useState importado
import { useRouter, usePathname, useSearchParams } from "next/navigation"; // 2. Asegúrate de importar usePathname y useSearchParams
import { supabase } from "../lib/supabaseClient";
import { 
  Trash2, Users, Disc3, PenLine, Mic2, User, Layers, 
    SlidersHorizontal, RotateCw, Undo2, Heart 
} from "lucide-react";
import WtsListingModal from "../library/WtsListingModal"
import React, { useCallback, useEffect, useMemo, useRef} from "react";
import type { CSSProperties } from "react";
import { OnboardingForm } from "../me/components/OnboardingForm";
import { useGlobal } from "../context/GlobalContext"
const CUSTOM_BUCKET = "binder_custom";
const SUBMISSIONS_BUCKET = "pc-submissions";
// ✅ back por defecto (/mock-pcs/groups/default-back.png)
const DEFAULT_BACK_URL = "/mock-pcs/groups/default-back.png";
// ...existing code...
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');

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
  color: "#b17eac", // Rosa oscuro
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
  `On the way: ${otw}`,
  `Wishlist: ${wish}`,
  `En binder: ${placedCount}`,
  `Disponibles: ${availableCount}`,
 ];
}
function statusColors(counts: StatusCounts) {
  // OTW: Azul pastel brillante
  if ((counts.on_its_way ?? 0) > 0) return { key: "otw", border: "#A7D4FF", bg: "#F0F7FF" }; 
  // WISH: Amarillo pastel brillante
  if ((counts.wish ?? 0) > 0) return { key: "wish", border: "#FDE9B4", bg: "#FFFDF5" }; 
  // WTT: Rosa brillante
  if ((counts.wtt ?? 0) > 0) return { key: "wtt", border: "#fdcbe9", bg: "#FFF5FA" }; 
  // HAVE: Verde menta brillante
  if ((counts.have ?? 0) > 0) return { key: "have", border: "#A7E3B8", bg: "#F2FAF6" }; 

  return { key: "", border: "#E2E2E2", bg: "white" };
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
    return { key: "on_its_way", label: "OTW", bg: "#e8f3ff", border: "#9cc8ff" };
  if (counts.wish > 0)
    return { key: "wish", label: "WISH", bg: "#fff7cc", border: "#f1d86a" };
  if (counts.wtt > 0)
    return { key: "wtt", label: "WTT", bg: "#f3e8ff", border: "#c9a7ff" };
  if (counts.wts > 0)
    return { key: "wts", label: "WTS", bg: "#f2f2f2", border: "#ddd" };
  if (counts.have > 0)
    return { key: "have", label: "HAVE", bg: "#e8fff0", border: "#9fe0b5" };
  return { key: null, label: "", bg: "#fff", border: "#eee" };
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
  const lower = String(memberRaw ?? "").toLowerCase().trim();
  if (/\bot8\b/.test(lower)) return "ot8";
  if (lower.includes("+")) return "unit";
  if (lower.split(/\s+/).length > 1) return "unit";
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
 color: "#8C659C",
 fontWeight: 900,
 display: "flex",
 alignItems: "center",
 gap: 6,
};

const pickerControlStyle: CSSProperties = {
 padding: "8px 10px",
 borderRadius: 10,
 border: "1px solid #F3DCE7",
 minWidth: 170,
 background: "white",
 color: "#2F2740",
 boxShadow: "0 4px 12px rgba(247,168,216,0.08)",
};

const pickerSearchStyle: CSSProperties = {
 padding: "8px 10px",
 borderRadius: 10,
 border: "1px solid #F3DCE7",
 minWidth: 220,
 background: "white",
 color: "#2F2740",
 boxShadow: "0 4px 12px rgba(247,168,216,0.08)",
};

const pickerShellStyle: CSSProperties = {
 background: "#FFFDF5",
 border: "1px solid #F3DCE7",
 borderRadius: 20,
 overflow: "hidden",
 boxShadow: "0 18px 44px rgba(140,101,156,0.10)",
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
 borderBottom: "1px solid #F3C7DA",
 background: "#FFD9E6",
};

const pickerTitleWrapStyle: CSSProperties = {
 display: "flex",
 alignItems: "center",
 gap: 12,
 minWidth: 0,
};

const pickerTitleStyle: CSSProperties = {
 color: "#8C659C",
 fontWeight: 950,
 fontSize: 20,
 letterSpacing: 0.2,
 lineHeight: 1.1,
};

const pickerSectionStyle: CSSProperties = {
 padding: 16,
 background: "#FFFDF5",
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
 border: "1px solid #F7A8D8",
 background: "#FFF5FA",
 color: "#8C659C",
 cursor: "pointer",
 fontWeight: 900,
 boxShadow: "0 4px 12px rgba(247,168,216,0.14)",
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
  | "sp_1x1";

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
];

const LAYOUT_KEYS = new Set(LAYOUTS.map((l) => l.key));

const isLayoutType = (value: unknown): value is LayoutType =>
  typeof value === "string" && LAYOUT_KEYS.has(value as LayoutType);

const defFor = (key: LayoutType): LayoutDef => LAYOUTS.find((l) => l.key === key) ?? LAYOUTS[0];

const getExtrasCount = (_key: LayoutType) => 0;

function ItemPicker({
  userId,
  binderId,
  placedByItem,
  invByItem,
  loadInvForIds,
  refreshTick,
  userBiases, // <--- AÑADE ESTO
  onPick,
  onClose,
}: {
  userId: string;
  binderId: number;
  placedByItem: Record<number, any>;
  invByItem: Record<number, any>;
  loadInvForIds: (ids: number[]) => Promise<void>;
  refreshTick: number;
  userBiases: number[]; // <--- AÑADE ESTO
  onPick: (itemId: number) => void;
  onClose: () => void;
}) {
 const DUMMY_PICK_ID = -1;

  const [loading, setLoading] = useState(true);
const [err, setErr] = useState<string | null>(null);
const [items, setItems] = useState<PickerItem[]>([]);

 const [pickerReloadTick, setPickerReloadTick] = useState(0);
 const [q, setQ] = useState("");
 
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
   const invRes = await supabase
  .from("user_item_statuses")
  .select("item_id")
  .eq("user_id", userId);

const ids = Array.from(new Set((invRes.data ?? []).map(r => r.item_id)));

const itemsRes = await supabase
  .from("items")
 .select("id, name, image_url, back_image_url, group_id, album_id, version_id, version, member_id, member") 
  .in("id", ids)
  .order("id", { ascending: true });

const rawItems = (itemsRes.data ?? []) as PickerItem[];


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
    return entries.sort((a, b) => {
      const da = a.release_date ? new Date(a.release_date).getTime() : Number.POSITIVE_INFINITY;
      const db = b.release_date ? new Date(b.release_date).getTime() : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name, "es");
    });
  }, [items, group, albums]);

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
    console.log("Prueba Bias - IDs Favoritos:", userBiases, "Primer item del picker:", items[0]?.member_id);

    return items.filter((it) => {
      const counts = invByItem[it.id] ?? emptyCounts();
      const have = Number(counts.have ?? 0);
      const wtt = Number(counts.wtt ?? 0);
      const wts = Number(counts.wts ?? 0);
      const otw = Number(counts.on_its_way ?? 0);
      const wish = Number(counts.wish ?? 0);

      const hasDeclaredStockOrWish =
        have > 0 || wtt > 0 || wts > 0 || otw > 0 || wish > 0;
      const inBinder = !!placedByItem[it.id];

      if (!hasDeclaredStockOrWish) return false;
      if (inBinder) return false;
      if (statusFilter) {
        if ((counts[statusFilter] ?? 0) <= 0) return false;
      }
      if (group !== "" && (it.group_id ?? null) !== group) return false;
      if (album !== "" && (it.album_id ?? null) !== album) return false;
      if (version !== "") {
        const vLabel = (it.version_name_display ?? it.version_name ?? "").trim();
        if (vLabel !== version) return false;
      }
      if (member !== "" && !memberMatches(it.member ?? it.member_name, member)) return false;

      if (onlyBiases) {
        if (it.member_id != null && userBiases.includes(Number(it.member_id))) {
          return matchesQuery(it, q);
        }

        const rawMember = it.member ?? it.member_name ?? "";
        const biasMatchByName = userBiases.some((biasId) => {
          const biasSlug = biasSlugById[Number(biasId)];
          if (!biasSlug) return false;
          return memberMatches(rawMember, biasSlug);
        });

        if (!biasMatchByName) return false;
      }

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
  ]);
 const pickBtnStyle: CSSProperties = {
 marginTop: 14,
 width: "100%",
 padding: "9px 12px",
 borderRadius: 12,
 border: "1px solid #F7A8D8",
 background: "#FFF5FA",
 color: "#8C659C",
 cursor: "pointer",
 fontWeight: 900,
 boxShadow: "0 4px 12px rgba(247,168,216,0.14)",
 transition: "all 0.15s ease",
};

const pickerShellStyle: CSSProperties = {
 background: "#FFFDF5",
 border: "1px solid #F3DCE7",
 borderRadius: 20,
 overflow: "hidden",
 boxShadow: "0 18px 44px rgba(140,101,156,0.10)",
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
 borderBottom: "1px solid #F3C7DA",
 background: "#FFD9E6",
};

const pickerTitleWrapStyle: CSSProperties = {
 display: "flex",
 alignItems: "center",
 gap: 12,
 minWidth: 0,
};

const pickerTitleStyle: CSSProperties = {
 color: "#8C659C",
 fontWeight: 950,
 fontSize: 20,
 letterSpacing: 0.2,
 lineHeight: 1.1,
};

const pickerSectionStyle: CSSProperties = {
 padding: 16,
 background: "#FFFDF5",
 display: "flex",
 flexDirection: "column",
 gap: 12,
 flex: 1,
 minHeight: 0,
};

const pickerLabelStyle: CSSProperties = {
 fontSize: 12,
 color: "#8C659C",
 fontWeight: 900,
 display: "flex",
 alignItems: "center",
 gap: 6,
};

const pickerControlStyle: CSSProperties = {
 padding: "8px 10px",
 borderRadius: 10,
 border: "1px solid #F3DCE7",
 minWidth: 170,
 background: "white",
 color: "#2F2740",
 boxShadow: "0 4px 12px rgba(247,168,216,0.08)",
};

const pickerSearchStyle: CSSProperties = {
 padding: "8px 10px",
 borderRadius: 10,
 border: "1px solid #F3DCE7",
 minWidth: 220,
 background: "white",
 color: "#2F2740",
 boxShadow: "0 4px 12px rgba(247,168,216,0.08)",
};

/* NUEVOS ESTILOS PARA FIJAR FILTROS Y HACER SCROLL EN PCS */

const pickerFiltersWrapStyle: CSSProperties = {
 flex: "0 0 auto",
};

const pickerGridScrollStyle: CSSProperties = {
 flex: 1,
 minHeight: 0,
 overflowY: "auto",
 paddingRight: 6,
};

return (
  <div style={pickerShellStyle}>
   <div style={pickerHeaderStyle}>
  <div style={pickerTitleWrapStyle}>
    <img
      src="/branding/logo.png"
      alt="My Kpop Binder Logo"
      draggable={false}
      style={{ height: 42, width: "auto", objectFit: "contain", flexShrink: 0 }}
    />
    <div style={pickerTitleStyle}>Elegir photocard</div>
  </div>

  <button
    type="button"
    onClick={onClose}
    title="Cerrar"
    style={{
      width: 36,
      height: 36,
      borderRadius: 10,
      border: "1px solid #F3C7DA",
      background: "white",
      color: "#8C659C",
      fontWeight: 900,
      fontSize: 18,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 3px 10px rgba(0,0,0,0.06)",
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
            <SlidersHorizontal size={14} strokeWidth={2.4} /> Estado
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target.value || "") as "" | StatusKey)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", ...pickerControlStyle, minWidth: 180 }}
          >
            <option value="">(todos)</option>
            <option value="have">Tengo</option>
            <option value="wtt">WTT</option>
            <option value="wts">WTS</option>
            <option value="on_its_way">On its way</option>
            <option value="wish">Wishlist</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={pickerLabelStyle}>
            <Users size={14} strokeWidth={2.4} /> Grupo
          </label>
          <select
            value={group}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", ...pickerControlStyle, minWidth: 180 }}
          >
            <option value="">(todos)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={pickerLabelStyle}>
            <Disc3 size={14} strokeWidth={2.4} /> Álbum
          </label>
          <select
            value={album}
            onChange={(e) => setAlbumId(e.target.value ? Number(e.target.value) : "")}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", ...pickerControlStyle, minWidth: 180 }}
          >
            <option value="">(todos)</option>
            {albumOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={pickerLabelStyle}>
            <Mic2 size={14} strokeWidth={2.4} /> Versión
          </label>
          <select
            value={version}
            onChange={(e) => setVersionId(e.target.value || "")}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", ...pickerControlStyle, minWidth: 160 }}
          >
            <option value="">(todas)</option>
            {versionOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={pickerLabelStyle}>
            <Layers size={14} strokeWidth={2.4} /> Tipo
          </label>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value as UnitFilter)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", ...pickerControlStyle, minWidth: 140 }}
          >
            <option value="all">(todos)</option>
            <option value="single">Selfie</option>
            <option value="unit">Unit</option>
            <option value="ot8">OT8</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={pickerLabelStyle}>
            <User size={14} strokeWidth={2.4} /> Miembro
          </label>
          <select
            value={member}
            onChange={(e) => setMemberId(e.target.value || "")}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", ...pickerControlStyle, minWidth: 140 }}
          >
            <option value="">(todos)</option>
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

                    border: onlyBiases ? "1px solid #F7A8D8" : "1px solid #ddd",

                    background: onlyBiases ? "#FFF5FA" : "#fff",

                    color: onlyBiases ? "#8C659C" : "#666",

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
  placeholder="Buscar por nombre o id…"
  style={{ ...pickerSearchStyle, width: "100%" }}
/>
               </div>
      </div>
      </div>

    <div style={pickerGridScrollStyle}>
      {loading && <div style={{ color: "#666" }}>Cargando… </div>}
      {err && <div style={{ color: "crimson" }}>Error: {err}</div>}

<div
  style={{
    marginTop: 12,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignContent: "flex-start",
    alignItems: "stretch",
  }}
>
  <div
    title="Añadir una PC personalizada (no está en el inventario)"
    style={{
      width: 230,
      minHeight: 210,
      display: "flex",
      flexDirection: "column",
      border: "1.5px solid #d4e3fb",
      borderRadius: 14,
      padding: 12,
      background: "#f4f7ff",
      position: "relative",
    }}
  >
    <div style={{ display: "flex", gap: 12, flex: 1, alignItems: "flex-start" }}>
      <div
        style={{
          width: 66,
          height: 120,
          borderRadius: 14,
          border: "2px dashed #8db8ff",
          background: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          color: "#8db8ff",
          fontWeight: 900,
          flex: "0 0 auto",
        }}
      >
        +
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          paddingTop: 2,
        }}
      >
        <div style={{ fontWeight: 950, color: "#232336", lineHeight: 1.2 }}>
          PC personalizada
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: "#666", lineHeight: 1.35 }}>
          Añade esta carta a tu binder y haz clic en ella para subir tus imágenes y escribir los detalles.
        </div>
      </div>
    </div>

    <div
      style={{
        marginTop: 8,
        marginBottom: 2,
        fontSize: 12,
        color: "transparent",
        userSelect: "none",
      }}
    >
      -
    </div>

    <button type="button" onClick={() => onPick(DUMMY_PICK_ID)} style={pickBtnStyle}>
      Añadir
    </button>
  </div>

  {filtered.map((it) => {
    const counts = invByItem[it.id] ?? emptyCounts();

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
    const availableCount = Math.max(0, basePlaceable - placedCount);

    const lines = formatTooltipLines(it.id, counts, placedCount, availableCount);
    const tooltip = lines.join("\n");
    const disabled = availableCount <= 0;
    const st = statusColors(counts);

    // 1. Obtenemos la lista de IDs del cerebro global
const biasList = (userBiases || []).map(Number);
    const rawMember = it.member ?? it.member_name ?? "";
    const lowerMember = String(rawMember).toLowerCase().trim();

    const isMyBias =
      (it.member_id != null && biasList.includes(Number(it.member_id))) ||
      /\bot8\b/.test(lowerMember) ||
      biasList.some((biasId) => {
        const biasSlug = biasSlugById[Number(biasId)];
        if (!biasSlug) return false;
        return memberMatches(rawMember, biasSlug);
      });

    return (
      <div
        key={it.id}
        title={tooltip}
        style={{
          width: 230,
          minHeight: 210,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          border: `1.5px solid ${
            st.key === "wish"
              ? st.border.replace("0.9", "0.3")
              : st.border.replace("0.8", "0.15").replace("0.7", "0.1")
          }`,
          borderRadius: 14,
          padding: 12,
          backgroundColor: "#F2F2F2",
          boxShadow: `0 2px 8px rgba(0,0,0,0.02)`,
          transition: "all 0.25s ease-out",
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.borderColor = st.border;
          e.currentTarget.style.boxShadow = `0 8px 20px ${st.border
            .replace("0.8", "0.3")
            .replace("0.7", "0.3")}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = st.border
            .replace("0.8", "0.2")
            .replace("0.7", "0.15")
            .replace("0.6", "0.1");
          e.currentTarget.style.boxShadow = `0 2px 8px rgba(0,0,0,0.02)`;
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1 }}>
          <div
            style={{
              width: 66,
              height: 120,
              borderRadius: 14,
              border: "1px solid #e7e7ef",
              overflow: "hidden",
              background: "transparent",
              flex: "0 0 auto",
              position: "relative",
            }}
          >
            <img
              src={it.image_url ?? "/mock-pcs/groupsui/not-available.png"}
              alt=""
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />

            {isMyBias && (
              <div
                style={{
                  position: "absolute",
                  left: 4,
                  bottom: 4,
                  zIndex: 3,
                  width: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  filter: "drop-shadow(0 1px 2px rgba(255,255,255,0.9))",
                }}
              >
                <Heart size={14} fill="#F7A8D8" color="#F7A8D8" strokeWidth={0} />
              </div>
            )}
          </div>

          <div style={{ textAlign: "left", display: "flex", flexDirection: "column", paddingTop: 2 }}>
            <div style={{ fontWeight: 950, color: "#232336", lineHeight: 1.2 }}>
              {(() => {
                const memberLabel = prettyMemberLabel(it.member ?? it.member_name ?? "");
                const fallbackLabel = (it.name ?? "").trim();
                const title = memberLabel || fallbackLabel || `Item ${it.id}`;
                const parts = String(title).split(" + ").map((x) => x.trim()).filter(Boolean);

                return (
                  <div style={{ lineHeight: 1.15 }}>
                    <div>{parts[0]}</div>
                    {parts.length > 1 && <div>{parts.slice(1).join(" + ")}</div>}
                  </div>
                );
              })()}
            </div>

            <div style={{ marginTop: 6, fontSize: 11, color: "#666", lineHeight: 1.35 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 900, color: "#70708a" }}>Grupo:</span>
                <span style={{ fontWeight: 800, color: "#232336" }}>
                  {(it.group_name ?? "—").trim() || "—"}
                </span>
              </div>

              <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 900, color: "#70708a" }}>Álbum:</span>
                <span style={{ fontWeight: 800, color: "#232336" }}>
                  {(it.album_name ?? "—").trim() || "—"}
                </span>
              </div>

              <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 900, color: "#70708a" }}>Versión:</span>
                <span style={{ fontWeight: 800, color: "#232336" }}>
                  {(it.version_name_display ?? it.version_name ?? "—").trim() || "—"}
                </span>
              </div>

              {(() => {
                const badges =
                  counts.wish > 0
                    ? [{ key: "wish", label: "WISH", bg: "#fff7cc", border: "#f1d86a" }]
                    : [
                        counts.have > 0
                          ? { key: "have", label: `HAVE ${counts.have}`, bg: "#e8fff0", border: "#9fe0b5" }
                          : null,
                        counts.wtt > 0
                          ? { key: "wtt", label: `WTT ${counts.wtt}`, bg: "#f3e8ff", border: "#c9a7ff" }
                          : null,
                        counts.wts > 0
                          ? { key: "wts", label: `WTS ${counts.wts}`, bg: "#f2f2f2", border: "#ddd" }
                          : null,
                        counts.on_its_way > 0
                          ? {
                              key: "on_its_way",
                              label: `OTW ${counts.on_its_way}`,
                              bg: "#e8f3ff",
                              border: "#9cc8ff",
                            }
                          : null,
                      ].filter(Boolean) as Array<{
                        key: string;
                        label: string;
                        bg: string;
                        border: string;
                      }>;

                const compact = badges.length >= 4;
                const ultraCompact = badges.length >= 5;

                return (
                  <div
                    style={{
                      marginTop: 6,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      minHeight: 42,
                      alignContent: "center",
                      justifyContent: "center",
                    }}
                  >
                    {badges.map((b) => (
                      <span
                        key={b.key}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          maxWidth: "100%",
                          fontSize: ultraCompact ? 9 : compact ? 10 : 11,
                          lineHeight: 1,
                          padding: ultraCompact ? "2px 5px" : compact ? "2px 6px" : "3px 8px",
                          borderRadius: 999,
                          border: `1px solid ${b.border}`,
                          backgroundColor: b.bg,
                          color: "#333",
                          fontWeight: 900,
                          letterSpacing: 0.15,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.label}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 8,
            marginBottom: 2,
            fontSize: 12,
            fontWeight: 900,
            color: "#3b4a66",
            textAlign: "center",
            letterSpacing: 0.2,
          }}
        >
          Disponibles: {availableCount}
        </div>

        <button
          type="button"
          onClick={() => onPick(it.id)}
          disabled={disabled}
          style={{
            ...pickBtnStyle,
            cursor: disabled ? "not-allowed" : "pointer",
            background: disabled ? "#f4f4f4" : pickBtnStyle.background,
          }}
        >
          {disabled ? "No disponible" : "Elegir"}
        </button>
      </div>
    );
         })}
      </div>

      {!loading && !err && filtered.length === 0 && (
        <div style={{ marginTop: 10, color: "#777" }}>
          No hay resultados para este filtro.
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
 filter: "drop-shadow(2px 2px 3px rgba(0,0,0,0.3))",
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
  color: "#8C659C", 
  fontSize: 14 
};

const footerColumnTitle: CSSProperties = { 
  fontSize: "13px", 
  color: "#8C659C", 
  fontWeight: 900, 
  textTransform: "uppercase", 
  marginBottom: "15px", 
  display: "block" 
};

const footerLinkStyle: CSSProperties = { 
  fontSize: "12px", 
  color: "#b17eac", 
  textDecoration: "none", 
  fontWeight: 500, 
  marginBottom: "8px", 
  display: "block" 
};
export default function BinderClient() { 
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const router = useRouter();
  
  const pathname = usePathname();
  // Estado para forzar el remount del preview
  const [showPreview, setShowPreview] = useState(true);
  // 1. Pon esta función fuera para que no de error
function memberMatches(rawMember: string, biasSlug: string): boolean {
  if (!rawMember || !biasSlug) return false;
  
  // Normalización: minúsculas y quitar puntos/guiones
  const member = rawMember.toLowerCase().replace(/[.\-_]/g, " ").trim();
  const bias = biasSlug.toLowerCase().replace(/[.\-_]/g, " ").trim();
  
  // Regla de oro para I.N (8)
  if (bias === "in" || bias === "i n") {
    // Busca la palabra "in" aislada o el nombre real "jeongin"
    return /\bin\b/i.test(member) || member.includes("jeongin");
  }

  // Para el resto (Bang Chan, etc.), usamos límites de palabra para evitar falsos positivos
  const regex = new RegExp(`\\b${bias}\\b`, "i");
  return regex.test(member);
}
 const topBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #F7A8D8", // Borde rosa
  background: "white",
  color: "#8C659C",            // Texto púrpura del logo
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
  textDecoration: "none",
  boxShadow: "0 4px 12px rgba(247, 168, 216, 0.15)", // Sombra rosada muy sutil
  transition: "all 0.2s ease"
};
const softPinkBtnStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #F7A8D8",
  background: "#FFF5FA",
  color: "#8C659C",
  cursor: "pointer",
  fontWeight: 900,
  boxShadow: "0 4px 12px rgba(247,168,216,0.14)",
  transition: "all 0.15s ease",
};

const whitePinkBtnStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #F7A8D8",
  background: "white",
  color: "#8C659C",
  cursor: "pointer",
  fontWeight: 900,
  boxShadow: "0 4px 12px rgba(247,168,216,0.10)",
  transition: "all 0.15s ease",
};

const tradeInputStyle: CSSProperties = {
  height: 34,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #F3DCE7",
  background: "white",
  fontSize: 13,
  color: "#2F2740",
};

const tradeLabelStyle: CSSProperties = {
  fontSize: 12,
  color: "#8C659C",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const tradeMutedTextStyle: CSSProperties = {
  fontSize: 12,
  color: "#70708a",
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


// Función corregida para evitar el error de tipado
const toggleFavorite = (e: React.MouseEvent, id: string) => {
  e.stopPropagation();
  setFavorites((prev) => {
    const isFav = prev.includes(id);
    const next = isFav ? prev.filter((itemId) => itemId !== id) : [...prev, id];
    localStorage.setItem("binder:favorite-cursors", JSON.stringify(next));
    return next;
  });
};
// Handler for confirming photocard deletion in modal
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
setRefreshTick((t) => t + 1); 
  await loadPageThumbs(); 
  setTimeout(() => setShowPreview(true), 100); 
  closeItemModal(); 
 
 // LIBERA LA PC PARA EL PICKER: Actualiza el contador local de cartas colocadas
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

  // ✅ borrar la miniatura exacta del slot
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
  // Duplicate declaration removed. The function 'closeItemModal' is already defined above.

  const searchParams = useSearchParams();

  // ...
 const binderFromUrl = searchParams.get("binder");
const binderFromUrlNum = binderFromUrl ? Number(binderFromUrl) : NaN;
 const [email, setEmail] = useState<string | null>(null);

const [userId, setUserId] = useState<string | null>(null);

const [loading, setLoading] = useState(true);
const { userBiases, checkIsBias } = useGlobal();


  const [status, setStatus] = useState("Cargando binder...");
  useEffect(() => {
  
    const timer = setTimeout(() => {
      setStatus("");
    }, 3000); 
    return () => clearTimeout(timer);
  });
const [showOnboarding, setShowOnboarding] = useState(false); // ✅ Esto ya lo tienes, solo asegúrate de no borrarlo
  const [error, setError] = useState<string | null>(null);
  const [binderId, setBinderId] = useState<number | null>(null);
  const [pageId, setPageId] = useState<number | null>(null);

  const [pagesCount, setPagesCount] = useState<number>(0);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [binderPages, setBinderPages] = useState<
    Array<{ id: number; page_index: number; layout_type: LayoutType }>
  >([]);
  const [pagesOpen, setPagesOpen] = useState(false);
// ✅ Thumbs (para carrusel)
// (removed duplicate declaration of pageThumbs)
const [refreshTick, setRefreshTick] = useState(0);
const [buyPagesOpen, setBuyPagesOpen] = useState(false);
const [isShifting, setIsShifting] = useState(false);
const [hoverSeam, setHoverSeam] = useState<number | null>(null);


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

// ✅ Precio (localStorage por itemId)
const [priceByItem, setPriceByItem] = useState<Record<number, string>>({});
const [currencyByItem, setCurrencyByItem] = useState<Record<number, string>>({});
const [marketByItem, setMarketByItem] = useState<Record<number, string>>({});
// ✅ Moneda del precio WTS (independiente del selector de conversión)
const [wtsCurrencyByItem, setWtsCurrencyByItem] = useState<Record<number, string>>({});
// ✅ Notas (localStorage por itemId)
const [notesByItem, setNotesByItem] = useState<Record<number, string>>({});

// ✅ Keys + LS helpers (DEBEN ir antes de handleWtsListingSaved)
  const priceKey = useCallback((itemId: number) => `binder:price:${itemId}`, []);
  const currencyKey = useCallback((itemId: number) => `binder:currency:${itemId}`, []);
  const marketKey = useCallback((itemId: number) => `binder:market:${itemId}`, []);
  const wtsCurrencyKey = useCallback((itemId: number) => `binder:wtsCurrency:${itemId}`, []);
const notesKey = useCallback((itemId: number) => `binder:notes:${itemId}`, []);

const readLS = useCallback((k: string) => {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
}, []);

const writeLS = useCallback((k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
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
 if (!userId) return;
 if (wtsListingItemId == null) return;
 const itemId = wtsListingItemId;

 await pushModalUndoSnapshot(itemId);

 // 1⃣ Asegurar WTS en base de datos
 const up = await supabase
  .from("user_item_statuses")
  .upsert(
   [{ user_id: userId, item_id: itemId, status: "wts", qty: 1 }] as any,
   { onConflict: "user_id,item_id,status" }
  );
 if (!up.error) {
  setInvByItem((prev) => {
   const current = prev?.[itemId] ?? emptyCounts();
   return {
    ...prev,
    [itemId]: { ...current, wts: 1 },
   };
  });
 }

 // 2⃣ Refrescar precio desde localStorage
 const latestPrice = readLS(priceKey(itemId));
 const latestWtsCur = readLS(wtsCurrencyKey(itemId)) || "EUR";
 setPriceByItem((p) => ({ ...p, [itemId]: latestPrice }));
 setWtsCurrencyByItem((p) => ({ ...p, [itemId]: latestWtsCur }));
 setCurrencyByItem((p) => ({ ...p, [itemId]: latestWtsCur }));

 // 3⃣ Asegurar carga perezosa si no estaba
 ensurePriceMarketLoaded(itemId);

 // 4⃣ Cerrar modal
 setWtsListingModalOpen(false);
}, [
 userId,
 wtsListingItemId,
 supabase,
 readLS,
 priceKey,
 wtsCurrencyKey,
 ensurePriceMarketLoaded,
]);

// ---------------------
// Drag UI (páginas)
// ---------------------
const openWtsListingModal = useCallback((itemId: number) => {
  setWtsListingItemId(itemId);
  setWtsListingModalOpen(true);
}, []);

const [modalItemId, setModalItemId] = useState<number | null>(null);
// ✅ Handler cuando se guarda el modal “Publicar venta”


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
  const wttGridRef = React.useRef<HTMLDivElement | null>(null);

 

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
React.useLayoutEffect(() => {
  const snap = wttOfferScrollSnapshotRef.current;
  const el = wttOfferScrollRef.current;
  if (!snap || !el) return;

  el.scrollTop = snap.top;
  el.scrollLeft = snap.left;

  wttOfferScrollSnapshotRef.current = null;
}, [wttOfferDraft]);
const saveWttWantDraft = useCallback(async () => {
  if (wttWantForId == null) return;
  await pushModalUndoSnapshot(wttWantForId);
  setWttWantedByItem((prev) => ({ ...prev, [wttWantForId]: wttWantDraft }));
  writeWttWanted(wttWantForId, wttWantDraft);
  setWttWantOpen(false);
}, [wttWantForId, wttWantDraft, writeWttWanted, pushModalUndoSnapshot]);

const saveWttOfferDraft = useCallback(async () => {
  if (wttOfferForId == null) return;
  await pushModalUndoSnapshot(wttOfferForId);

  const qty = Number.isFinite(wttOfferQtyDraft)
    ? Math.max(0, Math.floor(wttOfferQtyDraft))
    : 0;

  const nextIds = qty > 0 ? wttOfferDraft : [];
// Sustituye o añade antes de setWttOfferOpen(false):
setStatus("¡Stock de WTT actualizado! 🔄");
  setWttOfferByItem((prev) => ({ ...prev, [wttOfferForId]: nextIds }));
  writeWttOffer(wttOfferForId, qty, nextIds);
  await persistWttQty(wttOfferForId, qty);
  setWttOfferOpen(false);
}, [
  wttOfferForId,
  wttOfferDraft,
  wttOfferQtyDraft,
  writeWttOffer,
  persistWttQty,
  pushModalUndoSnapshot,
]);

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
      void saveWttOfferDraft();
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [wttOfferOpen, wttOfferDraft, saveWttOfferDraft]);

useEffect(() => {
  if (modalItemId == null) return;
  const wttStock = wttOfferQtyByItem[modalItemId] ?? readWttOffer(modalItemId).qty ?? 0;
  if (wttStock > 0) return;
  const hasSelection = (wttOfferByItem[modalItemId]?.length ?? 0) > 0;
  const hasQty = (wttOfferQtyByItem[modalItemId] ?? 0) > 0;
  if (!hasSelection && !hasQty) return;
  setWttOfferByItem((prev) => ({ ...prev, [modalItemId]: [] }));
  setWttOfferQtyByItem((prev) => ({ ...prev, [modalItemId]: 0 }));
  writeWttOffer(modalItemId, 0, []);
}, [modalItemId, wttOfferByItem, wttOfferQtyByItem, readWttOffer, writeWttOffer]);


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
  }, [wttWantOpen, wttWantQ]);

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
  if (!itemModalOpen && !wttOfferOpen) return;
  if (wttWantCatalogReady) return;
  let cancelled = false;
  const run = async () => {
    setWttWantLoading(true);
    const res = await supabase
      .from("items")
      .select("id, name, image_url, group_id, album_id, version, member")
      .order("id", { ascending: true })
      .range(0, 9999);
    if (cancelled) return;
    if (!res.error) {
      const list: WttCarouselItem[] = (res.data ?? []).map((r: any) => ({
        id: Number(r.id),
        name: r.name ?? undefined,
        image_url: r.image_url ?? undefined,
        group_id: typeof r.group_id === "number" ? r.group_id : undefined,
        album_id: typeof r.album_id === "number" ? r.album_id : undefined,
        version: r.version ?? undefined,
        member: r.member ?? undefined,
      }));
      setWttWantCatalog(list);
      setWttWantCatalogReady(true);
    }
    setWttWantLoading(false);
  };
  run();
  return () => {
    cancelled = true;
  };
}, [itemModalOpen, wttOfferOpen, wttWantCatalogReady, supabase]);
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

    const meta: ItemMeta = {
      id: Number(row.id),
      name: row.name ?? null,
      image_url: row.image_url ?? null,
      back_image_url: row.back_image_url ?? null,
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
const canAddPage = binderPages.length < MAX_FREE_PAGES;
const goToPurchasePages = () => {
  router.push("/pricing#pages"); // cambia esta ruta/ancla por la tuya real
};
const totalPages = Math.max(binderPages.length, 1);
const pageLabel = `${currentPageIndex + 1}/${totalPages}`;

// ✅ Narrow para ItemPicker (evita rojos TS)
const pickerUserId = typeof userId === "string" && userId.trim() ? userId : null;
const pickerBinderId = typeof binderId === "number" ? binderId : null;

const [applyAll, setApplyAll] = useState<boolean>(false);
const [layoutHover, setLayoutHover] = useState<LayoutType | null>(null);
const [pickingSlot, setPickingSlot] = useState<number | null>(null);
const layoutBoxRef = useRef<HTMLDivElement | null>(null);
const [layoutOpen, setLayoutOpen] = useState(false);

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
type ThumbMeta = {
  url: string | null;
  itemId: number | null; // <--- Ahora con 'I' mayúscula
  isCustom: boolean;
  isWanted: boolean;
  member: string | null;
  name: string | null;
  have: number;
  wtt: number;
  wts: number;
  onItsWay: number; // <--- Asegúrate que sea 'Its' con 'I'
  wish: number;
  stockTotal: number;
};

type PageThumbsMap = Record<number, Record<number, ThumbMeta>>;
// pageId -> slotIndex -> meta
const [pageThumbs, setPageThumbs] = useState<PageThumbsMap>({});
// ... (tus refs/estados anteriores)

const lastPageDragRef = useRef<PageDragPayload | null>(null);

// ✅ para NO cerrar el modal mientras arrastras
const pageDraggingRef = useRef(false);

// ✅ para pintar el hueco de drop (animación)
const [pageDragFromId, setPageDragFromId] = useState<number | null>(null);
const [pageDragOverId, setPageDragOverId] = useState<number | null>(null);

// ... (lo siguiente que tengas)


const loadPageThumbs = useCallback(async () => {
    if (!binderPages?.length) return;
    const pageIds = binderPages.map((p) => p.id).filter((x) => Number.isFinite(x));
    if (pageIds.length === 0) return;

    // 1. Pedimos los slots SOLO con las columnas que existen de verdad
    // (Hemos quitado 'face' y 'custom_back_image_url' para evitar el crash de Supabase)
    const slotsRes = await supabase
      .from("page_slots")
      .select("page_id, slot_index, item_id, is_wanted, is_custom, custom_image_url, rot, flip_h")
      .in("page_id", pageIds);

    if (slotsRes.error) {
  console.error("Error cargando carrusel:", slotsRes.error.message || slotsRes.error);
  return;
}
    const slotRows = (slotsRes.data ?? []) as any[];

    // 2. Pedimos los datos de las PCs
    const itemIds = Array.from(new Set(slotRows.map((r) => r.item_id).filter(id => id != null)));
    
    let itemsData: any[] = [];
    if (itemIds.length > 0) {
      const itemsRes = await supabase
        .from("items")
        .select("id, image_url, name, member")
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
          else if (st === "on_its_way") c.on_its_way += qty;
          else if (isWish) c.wish += Math.max(1, qty);
        }
      }
    }

    // 4. Construimos el mapa final (Page -> Slot -> Datos)
    const next: PageThumbsMap = {};

    for (const r of slotRows) {
      const pid = Number(r.page_id);
      const sid = Number(r.slot_index);
      if (!next[pid]) next[pid] = {};

      const itemData = itemsData.find(i => Number(i.id) === Number(r.item_id));
      
      let url = "";
      if (r.is_custom) {
        url = r.custom_image_url ?? "";
      } else {
        url = itemData?.image_url ?? "";
      }

      const counts = countsByItem[Number(r.item_id)] ?? emptyCounts();
      const stockTotal = Number(counts.have) + Number(counts.wtt) + Number(counts.wts) + Number(counts.on_its_way);

      next[pid][sid] = {
        url: url || "/mock-pcs/groupsui/not-available.png",
        itemId: r.item_id,
        isCustom: !!r.is_custom,
        isWanted: !!r.is_wanted,
        member: itemData?.member ?? null,
        name: itemData?.name ?? null,
        have: counts.have, wtt: counts.wtt, wts: counts.wts, onItsWay: counts.on_its_way, wish: counts.wish,
        stockTotal,
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
 const uniq = Array.from(new Set(ids)).filter((x) => Number.isFinite(x));
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
  if (st === "on_its_way") c.on_its_way += qty;
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

  useEffect(() => {
    if (modalItemId == null) return;
    const localQty = wttOfferQtyByItem[modalItemId] ?? readWttOffer(modalItemId).qty ?? 0;
    if (localQty > 0) return;
    const dbQty = invByItem[modalItemId]?.wtt ?? 0;
    if (dbQty <= 0) return;

    const ids = wttOfferByItem[modalItemId] ?? readWttOffer(modalItemId).ids;
    setWttOfferQtyByItem((prev) => ({ ...prev, [modalItemId]: dbQty }));
    writeWttOffer(modalItemId, dbQty, ids ?? []);
  }, [modalItemId, invByItem, readWttOffer, wttOfferByItem, wttOfferQtyByItem, writeWttOffer]);
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
    .upsert(
      {
        ...base,
        item_id: null,
        is_custom: true,
        custom_text: payload.custom_text ?? "",
        custom_image_url: payload.custom_image_url ?? null,
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
  thumbs,
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
    // Si no hay miniaturas, renderiza un div vacío con el mismo tamaño y estilos
    if (!thumbs || Object.keys(thumbs).length === 0) {
      const def = defFor(layoutKey);
      const extras = getExtrasCount(layoutKey);
      const baseCount = def.slots - extras;
      const cols = def.cols;
      const preset =
  size === "modal"
    ? { maxW: 850, maxH: 650, padding: 10 } // Aumentamos el contenedor para que la escala sea mayor
    : size === "picker"
    ? { maxW: 110, maxH: 76, padding: 4 }
    : { maxW: 84, maxH: 60, padding: 4 };
      const { slotW, slotH, gap: previewGap, rowGap: previewRowGap } = getSlotDimsForLayout(def);
      const baseRows = Math.ceil(baseCount / cols);
      const rowW = cols * slotW + (cols - 1) * previewGap;
      const naturalW = rowW;
      const naturalH =
        baseRows * slotH +
        (baseRows - 1) * previewRowGap +
        (extras > 0 ? previewRowGap + slotH : 0);
      const scale = Math.min(preset.maxW / naturalW, preset.maxH / naturalH, 1);
      const baseSlotsArr = Array.from({ length: baseCount }, (_, i) => i + 1);
      const extraSlotsArr =
        extras > 0 ? Array.from({ length: extras }, (_, i) => baseCount + 1 + i) : [];
      const rows = Array.from({ length: baseRows }, (_, r) =>
        baseSlotsArr.slice(r * cols, (r + 1) * cols)
      );
      return (
        <div
          style={{
            width: preset.maxW,
            height: preset.maxH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
          aria-hidden="true"
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "center",
              padding: preset.padding,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: previewRowGap }}>
              {rows.map((rowSlots, idx) => (
                <div
                  key={idx}
                  style={{
                    width: rowW,
                    display: "flex",
                    gap: previewGap,
                    justifyContent: rowSlots.length < cols ? "center" : "flex-start",
                  }}
                >
                  {rowSlots.map((s) => (
                    <div
                      key={s}
                      style={{
                        width: slotW,
                        height: slotH,
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        background: "#fafafa",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    />
                  ))}
                </div>
              ))}
              {extras > 0 && (
                <div
                  style={{
                    width: rowW,
                    display: "flex",
                    justifyContent: "center",
                    gap: previewGap,
                  }}
                >
                  {extraSlotsArr.map((s) => (
                    <div
                      key={s}
                      style={{
                        width: slotW,
                        height: slotH,
                        borderRadius: 10,
                        border: "1px solid #f1d86a",
                        background: "#fff7cc",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
      const def = defFor(layoutKey);
  const extras = getExtrasCount(layoutKey);
  const baseCount = def.slots - extras;
  const cols = def.cols;

  const preset =
  size === "modal"
    ? { maxW: 850, maxH: 650, padding: 10 } // Aumentamos el contenedor para que la escala sea mayor
    : size === "picker"
    ? { maxW: 110, maxH: 76, padding: 4 }
    : { maxW: 84, maxH: 60, padding: 4 };

  const { slotW, slotH, gap: previewGap, rowGap: previewRowGap } = getSlotDimsForLayout(def);

  const baseRows = Math.ceil(baseCount / cols);
  const rowW = cols * slotW + (cols - 1) * previewGap;
  const naturalW = rowW;
  const naturalH =
    baseRows * slotH +
    (baseRows - 1) * previewRowGap +
    (extras > 0 ? previewRowGap + slotH : 0);

  const scale = Math.min(preset.maxW / naturalW, preset.maxH / naturalH, 1);

  const baseSlotsArr = Array.from({ length: baseCount }, (_, i) => i + 1);
  const extraSlotsArr =
    extras > 0 ? Array.from({ length: extras }, (_, i) => baseCount + 1 + i) : [];

  const rows = Array.from({ length: baseRows }, (_, r) =>
    baseSlotsArr.slice(r * cols, (r + 1) * cols)
  );

  const thumbMap = thumbs ?? {};

  const Cell = ({ isExtra, meta }: { isExtra?: boolean; meta?: ThumbMeta }) => {
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
    const extraCount =
      Number(meta?.stockTotal ?? 0) > 1 ? Number(meta?.stockTotal ?? 0) - 1 : 0;

    const badgeFont = size === "modal" ? 10 : size === "picker" ? 8 : 7;
    const badgePad = size === "modal" ? "2px 6px" : "1px 5px";

    return (
      <div
        style={{
          width: slotW,
          height: slotH,
          borderRadius: 10,
          border: `1.5px solid ${st.border}`,
          background: st.bg,
          overflow: "hidden",
          position: "relative",
          boxShadow:
            extraCount > 0
              ? `0 8px 18px ${st.border}55`
              : `0 3px 10px ${st.border}22`,
          transition: "all .2s ease",
        }}
      >
  {url ? (
  meta?.isWanted ? (
    <div style={{ width: "100%", height: "100%", transform: "scale(1.1)" }}>
      <WesternWantedFrame 
        name={prettyText(meta?.member || meta?.name || "")} 
        variant="slot"
      >
        <img src={url} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </WesternWantedFrame>
    </div>
  ) : (
    <img
      src={url}
      alt=""
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        borderRadius: 8,
      }}
    />
  )
) : null}



        {wish ? (
          <span
            style={{
              position: "absolute",
              top: 4,
              left: 4,
              padding: badgePad,
              borderRadius: 999,
              border: "1px solid #f1d86a",
              background: "rgba(255,247,204,0.96)",
              color: "#7a5a00",
              fontWeight: 900,
              fontSize: badgeFont,
              lineHeight: 1,
              boxShadow: "0 2px 6px rgba(241,216,106,0.28)",
              letterSpacing: 0.2,
            }}
          >
            WISH
          </span>
        ) : null}

        {!wish && otw ? (
          <span
            style={{
              position: "absolute",
              top: 4,
              left: 4,
              padding: badgePad,
              borderRadius: 999,
              border: "1px solid #9cc8ff",
              background: "rgba(232,243,255,0.96)",
              color: "#2d5b96",
              fontWeight: 900,
              fontSize: badgeFont,
              lineHeight: 1,
              boxShadow: "0 2px 6px rgba(156,200,255,0.28)",
              letterSpacing: 0.2,
            }}
          >
            OTW
          </span>
        ) : null}

        {!wish && extraCount > 0 ? (
          <span
            style={{
              position: "absolute",
              right: 4,
              bottom: 4,
              minWidth: size === "modal" ? 22 : 18,
              height: size === "modal" ? 22 : 18,
              padding: size === "modal" ? "0 6px" : "0 5px",
              borderRadius: 999,
              border: "1px solid #ffb870",
              background: "rgba(255,232,204,0.96)",
              color: "#8a4d00",
              fontWeight: 950,
              fontSize: badgeFont,
              lineHeight: size === "modal" ? "20px" : "16px",
              textAlign: "center",
              boxShadow: "0 2px 6px rgba(255,184,112,0.28)",
            }}
          >
            +{extraCount}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div
      style={{
        width: preset.maxW,
        height: preset.maxH,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center",
          padding: preset.padding,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: previewRowGap }}>
          {rows.map((rowSlots, idx) => (
            <div
              key={idx}
              style={{
                width: rowW,
                display: "flex",
                gap: previewGap,
                justifyContent: rowSlots.length < cols ? "center" : "flex-start",
              }}
            >
              {rowSlots.map((s) => (
                <Cell key={s} meta={thumbMap[s]} />
              ))}
            </div>
          ))}

          {extras > 0 && (
            <div
              style={{
                width: rowW,
                display: "flex",
                justifyContent: "center",
                gap: previewGap,
              }}
            >
              {extraSlotsArr.map((s) => (
                <Cell key={s} isExtra meta={thumbMap[s]} />
              ))}
            </div>
          )}
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
  onDrop,
  onDragOver,
  onDragEnd,
  onDragLeave,
  showPageNumber = true,
  onDeletePage,
  refreshTick,
  pageWidth, // <-- nuevo
  pageHeight, // <-- nuevo
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
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  showPageNumber?: boolean;
  onDeletePage?: (pageId: number) => void;
  refreshTick: number;
  pageWidth?: number; // <-- nuevo
  pageHeight?: number; // <-- nuevo
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
        border: active ? "2px solid #D1E9FF" : "1px solid #ddd",
        background: active ? "#F0F7FF" : "white",
        cursor: "pointer",
        padding: 8,
        position: "relative",
        transition: "all 140ms ease",
      }}
      onClick={onClick}
      title={title}
      draggable={draggable}
      onDragStart={onDragStart}
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
    title="Eliminar página"
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
    size={size === "modal" ? "modal" : "carousel"}
    thumbs={thumbMap}
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

  // ✅ FIX REORDER: 2 pasos para evitar colisión de page_index
  const persistPageOrder = useCallback(
  async (nextPages: Array<{ id: number; page_index: number; layout_type: LayoutType }>) => {
    if (!binderId) return { ok: false, error: "No binderId" };
    if (pageReorderBusy) return { ok: false, error: "Busy" };

    setPageReorderBusy(true);

    // Fase 1: mueve todo a índices “seguros” (1000+idx) para evitar colisiones
    const phase1 = await Promise.all(
      nextPages.map((p, idx) =>
        supabase
          .from("binder_pages")
          .update({ page_index: 1000 + idx })
          .eq("id", p.id)
      )
    );

    const err1 = phase1.find((r) => r.error)?.error;
    if (err1) {
      setPageReorderBusy(false);
      return { ok: false, error: err1.message };
    }

    // Fase 2: aplica índices finales (0..n-1)
    const phase2 = await Promise.all(
      nextPages.map((p, idx) =>
        supabase
          .from("binder_pages")
          .update({ page_index: idx })
          .eq("id", p.id)
      )
    );

    const err2 = phase2.find((r) => r.error)?.error;
    if (err2) {
      setPageReorderBusy(false);
      return { ok: false, error: err2.message };
    }

    const normalized = nextPages.map((p, idx) => ({ ...p, page_index: idx }));
setBinderPages(normalized);
setPagesCount(normalized.length);
setPageReorderBusy(false);
return { ok: true, error: null as string | null };
},
[binderId, pageReorderBusy]
);

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
    }>
  > = {};

  if (!binderId) return grouped;

  // 1) Leer de BD TODOS los slots de TODAS las páginas del binder
  const pagesRes = await supabase
    .from("binder_pages")
    .select("id")
    .eq("binder_id", binderId);

  if (pagesRes.error) {
    console.error("Error leyendo páginas para undo snapshot:", pagesRes.error.message);
    return grouped;
  }

  const allPageIds = (pagesRes.data ?? [])
    .map((p: any) => Number(p.id))
    .filter((n: number) => Number.isFinite(n));

  if (allPageIds.length > 0) {
    const slotsRes = await supabase
      .from("page_slots")
      .select("page_id, slot_index, item_id, face, rot, flip_h, is_custom, custom_text, custom_image_url, custom_back_image_url")
      .in("page_id", allPageIds);

    if (slotsRes.error) {
      console.error("Error leyendo page_slots para undo snapshot:", slotsRes.error.message);
      return grouped;
    }

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
        custom_text: (row as any).custom_text ?? null,
        custom_image_url: (row as any).custom_image_url ?? null,
        custom_back_image_url: (row as any).custom_back_image_url ?? null,
      });
    }
  }

  // 2) Sobrescribir la página activa con el estado LOCAL actual
  // para que el snapshot refleje exactamente lo que ve la usuaria
  if (pageId) {
    const activePageSlots: Array<{
      slot_index: number;
      item_id: number | null;
      face: "front" | "back";
      rot: number;
      flip_h: boolean;
      is_custom: boolean;
      custom_text?: string | null;
      custom_image_url?: string | null;
      custom_back_image_url?: string | null;
    }> = [];

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

// ✅ restaurar page_slots de forma segura
const targetPageldsList = targetPages.map((p) => p.id);

      if (targetPageldsList.length > 0) {
        // 1. Borramos la base de datos actual para esas páginas
        await supabase.from("page_slots").delete().in("page_id", targetPageldsList);

        // 2. Preparamos los datos rescatados (asegurando que no haya undefined)
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
              custom_back_image_url: row.custom_back_image_url ?? null
            });
          }
        }

        // 3. Volvemos a insertar
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
setPlacedByItem(prev.placedByItem); // <--- AÑADE ESTA LÍNEA
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
      if (!cancelled) {
        setEmail(user.email ?? null);
        setUserId(user.id);

        
      }

      let bld = Number.isFinite(binderFromUrlNum) ? binderFromUrlNum : undefined;

if (!bld) {
 const binderRes = await supabase
  .from("binders")
  .select("id")
  .eq("user_id", user.id)
  .order("id", { ascending: false })
  .limit(1);

 bld = binderRes.data?.[0]?.id;
}

if (!bld && !cancelled) {
 const created = await supabase
  .from("binders")
  .insert({ user_id: user.id, title: "Mi Binder" })
  .select("id")
  .single();

 if (!created.error) bld = created.data.id;
}

if (cancelled || !bld) return;

setBinderId(bld);

/* ✅ NUEVO: asegurar que exista al menos una página */
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

   // Página 94 - Consulta Supabase
const { data: slotsData, error: slotsError } = await supabase
  .from("page_slots")
  .select(`
    is_wanted,
    assigned:enriched_items (
      id,
      name,
      image_url,
      member,
      member_id,
      version
    )
  `)
  .eq("page_id", pageData.id);

// Página 95 - Mapeo de datos
if (!slotsError && slotsData) {
  const newItems: Record<number, any> = {};
  slotsData.forEach((s: any) => {
    if (s.assigned) {
      newItems[s.slot_index] = {
        ...s.assigned,
        is_wanted: s.is_wanted, // <--- CLAVE PARA EL CHECK
      };
    }
  });
  setSlotItems(newItems);
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

  // ✅ custom dummy
  is_custom: boolean | null;
  custom_text: string | null;
  custom_image_url: string | null;
};

    const run = async () => {
  if (!pageId) return;
  setError(null);
  const slotsRes = await supabase
    .from("page_slots")
    .select("slot_index, item_id, rot, flip_h, is_custom, custom_text, custom_image_url, member_id") // AÑADIDO member_id
    .eq("page_id", pageId);

  if (slotsRes.error) {
    if (!cancelled) setError(slotsRes.error.message);
    return;
  }

  const rows = (slotsRes.data ?? []) as PageSlotRow[];
  const itemIds = rows.map((r) => r.item_id).filter((x): x is number => typeof x === "number");

  const itemsById = new Map<number, SlotItem>();
  if (itemIds.length > 0) {
    const itemsRes = await supabase
  .from("items")
  .select("id, name, image_url, back_image_url, member, member_id")
  .in("id", itemIds);

if (!itemsRes.error) {
  for (const it of (itemsRes.data ?? []) as DbItemRow[]) {
    itemsById.set(it.id, {
      id: it.id,
      name: it.name,
      image_url: it.image_url ?? null,
      back_image_url: it.back_image_url ?? null,
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
      const it = itemsById.get(r.item_id);
      // PASAMOS EL member_id AL OBJETO PARA EL CORAZÓN
      map[si] = it 
        ? ({ ...it, member_id: (r as any).member_id } as any) 
        : ({ id: r.item_id, name: null, image_url: null, back_image_url: null, member_id: (r as any).member_id } as any);
    } else if (r.is_custom) {
        map[si] = {
          id: -Number(`${Date.now()}${si}`),
          name: "PC personalizada",
          is_custom: true,
          custom_text: r.custom_text ?? "",
          custom_image_url: r.custom_image_url ?? null,
          member_id: (r as any).member_id ?? null, // 👈 ¡ESTA ES LA LÍNEA MÁGICA QUE FALTABA!
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
          const confirmBuy = window.confirm(
            `Al reducir el formato, ${orphans.length} photocards se quedan sin espacio.\n\nAñadir las páginas necesarias superaría tu límite gratuito (${MAX_FREE_PAGES} páginas).\n\n¿Quieres ampliar tu binder para realizar este cambio?`
          );
          if (confirmBuy) {
            setBuyPagesOpen(true); // Abre el modal de compra que ya tienes configurado
          }
          return; // Abortamos el proceso para no borrar cartas
        } else {
          // Hay margen para crear páginas gratis
          const confirmCreate = window.confirm(
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
        const confirm = window.confirm(
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
 setSlotItems((prev) => ({
  ...prev,
  [slotIndex]: {
    id: it.id,
    name: it.name,
    image_url: it.image_url ?? null,
    back_image_url: it.back_image_url ?? null,
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

  const PagesModal = () => {
  const onDragStartPage = (pageId: number) => (e: React.DragEvent<HTMLDivElement>) => {
    pageDraggingRef.current = true;
    setPageDragFromId(pageId);
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
    background: "rgba(0,0,0,0.35)",
    zIndex: 30000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  }}
  role="dialog"
  aria-modal="true"
>
             <div
  onMouseDown={(e) => e.stopPropagation()}
  style={{
    width: "min(1160px, 96vw)",
    height: "min(820px, 92vh)",
    background: "#FFFDF5",
    borderRadius: 18,
    border: "1px solid #f3d7e4",
    boxShadow: "0 18px 60px rgba(0,0,0,0.20)",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "72px 1fr",
  }}
>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 18px",
      borderBottom: "1px solid #f3c7da",
      background: "#ffd9e6",
    }}
  >
 <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
  <img
    src="/branding/logo.png"
    alt="My Kpop Binder Logo"
    style={{ height: 42, width: "auto", objectFit: "contain", flex: "0 0 auto" }}
  />

  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
    <div
      style={{
        fontWeight: 900,
        color: "#8C659C",
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span>Todas las páginas</span>
      {pageReorderBusy && (
        <span style={{ fontSize: 12, color: "#8C659C", opacity: 0.8 }}>
          Guardando orden…
        </span>
      )}
    </div>

    <div
      style={{
        fontSize: 12,
        color: "#8C659C",
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 999,
          border: "1px solid #F7A8D8",
          background: "rgba(255,255,255,0.72)",
          color: "#8C659C",
          fontWeight: 900,
        }}
      >
        Tip
      </span>
      <span>arrastra para reordenar</span>
    </div>
  </div>

 

 </div>

 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
  <button
   type="button"
   onClick={() => { void doPagesModalUndo(); }}
   title="Deshacer cambios de páginas"
   style={{
    ...topBtnStyle,
    padding: "8px",
    width: 36,
    height: 36,
    justifyContent: "center",
   }}
  >
   <Undo2 size={18} strokeWidth={2.5} />
  </button>

  <button
   type="button"
   onClick={closePagesModal}
   title="Cerrar"
   className="iconDangerHover modalCloseBtn"
   style={{
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
   }}
  >
   ✕
  </button>
 </div>
</div>

        <div
  style={{
    padding: 12,
    overflow: "auto",
    overflowAnchor: "none",
  }}
>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 14,
                alignItems: "start",
              }}
            >
             {ordered.map((p, idx) => {
  const active = idx === currentPageIndex;

  const isDropTarget =
    pageDragOverId === p.id &&
    pageDragFromId != null &&
    pageDragFromId !== p.id;

  const isDragging = pageDragFromId === p.id;

  return (
    <div
      key={p.id}
      draggable
      onDragStart={onDragStartPage(p.id)}
      onDragEnd={onDragEndPage}
      onDragEnter={(e) => {
        // ✅ SI estás arrastrando una PC: cambia de página “al vuelo”
        if (lastSlotDragRef.current) {
          e.preventDefault();
          e.stopPropagation();
          setCurrentPageIndex(idx);
          return;
        }
        // ✅ si no, comportamiento normal (reordenar páginas)
        setPageDragOverId(p.id);
      }}
      onDragOver={onDragOverPage(p.id)}
      onDragLeave={onDragLeavePage(p.id)}
      onDrop={onDropPage(p.id)}
      style={{
        position: "relative",
        overflow: "visible",
        borderRadius: 16,
        transform: isDragging ? "scale(1.02)" : "scale(1)",
        opacity: isDragging ? 0.92 : 1,
        transition: "transform 160ms ease, opacity 160ms ease",
      }}
      data-refresh-tick={refreshTick}
    >
      {/* ✅ Halo/animación de drop */}
      {isDropTarget && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: 16,
            border: "2px solid rgba(141,184,255,0.95)",
            background: "rgba(141,184,255,0.12)",
            boxShadow: "0 18px 40px rgba(141,184,255,0.22)",
            pointerEvents: "none",
            zIndex: 5,
            animation: "dropPulse 520ms ease-out infinite",
          }}
        />
      )}

   
<PageThumb
  pageId={p.id}
  layoutKey={p.layout_type}
  active={active}
  size="modal"
  title={`Ir a página ${idx + 1}`}
  onClick={() => {
    if (lastSlotDragRef.current) return;
    setCurrentPageIndex(idx);
  }}
  pageNumber={idx + 1}
  showPageNumber
  onDeletePage={(id) => void deletePageById(id)}
  refreshTick={refreshTick}
  pageWidth={PAGE_W}
  pageHeight={PAGE_H}
/>

    </div>
  );
})}
            </div>
          </div>
        </div>
      </div>
    );
  };
const BuyPagesModal = () => (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setBuyPagesOpen(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
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
          background: "#f0efe9",
          borderRadius: 18,
          border: "1px solid #7d187f",
          boxShadow: "0 18px 60px rgba(81, 41, 95, 0.2)",
          overflow: "hidden",
          display: "flex",           // Mejoramos el layout a flex
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #7d187f",
// ... el resto de tu modal sigue igual ...
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontWeight: 900, color: "#694a79" }}>Límite alcanzado</div>
        <button
          type="button"
          onClick={() => setBuyPagesOpen(false)}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid #c6a0e4",
            background: "#ccaad340",
            cursor: "pointer",
            fontWeight: 900,
            color: "#694a79",
          }}
          title="Cerrar"
        >
          ✕
        </button>
      </div>

      <div style={{ padding: 16, textAlign: "left" }}>
        <div style={{ color: "#694a79", fontWeight: 800, lineHeight: 1.4 }}>
          Has llegado al máximo de <b>{MAX_FREE_PAGES}</b> páginas.
        </div>
        <div style={{ marginTop: 8, color: "#666", lineHeight: 1.45 }}>
          Si quieres añadir más, puedes comprar páginas extra.
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setBuyPagesOpen(false)}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
                  border: "1px solid #8db8ff",
              background: "#eaf2ff",
              cursor: "pointer",
              fontWeight: 900,
               color: "#694a79",
            }}
          >
            Ahora no
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
              border: "1px solid #8db8ff",
              background: "#eaf2ff",
              cursor: "pointer",
              fontWeight: 900,
              color: "#694a79",
            }}
          >
            Comprar más páginas
          </button>
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
          h.style.cssText = `position: absolute; bottom: 20%; left: ${Math.random() * 80 + 10}%; font-size: 28px; color: #e23d61; text-shadow: 0 0 6px rgba(174, 0, 255, 0.6); z-index: 99999; pointer-events: none; animation: heartFlyUp 1.2s ease-out forwards;`;
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
          boxShadow: "inset 0 0 12px rgba(0,0,0,0.8)",
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
          color: "#2a1a0a",
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
  placedByItem, // 👈 AÑADIMOS LA PROP AQUÍ
}: {
  slotIndex: number;
  invByItem: Record<number, StatusCounts>;
  emptyCounts: () => StatusCounts;
  placedByItem: Record<number, number>; // 👈 Y SU TIPO AQUÍ
}) => {
  const assigned = slotItems[slotIndex] ?? null;
  const neonOrange = "rgba(255, 136, 0, 0.9)";
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
color: #e23d61;
text-shadow: 0 0 6px rgba(174, 0, 255, 0.6);
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
          { boxShadow: "0 0 0 rgba(0,0,0,0)", backgroundColor: "rgba(0,0,0,0)" },
          { boxShadow: "0 10px 22px rgba(0,0,0,0.12)", backgroundColor: "rgba(207,227,255,0.25)" },
          { boxShadow: "0 0 0 rgba(0,0,0,0)", backgroundColor: "rgba(0,0,0,0)" },
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


const badge = assigned ? dominantBadge(counts) : { key: null, label: "", bg: "#fff", border: "#eee" };



   // ... (unas líneas arriba tienes: const face = slotFace[slotIndex] ?? "front"; etc.)

const frontUrl = assigned?.is_custom
  ? (assigned.custom_image_url ?? undefined) 
  : (assigned?.image_url ?? undefined);

const backUrl = assigned?.is_custom
  ? ((assigned as any).custom_back_image_url ?? DEFAULT_BACK_URL)
  : (assigned?.back_image_url ?? DEFAULT_BACK_URL);


    







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

const handleDragEnd = () => {
  lastSlotDragRef.current = null;
  setDragOverSlot(null);
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
  border: "1px solid #F7A8D8",
  background: "#FFF9FB",
  color: "#8C659C",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(247,168,216,0.12)",
};
    const iconBtnStyle: React.CSSProperties = {
  width: 23,
  height: 23,
  borderRadius: 8,
  border: "1px solid #e7e7ef",
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(8px)",
  fontWeight: 900,
  fontSize: 13,
  color: "var(--icon-color, #777)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: "var(--icon-shadow, 0 10px 24px rgba(0,0,0,0.12))",
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
      { boxShadow: "0 0 0 rgba(0,0,0,0)", filter: "brightness(1)", transform: "translateZ(0)" },
      { boxShadow: "0 12px 26px rgba(0,0,0,0.14)", filter: "brightness(1.03)", transform: "translateZ(0)" },
      { boxShadow: "0 0 0 rgba(0,0,0,0)", filter: "brightness(1)", transform: "translateZ(0)" },
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
                boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
                width: 26,
                height: 26,
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "white",
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
                boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
                width: 26,
                height: 26,
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "white",
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
            border: isFxAnchor ? "2px solid #8db8ff" : "1px solid rgba(141,184,255,0.55)",
            boxShadow: isFxAnchor
              ? "0 0 0 6px rgba(141,184,255,0.16), 0 14px 30px rgba(0,0,0,0.10)"
              : "0 0 0 4px rgba(141,184,255,0.10)",
            background: isFxAnchor ? "rgba(141,184,255,0.08)" : "transparent",
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
              border: "2px solid rgba(141,184,255,0.95)",
              background: "rgba(141,184,255,0.12)",
              boxShadow: "0 18px 40px rgba(141,184,255,0.22)",
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
                  borderRadius: 12, border: "1px solid #999",
                  overflow: "hidden", 
                  // Filtro para hacerla más grisácea y oscura, dando sombra real
                  filter: "brightness(0.6) grayscale(0.2)", 
                  boxShadow: "0 8px 16px rgba(0,0,0,0.25)"
                }}>
                  <img src={frontUrl || "/mock-pcs/groupsui/not-available.png"} style={{ width: '100%', height: '100%', objectFit: fitThis ? 'contain' : 'cover' }} alt="" />
                </div>
                
                {/* Carta intermedia */}
                <div style={{
                  position: "absolute", inset: 0,
                  transform: "translate(3px, 3px)",
                  borderRadius: 12, border: "1px solid #bbb",
                  overflow: "hidden", 
                  filter: "brightness(0.8) grayscale(0.1)" // Ligeramente oscurecida
                }}>
                  <img src={frontUrl || "/mock-pcs/groupsui/not-available.png"} style={{ width: '100%', height: '100%', objectFit: fitThis ? 'contain' : 'cover' }} alt="" />
                </div>
              </>
            )}

           {/* CARTA PRINCIPAL */}
<div style={{
  width: "100%", height: "100%",
  background: st.bg,
  borderRadius: 12, overflow: "hidden",
  boxShadow: isMulti ? "none" : "0 4px 12px rgba(0,0,0,0.08)",
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
  <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
    {(assigned as any)?.is_wanted === true && uiWishlist > 0 ? (
      <WesternWantedFrame
        name={
  prettyMemberLabel(
    assigned?.member ||
    assigned?.member_name ||
    assigned?.custom_text ||
    assigned?.name ||
    ""
  ) || "—"
}
      >
        <img src={frontUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(0.2)' }} alt="" />
      </WesternWantedFrame>
    ) : (
      <img src={frontUrl} style={{ width: '100%', height: '100%', objectFit: fitThis ? 'contain' : 'cover' }} alt="" />
    )}
  </div>

      {/* LADO TRASERO (BACK) */}
      <div style={{ position: "absolute", inset: 0, transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
        <img src={backUrl || DEFAULT_BACK_URL} style={{ width: '100%', height: '100%', objectFit: fitThis ? 'contain' : 'cover' }} alt="" />
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
  <Heart size={18} fill="#F7A8D8" color="#F7A8D8" strokeWidth={0} />
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
          const ok = window.confirm("¿Eliminar esta photocard?");
          if (ok) await clearSlot(slotIndex);
        }}
        className="iconDangerHover modalCloseBtn"
        style={{ ...iconBtnStyle, width: 24, height: 24, background: 'rgba(255,255,255,0.9)' }}
      >
        ✕
      </button>
    </div>
  </>
) : (
  <button type="button" onClick={() => setPickingSlot(slotIndex)} style={{ width: '100%', height: '100%', borderRadius: 12, border: '1px dashed #cfe4ff', background: '#f7fbff', fontSize: 24, color: '#cfe4ff', cursor: 'pointer', zIndex: 1 }}>+</button>
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
const createNewPage = useCallback(async () => {
 if (!binderId) return;
 if (loading || pageReorderBusy) return;

 if (!canAddPage) {
  setError(`Has alcanzado el límite gratuito de ${MAX_FREE_PAGES} páginas.
Para añadir más páginas necesitas pagar.`);
  setStatus("Límite de páginas alcanzado");
  setBuyPagesOpen(true);
  return;
 }

 // ✅ guardar estado ANTES del cambio
 if (pagesOpen) {
  pushPagesModalUndoSnapshot();
 } else {
  await pushUndoSnapshot();
 }

 setError(null);
 setStatus("Creando página...");
 setLoading(true);

 for (let attempt = 0; attempt < 3; attempt++) {
  const lastRes = await supabase
   .from("binder_pages")
   .select("page_index")
   .eq("binder_id", binderId)
   .order("page_index", { ascending: false })
   .limit(1);

  const lastIndexRaw = lastRes.data?.[0]?.page_index;
  const lastIndex = typeof lastIndexRaw === "number" ? lastIndexRaw : -1;
  const nextIndex = lastIndex + 1;

  const ins = await supabase
   .from("binder_pages")
   .insert({ binder_id: binderId, page_index: nextIndex, layout_type: layout })
   .select("id, page_index, layout_type")
   .single();

  if (!ins.error && ins.data) {
   setStatus("Página creada ✅");
   setLoading(false);
   setRefreshTick((t) => t + 1);
   setCurrentPageIndex(nextIndex);
   return;
  }

  const msg = ins.error?.message ?? "No se pudo crear la página";
  const isDuplicate =
   msg.toLowerCase().includes("duplicate key value") ||
   msg.toLowerCase().includes("unique constraint");

  if (!isDuplicate || attempt === 2) {
   setError(msg);
   setStatus("Error creando página");
   setLoading(false);
   return;
  }
 }
}, [
 binderId,
 layout,
 binderPages,
 pagesCount,
 loading,
 pageReorderBusy,
 MAX_FREE_PAGES,
 canAddPage,
 pushUndoSnapshot,
 pagesOpen,
]);

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

  const ok = window.confirm(
    `¿Borrar la página ${currentPageIndex + 1}? Se perderán los slots colocados en esa página.`
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
function isLikelyImageUrl(u: string | null | undefined) {
  if (!u) return false;
  const clean = u.split("?")[0].toLowerCase();
  return /\.(png|jpe?g|webp)$/.test(clean);
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
// 1. Función para el flag de WTT (Intercambio)
// 1. Función para el flag de WTT (Intercambio)
// 1. Función para el flag de WTT (Intercambio)
// 1. Función para el flag de WTT (Intercambio)
// 1. Función para el flag de WTT (Intercambio)
const persistWttFlag = useCallback(
  async (value: number) => {
    if (!userId) return;
    if (activeItemId == null) return;

    if (value > 0) {
      const up = await supabase
        .from("user_item_statuses")
        .upsert(
          [{ user_id: userId, item_id: activeItemId, status: "wtt", qty: 1 }] as any,
          { onConflict: "user_id,item_id,status" }
        );
      if (up.error) return;
    } else {
      const del = await supabase
        .from("user_item_statuses")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", activeItemId)
        .eq("status", "wtt");
      if (del.error) return;
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
      if (qty > 0) rows.push({ ...base, status, qty });
      else toDelete.push(status);
    };

    pushRow("have", next.have);
    pushRow("wtt", next.wtt);
    pushRow("wts", next.wts);
    pushRow("on_its_way", next.on_its_way);
    pushRow("wishlist", next.wish);
    // ✅ limpia legacy "wish" siempre
    toDelete.push("wish");

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
// ✅ si acaba de activar WTS, pedir precio/moneda/país en modal aparte
if (becameWts) {
  setWtsListingItemId(activeItemId);
  setWtsListingModalOpen(true);
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

  const marketRawStr =
    open && !isCustom && activeItemId != null ? (marketByItem[activeItemId] ?? "") : "";

  const targetCurrency =
    open && !isCustom && activeItemId != null ? (currencyByItem[activeItemId] ?? "EUR") : "EUR";

  const rateKey = fxPairKey(marketBaseCurrency, targetCurrency);
  const existingRate = fxPairRate[rateKey];
  const existingLoading = fxPairLoading[rateKey] === true;

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

  const marketDisplayValue =
    marketBaseValue != null && existingRate != null ? marketBaseValue * existingRate : null;

  const marketDisplayStr =
    marketDisplayValue != null ? String(Math.round(marketDisplayValue * 100) / 100) : "";

  const fxLoading = existingLoading === true;
  const fxErr = fxPairError?.[rateKey];
    const headerBtn: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "white",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
    color: "#2a2a44",
  };
const [marketPrice, setMarketPrice] = useState("");
 const iconBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",

  padding: "6px 10px",
  borderRadius: 10,

  background: "#ffffff",

  color: "#8C659C",                 // 👈 morado del sistema
  fontWeight: 600,
  fontSize: 12,

  border: "1px solid #F7A8D8",      // 👈 borde rosa suave

  boxShadow: "0 1px 4px rgba(140,101,156,0.15)",

  cursor: "pointer",

  transition: "all 0.15s ease",
};

  const dangerBtn: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  border: "1px solid #F4C7D8",
  background: "#FFF7FA",
  color: "#8C659C",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 10px rgba(247,168,216,0.10)",
};

    const subtleCard: CSSProperties = {
  background: "#FFF9FB",
  border: "1px solid #F3DCE7",
  borderRadius: 18,
  boxShadow: "0 8px 24px rgba(247, 168, 216, 0.10)",
};



  if (!open) return null;
// SUSTITUYE las líneas 4532 a 4537 por este bloque:
const frontImg = isCustom ? customImageUrl : (meta?.image_url ?? null);
const backImg = isCustom
  ? ((assigned as any)?.custom_back_image_url ?? DEFAULT_BACK_URL)
  : (meta?.back_image_url ?? DEFAULT_BACK_URL);
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
          <div style={{ fontWeight: 950, color: "#8C659C" }}>Info</div>

          <button
            type="button"
            onClick={() => {
              const ok = window.confirm("¿Eliminar esta photocard del slot?");
              if (!ok) return;
              onRemoveItem();
            }}
            style={dangerBtn}
            title="Eliminar photocard"
          >
            🗑
          </button>
        </div>

        <div style={{ display: "grid", rowGap: 10 }}>
          {[
            { k: "Grupo", v: prettyGroup },
            { k: "Álbum", v: prettyAlbum },
            { k: "Versión", v: prettyVersion },
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
              <div style={{ fontSize: 12, fontWeight: 900, color: "#8C659C" }}>{r.k}</div>
              <div
                style={{
                  fontWeight: 950,
                  color: "#2F2740",
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

      {/* ÁREA 2 COLUMNAS: STOCK + PRECIO */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        
     {/* STOCK */}
<div style={{ ...subtleCard, padding: 14 }}>
  {/* Ocultamos las líneas si el check de Wish está marcado */}
  {uiWishlist <= 0 && (
    <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#333", marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontWeight: 900 }}>Tengo</span>
      <span style={{ fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{uiCounts.have}</span>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontWeight: 900 }}>WTT</span>
      <span style={{ fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{uiWttDisplay}</span>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontWeight: 900 }}>WTS</span>
      <span style={{ fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{uiCounts.wts}</span>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontWeight: 900 }}>On the way</span>
      <span style={{ fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{uiCounts.on_its_way}</span>
    </div>
  </div>
)}
  {/* Checkbox WISH debajo del stock */}

  <label style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginTop: 10,
    padding: "8px 10px", borderRadius: 10, border: "1px solid #eee",
    background: uiWishlist > 0 ? "#fffdf1" : "#fff", cursor: "pointer"
  }}>
    <span style={{ fontSize: 13, fontWeight: 800, color: "#4A3F54" }}>WISH </span>
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
      style={{ width: 18, height: 18, accentColor: "#e8c8eb", cursor: "pointer" }}
    />
  </label>


  {/* Botón "Añadir decoración" persistente: visible si WISH está activo o la decoración está puesta */}
  {/* Botón "Añadir decoración" persistente: visible si WISH está activo o la decoración está puesta */}
  {(uiWishlist > 0 || (assigned as any)?.is_wanted) && (
    <label style={{
      marginTop: "4px", padding: "10px 12px",
      backgroundColor: "#FFF9FB", borderRadius: "14px",
      border: "1px dashed #F7A8D8",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      cursor: "pointer", transition: "all 0.2s ease"
    }}>
      <span style={{ fontSize: "12px", fontWeight: 900, color: "#8C659C" }}>Añadir decoración</span>
      <input
        type="checkbox"
        style={{ width: "16px", height: "16px", accentColor: "#8C659C", cursor: "pointer" }}
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
 border: "1px solid #f6d3e8",
 background: "white",
 color: "#8C659C",
 cursor: uiWishlist > 0 ? "not-allowed" : "pointer",
 fontWeight: 900,
 fontSize: 12,
 opacity: uiWishlist > 0 ? 0.6 : 1,
 boxShadow: uiWishlist > 0 ? "none" : "0 4px 12px rgba(247,168,216,0.14)",
}}
            >
              Actualizar stock
            </button>

            {stockModalOpen && (
              <div
                role="dialog"
                aria-modal="true"
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.35)",
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
    background: "white",
    border: "1px solid #e7e7ef",
    boxShadow: "0 22px 60px rgba(0,0,0,0.22)",
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
  title="Cerrar"
  onClick={(e) => {
    e.stopPropagation();
    if (stockSaving) return;
    setStockModalOpen(false);
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = "#FFF5FA";
    e.currentTarget.style.borderColor = "#F7A8D8";
    e.currentTarget.style.color = "#8C659C";
    e.currentTarget.style.boxShadow = "0 4px 12px rgba(247,168,216,0.18)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = "white";
    e.currentTarget.style.borderColor = "#F7A8D8";
    e.currentTarget.style.color = "#8C659C";
    e.currentTarget.style.boxShadow = "none";
  }}
  style={{
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid #F7A8D8",
    background: "white",
    cursor: stockSaving ? "not-allowed" : "pointer",
    fontWeight: 950,
    color: "#8C659C",
    boxShadow: "none",
    transition: "all 0.15s ease",
  }}
>
  ✕
</button>

                    <div
  style={{
    fontWeight: 900,
    color: "#8C659C",
    fontSize: 18,
  }}
>
  Editar stock
</div>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
  {(() => {
   const setCount = (key: string, value: number) => {
  const prevVal = (stockDraft as any)?.[key] ?? 0;
  const nextVal = Math.max(0, value);

  // Solo procedemos si el valor realmente cambia
  if (nextVal !== prevVal) {
    // Para evitar el error de "await", disparamos el snapshot sin bloquear el hilo principal
    if (activeItemId != null) {
      void pushModalUndoSnapshot(activeItemId);
    }

    if (key === "wtt" && prevVal > 0 && nextVal === 0) {
      if (typeof activeItemId === "number") {
        clearWttWanted(activeItemId);
      }
      setWttWantDraft([]);
    }

    setStockDraft((prev) => ({
      ...(prev ?? emptyCounts()),
      [key]: nextVal,
      // Si activas cualquier stock, desmarca WISH automáticamente
      ...(nextVal > 0 ? { wish: 0 } : {}),
    }) as any);

    if (key === "wtt") setWttDisplay(nextVal);
    setStockDirty(true);
  }
};
    const rows = [
      { key: "have", label: "Tengo" },
      { key: "wts", label: "WTS" },
      { key: "on_its_way", label: "On the way" },
    ];

    return (
      <>
                          {/* ✅ Resto de stocks */}
                          {rows.map((row) => {
          const current = (stockDraft as any)?.[row.key] ?? 0;

                            return (
                           <div
  key={row.key}
  style={{
    borderRadius: 14,
    border: "1px solid #FFD9E6",
    background: "#F2F2F2",
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
    color: "#8C659C",
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
        color: "#8C659C",
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
        setCount(row.key, current + 1);
      }}
      style={{
        gridColumn: "2 / 3",
        gridRow: "1 / 2",
        width: 32,
        height: 20,
        borderRadius: 10,
        border: "1px solid #F7A8D8",
        background: "#FFF5FA",
        color: "#8C659C",
        cursor: "pointer",
        fontWeight: 950,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 1px 4px rgba(247,168,216,0.18)",
      }}
      title="Sumar 1"
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
        height: 20,
        borderRadius: 10,
        border: "1px solid #F7A8D8",
        background: "#FFF5FA",
        color: "#8C659C",
        cursor: "pointer",
        fontWeight: 950,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 1px 4px rgba(247,168,216,0.18)",
      }}
      title="Restar 1"
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
    borderTop: "1px solid #eee",
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
    border: "1px solid #F7A8D8",
    background: "white",
    color: "#8C659C",
    fontWeight: 900,
    cursor: "pointer",
  }}
>
  Cancelar
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
  border: "1px solid #F7A8D8",
  background: "#f7e3ef",
  color: "#8C659C",
  cursor: stockSaving ? "not-allowed" : "pointer",
  fontWeight: 950,
  opacity: stockSaving ? 0.6 : 1,
  boxShadow: "0 4px 12px rgba(247,168,216,0.25)",
}}
  >
    {stockSaving ? "Guardando…" : "Guardar"}
  </button>
</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PRECIO */}
        <div style={{ ...subtleCard, padding: 14, overflow: "hidden" }}>
         <div style={{ fontWeight: 950, color: "#8C659C" }}>Precio</div>

          <div style={{ display: "grid", gap: 12 }}>
           {/* TU PRECIO WTS */}
{uiCounts.wts > 0 ? (
  <div style={{ display: "grid", gap: 6 }}>
    <div style={{ fontSize: 12, color: "#5b5b72", fontWeight: 800 }}>
      Tu precio (WTS)
    </div>

    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap" }}>
      {/* input bloqueado: muestra lo guardado */}
      <input
      
       value={(() => {
  if (activeItemId == null) return "—";
  const stored = priceByItem[activeItemId] ?? readLS(priceKey(activeItemId)) ?? "";
  const raw = String(stored).trim();
  if (!raw) return "—";

  const baseCur = wtsCurrencyByItem[activeItemId] ?? "EUR";
  
  // Si la moneda es la misma, formateamos el original
  if (wtsViewCurrency === baseCur) return formatPrice(raw);
  
  // Si hay conversión
  if (wtsFxRate == null) return "—";
  const base = Number(raw.replace(",", "."));
  return formatPrice(base * wtsFxRate);
})()}
        disabled
        style={{
          width: "33%",
          minWidth: 90,
          maxWidth: 110,
          height: 30,
          padding: "6px 8px",
          borderRadius: 10,
          border: "1px solid #dfe0ee",
          background: "#f4f5fb",
          fontSize: 12,
          lineHeight: "18px",
          color: "#333",
          cursor: "not-allowed",
        }}
        title="Precio fijado por ti (se edita desde el modal)"
      />

      {/* selector libre: SOLO para convertir y consultar */}
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
 padding: "6px 10px",
 borderRadius: 10,
 background: "#FFF5FA",
 border: "1px solid #f6d3e8",
 color: "#8C659C",
 fontWeight: 900,
 fontSize: 12,
 cursor: "pointer",
 boxShadow: "0 2px 8px rgba(247,168,216,0.18)",
}}
 title="Convertir tu precio a otra moneda"
>
 <option value="EUR">EUR</option>
 <option value="USD">USD</option>
 <option value="GBP">GBP</option>
 <option value="JPY">JPY</option>
 <option value="CNY">CNY</option>
 <option value="AUD">AUD</option>
 <option value="CAD">CAD</option>
 <option value="CHF">CHF</option>
 <option value="HKD">HKD</option>
 <option value="SGD">SGD</option>
 <option value="NZD">NZD</option>
 <option value="SEK">SEK</option>
 <option value="NOK">NOK</option>
 <option value="DKK">DKK</option>
 <option value="INR">INR</option>
 <option value="BRL">BRL</option>
 <option value="MXN">MXN</option>
 <option value="KRW">KRW</option>
</select>

{/* botón visible para editar: reabre el WtsListingModal */}
<button
 type="button"
 onMouseDown={(e) => e.stopPropagation()}
 onClick={(e) => {
 e.stopPropagation();
 if (activeItemId == null) return;
 onBecameWts(activeItemId);
 }}
 style={{
 padding: "6px 10px",
 borderRadius: 10,
 background: "#FFF5FA",
 border: "1px solid #f6d3e8",
 color: "#8C659C",
 fontWeight: 900,
 fontSize: 12,
 cursor: "pointer",
 boxShadow: "0 2px 8px rgba(247,168,216,0.18)",
}}
 title="Modificar precio"
 onMouseEnter={(e) => {
 e.currentTarget.style.background = "#f3f4fb";
 e.currentTarget.style.borderColor = "#cfd2ff";
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.background = "white";
 e.currentTarget.style.borderColor = "#dfe0ee";
 }}
>
 <RotateCw size={15} strokeWidth={2.4} />
</button>
</div>
  </div>
) : null}
            {/* PRECIO DE MERCADO */}
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: "#5b5b72", fontWeight: 800 }}>Precio de mercado</div>



              {/* Campo no editable con valor 8 USD y conversión */}
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
 
<input
  value={
    targetCurrency === "USD"
      ? formatPrice(8)
      : (marketFxRate != null ? formatPrice(8 * marketFxRate) : "—")
  } 
  disabled
                  placeholder="Ej: 8 (USD)"
                  style={{
                    width: "50%",
                    minWidth: 120,
                    maxWidth: 160,
                    height: 30,
                    padding: "6px 8px",
                    borderRadius: 10,
                    border: "1px solid #dfe0ee",
                    background: "#f4f5fb",
                    fontSize: 12,
                    lineHeight: "18px",
                    color: "#777",
                    cursor: "not-allowed",
                  }}
                />

                <select
                  value={targetCurrency}
                 onChange={async (e) => {
  if (activeItemId == null) return;
  const cur = e.target.value || "EUR";
  setCurrencyByItem((prev) => ({ ...prev, [activeItemId]: cur }));
  writeLS(currencyKey(activeItemId), cur);

  // ✅ dispara la conversión (y cachea) para que NO se quede “cargando”
  await getFxRate("USD", cur);
}}
                  style={{
  padding: "6px 10px",
  borderRadius: 10,

  background: "#FFF5FA",
  border: "1px solid #f6d3e8",

  color: "#8C659C",
  fontWeight: 900,
  fontSize: 12,

  cursor: "pointer",

  boxShadow: "0 2px 8px rgba(247,168,216,0.18)",
}}
                  title="Moneda para ver la conversión"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                  <option value="KRW">KRW</option>
                  <option value="CNY">CNY</option>
                  <option value="AUD">AUD</option>
                  <option value="CAD">CAD</option>
                  <option value="CHF">CHF</option>
                  <option value="HKD">HKD</option>
                  <option value="SGD">SGD</option>
                  <option value="NZD">NZD</option>
                  <option value="SEK">SEK</option>
                  <option value="NOK">NOK</option>
                  <option value="DKK">DKK</option>
                  <option value="INR">INR</option>
                  <option value="BRL">BRL</option>
                  <option value="MXN">MXN</option>
                </select>
              </div>

              {/* Conversión en tiempo real de 8 USD a la moneda seleccionada */}
<div style={{ fontSize: 12, color: "#5b5b72", lineHeight: 1.4 }}>
  Mercado: <b>{formatPrice(8)}</b> USD
  {targetCurrency !== "USD" ? (
    <>
      {" "} → {targetCurrency}: <b>{marketFxRate != null ? formatPrice(8 * marketFxRate) : "—"}</b>
      {marketFxLoading ? " (cargando…)" : ""}
    </>
  ) : null}
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
         <div style={{ fontWeight: 950, color: "#8C659C" }}>Busco en WTT</div>

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

  background: "#FFF5FA",
  border: "1px solid #f6d3e8",

  color: "#8C659C",
  fontWeight: 900,
  fontSize: 12,

  cursor: "pointer",

  boxShadow: "0 2px 8px rgba(247,168,216,0.18)",
}}
            >
              Mis trades
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
                <img
                  key={`${w.id ?? "wtt"}-${idx}`}
                  src={w.image_url ?? "/mock-pcs/groupsui/not-available.png"}
                  alt=""
                  draggable={false}
                  title={w.name ?? ""}
                  style={{
                    width: 90,
                    height: 110,
                    borderRadius: 12,
                    border: "1px solid #e7e7ef",
                    background: "linear-gradient(180deg, #ffffff, #f6f7ff)",
                    objectFit: "cover",
                    flex: "0 0 auto",
                    scrollSnapAlign: "start",
                    boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
                  }}
                />
              ))}
            </div>
          ) : wttOfferForModal.length > 0 ? null : (
            <div style={{ fontSize: 13, color: "#5b5b72", lineHeight: 1.5 }}>
              Aún no has añadido nada a “Busco en WTT”.
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
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100000,
            padding: 18,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setWttWantOpen(false);
          }}
        >
          <div
            style={{
              width: "min(980px, 96vw)",
              height: "min(740px, 92vh)",
              background: "white",
              borderRadius: 18,
              border: "1px solid #e7e7ef",
              boxShadow: "0 22px 60px rgba(0,0,0,0.22)",
              overflow: "hidden",
              display: "grid",
              gridTemplateRows: "58px auto 1fr 64px",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ fontWeight: 950 }}>Selecciona lo que buscas en WTT</div>
              <button
                type="button"
                onClick={() => setWttWantOpen(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
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
                borderBottom: "1px solid #eee",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <select
                  value={wttWantGroup}
                  onChange={(e) => setWttWantGroup(e.target.value ? Number(e.target.value) : "")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  <option value="">Grupo (todos)</option>
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
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  <option value="">Álbum (todos)</option>
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
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  <option value="">Versión (todas)</option>
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
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  <option value="all">Tipo (todos)</option>
                  <option value="single">Selfie</option>
                  <option value="unit">Unit</option>
                  <option value="ot8">OT8</option>
                </select>

                <select
                  value={wttWantMember}
                  onChange={(e) => setWttWantMember(e.target.value || "")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  <option value="">Miembro (todos)</option>
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
  if (wttWantUnit !== "all" && unitTypeFromMember(it.member || "") !== wttWantUnit) return false;
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
                autoFocus
                value={wttWantQ}
                onChange={(e) => setWttWantQ(e.target.value)}
                placeholder="Búsqueda libre"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                }}
              />
            </div>

            <div style={{ padding: 16, overflow: "auto" }}>
              {wttWantLoading ? (
                <div style={{ color: "#666" }}>Cargando…</div>
              ) : (
                <div
                  ref={wttGridRef}
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
if (wttWantUnit !== "all" && unitTypeFromMember(it.member || "") !== wttWantUnit) return false;

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
                          onClick={() => {
                            const scroller = wttGridRef.current;
                            const top = scroller?.scrollTop ?? 0;
                            setWttWantDraft((prev) =>
                              prev.includes(it.id)
                                ? prev.filter((x) => x !== it.id)
                                : [...prev, it.id]
                            );
                            requestAnimationFrame(() => {
                              if (scroller) scroller.scrollTop = top;
                            });
                          }}
                          style={{
                            borderRadius: 14,
                            border: selected ? "2px solid #8db8ff" : "1px solid #ececf6",
                            background: selected ? "#f2f7ff" : "white",
                            boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
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
                              background: "#fafafa",
                            }}
                          >
                            <img
                              src={it.image_url ?? "/mock-pcs/groupsui/not-available.png"}
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
                borderTop: "1px solid #eee",
              }}
            >
             <div style={{ fontSize: 13, color: "#70708a", fontWeight: 900 }}>
  Seleccionadas: {wttOfferDraft.length}
</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setWttWantOpen(false)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "white",
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
                    border: "1px solid #ddd",
                    background: "white",
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
    background: "#B17EAC", // Púrpura de la tipografía
    color: "white",
    border: "none",
    boxShadow: "0 4px 10px rgba(177, 126, 172, 0.3)"
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
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100000,
            padding: 18,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setWttOfferOpen(false);
          }}
        >
         <div
  style={{
    width: "min(980px, 96vw)",
    height: "min(700px, 92vh)",
    background: "#F7F4EE",
    borderRadius: 18,
    border: "1px solid #F3DCE7",
    boxShadow: "0 22px 60px rgba(0,0,0,0.22)",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "62px auto 1fr 64px",
  }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #F3C7DA",
    background: "#FFD9E6",
  }}
>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
    }}
  >
    <img
      src="/branding/logo.png"
      alt=""
      style={{
        height: 28,
        width: "auto",
        objectFit: "contain",
        flex: "0 0 auto",
      }}
    />
    <div
      style={{
        fontWeight: 950,
        color: "#8C659C",
        fontSize: 20,
        lineHeight: 1.1,
      }}
    >
      Mis trades (WTT)
    </div>
  </div>

  <button
    type="button"
    onClick={() => setWttOfferOpen(false)}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "#FFF5FA";
      e.currentTarget.style.borderColor = "#F7A8D8";
      e.currentTarget.style.color = "#8C659C";
      e.currentTarget.style.boxShadow = "0 4px 12px rgba(247,168,216,0.18)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "white";
      e.currentTarget.style.borderColor = "#F7A8D8";
      e.currentTarget.style.color = "#8C659C";
      e.currentTarget.style.boxShadow = "none";
    }}
    style={{
      width: 34,
      height: 34,
      borderRadius: 10,
      border: "1px solid #F7A8D8",
      background: "white",
      color: "#8C659C",
      cursor: "pointer",
      fontWeight: 900,
      transition: "all 0.15s ease",
    }}
  >
    ✕
  </button>
</div>

          <div
  style={{
    padding: "10px 16px",
    borderBottom: "1px solid #F3DCE7",
    display: "grid",
    gap: 10,
    background: "#efedef",
  }}
>
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10 }}>
                <div style={{ display: "grid", gap: 6 }}>
<div style={{ fontSize: 12, color: "#8C659C", fontWeight: 900 }}>
  Nº de PCs para tradear
</div>
                  <input
                    type="number"
                    min={0}
                    value={wttOfferQtyDraft}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const next = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
                      setWttOfferQtyDraft(next);
                      if (next === 0) setWttOfferDraft([]);
                      if (wttOfferForId != null) {
                        const nextIds = next > 0 ? wttOfferDraft : [];
                        setWttOfferByItem((prev) => ({ ...prev, [wttOfferForId]: nextIds }));
                        setWttOfferQtyByItem((prev) => ({ ...prev, [wttOfferForId]: next }));
                        writeWttOffer(wttOfferForId, next, nextIds);
                        setInvByItem((prev: any) => ({
                          ...prev,
                          [wttOfferForId]: { ...(prev?.[wttOfferForId] ?? emptyCounts()), wtt: next },
                        }));
                        void persistWttQty(wttOfferForId, next);
                      }
                    }}
                    style={{
  height: 34,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #F3DCE7",
  background: "white",
  fontSize: 13,
  color: "#2F2740",
}}
                  />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <label
  style={{
    fontSize: 12,
    color: "#8C659C",
    fontWeight: 900,
    display: "flex",
     borderRadius: 10,
  border: "1px solid #F3DCE7",
      background: "#fff9fe",
    alignItems: "center",
    gap: 6,
  }}
>
  Buscar en mis WTT
</label>
                  <input
                    ref={wttOfferQRef}
                    value={wttOfferQ}
                    onChange={(e) => {
                      setWttOfferQ(e.target.value);
                      requestAnimationFrame(() => wttOfferQRef.current?.focus());
                    }}
                    placeholder="Busca por nombre, miembro, versión…"
                    style={{
                      height: 34,
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: "#fff9fe",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "#666666", display: "flex", alignItems: "center", gap: 6 }}>
                    <Users size={14} strokeWidth={2.4} /> Grupo
                  </label>
                  <select
                    value={wttOfferGroup}
                    onChange={(e) => setWttOfferGroup(e.target.value ? Number(e.target.value) : "")}
                    style={{background: "#fff9fe", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    <option value="">Todos</option>
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
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={pickerLabelStyle}>
                    <Disc3 size={14} strokeWidth={2.4} /> Álbum
                  </label>
                  <select
                    value={wttOfferAlbum}
                    onChange={(e) => setWttOfferAlbum(e.target.value ? Number(e.target.value) : "")}
                    style={{ background: "#fff9fe", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    <option value="">Todos</option>
                    {Array.from(
                      new Set(
                        wttWantCatalog
                          .filter((i) => (wttOfferGroup === "" ? true : i.group_id === wttOfferGroup))
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
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={pickerLabelStyle}>
                    <Mic2 size={14} strokeWidth={2.4} /> Versión
                  </label>
                  <select
                    value={wttOfferVersion}
                    onChange={(e) => setWttOfferVersion(e.target.value)}
                    style={{ background: "#fff9fe", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                  >
                   <option value="">Todos</option>
{Array.from(
  new Set(
    wttWantCatalog
      .filter((i) => (wttOfferGroup === "" ? true : i.group_id === wttOfferGroup))
      .filter((i) => (wttOfferAlbum === "" ? true : i.album_id === wttOfferAlbum))
      .map((i) => String(i.version ?? i.version_name ?? "").trim())
      .filter(Boolean)
  )
)
  .sort((a, b) => prettyText(a).localeCompare(prettyText(b), "es"))
  .map((v) => (
    <option key={v} value={v}>
      {prettyText(v)}
    </option>
  ))}
                  </select>
                </div>

               <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
  <label
    style={pickerLabelStyle}>
 
    <User size={14} strokeWidth={2.4} /> Miembro
  </label>

  <select
    value={wttOfferMember}
    onChange={(e) => setWttOfferMember(e.target.value)}
    style={{
     
   
      background: "#fff9fe", 
      padding: "8px 10px", 
      borderRadius: 10, 
      border: "1px solid #ddd" 
    
    
    }}
  >
    <option value="">Todos</option>
    <option value="bang-chan">Bang Chan</option>
    <option value="lee-know">Lee Know</option>
    <option value="changbin">Changbin</option>
    <option value="hyunjin">Hyunjin</option>
    <option value="han">Han</option>
    <option value="felix">Felix</option>
    <option value="seungmin">Seungmin</option>
    <option value="in">I.N</option>
  </select>
</div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={pickerLabelStyle}>
                    <Layers size={14} strokeWidth={2.4} /> Tipo
                  </label>
                  <select
                    value={wttOfferUnit}
                    onChange={(e) => setWttOfferUnit(e.target.value as any)}
                    style={{ background: "#fff9fe", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    <option value="all">Todos</option>
                    <option value="single">Single</option>
                    <option value="unit">Unit</option>
                    <option value="ot8">OT8</option>
                  </select>
                </div>
              </div>
            </div>

           <div
  ref={wttOfferScrollRef}
  style={{
    padding: 12,
    overflow: "auto",
    overflowAnchor: "none",
  }}
>
              {(() => {
                if (wttWantLoading) {
                  return <div style={{ fontSize: 13, color: "#666" }}>Cargando…</div>;
                }

                const filtered = wttWantCatalog.filter((it) => {
  if (wttOfferGroup !== "" && it.group_id !== wttOfferGroup) return false;
  if (wttOfferAlbum !== "" && it.album_id !== wttOfferAlbum) return false;
  
  // Normalización de versión para evitar rojos
  const versionStr = String(it.version ?? it.version_name ?? "");
  if (wttOfferVersion && versionStr !== wttOfferVersion) return false;

  // CORRECCIÓN PARA EVITAR EL ROJO EN MEMBER:
  // Usamos ?? "" para garantizar que siempre se envíe un string a las funciones
  const memberVal = it.member ?? it.member_name ?? "";

  if (wttOfferMember && !memberMatches(memberVal, wttOfferMember)) return false;
  
  if (wttOfferUnit !== "all" && unitTypeFromMember(memberVal) !== wttOfferUnit) return false;

  const q = normText(wttOfferQ);
  if (!q) return true;

  const hay = normText(
    [
      it.id,
      it.name ?? "",
      it.member ?? "",
      it.member_name ?? "",
      it.version ?? "",
      it.version_name ?? "",
      it.version_name_display ?? "",
      notesByItem[it.id] ?? readLS(notesKey(it.id)) ?? "",
    ].join(" ")
  );
  return hay.includes(q);
});
                if (!filtered.length) {
                  return <div style={{ fontSize: 13, color: "#666" }}>No hay resultados.</div>;
                }

                return (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {filtered.map((it) => {
  const selected = wttOfferDraft.includes(it.id);

  return (
   <div
  key={it.id}
  role="button"
  aria-pressed={selected}
  onMouseDown={(e) => {
    const el = wttOfferScrollRef.current;
    if (el) {
      wttOfferScrollSnapshotRef.current = {
        top: el.scrollTop,
        left: el.scrollLeft,
      };
    }
    e.preventDefault();
  }}
  onClick={() => {
    setWttOfferDraft((prev) =>
      prev.includes(it.id)
        ? prev.filter((x) => x !== it.id)
        : [...prev, it.id]
    );
  }}
  style={{
    border: selected ? "2px solid #8db8ff" : "2px solid transparent",
    borderRadius: 12,
    background: selected ? "#f2f7ff" : "white",
    padding: 6,
    cursor: "pointer",
    textAlign: "left",
    boxSizing: "border-box",
    boxShadow: selected
      ? "0 8px 18px rgba(141,184,255,0.16)"
      : "0 8px 18px rgba(0,0,0,0.06)",
    userSelect: "none",
  }}
>
      <img
        src={it.image_url ?? "/mock-pcs/groupsui/not-available.png"}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          aspectRatio: "3 / 4",
          objectFit: "cover",
          borderRadius: 8,
          border: "1px solid #e7e7ef",
          background: "#fafafa",
          display: "block",
          pointerEvents: "none",
        }}
      />
    </div>
  );
})}
                  </div>
                );
              })()}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 16px",
                borderTop: "1px solid #eee",
              }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>
                Seleccionadas: <b>{wttOfferDraft.length}</b>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
               <button
  type="button"
  onClick={() => setWttOfferDraft([])}
  style={{
    padding: "8px 14px",
    borderRadius: 14,
    border: "1px solid #FFD9E6",
    background: "#FFF5FA",
    color: "#8C659C",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  }}
>
  <Trash2 size={16} />
  Borrar selección
</button>
                <button
                  type="button"
                  onClick={() => setWttOfferOpen(false)}
                  style={{
  padding: "10px 16px",
  borderRadius: 14,
  border: "1px solid #FFD9E6",
  background: "#FFF5FA",
  color: "#8C659C",
  fontWeight: 900,
  cursor: "pointer",
}}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => saveWttOfferDraft()}
                 style={{
  padding: "10px 16px",
  borderRadius: 14,
  border: "1px solid #F7B9D2",
  background: "#FFE8F2",
  color: "#8C659C",
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(247,185,210,0.25)",
}}
                >
                  Guardar
                </button>
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
        <div style={{ fontWeight: 950, color: "#1f1f2f", lineHeight: 1.15 }}>
          Información PC personalizada
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <textarea
            value={draftCustomText}
            onChange={(e) => setDraftCustomText(e.target.value)}
            onBlur={() => onChangeCustomText(draftCustomText)}
            placeholder="Ej: dónde la conseguiste, notas, trade info…"
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #F3DCE7",
background: "white",
color: "#2F2740",
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
      border: "1px solid #d9b0ea",
      background: "white",
      cursor: "pointer",
      fontWeight: 800,
      boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
    }}
    title="Subir imagen"
  >
    Subir anverso
    
    <input
      type="file"
      accept="image/png,image/jpeg,image/webp"
      style={{ display: "none" }}
      onChange={(e) => {
  const f = e.target.files?.[0];
    if (f) onPickCustomImage(f, "front"); // Añade "front"
  e.currentTarget.value = "";
}}
    />
  </label>
  <label
    style={{
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #d9b0ea",
      background: "white",
      cursor: "pointer",
      fontWeight: 800,
      boxShadow: "0 8px 18px rgba(193, 143, 205, 0.06)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
    }}
    title="Subir imagen"
  >
    Subir reverso
    
    <input
      type="file"
      accept="image/png,image/jpeg,image/webp"
      style={{ display: "none" }}
     
       onChange={(e) => {
  const f = e.target.files?.[0];
  if (f) onPickCustomImage(f, "back"); // Añade "back"
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
            border: customIsBias ? "1px solid #F7A8D8" : "1px solid #d9b0ea",
            background: customIsBias ? "#FFF5FA" : "white",
            cursor: "pointer",
            fontWeight: 800,
            boxShadow: customIsBias ? "0 8px 18px rgba(247,168,216,0.12)" : "0 8px 18px rgba(193, 143, 205, 0.06)",
            transition: "all 140ms ease",
          }}
          title="Marcar como Bias"
        >
         <input
            type="checkbox"
            checked={customIsBias}
            onChange={(e) => onToggleCustomBias(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "#F7A8D8", cursor: "pointer" }}
          />
 
          <span style={{ fontSize: 14, color: customIsBias ? "#8C659C" : "#555" }}>
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
      padding: "10px 12px",
      borderRadius: 12,
      background: "white",
      cursor: "pointer",
      fontWeight: 800,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
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
        background: "rgba(0,0,0,0.40)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
 width: "auto",
 maxWidth: "96vw",
 height: "auto",
 maxHeight: "92vh",
 background: "#F7F4EE",
 borderRadius: 18,
 border: "1px solid #F3DCE7",
 boxShadow: "0 30px 80px rgba(0,0,0,0.22)",
 overflow: "hidden",
 display: "grid",
 gridTemplateRows: "62px auto",
 
}}

      >
    
{/* HEADER */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 16px",
    borderBottom: "1px solid #F3C7DA",
    background: "#FFD9E6",
  }}
>
  {/* IZQUIERDA: logo + título */}
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
      flex: 1,
    }}
  >
    <img
      src="/branding/logo.png"
      alt=""
      style={{
        height: 28,
        width: "auto",
        objectFit: "contain",
        flex: "0 0 auto",
      }}
    />

    <div
      style={{
         fontSize: 22,      // 👈 tamaño del nombre
        fontWeight: 950,
        color: "#8C659C",
        whiteSpace: "pre-line",
        lineHeight: 1.1,
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {headerTitle}
    </div>
  </div>

  {/* DERECHA: botones */}
  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
    {/* AÑADE ESTE BOTÓN AQUÍ: */}
  <button
    type="button"
    onClick={() => { void doModalUndo(); }}
    title="Deshacer cambios en esta PC"
    style={{
      ...iconBtnStyle,
      padding: "8px",
      width: 36,
      height: 36,
    }}
  >
    <Undo2 size={18} strokeWidth={2.5} />
  </button>

    <button
      type="button"
      onClick={onClose}
      style={iconBtnStyle}
      title="Cerrar"
      className="iconDangerHover modalCloseBtn"
    >
      ✕
    </button>
  </div>
</div>

        {/* BODY */}
        <div
  style={{
    display: "grid",
    gridTemplateColumns: "420px 520px", // 👈 ancho fijo derecha
    columnGap: 18,
    justifyContent: "start",
    height: "100%",
    minHeight: 0,
  }}
>
               {/* IZQUIERDA: PREVIEW */}
<div
 style={{
  position: "relative",
  background: "#F7F4EE",
  padding: 10,
  borderRight: "1px solid #FFD9E6",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 0,
 }}
>
           {/* ✅  PC ARRIBA */}
        {(() => {
          const sleeveRot = ((rot % 360) + 360) % 360;
          const modalIsZoomed = modalZoom > 1;
          const modalObjectFit = modalIsZoomed ? "contain" : "cover";

          return (
            <div
              className="modalPcWrap"
              style={{
                width: "100%",
                maxWidth: 320, // Tamaño constante
                aspectRatio: "2 / 3", // Aspecto nativo vertical
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "visible",
                margin: "auto 0",
                position: "relative",
                zIndex: 1,
              }}
            >
              {/* LA CARTA QUE ROTA */}
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 14,
                  overflow: modalIsZoomed ? "visible" : "hidden",
                  border: "1px solid #e7e7ef",
                  background: "white",
                  position: "absolute",
                  zIndex: 1,
                  transform: `rotate(${sleeveRot}deg)`,
                  transition: "transform 160ms ease",
                }}
              >
                <div style={{ width: "100%", height: "100%", position: "relative", perspective: 900 }}>
                  <div
                    ref={modalFlipWrapRef}
                    style={{
                      width: "100%",
                      height: "100%",
                      position: "absolute",
                      inset: 0,
                      transformStyle: "preserve-3d",
                      transition: "none",
                      transform: `scaleX(${flipH ? -1 : 1}) rotateY(${face === "front" ? 0 : 180}deg)`,
                      willChange: "transform",
                    }}
                  >
                    {/* FRONT EN EL MODAL */}
  <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
    {(assigned as any)?.is_wanted === true && uiWishlist > 0 ? (
      <WesternWantedFrame 
        name={headerTitle || "WANTED"} 
        variant="modal" // <--- Importante: esto activa el tamaño grande
      >
        <img src={frontImg || "/mock-pcs/groupsui/not-available.png"} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(0.2)' }} alt="" />
      </WesternWantedFrame>
    ) : (
      <img src={frontImg || "/mock-pcs/groupsui/not-available.png"} style={{ width: '100%', height: '100%', objectFit: modalObjectFit }} alt="" />
    )}
  </div>
                    {/* BACK */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        transform: "rotateY(180deg)",
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                      }}
                    >
                      <img
                        src={backImg}
                        alt=""
                        draggable={false}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: modalObjectFit,
                          background: "#fff",
                          transform: `scale(${modalZoom})`,
                          transformOrigin: "center center",
                          transition: "transform 120ms ease",
                          display: "block",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTONES EMERGENTES (Flotan por encima de la carta, no se rotan) */}
              <div className="modalPcControls" style={{ zIndex: 10 }}>
                <button type="button" onClick={onRotateLeft} title="Rotar -90º">⟲</button>
                <button type="button" onClick={onRotateRight} title="Rotar +90º">⟳</button>
                <button
                  type="button"
                  onClick={onToggleFaceAnimated ?? onToggleFace}
                  title={face === "front" ? "Reverso" : "Anverso"}
                >
                  ⇄
                </button>
              </div>
            </div>
          );
        })()}

{/* ✅ ESPACIADOR */}
<div style={{ flex: 0 }} />
{/* ✅ ABAJO: ZOOM + NOTAS (PEGADOS) */}
<div
 style={{
  width: "min(380px, 96%)",
  display: "grid",
  gap: 10,
  paddingBottom: 6,
  position: "relative",
  zIndex: 30
 }}
>
  <div
  style={{
    display: "flex",
    gap: 10,
    justifyContent: "center",
    padding: 10,
    borderRadius: 16,

    background: "#f9f5f7",          // rosa muy suave
    border: "1px solid #f9daed",    // borde rosa del sistema
    boxShadow: "0 6px 8px rgba(234, 208, 224, 0.25)",

  }}
>
    <button
      type="button"
      onClick={() => setModalZoom((z) => Math.max(0.8, Math.round((z - 0.1) * 10) / 10))}
      style={iconBtnStyle}
      title="Zoom -"
    >
      −
    </button>
    <button
      type="button"
      onClick={() => setModalZoom((z) => Math.min(1.8, Math.round((z + 0.1) * 10) / 10))}
      style={iconBtnStyle}
      title="Zoom +"
    >
      +
    </button>
    <button type="button" onClick={() => setModalZoom(1)} style={iconBtnStyle} title="Reset zoom">
      Reset
    </button>
  </div>

  {/* ✅ Notas: SOLO para PCs NO personalizadas */}
  {!isCustom && (
    <div
      style={{
        width: "100%",
    minHeight: 90,

    padding: "10px 12px",
    borderRadius: 12,

    background: "#FFF7FB",        // rosa muy muy suave
    border: "1px solid #f7e6ed",  // borde rosa sutil

    color: "#333",
    fontSize: 14,

    outline: "none",

    boxShadow: "0 1px 3px rgba(247,168,216,0.15)",

    resize: "vertical",
      }}
    >
      <div
        style={{
         fontWeight: 900,
    color: "#8C659C",
    letterSpacing: 0.2,
        }}
      >
        Notas
      </div>

      <textarea
        value={draftNotes}
        onChange={(e) => setDraftNotes(e.target.value)}
        onBlur={() => onChangeNotes(draftNotes)}
        placeholder="Notas libres..."
        rows={2}
        style={{
          width: "100%",
          padding: "8px 10px",
     
          outline: "none",
          resize: "none",
          fontWeight: 700,
          color: "#232336",
          fontSize: 12,
          boxSizing: "border-box",
          background: "#FFF9FB",
border: "1px solid #F3DCE7",
borderRadius: 18,
boxShadow: "0 8px 24px rgba(247,168,216,0.10)",
        }}
      />
    </div>
  )}
</div>

          </div>

          {/* DERECHA: INFO + BLOQUES */}
          <div
            style={{
              padding: 16,
              overflowY: "auto",
              height: "100%",
              minHeight: 0,
              minWidth: 0,
              width: 520,
            }}
          >
           {rightPanelContent}
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


  

return (
  <div style={{ 
    minHeight: "100vh", 
    backgroundColor: "#FFFDF5", // Fondo blanco como en tu moodboard
    display: "flex",
    flexDirection: "column"
  }}>
    
  <Header />

    {/* CUERPO DEL BINDER (Debajo de la banda) */}
    <div style={{ width: "100%", maxWidth: 1120, margin: "40px auto", textAlign: "center" }}>
      {/* ... resto del código (h1, email, status...) ... */}
      {/* ... aquí sigue el resto de tu código (email, status, etc) ... */}
      
      

      <style jsx global>{`
      /* Añadir en tu bloque <style jsx global> */
.status-popup {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: #2F2740;
  color: white;
  padding: 10px 20px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 13px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.2);
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
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #eee;
    font-size: 11px;
    font-weight: 950;
    color: #2a2a44;
    box-shadow: 0 4px 10px rgba(0,0,0,0.15);
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
.pagesCarousel .pageThumb .pageNumBadge{
  left: 8px;
  bottom: 8px;

  width: 16px;
  height: 16px;
  min-width: 16px;

  padding: 0;                 /* <- clave: adiós “pill” */
  border-radius: 999px;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  font-size: 10px;            /* mismo que la X */
  line-height: 1;             /* para centrar bien */

  box-shadow: 0 6px 14px rgba(0,0,0,0.10);
}

.pagesCarousel .pageDeleteBtn{
  right: 8px;
  bottom: 8px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  font-size: 10px;
  box-shadow: 0 6px 14px rgba(0,0,0,0.10);
}
@media (hover: hover) {
  .pageThumb .pageNumBadge {
    opacity: 0;
    transform: translateY(2px);
  }
  .pageThumb:hover .pageNumBadge {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes dropPulse {
    0% { transform: scale(1); opacity: 0.75; }
    50% { transform: scale(1.01); opacity: 1; }
    100% { transform: scale(1); opacity: 0.75; }
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
  border: 1px solid #cfdcff;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(8px);
  font-weight: 900;
  font-size: 12px;
  color: #1f3b66;
  box-shadow: 0 10px 24px rgba(0,0,0,0.12);
  pointer-events: none;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 140ms ease, transform 140ms ease;
}

/* ❌ botón borrar */
.pageDeleteBtn{
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid #ddd;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 24px rgba(0,0,0,0.12);
  font-weight: 950;
  cursor: pointer;
  color: #a11;
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
    border-color: #f0b4b4;
    background: rgba(255,242,242,0.95);
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
  border:1px solid #cfdcff;
  background:rgba(255,255,255,0.92);
  backdrop-filter:blur(8px);
  font-weight:900;
  font-size:12px;
  color:#1f3b66;
  box-shadow:0 10px 24px rgba(0,0,0,0.12);
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
        @keyframes dropPulse {
  0% { transform: scale(1); opacity: 0.55; }
  50% { transform: scale(1.02); opacity: 0.95; }
  100% { transform: scale(1); opacity: 0.55; }
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
 color: #b42318;
}
@media (hover: hover){
 .pcControlsBottom button:hover{
 border-color: #f0b4b4;
 background: #fff2f2;
 color: #a11;
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
  border: 1px solid rgba(0,0,0,0.10);
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 24px rgba(0,0,0,0.10);

  font-size: 11px;
  font-weight: 950;
  color: #2a2a44;

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
  border: 1px solid #ddd;
  background: white;
  color: var(--icon-color, #777);
  --icon-color: #777;
}

.modalCloseBtn {
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
  --icon-shadow: 0 10px 24px rgba(0,0,0,0.12);
}

@media (hover: hover) {
  .modalCloseBtn:hover:not(:disabled) {
    transform: translateY(-1px);
    --icon-shadow: 0 8px 18px rgba(0,0,0,0.10);
    border-color: #d5d9e4;
  }
}

.modalCloseBtn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

@media (hover: hover) {
  .iconDangerHover:hover:not(:disabled) {
    border-color: #f0b4b4;
    background: #fff2f2;
    --icon-color: #a11;
    --icon-shadow: 0 8px 18px rgba(176, 35, 24, 0.18);
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
  border: 1px solid #e7e7ef;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(8px);
  font-weight: 950;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(0,0,0,0.12);
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
  border: 1px solid #ddd;
  background: rgba(255,255,255,0.96);
  backdrop-filter: blur(8px);
  box-shadow: 0 12px 28px rgba(0,0,0,0.16);

  color: #222;
  font-size: 12px;
  line-height: 1.25;
  font-weight: 700;
  text-align: left;

  /* ✅ 2 líneas máximo */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
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
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #eee;
    font-size: 11px;
    font-weight: 900;
    color: #2a2a44;
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
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




        `}</style>

        {binderPages.length > 0 && (
  <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
    <div style={{ width: "100%", maxWidth: 1120 }}>
      <div
  className="pagesCarousel"
  style={{
    display: "flex",
    flexWrap: "nowrap",
    overflowX: "auto",
    overflowY: "hidden",
    // ✅ CAMBIO: 'center' para que cuando haya pocas páginas estén centradas. 
    // El 'auto' en los márgenes permite que si hay muchas, el scroll funcione bien.
    justifyContent: binderPages.length > 5 ? "flex-start" : "center", 
    gap: 12,
    alignItems: "center",
    padding: "10px 20px", // Un poco más de aire lateral
    maxWidth: "100%",
    WebkitOverflowScrolling: "touch",
    scrollSnapType: "x mandatory",
  }}
        onDragOver={(e) => e.preventDefault()}
      >
        {binderPages
          .slice()
          .sort((a, b) => a.page_index - b.page_index)
          .map((p, idx) => {
    const active = idx === currentPageIndex;

    const onDragStartPage = (pageId: number) => (e: React.DragEvent<HTMLDivElement>) => {
  const payload: PageDragPayload = { pageId };
  lastPageDragRef.current = payload;
setPageDragFromId(pageId); // ✅ clave para que el overlay sepa “desde dónde”
  const json = JSON.stringify(payload);
  setDragData(e.dataTransfer, json);
};

   const onDragOverPage = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  e.stopPropagation();

  // ✅ Si estamos arrastrando una PC, cambia de página al vuelo
  if (lastSlotDragRef.current) {
    if (idx !== currentPageIndex) setCurrentPageIndex(idx);
  }
};

   const onDropPage = async (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  e.stopPropagation();

  const raw =
    e.dataTransfer.getData("application/json") ||
    e.dataTransfer.getData("text/plain");

  // 1) ✅ Si lo que estás soltando es una PC (slot drag), muévela a esta página
  const slotPayload = parseDragPayload(raw) ?? lastSlotDragRef.current;
  if (slotPayload && Number.isFinite(Number(slotPayload.fromPageId))) {
    // OJO: aquí NO reordenamos páginas. Solo movemos la PC.
    await movePcToPageFromCarousel(slotPayload, p.id);

    // evita que el click de la miniatura te cambie de página “como si fuera un tap”
    lastSlotDragRef.current = null;
    return;
  }

  // 2) ✅ Si NO es PC, entonces sí: reorder de páginas (lo de siempre)
  const pagePayload = parsePageDragPayload(raw);
  if (!pagePayload) return;
  reorderPagesInState(pagePayload.pageId, p.id);
};

       return (
  <div
    key={p.id}
    draggable
    onDragStart={onDragStartPage(p.id)}
    onDragEnter={(e) => {
  // ✅ Si arrastras una PC, NO activamos overlay de reorder
  if (lastSlotDragRef.current) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  setPageDragOverId(p.id);
}}
    onDragOver={onDragOverPage}
    onDragEnd={() => {
      // ✅ limpia estados al soltar
      setPageDragOverId(null);
      setPageDragFromId(null);
      lastPageDragRef.current = null;
    }}
    onDrop={onDropPage}
    style={{
      flex: "0 0 auto",
      scrollSnapAlign: "start",
      position: "relative",
      overflow: "visible",
    }}
  >
    {pageDragOverId === p.id &&
      pageDragFromId != null &&
      pageDragFromId !== p.id && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: 16,
            border: "2px solid rgba(141,184,255,0.95)",
            background: "rgba(141,184,255,0.12)",
            boxShadow: "0 18px 40px rgba(141,184,255,0.22)",
            pointerEvents: "none",
            zIndex: 999,
            animation: "dropPulse 520ms ease-out infinite",
          }}
        />
      )}

<PageThumb
  pageId={p.id}
  layoutKey={p.layout_type}
  active={active}
  title={`Ir a página ${idx + 1}`}
  onClick={() => {
    // ✅ si quedó “basura” de un drag antiguo, la limpiamos y dejamos clicar
    if (lastSlotDragRef.current) lastSlotDragRef.current = null;
    setCurrentPageIndex(idx);
  }}
  pageNumber={idx + 1}
  showPageNumber
  onDeletePage={(id) => void deletePageById(id)}
  refreshTick={refreshTick}
/>
  </div>
);
 })}

        <div style={{ flex: "0 0 auto", scrollSnapAlign: "start" }}>
  <button
    type="button"
    onClick={() => setPagesOpen(true)}
    style={{
      ...topBtnStyle,
      padding: "8px 14px",
      whiteSpace: "nowrap",
      justifyContent: "center",
    }}
    title="Ver todas las páginas"
  >
    Ver todas
  </button>
</div>
      </div>

      {/* ✅ guía debajo del carrusel (no la corta el overflow) */}
      
    </div>
  </div>
)}

        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "center",
            gap: 10,
            alignItems: "center",
            width: "100%",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 10 }}>

    
      
   

</div>
{/* Selector de Cursor SKZOO */}
<div ref={skzooBoxRef} style={{ position: "relative", display: "inline-block", marginRight: 10 }}>
  <button
  type="button"
  onClick={() => setSkzooOpen(!skzooOpen)}
  style={{
    ...topBtnStyle, // Hereda el borde rosa y la sombra 
    minWidth: 120,
    justifyContent: "space-between",
    border: activeSkzoo ? "2px solid #F7A8D8" : "1px solid #F7A8D8", // Borde rosa siempre [cite: 348]
    background: activeSkzoo ? "#FFF5FA" : "white"
  }}
>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 13, color: "#8C659C", fontWeight: 900 }}>Cursor</span>
      {activeSkzoo && <img src={activeSkzoo.img} style={{ width: 20, height: 20, objectFit: "contain" }} alt="" />}
    </div>
    <span style={{ fontSize: 10, opacity: 0.5 }}>{skzooOpen ? "▲" : "▼"}</span>
  </button>

 {skzooOpen && (
  <div style={{
    position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 1100,
    width: 260, background: "white", border: "1px solid #ddd", borderRadius: 14,
    boxShadow: "0 12px 32px rgba(0,0,0,0.15)", padding: 10,
    maxHeight: "450px", overflowY: "auto"
  }}>
    
    {/* Botón armonioso para quitar cursor */}
    <button
      onClick={() => {
        setActiveSkzoo(null);
        setSkzooOpen(false);
        localStorage.removeItem("binder:skzoo-cursor");
      }}
      style={{
        width: "100%", height: 38, marginBottom: 12, borderRadius: 10,
        border: "1px solid #eee", background: "#f9f9f9", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 800, color: "#666", gap: 8
      }}
    >
      <span style={{ fontSize: 14 }}>🚫</span> Quitar cursor personalizado
    </button>

    <input 
      type="text"
      placeholder="Buscar mascota o artista..."
      value={cursorQuery}
      onChange={(e) => setCursorQuery(e.target.value)}
      style={{
        width: "100%", padding: "8px 10px", borderRadius: 8,
        border: "1px solid #eee", fontSize: 12, marginBottom: 12, outline: "none"
      }}
    />

    {/* ... resto del mapeo de grupos que ya tienes ... */}

    {/* SECCIÓN: FAVORITOS (Solo si hay alguno seleccionado) */}
    {(() => {
      const allMascots = CURSOR_GROUPS.flatMap(g => g.mascots);
      const favMascots = allMascots.filter(m => 
        favorites.includes(m.id) && 
        (m.name + (m as any).artist).toLowerCase().includes(cursorQuery.toLowerCase())
      );
      if (favMascots.length === 0) return null;
      return (
        <div style={{ marginBottom: 16, borderBottom: "1px solid #f0f0f0", paddingBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#F7A8D8", textTransform: "uppercase", marginBottom: 8 }}>⭐ Mis Favoritos</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {favMascots.map(m => (
              <button key={`fav-${m.id}`} onClick={() => { setActiveSkzoo(m); setSkzooOpen(false); }} style={{ borderRadius: 10, position: "relative", border: activeSkzoo?.id === m.id ? "2px solid #8db8ff" : "1px solid #eee", background: "white", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 4px" }}>
                <span onClick={(e) => toggleFavorite(e, m.id)} style={{ position: "absolute", top: 2, left: 2, fontSize: 10 }}>⭐</span>
                <img src={m.img} style={{ width: 28, height: 28, objectFit: "contain" }} alt="" />
                <span style={{ fontSize: 8, fontWeight: 800, marginTop: 4, color: "#666", textAlign: "center", lineHeight: 1.1 }}>{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      );
    })()}

    {/* SECCIÓN: GRUPOS NORMALES */}
    {CURSOR_GROUPS.map(group => {
     const filtered = group.mascots.filter(m => 
  m.name.toLowerCase().includes(cursorQuery.toLowerCase()) || 
  m.artist.toLowerCase().includes(cursorQuery.toLowerCase())
);
      if (filtered.length === 0) return null;
      return (
        <div key={group.groupName} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#aaa", textTransform: "uppercase", marginBottom: 8 }}>{group.groupName}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {filtered.map(it => (
              <button key={it.id} onClick={() => { setActiveSkzoo(it); setSkzooOpen(false); }} style={{ borderRadius: 10, position: "relative", border: activeSkzoo?.id === it.id ? "2px solid #8db8ff" : "1px solid #eee", background: "white", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 4px" }}>
                <span onClick={(e) => toggleFavorite(e, it.id)} style={{ position: "absolute", top: 2, left: 2, fontSize: 10, opacity: favorites.includes(it.id) ? 1 : 0.2 }}>⭐</span>
                <img src={it.img} style={{ width: 28, height: 28, objectFit: "contain" }} alt="" />
                <span style={{ fontSize: 8, fontWeight: 800, marginTop: 4, color: "#666", textAlign: "center", lineHeight: 1.1 }}>{it.name}</span>
              </button>
            ))}
          </div>
        </div>
      );
    })}
  </div>
)}
</div>

          <div ref={layoutBoxRef} style={{ position: "relative", display: "inline-block" }}>
  <button
    type="button"
    onClick={() => setLayoutOpen((v) => !v)}
    style={topBtnStyle}
    title="Cambiar formato"
  >
    <span style={{ fontSize: 14, color: "#8C659C", fontWeight: 900 }}>
      Formato
{layoutDef.size === "special" ? (
  <img
    src="/ui/premium-medal.png"
    alt=""
    aria-hidden="true"
    title="Premium"
    style={{
      width: 16,
      height: 16,
      marginLeft: 6,
      verticalAlign: "middle",
      display: "inline-block",
    }}
  />
) : null}
    </span>

    <div
      style={{
        width: 44,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ transform: "scale(0.6)", transformOrigin: "center" }}>
        <LayoutMiniPreview
          layoutKey={layout}
          size="carousel"
          thumbs={pageId && pageThumbs[pageId] && Object.keys(pageThumbs[pageId]).some(k => !!pageThumbs[pageId][Number(k)]) ? pageThumbs[pageId] : undefined}
          refreshTick={refreshTick}
          key={refreshTick}
        />
      </div>
    </div>

  </button>

            {layoutOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  zIndex: 1000,
                  width: 260,
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "nowrap" }}>
                      <button
                        type="button"
                        onClick={() => setApplyAll(false)}
                        style={{
                          flex: 1,
                          padding: "6px 8px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          background: !applyAll ? "#eaf2ff" : "white",
                          color: "#222",
                          fontWeight: 800,
                          fontSize: 11,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                        title="Aplicar solo a esta página"
                      >
                        Solo esta página
                      </button>

                      <button
                        type="button"
                        onClick={() => setApplyAll(true)}
                        style={{
                          flex: 1,
                          padding: "6px 8px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          background: applyAll ? "#eaf2ff" : "white",
                          color: "#222",
                          fontWeight: 800,
                          fontSize: 11,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                        title="Aplicar a todo el binder"
                      >
                        Todo el binder
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ maxHeight: 240, background: "#F7F4EE", overflow: "auto", padding: 6 }}>
 {LAYOUTS.map((l) => {
  
  const isSelected = layout === l.key;
  const isHover = layoutHover === l.key;
  const bg = isSelected ? "#eaf2ff" : isHover ? "#f4f7ff" : "white";
const border = isSelected ? "#8db8ff" : isHover ? "#cfdcff" : "#eee";
  // ✅ “especial” solo si existe size y vale "special"
  const isSpecial = (l as any).size === "special";

  return (
    <button
      key={l.key}
      type="button"
      onMouseEnter={() => setLayoutHover(l.key)}
      onMouseLeave={() => setLayoutHover(null)}
      onClick={async () => {
        await changeLayout(l.key);
        setLayoutOpen(false);
      }}
      style={{
        width: "100%",
        textAlign: "center",
        padding: 6,
        borderRadius: 14,
        border: `1px solid ${border}`,
        background: bg,
        cursor: "pointer",
        marginBottom: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative", // ✅ para anclar la estrella
      }}
    >
     {/* 🏅 badge premium solo en especiales */}
{isSpecial ? (
  <span
    aria-hidden="true"
    title="Premium"
    style={{
      position: "absolute",
      top: 8,
      right: 10,
      width: 24,
      height: 24,
      borderRadius: 999,
      border: "1px solid #cfdcff",
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(8px)",
      boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
    }}
  >
    <img
      src="/ui/premium-medal.png"
      alt=""
      style={{
        width: 16,
        height: 16,
        display: "block",
      }}
      draggable={false}
      
    />
  </span>
) : null}

      <div style={{ marginTop: 6 }}>
        <LayoutMiniPreview layoutKey={l.key} size="picker" refreshTick={refreshTick} />
              </div>

     {/* ✅ SIN TEXTO, SIN NÚMEROS */}
            </button>
          );
        })}
        
        </div>
      </div>
      )}
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* ❌ El botón de Biblioteca ha sido eliminado */}

      <button
        type="button"
        onClick={() => {
          if (loading) return;
          if (canAddPage) createNewPage();
          else setBuyPagesOpen(true);
        }}
        disabled={loading}
        title={
          loading
            ? "Cargando…"
            : canAddPage
            ? "Añadir una nueva página al binder"
            : `Has llegado al límite (${MAX_FREE_PAGES}). Pulsa para ver opciones.`
        }
        style={{
          ...topBtnStyle,
          width: 44,
          minWidth: 44,
          padding: 0,
          justifyContent: "center",
          opacity: loading ? 0.45 : 1,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        +
      </button>

      <button
        type="button"
        onClick={deleteCurrentPage}
        disabled={loading || binderPages.length <= 1}
        title={binderPages.length <= 1 ? "No puedes borrar la última página" : "Borrar esta página"}
        aria-label={binderPages.length <= 1 ? "No puedes borrar la última página" : "Borrar esta página"}
        className="iconDangerHover"
        style={{
          ...topBtnStyle,
          width: 44,
          minWidth: 44,
          padding: 0,
          justifyContent: "center",
          opacity: loading || binderPages.length <= 1 ? 0.45 : 1,
          cursor: loading || binderPages.length <= 1 ? "not-allowed" : "pointer",
        }}
      >
  <Trash2 size={18} />
</button>
    
<button
 onClick={doUndo}
 style={{
  ...topBtnStyle,
  padding: "8px",
  width: 36,
  height: 36,
  justifyContent: "center",
 }}
 title="Deshacer"
>
 <Undo2 size={18} strokeWidth={2.5} />
</button>
 {/* ✅ Voltear 90º (todas) */}
<button
  type="button"
  onClick={togglePageRotateAll}
  disabled={loading}
  role="switch"
  aria-checked={pageRotateAll}
  title={pageRotateAll ? "Quitar voltear 90º (todas)" : "Voltear 90º (todas)"}
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    border: "0",
    background: "transparent",
    padding: 0,
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.6 : 1,
  }}
>
  <span style={{ fontSize: 14, color: "#8C659C", fontWeight: 900 }}>Voltear 90º</span>

  <span
    aria-hidden="true"
    style={{
      width: 34,
      height: 20,
      borderRadius: 999,
      border: "1px solid #d9d9d9",
      background: pageRotateAll ? "#8db8ff" : "#e9e9e9",
      position: "relative",
      display: "inline-block",
    }}
  >
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: 999,
        background: "white",
        position: "absolute",
        top: 1,
        left: 1,
        transform: pageRotateAll ? "translateX(14px)" : "translateX(0)",
        transition: "transform 160ms ease",
        boxShadow: "0 6px 14px rgba(0,0,0,0.18)",
      }}
    />
  </span>
</button>

{/* ✅ Reverso (todas) */}
<button
  ref={backAllBtnRef}
  type="button"
  onClick={togglePageShowBackAll}
  disabled={loading}
  role="switch"
  aria-checked={pageShowBackAll}
  title={pageShowBackAllUI ? "Ver anverso (todas)" : "Ver reverso (todas)"}
  
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    border: "0",
    background: "transparent",
    padding: 0,
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.6 : 1,
  }}
>
  <span style={{ fontSize: 14, color: "#8C659C", fontWeight: 900 }}>Reverso</span>

  <span
    aria-hidden="true"
    style={{
      width: 34,
      height: 20,
      borderRadius: 999,
      border: "1px solid #d9d9d9",
      background: pageShowBackAll ? "#8db8ff" : "#e9e9e9",
      position: "relative",
      display: "inline-block",
      
    }}
  >
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: 999,
        background: "white",
        position: "absolute",
        top: 1,
        left: 1,
        transform: pageShowBackAll ? "translateX(14px)" : "translateX(0)",
        transition: "transform 160ms ease",
        boxShadow: "0 6px 14px rgba(0,0,0,0.18)",
      }}
    />
  </span>
</button>
{/* ✅ Zoom real (− / +) */}
<div
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  }}
>
  <span style={{ fontSize: 14, color: "#8C659C", fontWeight: 900 }}>Zoom</span>

  <div
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 8px",
    borderRadius: 999,
    border: "1px solid #F7A8D8", // Borde rosa [cite: 348]
    background: "white",
    boxShadow: "0 4px 12px rgba(247, 168, 216, 0.25)", // Brillo rosado 
  }}
  aria-label="Controles de zoom"
>
    <button
  type="button"
  onClick={zoomOut}
  disabled={loading}
  style={{
    width: 30,
    height: 30,
    borderRadius: 999,
    border: "1px solid #F7A8D8",
    background: "white",
    color: "#8C659C",
    boxShadow: loading
      ? "none"
      : "0 4px 12px rgba(247,168,216,0.15)",
    cursor: loading ? "not-allowed" : "pointer",
    fontWeight: 900,
    fontSize: 16,
    opacity: loading ? 0.45 : 0.75
  }}
>
  -
</button>

    <div
  style={{
    minWidth: 54,
    textAlign: "center",
    fontWeight: 950,
    color: "#8C659C",
    fontSize: 12,
  }}
  title="Nivel de zoom"
>
    
      {Math.round(pageZoom * 100)}%
    </div>

   <button
  type="button"
  onClick={zoomIn}
  disabled={loading}
  style={{
    width: 30,
    height: 30,
    borderRadius: 999,
    border: "1px solid #F7A8D8",
    background: "white",
    color: "#8C659C",
    boxShadow: loading
      ? "none"
      : "0 4px 12px rgba(247,168,216,0.15)",
    cursor: loading ? "not-allowed" : "pointer",
    fontWeight: 900,
    fontSize: 16,
    opacity: loading ? 0.45 : 0.75
  }}
>
  +
</button>

    {/* opcional pero muy útil */}
    <button
  type="button"
  onClick={zoomReset}
  disabled={loading || Math.abs(pageZoom - 1) < 1e-9}
  title="Reset (100%)"
  style={{
    marginLeft: 4,
    padding: "0 10px",
    height: 30,
    borderRadius: 999,
    border: "1px solid #F7A8D8",
    background: "white",
    color: "#8C659C",
    boxShadow:
      loading || Math.abs(pageZoom - 1) < 1e-9
        ? "none"
        : "0 4px 12px rgba(247, 168, 216, 0.25)",
    cursor: loading || Math.abs(pageZoom - 1) < 1e-9 ? "not-allowed" : "pointer",
    fontWeight: 900,
    fontSize: 12,
    opacity: loading || Math.abs(pageZoom - 1) < 1e-9 ? 0.45 : 1,
  }}
>
  Reset
</button>
  </div>
</div>
</div>
        </div>

       {pageId ? (
  <div style={{ display: "flex", justifyContent: "center" }}>
    <div
      style={{
        zoom: pageZoom as any,
      }}
    >
      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: `repeat(${layoutDef.cols}, ${gridFrameW}px)`,
          columnGap: baseGap,
          rowGap: baseRowGap,
          justifyContent: "center",
          alignContent: "start",
        }}
      >
      {baseSlots.map((n) => (
    <SlotBox
      key={n}
      slotIndex={n}
      invByItem={invByItem}
      emptyCounts={emptyCounts}
      placedByItem={placedByItem} // 👈 AÑADE ESTA LÍNEA
    />
  ))}
  {extras > 0 && (
    <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", gap: gridGap, marginTop: 8 }}>
      {extraSlots.map((n) => (
        <SlotBox
          key={n}
          slotIndex={n}
          invByItem={invByItem}
          emptyCounts={emptyCounts}
          placedByItem={placedByItem} // 👈 AÑADE ESTA LÍNEA TAMBIÉN
        />
      ))}
    </div>
  )}
      </div>
    </div>
  </div>
) : (
  <div style={{ marginTop: 30, color: "#666", fontWeight: 800 }}>
    Cargando página…
  </div>
)}
  <WtsListingModal
 open={wtsListingModalOpen}
 itemId={wtsListingItemId}
 onClose={() => setWtsListingModalOpen(false)}
 onSaved={handleWtsListingSaved}
/>

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
 onRotateLeft={() => setModalViewRot(((modalViewRot - 90) % 360 + 360) % 360)}
 onRotateRight={() => setModalViewRot(((modalViewRot + 90) % 360 + 360) % 360)}
 onToggleFlipH={() => setModalViewFlipH((v) => !v)}
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
/>
{activeSkzoo && (
  <div
    ref={skzooFollowerRef}
    style={{
      position: "fixed",
      left: 0,
      top: 0,
      width: 30,
      height: 30,
      pointerEvents: "none",
      zIndex: 9999999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      willChange: "transform",
      transform: `translate3d(${mousePos.x + 15}px, ${mousePos.y + 15}px, 0)`,
    }}
  >
    <img
      src={activeSkzoo.img}
      alt=""
      draggable={false}
      style={skzooImgStyle}
    />
  </div>
)}
{/* NAV inferior */}
<div
  style={{
    position: "sticky",
    bottom: 0,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(10px)",
    borderTop: "1px solid #eee",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "center",

    
  }}
>
  <div
    style={{
      width: "100%",
      maxWidth: 1120,
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      gap: 10,
    }}
  >
    {/* Columna izquierda: vacía (sirve de “contrapeso”) */}
    <div />

    {/* Columna central: SIEMPRE centrada */}
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
    color: "#8C659C",
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

{/* Picker en modal */}
{pickingSlot != null &&
 pickerUserId != null &&
 pickerBinderId != null && (
 <div
  onClick={() => setPickingSlot(null)}
  style={{
   position: "fixed",
   inset: 0,
   zIndex: 10030,
   background: "rgba(32, 18, 34, 0.38)",
   backdropFilter: "blur(6px)",
   display: "flex",
   alignItems: "center",
   justifyContent: "center",
   padding: 20,
  }}
 >
  <div
  onClick={(e) => e.stopPropagation()}
  style={{
    width: "min(1180px, 96vw)",
    height: "90vh",
    borderRadius: 24,
    border: "1px solid #f1d9e8",
    background: "#fffdfd",
    boxShadow: "0 24px 80px rgba(80, 46, 86, 0.22)",
    padding: 18,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  }}
>
   

   <ItemPicker
                userId={pickerUserId}
                binderId={pickerBinderId}
                placedByItem={placedByItem}
                invByItem={invByItem}
                loadInvForIds={loadInvForIds}
                refreshTick={refreshTick}
                userBiases={userBiases} // <--- NUEVA LÍNEA AÑADIDA
                onPick={(itemId) => {
                  const s = pickingSlot;
                  setPickingSlot(null);
                  if (s != null) assignItemToSlot(s, itemId);
                }}
                onClose={() => setPickingSlot(null)}
              />
  </div>
  
 </div>
)}

{/* Modales */}
{pagesOpen && <PagesModal />}
{buyPagesOpen && <BuyPagesModal />}

{showOnboarding && userId && (
  <OnboardingForm
    userId={userId}
    onComplete={() => {
      setShowOnboarding(false);
      window.location.reload();
    }}
  />
)}
{/* ✅ AQUÍ ES DONDE DEBES PEGARLO: */}
  {status && (
    <div className="status-popup" aria-live="polite">
      {status}
    </div>
  )}
      </div>
    <footer style={{ 
  width: "100%", 
  backgroundColor: "white", 
  borderTop: "1px solid #F3DCE7", 
  padding: "50px 80px", // Más aire arriba y abajo
  marginTop: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "40px"
}}>
  {/* FILA SUPERIOR: 3 COLUMNAS */}
  <div style={{ 
    display: "grid", 
    gridTemplateColumns: "1.5fr 1fr 1fr 1fr", 
    gap: "40px",
    alignItems: "start"
  }}>
    
    {/* Columna 1: Branding */}
    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
      <span className="tan-font" style={{ color: "#b17eac", fontSize: "24px", letterSpacing: "1px" }}>
        MY KPOP BINDER
      </span>
      <p style={{ fontSize: "14px", color: "#8C659C", lineHeight: "1.5", maxWidth: "250px" }}>
        Tu rincón digital para organizar, comprar y tradear tus photocards favoritas de la forma más eficiente.
      </p>
    </div>

    {/* Columna 2: Legal (Terms, Community, Copyright) */}
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <span style={footerLinkStyle}>LEGAL</span>
      <a href="/terms" style={footerSubLinkStyle}>Términos y Condiciones</a>
      <a href="/terms#community" style={footerSubLinkStyle}>Normas de la Comunidad</a> {/* [cite: 1682] */}
      <a href="/terms#copyright" style={footerSubLinkStyle}>Aviso de Copyright</a> {/* [cite: 1693] */}
    </div>

    {/* Columna 3: Mercado (Marketplace, Scam Policy) */}
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <span style={footerLinkStyle}>MARKETPLACE</span>
      <a href="/market-rules" style={footerSubLinkStyle}>Reglas del Mercado</a>
      <a href="/anti-scam" style={footerSubLinkStyle}>Política Anti-Fraude</a> {/* [cite: 1701] */}
      <a href="/privacy" style={footerSubLinkStyle}>Privacidad y Cookies</a>
    </div>

    {/* Columna 4: Soporte y DSA */}
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <span style={footerLinkStyle}>SOPORTE</span>
      <a href="/faq" style={footerSubLinkStyle}>Preguntas Frecuentes</a>
      {/* Sustituimos el ROJO por un rosa fuerte o subrayado sutil */}
      <a href="/report" style={{ ...footerSubLinkStyle, fontWeight: 800, color: "#8C659C", textDecoration: "underline" }}>
        Reportar Abuso (DSA)
      </a> {/* [cite: 1712, 1724] */}
      <a href="mailto:info@mykpopbinder.com" style={footerSubLinkStyle}>info@mykpopbinder.com</a>
    </div>
  </div>

  {/* FILA INFERIOR: Copyright centrado o lateral */}
  <div style={{ 
    borderTop: "1px solid #FFF5FA", 
    paddingTop: "20px", 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center" 
  }}>
    <span style={{ fontSize: "12px", color: "#b17eac", fontWeight: 700 }}>
      © {new Date().getFullYear()} My Kpop Binder. Hecho por fans para fans.
    </span>
    <div style={{ display: "flex", gap: "15px" }}>
      {/* Aquí podrías poner iconos de redes sociales en el futuro */}
    </div>
  </div>
</footer>
    </div>
  );
}

  function updateSlotCustom(next: Record<number, SlotCustom>) {
      // Updates the slotCustom state with the provided object
      // Used to store custom text/image for slots (PC personalizada)
      // next: { [slotIndex]: { text: string, imageDataUrl: string | null } }
      // This is a state setter, so call React's setSlotCustom
      setSlotCustom((prev: Record<number, SlotCustom>) => ({ ...prev, ...next }));
    }

    function setSlotCustom(
      updater: (prev: Record<number, SlotCustom>) => Record<number, SlotCustom>
    ) {
      // Updates the slotCustom state using the provided updater function
      // This is a wrapper for the React state setter
      // Example usage: setSlotCustom(prev => ({ ...prev, [slotIndex]: custom }))
      // If you want to call this outside the component, bind it to the state setter

      // If you have a React state setter available, call it here:
      // setSlotCustomState(updater);

      // Otherwise, if this is a placeholder for the actual setter, you can implement it as:
      // (This assumes setSlotCustomState is the actual React useState setter)
      // setSlotCustomState(updater);

      // Since this is inside the component, just call the state setter directly:
      // (You may need to rename this function or ensure it's not shadowing the state setter)
      // For now, this is a no-op as the actual setter is already defined above.
    }


function setShowOnboarding(arg0: boolean) {
  throw new Error("Function not implemented.");
}

