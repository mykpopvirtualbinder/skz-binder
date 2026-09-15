import { canonicalMerchGroupDisplayName } from "@/lib/merch-group-display";
import {
  MERCH_ALBUM_DB_CATEGORY,
  merchAlbumItemMatchesQuery,
  merchAlbumSearchHaystack,
} from "@/lib/merch-album-filter-meta";

/** Fila mínima para búsqueda en catálogo merch / modal WTT. */
export type MerchSearchRow = {
  id?: string;
  name: string;
  group_name: string;
  category: string;
  rarity: string;
  image_url?: string | null;
  album_title?: string | null;
  album_type?: string | null;
  album_version?: string | null;
};

function normSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function pushPathSegments(url: string | null | undefined, parts: string[]) {
  if (!url?.trim()) return;
  try {
    const u = (url.trim().split("?")[0] ?? "").replace(/\+/g, " ");
    const dec = decodeURIComponent(u);
    for (const seg of dec.split("/")) {
      if (seg) parts.push(seg.replace(/\.(png|jpe?g|webp)$/i, ""));
    }
  } catch {
    parts.push(url.trim());
  }
}

/**
 * Texto normalizado indexable: álbumes usan el haystack rico (packaging, miembros, rutas);
 * resto de merch usa nombre, grupo, categoría, rareza y segmentos de URL.
 */
export function merchRowSearchHaystack(row: MerchSearchRow): string {
  if (row.category === MERCH_ALBUM_DB_CATEGORY) {
    return merchAlbumSearchHaystack(row);
  }
  const parts: string[] = [];
  const push = (s: string | null | undefined) => {
    const t = String(s ?? "").trim();
    if (t) parts.push(t);
  };
  push(row.name);
  push(row.group_name);
  push(row.category);
  push(row.rarity);
  push(row.image_url);
  push(canonicalMerchGroupDisplayName(row.group_name));
  pushPathSegments(row.image_url, parts);
  return normSearch(parts.join(" "));
}

/** Misma lógica de palabras que en álbumes (AND de tokens normalizados). */
export function merchRowMatchesQuery(row: MerchSearchRow, qRaw: string): boolean {
  if (row.category === MERCH_ALBUM_DB_CATEGORY) {
    return merchAlbumItemMatchesQuery(row, qRaw);
  }
  const q = qRaw.trim();
  if (!q) return true;
  const hay = merchRowSearchHaystack(row);
  const words = normSearch(q)
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => hay.includes(w));
}
