import { supabase } from "@/lib/supabase";

/** Cuenta auth de info@mykpopbinder.com. El resto del equipo admin no hereda este stock. */
export const SITE_ADMIN_USER_ID = "85b9ef79-4f84-4b9e-8f0a-1847bcb9770c";

export function isSiteAdminUser(userId: string | null | undefined) {
  return Boolean(userId) && userId === SITE_ADMIN_USER_ID;
}

export type SiteAdminStockCard = {
  id: string;
  qty: 1;
  status: "have";
  item: { id: string | number; name: string | null; image_url: string | null };
};

async function fetchAll(table: "items" | "merch_items", columns: string) {
  const pageSize = 1000;
  const rows: Array<{ id: string | number; name?: string | null; image_url?: string | null }> = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (error || !data?.length) break;
    rows.push(...(data as unknown as typeof rows));
    if (data.length < pageSize) break;
  }
  return rows;
}

/** Una unidad de cada photocard, inclusión y merch que exista en el catálogo. */
export async function loadSiteAdminStock(): Promise<SiteAdminStockCard[]> {
  const [items, merch] = await Promise.all([
    fetchAll("items", "id, name, image_url, version"),
    fetchAll("merch_items", "id, name, image_url, album_version"),
  ]);
  const publicItems = items.filter((item) => String((item as { version?: string | null }).version || "") !== "personal");
  const publicMerch = merch.filter((item) => String((item as { album_version?: string | null }).album_version || "") !== "personal");
  return [
    ...publicItems.map((item) => ({
      id: `pc-${item.id}`,
      qty: 1 as const,
      status: "have" as const,
      item: { id: item.id, name: item.name ?? null, image_url: item.image_url ?? null },
    })),
    ...publicMerch.map((item) => ({
      id: `merch-${item.id}`,
      qty: 1 as const,
      status: "have" as const,
      item: { id: item.id, name: item.name ?? null, image_url: item.image_url ?? null },
    })),
  ];
}

export async function countSiteAdminStock() {
  const stock = await loadSiteAdminStock();
  return stock.length;
}
