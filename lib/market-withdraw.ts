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

/** Las photocards no tienen id de fila: la clave real es usuario + pieza + estado. */
function normalizeItemId(itemType: "pc" | "merch", itemId: string | number) {
  if (itemType === "pc") {
    const n = Number(itemId);
    if (Number.isFinite(n)) return n;
  }
  return itemId;
}

/** Quita el anuncio y deja constancia del motivo. */
export async function withdrawMarketListing(input: WithdrawInput): Promise<{ ok: true; logged: boolean } | { ok: false; message: string }> {
  const table = tableOf(input.itemType);
  const itemCol = itemColumn(input.itemType);
  const itemId = normalizeItemId(input.itemType, input.itemId);
  const { data: rows, error: readError } = await supabase
    .from(table)
    .select("qty")
    .eq("user_id", input.userId)
    .eq(itemCol, itemId)
    .eq("status", input.listingType);
  if (readError) return { ok: false, message: readError.message };
  if (!rows?.length) return { ok: false, message: "missing" };

  const qty = rows.reduce((sum, row) => sum + Math.max(1, Number(row.qty) || 1), 0);
  let haveRollback: { prev: number; created: boolean } | null = null;

  if (input.reason === "not_wanted") {
    const { data: have, error: haveError } = await supabase
      .from(table)
      .select("qty")
      .eq("user_id", input.userId)
      .eq(itemCol, itemId)
      .eq("status", "have")
      .maybeSingle();
    if (haveError) return { ok: false, message: haveError.message };
    const prev = Math.max(0, Number(have?.qty) || 0);
    const { error: upError } = await supabase.from(table).upsert(
      {
        user_id: input.userId,
        [itemCol]: itemId,
        status: "have",
        qty: prev + qty,
      },
      { onConflict: conflictKey(input.itemType) },
    );
    if (upError) return { ok: false, message: upError.message };
    haveRollback = { prev, created: !have };
  }

  const { data: deleted, error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq("user_id", input.userId)
    .eq(itemCol, itemId)
    .eq("status", input.listingType)
    .select("qty");
  if (deleteError || !deleted?.length) {
    if (haveRollback) {
      if (haveRollback.created) {
        await supabase.from(table).delete().eq("user_id", input.userId).eq(itemCol, itemId).eq("status", "have");
      } else {
        await supabase.from(table).upsert(
          {
            user_id: input.userId,
            [itemCol]: itemId,
            status: "have",
            qty: haveRollback.prev,
          },
          { onConflict: conflictKey(input.itemType) },
        );
      }
    }
    return { ok: false, message: deleteError?.message || "failed" };
  }

  if (input.reason === "not_wanted" && input.itemType === "merch") {
    await supabase.from(table).delete().eq("user_id", input.userId).eq(itemCol, itemId).eq("status", "wishlist");
  }

  const logged = await recordWithdrawal({ ...input, itemId, qty });
  return { ok: true, logged };
}

async function recordWithdrawal(input: WithdrawInput & { qty: number }) {
  const { error: logError } = await supabase.from("market_listing_withdrawals").insert({
    user_id: input.userId,
    source: input.itemType === "merch" ? "merch" : "pc",
    status_row_id: `${input.userId}:${input.itemId}:${input.listingType}`,
    item_ref: String(input.itemId),
    listing_type: input.listingType,
    qty: input.qty,
    reason: input.reason,
  });
  if (!logError) return true;

  // La tabla de retiradas aún no está en la base. El asunto admin-queue no sale en el buzón.
  const { error: fallbackError } = await supabase.from("buzon_colaboraciones").insert({
    user_id: input.userId,
    asunto: "admin-queue",
    email: `retirada:${input.userId}:${Date.now()}`,
    status: "pendiente",
    mensaje: JSON.stringify({
      kind: "market-withdraw",
      at: new Date().toISOString(),
      source: input.itemType,
      item_ref: String(input.itemId),
      listing_type: input.listingType,
      qty: input.qty,
      reason: input.reason,
    }),
  });
  return !fallbackError;
}
