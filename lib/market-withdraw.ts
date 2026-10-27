import { supabase } from "@/lib/supabase";

export type WithdrawReason = "not_wanted" | "off_platform";

type WithdrawInput = {
  userId: string;
  itemType: "pc" | "merch";
  itemId: string | number;
  statusRowId: string;
  listingType: "wtt" | "wts";
  reason: WithdrawReason;
};

function tableOf(itemType: "pc" | "merch") {
  return itemType === "merch" ? "user_merch_statuses" : "user_item_statuses";
}

function itemColumn(itemType: "pc" | "merch") {
  return itemType === "merch" ? "merch_id" : "item_id";
}

function conflictKey(itemType: "pc" | "merch") {
  return itemType === "merch" ? "user_id,merch_id,status" : "user_id,item_id,status";
}

/** Quita el anuncio y deja constancia del motivo. */
export async function withdrawMarketListing(input: WithdrawInput): Promise<{ ok: true; logged: boolean } | { ok: false; message: string }> {
  const table = tableOf(input.itemType);
  const itemCol = itemColumn(input.itemType);
  const { data: row, error: readError } = await supabase
    .from(table)
    .select("id, qty")
    .eq("id", input.statusRowId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (readError) return { ok: false, message: readError.message };
  if (!row) return { ok: false, message: "missing" };

  const qty = Math.max(1, Number(row.qty) || 1);
  let haveRollback: { prev: number; created: boolean } | null = null;

  if (input.reason === "not_wanted") {
    const { data: have, error: haveError } = await supabase
      .from(table)
      .select("qty")
      .eq("user_id", input.userId)
      .eq(itemCol, input.itemId)
      .eq("status", "have")
      .maybeSingle();
    if (haveError) return { ok: false, message: haveError.message };
    const prev = Math.max(0, Number(have?.qty) || 0);
    const { error: upError } = await supabase.from(table).upsert(
      {
        user_id: input.userId,
        [itemCol]: input.itemId,
        status: "have",
        qty: prev + qty,
      },
      { onConflict: conflictKey(input.itemType) },
    );
    if (upError) return { ok: false, message: upError.message };
    haveRollback = { prev, created: !have };
    if (input.itemType === "merch") {
      await supabase
        .from(table)
        .delete()
        .eq("user_id", input.userId)
        .eq(itemCol, input.itemId)
        .eq("status", "wishlist");
    }
  }

  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq("id", input.statusRowId)
    .eq("user_id", input.userId);
  if (deleteError) {
    if (haveRollback) {
      if (haveRollback.created) {
        await supabase.from(table).delete().eq("user_id", input.userId).eq(itemCol, input.itemId).eq("status", "have");
      } else {
        await supabase.from(table).upsert(
          {
            user_id: input.userId,
            [itemCol]: input.itemId,
            status: "have",
            qty: haveRollback.prev,
          },
          { onConflict: conflictKey(input.itemType) },
        );
      }
    }
    return { ok: false, message: deleteError.message };
  }

  const logged = await recordWithdrawal({ ...input, qty });
  return { ok: true, logged };
}

async function recordWithdrawal(input: WithdrawInput & { qty: number }) {
  const { error: logError } = await supabase.from("market_listing_withdrawals").insert({
    user_id: input.userId,
    source: input.itemType === "merch" ? "merch" : "pc",
    status_row_id: input.statusRowId,
    item_ref: String(input.itemId),
    listing_type: input.listingType,
    qty: input.qty,
    reason: input.reason,
  });
  if (!logError) return true;

  const table = tableOf(input.itemType);
  const itemCol = itemColumn(input.itemType);
  const noteCol = input.itemType === "merch" ? "comment" : "market_comment";
  const { data: existing } = await supabase
    .from(table)
    .select(noteCol)
    .eq("user_id", input.userId)
    .eq(itemCol, input.itemId)
    .eq("status", "listing_closed")
    .maybeSingle();
  let events: unknown[] = [];
  const raw = existing ? (existing as Record<string, unknown>)[noteCol] : null;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) events = parsed;
    } catch {
      events = [];
    }
  }
  events.push({
    at: new Date().toISOString(),
    listing_type: input.listingType,
    qty: input.qty,
    reason: input.reason,
    status_row_id: input.statusRowId,
  });
  const { error: fallbackError } = await supabase.from(table).upsert(
    {
      user_id: input.userId,
      [itemCol]: input.itemId,
      status: "listing_closed",
      qty: 1,
      [noteCol]: JSON.stringify(events),
    },
    { onConflict: conflictKey(input.itemType) },
  );
  return !fallbackError;
}
