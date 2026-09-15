import {
  isStrayKidsGroupName,
  normalizeCollectionName,
  strayKidsAlbumOrderIndex,
  strayKidsJapaneseAlbumOrderIndex,
} from "@/lib/collection-filters";
import { deriveAlbumRegionKey, deriveAlbumKindKey, merchAlbumSlot4SortTuple, merchAlbumKindSortIndex, type MerchAlbumItem } from "@/lib/merch-album-filter-meta";
import { canonicalMerchGroupDisplayName } from "@/lib/merch-group-display";

export type MerchAlbumCatalogRow = MerchAlbumItem & {
  id: string;
  name: string;
  group_name: string;
  category: string;
};

/** Orden en pestaña Álbumes: grupo → discografía KR / bloque JP → título → variante → nombre en catálogo. */
function strayKidsMerchCatalogSortKey(item: MerchAlbumCatalogRow): readonly [number, number, string] {
  const title = normalizeCollectionName(item.album_title);
  const region = deriveAlbumRegionKey(item);
  if (region === "japan") {
    const ji = strayKidsJapaneseAlbumOrderIndex(title);
    if (ji !== null) return [1, ji, title] as const;
    return [1, 900, title] as const;
  }
  const ki = strayKidsAlbumOrderIndex(title);
  if (ki !== null) return [0, ki, title] as const;
  const ji = strayKidsJapaneseAlbumOrderIndex(title);
  if (ji !== null) return [1, ji, title] as const;
  return [0, 800, title] as const;
}

export function compareMerchAlbumCatalogItems(a: MerchAlbumCatalogRow, b: MerchAlbumCatalogRow): number {
  const ga = canonicalMerchGroupDisplayName(a.group_name);
  const gb = canonicalMerchGroupDisplayName(b.group_name);
  if (ga !== gb) return ga.localeCompare(gb);

  if (!isStrayKidsGroupName(a.group_name)) {
    const ta = String(a.album_title || "").trim();
    const tb = String(b.album_title || "").trim();
    const c = ta.localeCompare(tb, "es", { sensitivity: "base", numeric: true });
    return c || a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true });
  }

  const ka = strayKidsMerchCatalogSortKey(a);
  const kb = strayKidsMerchCatalogSortKey(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (ka[1] !== kb[1]) return ka[1] - kb[1];
  const tc = ka[2].localeCompare(kb[2], "es", { sensitivity: "base", numeric: true });
  if (tc !== 0) return tc;

  const kindA = deriveAlbumKindKey(a);
  const kindB = deriveAlbumKindKey(b);
  const kia = merchAlbumKindSortIndex(kindA);
  const kib = merchAlbumKindSortIndex(kindB);
  if (kia !== kib) return kia - kib;

  const ta = merchAlbumSlot4SortTuple(a);
  const tb = merchAlbumSlot4SortTuple(b);
  if (ta[0] !== tb[0]) return ta[0] - tb[0];
  return ta[1].localeCompare(tb[1], "es", { sensitivity: "base", numeric: true }) || a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true });
}
