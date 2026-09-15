import { formatCollectionOptionLabel } from "@/lib/collection-filters";
import { formatMerchAlbumTypeDisplay } from "@/lib/album-physical-labels";
import { merchAlbumSlot4Value, type MerchAlbumItem } from "@/lib/merch-album-filter-meta";
import { canonicalMerchGroupDisplayName } from "@/lib/merch-group-display";

export type MerchAlbumCardItem = MerchAlbumItem & {
  group_name?: string | null;
  category?: string | null;
};

/** Línea superior de la ficha (sin mayúsculas forzadas): grupo · categoría · colección · formato · variante. */
export function merchAlbumCardBreadcrumbLine(item: MerchAlbumCardItem, albumsCategoryLabel: string): string {
  const g = canonicalMerchGroupDisplayName(item.group_name || "");
  const parts: string[] = [];
  if (g) parts.push(g);
  if (albumsCategoryLabel) parts.push(albumsCategoryLabel);
  const album = formatCollectionOptionLabel(item.album_title);
  const typ = item.album_type ? formatMerchAlbumTypeDisplay(item.album_title, item.album_type) : "";
  const slot = merchAlbumSlot4Value(item);
  const tail = [album, typ, slot].filter(Boolean).join(" · ");
  if (tail) parts.push(tail);
  return parts.join(" · ");
}

/** Título principal alineado con la variante legible (sustituye `name` crudo del catálogo). */
export function merchAlbumCardHeading(item: MerchAlbumCardItem): string {
  const album = formatCollectionOptionLabel(item.album_title);
  const typ = item.album_type ? formatMerchAlbumTypeDisplay(item.album_title, item.album_type) : "";
  const slot = merchAlbumSlot4Value(item);
  return [album, typ, slot].filter(Boolean).join(" · ");
}
