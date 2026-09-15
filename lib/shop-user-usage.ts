import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageCounts } from "@/lib/shop-catalog";

export async function fetchShopUsageCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<UsageCounts> {
  const { data: bData } = await supabase.from("binders").select("id").eq("user_id", userId);
  const bIds = bData?.map((b) => b.id) || [];
  let pCount = 0;
  let sCount = 0;
  if (bIds.length > 0) {
    const { data: pages } = await supabase
      .from("binder_pages")
      .select("layout_type")
      .in("binder_id", bIds);
    pCount = pages?.filter((p) => p.layout_type !== "separator").length || 0;
    sCount = pages?.filter((p) => p.layout_type === "separator").length || 0;
  }
  return { binders: bIds.length, pages: pCount, separators: sCount };
}
