import type { SupabaseClient } from "@supabase/supabase-js";
import { prettyMemberLabel } from "@/lib/member-labels";
import { resolveMockPcImageUrl } from "@/lib/mock-pc-url";
import { SITE_ADMIN_USER_ID } from "@/lib/site-admin-stock";

type Admin = SupabaseClient;

export type AdminRemovalBody = {
  kind?: string;
  id?: string;
  ids?: string[];
  userId?: string;
  itemType?: "pc" | "merch";
  itemId?: string | number;
  listingType?: "wtt" | "wts";
  reason?: string;
  label?: string;
};

function clip(value: unknown, max: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function idsOf(body: AdminRemovalBody) {
  const ids = [...(body.ids || []), body.id || ""].map((id) => String(id || "").trim()).filter(Boolean);
  return [...new Set(ids)];
}

function ignorable(message: string) {
  return /does not exist|schema cache|could not find the/i.test(message);
}

async function quiet(run: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await run;
  if (error && !ignorable(error.message)) return error.message;
  return null;
}

async function removeListing(admin: Admin, body: AdminRemovalBody) {
  const userId = String(body.userId || "");
  const listingType = body.listingType === "wts" ? "wts" : body.listingType === "wtt" ? "wtt" : "";
  const itemType = body.itemType === "merch" ? "merch" : "pc";
  if (!userId || !listingType) return "Faltan los datos del anuncio.";
  const table = itemType === "merch" ? "user_merch_statuses" : "user_item_statuses";
  const itemCol = itemType === "merch" ? "merch_id" : "item_id";
  const itemId = itemType === "pc" ? Number(body.itemId) : String(body.itemId || "");
  if (itemType === "pc" && !Number.isFinite(itemId)) return "Pieza no válida.";
  if (itemType === "merch" && !itemId) return "Pieza no válida.";

  const { data: rows, error: readError } = await admin.from(table).select("qty").eq("user_id", userId).eq(itemCol, itemId).eq("status", listingType);
  if (readError) return readError.message;
  if (!rows?.length) return "Ese anuncio ya no está.";
  const qty = rows.reduce((sum, row) => sum + Math.max(1, Number(row.qty) || 1), 0);

  const { data: have, error: haveError } = await admin.from(table).select("qty").eq("user_id", userId).eq(itemCol, itemId).eq("status", "have").maybeSingle();
  if (haveError) return haveError.message;
  const prev = Math.max(0, Number(have?.qty) || 0);
  const { error: upError } = await admin.from(table).upsert(
    { user_id: userId, [itemCol]: itemId, status: "have", qty: prev + qty },
    { onConflict: itemType === "merch" ? "user_id,merch_id,status" : "user_id,item_id,status" },
  );
  if (upError) return upError.message;

  const { error: deleteError } = await admin.from(table).delete().eq("user_id", userId).eq(itemCol, itemId).eq("status", listingType);
  if (deleteError) return deleteError.message;
  if (itemType === "merch") {
    await admin.from(table).delete().eq("user_id", userId).eq(itemCol, itemId).eq("status", "wishlist");
  }
  const noticed = await notifyListingRemoved(admin, userId, listingType, itemType, itemId, clip(body.reason, 500), clip(body.label, 180));
  return noticed;
}

const LISTING_REMOVED: Record<string, (type: string, itemLine: string, reason: string) => string> = {
  es: (type, itemLine, reason) => `Hemos quitado tu anuncio ${type} del mercado.\n${itemLine}Motivo: ${reason}.\nLas copias pasan a Tengo.`,
  en: (type, itemLine, reason) => `We removed your ${type} listing from the market.\n${itemLine}Reason: ${reason}.\nThe copies move to Have.`,
  fr: (type, itemLine, reason) => `Nous avons retiré ton annonce ${type} du marché.\n${itemLine}Motif : ${reason}.\nLes exemplaires passent dans J'ai.`,
  de: (type, itemLine, reason) => `Wir haben deine ${type}-Anzeige vom Markt genommen.\n${itemLine}Grund: ${reason}.\nDie Exemplare liegen jetzt bei Habe ich.`,
  it: (type, itemLine, reason) => `Abbiamo tolto il tuo annuncio ${type} dal mercato.\n${itemLine}Motivo: ${reason}.\nLe copie passano a Ce l'ho.`,
  pt: (type, itemLine, reason) => `Tirámos o teu anúncio ${type} do mercado.\n${itemLine}Motivo: ${reason}.\nAs cópias passam para Tenho.`,
  id: (type, itemLine, reason) => `Kami menurunkan iklan ${type} milikmu dari market.\n${itemLine}Alasan: ${reason}.\nSalinannya pindah ke Punya.`,
  th: (type, itemLine, reason) => `เราเอารายการ ${type} ของคุณออกจากตลาดแล้ว\n${itemLine}เหตุผล: ${reason}\nสำเนาไปอยู่ที่ มีแล้ว`,
  ja: (type, itemLine, reason) => `あなたの${type}出品をマーケットから取り下げました。\n${itemLine}理由: ${reason}。\n枚数は「持っている」に移ります。`,
  ko: (type, itemLine, reason) => `회원님의 ${type} 글을 마켓에서 내렸습니다.\n${itemLine}사유: ${reason}.\n수량은 보유로 옮겨집니다.`,
  zh: (type, itemLine, reason) => `我们已将你的 ${type} 公告从市场移除。\n${itemLine}原因：${reason}。\n副本已转入「已有」。`,
};

const ITEM_WORD: Record<string, string> = {
  es: "Ítem",
  en: "Item",
  fr: "Pièce",
  de: "Stück",
  it: "Pezzo",
  pt: "Item",
  id: "Item",
  th: "ชิ้น",
  ja: "アイテム",
  ko: "아이템",
  zh: "物品",
};

function listingRemovedText(language: string, type: string, label: string, reason: string) {
  const code = language.toLowerCase().split("-")[0];
  const word = ITEM_WORD[code] || ITEM_WORD.es;
  const itemLine = label ? `${word}: ${label}.\n` : "";
  return (LISTING_REMOVED[code] || LISTING_REMOVED.es)(type, itemLine, reason);
}

function joinParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const text = String(part || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out.join(" · ").slice(0, 220);
}

function plainVersion(value: string | null | undefined) {
  const text = String(value || "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text || text !== text.toLowerCase()) return text;
  return text.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

async function listingItem(admin: Admin, itemType: "pc" | "merch", itemId: string | number, fallback: string) {
  if (itemType === "merch") {
    const { data } = await admin.from("merch_items").select("name, group_name, album_title, album_version, category, image_url").eq("id", itemId).maybeSingle();
    const row = data as { name?: string | null; group_name?: string | null; album_title?: string | null; album_version?: string | null; category?: string | null; image_url?: string | null } | null;
    const label = joinParts([row?.name, row?.group_name, row?.album_title, plainVersion(row?.album_version), row?.category]) || fallback;
    return { label, image: row?.image_url || null };
  }
  const { data } = await admin.from("items").select("name, member, version, group_id, album_id, image_url").eq("id", itemId).maybeSingle();
  const row = data as { name?: string | null; member?: string | null; version?: string | null; group_id?: number | null; album_id?: number | null; image_url?: string | null } | null;
  if (!row) return { label: fallback, image: null };
  const member = prettyMemberLabel(row.member) || String(row.member || "").trim();
  let group = "";
  let album = "";
  if (row.group_id) {
    const found = await admin.from("groups").select("name").eq("id", row.group_id).maybeSingle();
    group = String((found.data as { name?: string } | null)?.name || "");
  }
  if (row.album_id) {
    const found = await admin.from("albums").select("name").eq("id", row.album_id).maybeSingle();
    album = plainVersion(String((found.data as { name?: string } | null)?.name || ""));
  }
  const label = joinParts([member, album, plainVersion(row.version), group]) || fallback;
  return { label, image: row.image_url || null };
}

async function notifyListingRemoved(
  admin: Admin,
  userId: string,
  listingType: "wtt" | "wts",
  itemType: "pc" | "merch",
  itemId: string | number,
  reason: string,
  fallback: string,
) {
  const { data: profile } = await admin.from("profiles").select("language").eq("user_id", userId).maybeSingle();
  const item = await listingItem(admin, itemType, itemId, fallback);
  const content = listingRemovedText(String(profile?.language || "es"), listingType.toUpperCase(), item.label, reason);
  const rawImage = item.image && (item.image.startsWith("/") || item.image.startsWith("http")) ? item.image : null;
  const image = rawImage ? resolveMockPcImageUrl(rawImage) || rawImage : null;
  const payload = {
    user_id: userId,
    sender_id: SITE_ADMIN_USER_ID,
    type: "admin_message",
    content,
    image_url: image,
    read: false,
  };
  const note = await admin.from("notifications").insert(payload);
  if (!note.error) return null;
  const retry = await admin.from("notifications").insert({
    user_id: userId,
    sender_id: SITE_ADMIN_USER_ID,
    type: "admin_message",
    content,
    read: false,
  });
  if (!retry.error) return null;
  const plain = await admin.from("notifications").insert({
    user_id: userId,
    type: "admin_message",
    content,
    read: false,
  });
  if (plain.error) return "El anuncio se ha quitado, pero no se ha podido avisar a quien lo publicó.";
  return null;
}

async function removeFanarts(admin: Admin, ids: string[]) {
  if (!ids.length) return "No hay contenido.";
  const { data: comments } = await admin.from("fanart_comments").select("id, parent_id").in("fanart_id", ids);
  const commentRows = (comments || []) as { id: string; parent_id?: string | null }[];
  const replyIds = commentRows.filter((row) => row.parent_id).map((row) => row.id);
  const rootIds = commentRows.filter((row) => !row.parent_id).map((row) => row.id);
  const commentIds = [...replyIds, ...rootIds];
  if (commentIds.length) {
    await quiet(admin.from("fanart_comment_likes").delete().in("comment_id", commentIds));
    if (replyIds.length) await quiet(admin.from("fanart_comments").delete().in("id", replyIds));
    if (rootIds.length) await quiet(admin.from("fanart_comments").delete().in("id", rootIds));
  }
  await quiet(admin.from("fanart_likes").delete().in("fanart_id", ids));
  await quiet(admin.from("fanzone_notifications").delete().in("fanart_id", ids));
  const { data: chapters } = await admin.from("capitulos").select("id").in("obra_id", ids);
  const chapterIds = (chapters || []).map((row) => String((row as { id: string }).id));
  if (chapterIds.length) {
    await quiet(admin.from("traducciones").delete().in("capitulo_id", chapterIds));
    await quiet(admin.from("capitulos").delete().in("id", chapterIds));
  }
  await quiet(admin.from("obras").delete().in("id", ids));
  const { error } = await admin.from("fanarts").delete().in("id", ids);
  if (error && !ignorable(error.message)) return error.message;
  return null;
}

async function removeComments(admin: Admin, table: string, ids: string[]) {
  if (!ids.length) return "No hay contenido.";
  await quiet(admin.from(table).delete().in("parent_id", ids));
  const { error } = await admin.from(table).delete().in("id", ids);
  if (error) return error.message;
  return null;
}

export async function adminRemoveContent(admin: Admin, body: AdminRemovalBody) {
  const kind = String(body.kind || "");
  const ids = idsOf(body);
  if (kind === "listing") {
    const reason = clip(body.reason, 500);
    if (!reason) return { ok: false as const, message: "Escribe el motivo." };
    const message = await removeListing(admin, { ...body, reason });
    if (message?.startsWith("El anuncio se ha quitado")) return { ok: true as const, noticeFailed: message };
    return message ? { ok: false as const, message } : { ok: true as const };
  }
  if (kind === "fanart" || kind === "obra") {
    const message = await removeFanarts(admin, ids);
    return message ? { ok: false as const, message } : { ok: true as const };
  }
  if (kind === "fanart_comment") {
    const message = await removeComments(admin, "fanart_comments", ids);
    return message ? { ok: false as const, message } : { ok: true as const };
  }
  if (kind === "fanzone_post") {
    if (!ids.length) return { ok: false as const, message: "No hay contenido." };
    await quiet(admin.from("fanzone_posts").delete().in("parent_id", ids));
    await quiet(admin.from("fanzone_posts").delete().in("repost_id", ids));
    const { error } = await admin.from("fanzone_posts").delete().in("id", ids);
    if (error && !ignorable(error.message)) return { ok: false as const, message: error.message };
    return { ok: true as const };
  }
  if (kind === "fanzone_comment") {
    const message = await removeComments(admin, "fanzone_comments", ids);
    if (!message) return { ok: true as const };
    if (!ignorable(message)) return { ok: false as const, message };
    const fallback = await removeComments(admin, "fanzone_posts", ids);
    if (fallback && !ignorable(fallback)) return { ok: false as const, message: fallback };
    return { ok: true as const };
  }
  if (kind === "artist_wall") {
    if (!ids.length) return { ok: false as const, message: "No hay contenido." };
    await quiet(admin.from("artist_wall").delete().in("parent_id", ids));
    await quiet(admin.from("artist_wall_likes").delete().in("post_id", ids));
    const { error } = await admin.from("artist_wall").delete().in("id", ids);
    if (error && !ignorable(error.message)) return { ok: false as const, message: error.message };
    return { ok: true as const };
  }
  if (kind === "message") {
    if (!ids.length) return { ok: false as const, message: "No hay contenido." };
    const { error } = await admin.from("notifications").delete().in("id", ids);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  }
  return { ok: false as const, message: "Ese contenido no se puede borrar desde aquí." };
}
