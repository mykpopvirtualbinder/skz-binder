/**
 * Metadatos derivados para filtros de la pestaña Merch → Álbumes
 * (país desde URL, tipo lógico, miembro vs versión con nombres legibles).
 */

import { formatCollectionOptionLabel } from "@/lib/collection-filters";
import { formatPhysicalMerchLabel, formatMerchAlbumTypeDisplay, strayKidsAccordionRetailLabelForAlbum } from "@/lib/album-physical-labels";

/** Categoría en BD para filas de la pestaña Álbumes (Merch, Supabase, scripts). */
export const MERCH_ALBUM_DB_CATEGORY = "Álbumes";

export type MerchAlbumItem = {
  album_title?: string | null;
  album_type?: string | null;
  album_version?: string | null;
  image_url?: string | null;
  name?: string | null;
  group_name?: string | null;
};

export type AlbumRegionKey = "korea" | "japan" | "taiwan";
export type AlbumKindKey =
  | "regular"
  | "accordion"
  | "digipack"
  | "jewel-case"
  | "paper-case"
  | "postcard"
  | "fan-club"
  | "vinyl"
  | "skzoo"
  | "platform"
  | "limited"
  | "other";

/** Orden fijo en el desplegable de país (incluye unknown para filas sin ruta reconocida). */
export const ALBUM_REGION_ORDER: Array<AlbumRegionKey | "unknown"> = ["korea", "japan", "taiwan", "unknown"];

export const ALBUM_KIND_ORDER: AlbumKindKey[] = [
  "regular",
  "accordion",
  "digipack",
  "jewel-case",
  "paper-case",
  "postcard",
  "fan-club",
  "vinyl",
  "skzoo",
  "platform",
  "limited",
  "other",
];

const ACCORDION_KIND_KEYS = new Set<AlbumKindKey>([
  "accordion",
  "digipack",
  "jewel-case",
  "paper-case",
  "postcard",
  "fan-club",
]);

const PORTADAS_KIND_FOLDERS = new Set(["regular", "accordion", "vinyl", "skzoo", "platform"]);
const ACCORDION_PACKAGING_SEGMENTS = new Set([
  "digipack",
  "jewel-case",
  "paper-case",
  "postcard",
  "fan-club",
  "fanclub",
  "compact",
]);

/** Orden fijo de miembros Stray Kids (nombres en pantalla). */
const MEMBER_ORDER: { label: string; tokens: string[] }[] = [
  { label: "Bang Chan", tokens: ["bang-chan", "bangchan", "bang chan"] },
  { label: "Lee Know", tokens: ["lee-know", "leeknow", "lee know"] },
  { label: "Changbin", tokens: ["changbin", "chang bin"] },
  { label: "Hyunjin", tokens: ["hyunjin"] },
  { label: "Han", tokens: ["han", "jisung"] },
  { label: "Felix", tokens: ["felix", "yongbok"] },
  { label: "Seungmin", tokens: ["seungmin"] },
  { label: "I.N", tokens: ["i-n", "i.n", "jeongin", "in"] },
  { label: "OT8", tokens: ["ot8", "group", "all"] },
];

/** Quita prefijos tipo "03 " o "08-" al inicio de versión / nombre de archivo. */
function stripLeadingOrdinalPrefix(s: string): string {
  return s.replace(/^\s*\d+\s*[-_.]?\s*/i, "").trim();
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mascotas SKZOO — etiquetas oficiales en UI (mismo orden que miembros). */
const SKZOO_CHARACTER_LABEL_BY_STEM: Record<string, string> = {
  wolfchan: "SKZOO WolfChan",
  leebit: "SKZOO Leebit",
  dwaekki: "SKZOO Dwaekki",
  jiniret: "SKZOO Jiniret",
  hanquokka: "SKZOO Han Quokka",
  bbokari: "SKZOO BbokKari",
  puppym: "SKZOO PuppyM",
  foxiny: "SKZOO FoxI.Ny",
};

const SKZOO_STEM_ORDER = Object.keys(SKZOO_CHARACTER_LABEL_BY_STEM);

function compactAlnum(s: string): string {
  return norm(s).replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

/**
 * Resuelve slug / versión / nombre de archivo → stem canónico (wolfchan, leebit, …).
 */
export function detectSkzooStemKey(item: MerchAlbumItem): string | null {
  const verRaw = String(item.album_version || "").trim();
  const url = pathFromImageUrl(item.image_url || "");
  const file = url.split("/").pop() || "";
  const stem = file.replace(/\.(png|jpe?g|webp)$/i, "").replace(/^\d+-/, "");

  const chunks = [verRaw, stripLeadingOrdinalPrefix(verRaw), stem, stripLeadingOrdinalPrefix(stem)].filter(Boolean);
  for (const ch of chunks) {
    const x = compactAlnum(ch);
    if (!x) continue;

    if (x.includes("hanquokka") || (x.includes("han") && x.includes("quokka"))) return "hanquokka";
    if (x === "foxi.ny" || x.includes("foxiny") || (x.startsWith("fox") && x.includes("iny"))) return "foxiny";
    if (x.includes("wolfchan") || (x.startsWith("wolf") && x.includes("chan"))) return "wolfchan";
    if (x.includes("leebit") || (x.startsWith("lee") && x.endsWith("bit"))) return "leebit";
    if (x.includes("dwaekki") || x.includes("dwae")) return "dwaekki";
    if (x.includes("jiniret") || (x.startsWith("jini") && x.includes("ret"))) return "jiniret";
    if (x.includes("bbokari") || x.includes("bbokkari") || (x.includes("bbok") && x.includes("kari"))) return "bbokari";
    if (x.includes("puppym") || (x.includes("puppy") && x.endsWith("m"))) return "puppym";
  }
  return null;
}

/** Etiqueta bonita para filas tipo SKZOO; null si no reconocemos la mascota. */
export function formatSkzooCharacterLabel(item: MerchAlbumItem): string | null {
  const key = detectSkzooStemKey(item);
  if (!key) return null;
  return SKZOO_CHARACTER_LABEL_BY_STEM[key] ?? null;
}

export function pathFromImageUrl(url: string): string {
  try {
    const u = url.trim();
    const noQuery = u.split("?")[0] ?? u;
    const decoded = decodeURIComponent(noQuery.replace(/\+/g, " "));
    return decoded.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Corea / Japón / Taiwán desde la ruta en image_url; null si no se reconoce. */
export function deriveAlbumRegionKey(item: MerchAlbumItem): AlbumRegionKey | null {
  const p = pathFromImageUrl(item.image_url || "");
  if (/(?:\/|^)(korean|korean-albums)(?:\/|$)/.test(p)) return "korea";
  if (/(?:\/|^)(japanese|japanese-albums)(?:\/|$)/.test(p)) return "japan";
  if (/(?:\/|^)(taiwan|taiwanese|taiwanese-albums)(?:\/|$)/.test(p)) return "taiwan";
  return null;
}

function haystack(item: MerchAlbumItem): string {
  const p = pathFromImageUrl(item.image_url || "");
  const typ = String(item.album_type || "").toLowerCase();
  const nm = String(item.name || "").toLowerCase();
  return `${p} ${typ} ${nm}`;
}

function lastPathSegmentIsFile(seg: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(seg);
}

function kindFromPortadasPath(p: string): AlbumKindKey | null {
  const m = p.match(/\/portadas[- ]?(?:de[- ]+)?albums?\//i);
  if (!m || m.index == null) return null;
  const after = p.slice(m.index + m[0].length);
  const segs = after.split("/").filter(Boolean);
  if (segs.length === 0) return "regular";

  const firstRaw = segs[0]!;
  const first = firstRaw.replace(/\.(png|jpe?g|webp)$/i, "").toLowerCase();

  // Archivos sueltos en `portadas-album/` (standard, limited, fan-club.png, …) → Regular.
  if (segs.length === 1 && lastPathSegmentIsFile(firstRaw)) return "regular";

  if (PORTADAS_KIND_FOLDERS.has(first)) {
    if (first === "accordion") {
      if (segs.length >= 2 && !lastPathSegmentIsFile(segs[1]!)) {
        const nested = segs[1]!.toLowerCase();
        if (nested === "fanclub") return "fan-club";
        if (ACCORDION_PACKAGING_SEGMENTS.has(nested)) return nested as AlbumKindKey;
      }
      return "accordion";
    }
    return first as AlbumKindKey;
  }

  // Legado: portadas de albums/<región>/<álbum>/[packaging]/archivo
  const tail = segs.slice(2);
  if (tail.length === 0) return "regular";
  if (tail.length === 1 && lastPathSegmentIsFile(tail[0]!)) return "regular";
  const pack = tail[0]!.replace(/\.(png|jpe?g|webp)$/i, "").toLowerCase();
  if (pack === "vinyl") return "vinyl";
  if (pack === "skzoo") return "skzoo";
  if (pack === "platform") return "platform";
  if (pack === "accordion") return "accordion";
  if (pack === "fanclub" || pack === "fan-club") return "fan-club";
  if (ACCORDION_PACKAGING_SEGMENTS.has(pack)) return pack as AlbumKindKey;
  return null;
}

function packagingKindFromHaystack(h: string): AlbumKindKey | null {
  if (/jewel-case|jewelcase/.test(h)) return "jewel-case";
  if (/paper-case|papercase/.test(h)) return "paper-case";
  if (/digipack/.test(h)) return "digipack";
  if (/\bpostcard\b/.test(h)) return "postcard";
  if (/fan-?club/.test(h)) return "fan-club";
  if (/accordion|acordeon/.test(h)) return "accordion";
  return null;
}

/**
 * Tipo lógico para el filtro de edición: carpeta `regular` (incl. standard/limited),
 * acordeón y su nombre retail (jewel case, paper case, …), vinilo, SKZOO, etc.
 */
export function deriveAlbumKindKey(item: MerchAlbumItem): AlbumKindKey {
  const p = pathFromImageUrl(item.image_url || "");
  const fromPath = kindFromPortadasPath(p);
  if (fromPath) return fromPath;

  const typ = String(item.album_type || "").toLowerCase();
  const typLeaf = typ.split("/").filter(Boolean).pop() || "";
  if (typLeaf === "fanclub") return "fan-club";
  if (PORTADAS_KIND_FOLDERS.has(typLeaf) && typLeaf !== "accordion") return typLeaf as AlbumKindKey;
  if (ACCORDION_PACKAGING_SEGMENTS.has(typLeaf)) return typLeaf as AlbumKindKey;
  if (typLeaf === "accordion") return "accordion";

  const h = haystack(item);
  if (/\/vinyl\/|\bvinyl\b/.test(h) && !/\/regular\//.test(p)) return "vinyl";
  if (/\/skzoo\/|\bskzoo\b/.test(h) && !/\/regular\//.test(p)) return "skzoo";

  const pack = packagingKindFromHaystack(h);
  if (pack) return pack;

  if (/\bplatform\b/.test(h) && !/\/regular\//.test(p) && !/\/portadas/.test(p)) return "platform";
  if (
    !/\/regular\//.test(p) &&
    (/(?:\/|^|_)(limited|lim-?it)(?:\/|$|_|\b)/.test(h) ||
      /\blimited\b/.test(String(item.album_version || "").toLowerCase()))
  ) {
    return "limited";
  }
  return "regular";
}

export function isAccordionKindKey(kind: string): boolean {
  return ACCORDION_KIND_KEYS.has(kind as AlbumKindKey);
}

/** Versión / edición con etiqueta bonita (sin slugs crudos cuando hay mapa). */
export function prettyMerchAlbumEditionLabel(item: MerchAlbumItem): string {
  const v = String(item.album_version || "").trim();
  if (!v) return "";
  const slug = v.toLowerCase().replace(/\s+/g, "-");
  const map: Record<string, string> = {
    "limited-a": "Limited A",
    "limited-b": "Limited B",
    "limited-c": "Limited C",
    "limited-press": "Limited Press",
    "limited-star": "Limited Star",
    "limited-anime": "Limited Anime",
    "limited-cd": "Limited CD",
    "limited-dvd": "Limited DVD",
    "limited-tape": "Limited Tape",
    "regular": "Regular",
    "standart": "Standard",
    "standard": "Standard",
    cassete: "Cassette",
    cassette: "Cassette",
    platform: "Platform",
    "go-limited": "Go Limited",
    "t-crush": "T-Crush",
    "heart": "Heart",
    "mask-off": "Mask Off",
    scanning: "Scanning",
    "hiptape": "Hiptape",
    "nemo-a": "Nemo A",
    "nemo-b": "Nemo B",
    "letter": "Letter",
    "boom": "Boom",
    "chk-chk": "Chk Chk",
    ceremony: "Ceremony",
    hooray: "Hooray",
    compact: "Compact",
    "skzhop": "SKZ Hop",
    rock: "Rock",
    roll: "Roll",
    headliner: "Headliner",
    nemo: "Nemo",
    "i-am": "I am",
    not: "NOT",
    who: "Who",
    you: "You",
    ot8: "OT8",
  };
  if (map[slug]) return map[slug];
  return v
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/** Si la fila es “acordeón”, intenta sacar miembro desde versión o nombre de archivo en la URL. */
export function merchAlbumMemberLabel(item: MerchAlbumItem): string | null {
  if (!isAccordionKindKey(deriveAlbumKindKey(item))) return null;
  const verRaw = String(item.album_version || "").trim();
  const url = pathFromImageUrl(item.image_url || "");
  const file = url.split("/").pop() || "";
  const stem = file.replace(/\.(png|jpe?g|webp)$/i, "").replace(/^\d+-/, "");

  const needleNorms = new Set<string>();
  const needleCompacts = new Set<string>();
  for (const chunk of [verRaw, stripLeadingOrdinalPrefix(verRaw), stem, stripLeadingOrdinalPrefix(stem)]) {
    const n = norm(chunk);
    if (n) {
      needleNorms.add(n);
      needleCompacts.add(n.replace(/\s+/g, ""));
    }
  }

  for (const m of MEMBER_ORDER) {
    for (const tok of m.tokens) {
      const tNorm = norm(tok);
      const tCompact = tNorm.replace(/\s+/g, "");
      if (!tNorm) continue;

      for (const n of needleNorms) {
        if (n === tNorm) return m.label;
      }
      for (const c of needleCompacts) {
        if (c && tCompact && c === tCompact) return m.label;
      }

      // Subcadena solo con tokens largos (evita "han" dentro de "changbin", "in" en "min", etc.)
      if (tCompact.length >= 5) {
        for (const n of needleNorms) {
          if (n.includes(tNorm)) return m.label;
        }
        for (const c of needleCompacts) {
          if (c.includes(tCompact)) return m.label;
        }
      }

      // "in" / "I.N": solo igualdad compacta o la cadena entera es "in"
      if (tCompact === "in") {
        for (const c of needleCompacts) {
          if (c === "in") return m.label;
        }
      }
    }
  }
  return null;
}

/** Valor estable para el 4º filtro (miembro o edición). */
export function merchAlbumSlot4Value(item: MerchAlbumItem): string {
  const kind = deriveAlbumKindKey(item);
  if (isAccordionKindKey(kind)) {
    const m = merchAlbumMemberLabel(item);
    if (m) return m;
  }
  if (kind === "skzoo") {
    const z = formatSkzooCharacterLabel(item);
    if (z) return z;
  }
  return prettyMerchAlbumEditionLabel(item);
}

/** Orden del 4º filtro: miembros canónicos primero, luego el resto alfabético. */
export function sortMerchAlbumSlot4Labels(kind: AlbumKindKey | "Todos", labels: string[]): string[] {
  const uniq = [...new Set(labels.filter(Boolean))];
  if (kind === "skzoo") {
    const order = SKZOO_STEM_ORDER.map((k) => SKZOO_CHARACTER_LABEL_BY_STEM[k]!);
    return uniq.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
    });
  }
  if (!isAccordionKindKey(kind)) {
    return uniq.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true }));
  }
  const order = MEMBER_ORDER.map((m) => m.label);
  return uniq.sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
  });
}

/** Índice en `ALBUM_KIND_ORDER` para ordenar catálogo (regular → … → skzoo → …). */
export function merchAlbumKindSortIndex(kind: AlbumKindKey): number {
  const i = ALBUM_KIND_ORDER.indexOf(kind);
  return i >= 0 ? i : 99;
}

const ACCORDION_NON_MEMBER_SORT_RANK = 80;
const SKZOO_SORT_RANK_BASE = 120;
const SKZOO_UNKNOWN_SORT_RANK = 200;
const OTHER_SLOT_SORT_RANK = 400;

/**
 * Orden canónico de variante en catálogo: miembros (edad) → ediciones sin miembro → SKZOO (orden fijo) → resto.
 * [rank, etiqueta] — menor rank primero; mismo rank desempata por etiqueta.
 */
export function merchAlbumSlot4SortTuple(item: MerchAlbumItem): readonly [number, string] {
  const kind = deriveAlbumKindKey(item);
  const label = merchAlbumSlot4Value(item);
  if (isAccordionKindKey(kind)) {
    const m = merchAlbumMemberLabel(item);
    if (m) {
      const i = MEMBER_ORDER.findIndex((x) => x.label === m);
      if (i >= 0) return [i, label] as const;
    }
    return [ACCORDION_NON_MEMBER_SORT_RANK, label] as const;
  }
  if (kind === "skzoo") {
    const key = detectSkzooStemKey(item);
    if (key) {
      const i = SKZOO_STEM_ORDER.indexOf(key);
      if (i >= 0) return [SKZOO_SORT_RANK_BASE + i, label] as const;
    }
    return [SKZOO_UNKNOWN_SORT_RANK, label] as const;
  }
  return [OTHER_SLOT_SORT_RANK, label] as const;
}

/**
 * Cadena normalizada (minúsculas, espacios) con todo lo que el usuario puede buscar:
 * nombres crudos, etiquetas bonitas, tipo retail SKZ, ruta de imagen, etc.
 */
export function merchAlbumSearchHaystack(item: MerchAlbumItem): string {
  const parts: string[] = [];
  const push = (s: string | null | undefined) => {
    const t = String(s ?? "").trim();
    if (t) parts.push(t);
  };

  push(item.name);
  push(item.group_name);
  push(item.album_title);
  push(item.album_type);
  push(item.album_version);
  push(item.image_url);

  const p = pathFromImageUrl(item.image_url || "");
  for (const seg of p.split("/")) {
    if (seg) parts.push(seg.replace(/\.(png|jpe?g|webp)$/i, ""));
  }

  if (item.album_title) push(formatCollectionOptionLabel(item.album_title));
  if (item.album_type) {
    push(formatPhysicalMerchLabel(item.album_type));
    push(formatMerchAlbumTypeDisplay(item.album_title, item.album_type));
  }
  if (item.album_version) push(formatPhysicalMerchLabel(item.album_version));

  const skzRetail = strayKidsAccordionRetailLabelForAlbum(item.album_title);
  if (skzRetail) push(skzRetail);

  push(merchAlbumSlot4Value(item));
  push(prettyMerchAlbumEditionLabel(item));

  return norm(parts.join(" "));
}

/** Búsqueda por texto: todas las palabras de la query deben aparecer en el haystack (AND). */
export function merchAlbumItemMatchesQuery(item: MerchAlbumItem, qRaw: string): boolean {
  const q = qRaw.trim();
  if (!q) return true;
  const hay = merchAlbumSearchHaystack(item);
  const words = norm(q)
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return true;
  return words.every((w) => hay.includes(w));
}
