import { supabase } from "@/lib/supabase";

export type BinderSlotLink = {
  binderId: number;
  pageIndex: number;
  slotIndex: number;
  title: string;
};

export async function findUserItemSlot(userId: string, itemId: number): Promise<BinderSlotLink | null> {
  if (!userId || !Number.isFinite(itemId)) return null;

  const bindersRes = await supabase.from("binders").select("id, title").eq("user_id", userId);
  if (bindersRes.error || !bindersRes.data?.length) return null;

  const binders = bindersRes.data as Array<{ id: number; title: string | null }>;
  const binderIds = binders.map((binder) => binder.id);
  const pagesRes = await supabase
    .from("binder_pages")
    .select("id, binder_id, page_index")
    .in("binder_id", binderIds);
  if (pagesRes.error || !pagesRes.data?.length) return null;

  const pages = pagesRes.data as Array<{ id: number; binder_id: number; page_index: number | null }>;
  const slotsRes = await supabase
    .from("page_slots")
    .select("page_id, slot_index")
    .eq("item_id", itemId)
    .in("page_id", pages.map((page) => page.id))
    .limit(1);
  if (slotsRes.error || !slotsRes.data?.length) return null;

  const slot = slotsRes.data[0] as { page_id: number; slot_index: number };
  const page = pages.find((candidate) => candidate.id === slot.page_id);
  if (!page) return null;

  const binderPages = pages
    .filter((candidate) => candidate.binder_id === page.binder_id)
    .sort((a, b) => (a.page_index ?? 0) - (b.page_index ?? 0));
  const pageIndex = binderPages.findIndex((candidate) => candidate.id === page.id);
  const binder = binders.find((candidate) => candidate.id === page.binder_id);

  return {
    binderId: page.binder_id,
    pageIndex: pageIndex >= 0 ? pageIndex : 0,
    slotIndex: Number(slot.slot_index),
    title: binder?.title ?? "",
  };
}
