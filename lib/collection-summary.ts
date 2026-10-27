import { supabase } from "@/lib/supabase";
import { itemIsMerchNotPhotocard, itemLibraryCollectionKind } from "@/lib/folder-tree-catalog-shared";
import { isSiteAdminUser } from "@/lib/site-admin-stock";

/** Apartados del resumen de colección. Cubre photocards, merch, álbumes, inclusiones y el resto del catálogo. */
export const STOCK_BUCKETS = [
  "photocards",
  "pobs",
  "inclusions",
  "albums",
  "plushies",
  "lightsticks",
  "clothes",
  "accessories",
  "tour_merch",
  "merch",
  "seasons-greetings",
  "tours",
  "pop-ups",
  "memberships",
  "collabs",
  "events",
  "other",
] as const;

export type StockBucket = (typeof STOCK_BUCKETS)[number];
export type CollectionCounts = Record<StockBucket, number>;

const CARD_BUCKETS = new Set<StockBucket>([
  "photocards",
  "pobs",
  "inclusions",
  "seasons-greetings",
  "tours",
  "pop-ups",
  "memberships",
  "collabs",
  "events",
  "other",
]);

export function emptyCollectionCounts(): CollectionCounts {
  return Object.fromEntries(STOCK_BUCKETS.map((key) => [key, 0])) as CollectionCounts;
}

export function collectionTotal(counts: CollectionCounts) {
  return STOCK_BUCKETS.reduce((sum, key) => sum + (counts[key] || 0), 0);
}

/** Unidades que se valoran como photocard. El merch físico y los álbumes no entran. */
export function collectionCardQty(counts: CollectionCounts) {
  return STOCK_BUCKETS.reduce((sum, key) => sum + (CARD_BUCKETS.has(key) ? counts[key] || 0 : 0), 0);
}

export function bucketForCatalogItem(item: {
  type?: string | null;
  image_url?: string | null;
  version?: string | null;
}): StockBucket {
  const type = String(item.type ?? "").toLowerCase();
  const url = String(item.image_url ?? "").toLowerCase();
  if (!type && !url) return "other";
  if (type.startsWith("inclusion") || url.includes("/inclusions/")) return "inclusions";
  if (type === "pobs" || type === "pob" || /\/pobs?\//.test(url)) return "pobs";
  if (/event/.test(type) || /\/(events|eventos)\//.test(url)) return "events";
  if (itemIsMerchNotPhotocard(item)) return "merch";
  const kind = itemLibraryCollectionKind(item);
  if (
    kind === "seasons-greetings" ||
    kind === "tours" ||
    kind === "pop-ups" ||
    kind === "memberships" ||
    kind === "collabs" ||
    kind === "events"
  ) {
    return kind;
  }
  if (kind === "merch") return "merch";
  return "photocards";
}

export function bucketForMerchCategory(category: string | null | undefined): StockBucket {
  const value = String(category || "").trim();
  if (/^álbumes$|^albums?$/i.test(value)) return "albums";
  if (/^inclusions?$/i.test(value)) return "inclusions";
  if (/peluche/i.test(value)) return "plushies";
  if (/lightstick/i.test(value)) return "lightsticks";
  if (/ropa|cloth/i.test(value)) return "clothes";
  if (/accesorio/i.test(value)) return "accessories";
  if (/tour merch/i.test(value)) return "tour_merch";
  return "merch";
}

async function eachPage(table: "items" | "merch_items", columns: string, onPage: (rows: Array<Record<string, unknown>>) => void) {
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (error || !data?.length) break;
    onPage(data as unknown as Array<Record<string, unknown>>);
    if (data.length < pageSize) break;
  }
}

async function loadCatalogSummary(): Promise<CollectionCounts> {
  const counts = emptyCollectionCounts();
  await eachPage("items", "type, image_url, version", (rows) => {
    for (const row of rows) {
      if (String(row.version || "") === "personal") continue;
      counts[bucketForCatalogItem(row as { type?: string | null; image_url?: string | null; version?: string | null })] += 1;
    }
  });
  await eachPage("merch_items", "category, album_version", (rows) => {
    for (const row of rows) {
      if (String(row.album_version || "") === "personal") continue;
      counts[bucketForMerchCategory(row.category as string | null)] += 1;
    }
  });
  return counts;
}

async function rowsIn<T extends Record<string, unknown>>(table: "items" | "merch_items", column: string, ids: Array<string | number>, columns: string) {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const { data } = await supabase.from(table).select(columns).in(column, slice);
    if (data?.length) out.push(...(data as unknown as T[]));
  }
  return out;
}

async function loadOwnedSummary(userId: string): Promise<CollectionCounts> {
  const counts = emptyCollectionCounts();
  const [{ data: pcRows }, { data: merchRows }] = await Promise.all([
    supabase.from("user_item_statuses").select("item_id, qty").eq("user_id", userId).eq("status", "have"),
    supabase.from("user_merch_statuses").select("merch_id, qty").eq("user_id", userId).eq("status", "have"),
  ]);

  const pcQty = new Map<number, number>();
  for (const row of pcRows || []) {
    const id = Number(row.item_id);
    if (!Number.isFinite(id)) continue;
    pcQty.set(id, (pcQty.get(id) || 0) + Math.max(1, Number(row.qty) || 1));
  }
  if (pcQty.size) {
    const items = await rowsIn<{ id: number; type?: string | null; image_url?: string | null; version?: string | null }>(
      "items",
      "id",
      [...pcQty.keys()],
      "id, type, image_url, version",
    );
    for (const item of items) counts[bucketForCatalogItem(item)] += pcQty.get(Number(item.id)) || 0;
  }

  const merchQty = new Map<string, number>();
  for (const row of merchRows || []) {
    const id = String(row.merch_id || "");
    if (!id) continue;
    merchQty.set(id, (merchQty.get(id) || 0) + Math.max(1, Number(row.qty) || 1));
  }
  if (merchQty.size) {
    const merch = await rowsIn<{ id: string; category?: string | null }>("merch_items", "id", [...merchQty.keys()], "id, category");
    for (const item of merch) counts[bucketForMerchCategory(item.category)] += merchQty.get(String(item.id)) || 0;
  }
  return counts;
}

/** Lo que tiene el usuario. En info@mykpopbinder.com es 1 unidad de cada pieza del catálogo. */
export async function loadCollectionSummary(userId: string): Promise<CollectionCounts> {
  if (isSiteAdminUser(userId)) return loadCatalogSummary();
  return loadOwnedSummary(userId);
}
