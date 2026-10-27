import type { MerchAlbumCatalogRow } from "@/lib/merch-albums-catalog-scan";
import { canonicalMerchGroupDisplayName } from "@/lib/merch-group-display";
import { supabase } from "@/lib/supabase";

const ALBUM_CATEGORY = "Álbumes";

type StoredMerchRow = {
  id: string;
  name: string | null;
  category: string | null;
  group_name: string | null;
  image_url: string | null;
  rarity: string | null;
  album_title: string | null;
  album_type: string | null;
  album_version: string | null;
};

async function loadStoredMerch() {
  const pageSize = 1000;
  const rows: StoredMerchRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("merch_items")
      .select("id, name, category, group_name, image_url, rarity, album_title, album_type, album_version")
      .range(from, from + pageSize - 1);
    if (error || !data?.length) break;
    rows.push(...(data as StoredMerchRow[]));
    if (data.length < pageSize) break;
  }
  return rows.filter((row) => {
    const image = String(row.image_url || "").trim();
    if (!image || /placehold\.co/i.test(image)) return false;
    return String(row.album_version || "") !== "personal";
  });
}

export async function loadStoredAlbumCatalogRows(): Promise<MerchAlbumCatalogRow[]> {
  const rows = await loadStoredMerch();
  return rows
    .filter((row) => row.category === ALBUM_CATEGORY && row.album_title)
    .map((row) => ({
      id: String(row.id),
      name: String(row.name || row.album_title || ""),
      category: ALBUM_CATEGORY,
      group_name: canonicalMerchGroupDisplayName(row.group_name),
      image_url: String(row.image_url),
      rarity: String(row.rarity || "Común"),
      album_title: String(row.album_title),
      album_type: row.album_type,
      album_version: String(row.album_version || ""),
    }));
}
