import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import type { ChatOfferItem } from "@/lib/chat-offer-payload";
import type { ChatDealPayload } from "@/lib/chat-deal-payload";

async function requireUser(req: Request) {
  const token = req.headers.get("authorization")?.startsWith("Bearer ")
    ? req.headers.get("authorization")!.slice(7).trim()
    : "";
  if (!token) return { error: NextResponse.json({ error: "Authorization required" }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { error: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }) };
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user?.id) return { error: NextResponse.json({ error: "Invalid session" }, { status: 401 }) };
  return { userId: data.user.id };
}

async function takeOne(
  admin: ReturnType<typeof createServiceRoleClient>,
  table: "user_item_statuses" | "user_merch_statuses",
  userId: string,
  idField: "item_id" | "merch_id",
  itemId: string | number,
) {
  const { data: rows } = await admin.from(table).select("*").eq("user_id", userId).eq(idField, itemId);
  const order = ["wts", "wtt", "have", "otw", "on_its_way"];
  const row =
    order.map((s) => (rows || []).find((r: any) => r.status === s && Number(r.qty ?? 1) > 0)).find(Boolean) ||
    (rows || []).find((r: any) => Number(r.qty ?? 1) > 0);
  if (!row) return false;
  const qty = Number(row.qty ?? 1);
  if (qty <= 1) await admin.from(table).delete().eq("id", row.id);
  else await admin.from(table).update({ qty: qty - 1, updated_at: new Date().toISOString() }).eq("id", row.id);
  return true;
}

async function giveHave(
  admin: ReturnType<typeof createServiceRoleClient>,
  table: "user_item_statuses" | "user_merch_statuses",
  userId: string,
  idField: "item_id" | "merch_id",
  itemId: string | number,
) {
  const { data: have } = await admin
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .eq(idField, itemId)
    .eq("status", "have")
    .maybeSingle();
  if (have) {
    await admin
      .from(table)
      .update({ qty: Number(have.qty ?? 1) + 1, updated_at: new Date().toISOString() })
      .eq("id", have.id);
    return;
  }
  await admin.from(table).insert({
    user_id: userId,
    [idField]: itemId,
    status: "have",
    qty: 1,
    updated_at: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const me = auth.userId;
  let deal: ChatDealPayload;
  try {
    deal = (await req.json()) as ChatDealPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!deal?.dealId || !deal.ownerId || !deal.bidderId) {
    return NextResponse.json({ error: "Invalid deal" }, { status: 400 });
  }
  if (me !== deal.ownerId && me !== deal.bidderId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const confirmed = new Set((deal.confirmedBy || []).map(String));
  if (!confirmed.has(deal.ownerId) || !confirmed.has(deal.bidderId)) {
    return NextResponse.json({ error: "Both parties must confirm" }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    let alreadySettled = false;
    try {
      const { data: prior } = await admin
        .from("notifications")
        .select("id")
        .eq("type", "deal_settled")
        .contains("metadata", { dealId: deal.dealId })
        .limit(1);
      alreadySettled = !!(prior && prior.length > 0);
    } catch {
      alreadySettled = false;
    }
    if (alreadySettled) {
      return NextResponse.json({ ok: true, alreadySettled: true });
    }

    const koins = Math.max(0, Math.floor(Number(deal.terms?.koins) || 0));
    if (koins > 0) {
      const payer = deal.terms.koinsPayer === "owner" ? deal.ownerId : deal.bidderId;
      const payee = payer === deal.ownerId ? deal.bidderId : deal.ownerId;
      const { error: rpcErr } = await admin.rpc("transferir_puntos", {
        remitente_id: payer,
        destinatario_id: payee,
        cantidad: koins,
      });
      if (rpcErr) {
        const { data: payerRow, error: payerErr } = await admin.from("profiles").select("puntos").eq("user_id", payer).single();
        const { data: payeeRow, error: payeeErr } = await admin.from("profiles").select("puntos").eq("user_id", payee).single();
        if (payerErr || payeeErr || !payerRow) {
          return NextResponse.json({ error: rpcErr.message || "Could not read K-oins" }, { status: 400 });
        }
        const fromBal = Number(payerRow.puntos || 0);
        if (fromBal < koins) {
          return NextResponse.json({ error: "Insufficient K-oins" }, { status: 400 });
        }
        const { error: up1 } = await admin.from("profiles").update({ puntos: fromBal - koins }).eq("user_id", payer);
        const { error: up2 } = await admin.from("profiles").update({ puntos: Number(payeeRow?.puntos || 0) + koins }).eq("user_id", payee);
        if (up1 || up2) {
          return NextResponse.json({ error: (up1 || up2)?.message || "Could not update K-oins" }, { status: 500 });
        }
      }
    }

    const move = async (fromUser: string, toUser: string, item: ChatOfferItem) => {
      if (item.id == null) return;
      const merch = item.type === "merch" || item.itemType === "merch";
      const table = merch ? "user_merch_statuses" : "user_item_statuses";
      const idField = merch ? "merch_id" : "item_id";
      const took = await takeOne(admin, table, fromUser, idField, item.id);
      if (took) await giveHave(admin, table, toUser, idField, item.id);
    };

    for (const item of deal.terms.itemsFromBidder || []) await move(deal.bidderId, deal.ownerId, item);
    for (const item of deal.terms.itemsFromOwner || []) await move(deal.ownerId, deal.bidderId, item);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Settle failed" }, { status: 500 });
  }
}
