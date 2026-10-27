import { SITE_ADMIN_USER_ID } from "@/lib/site-admin-stock";
import { sendMail } from "@/lib/site-mail";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { applyCatalogRemoval, planCatalogRemoval, removalCounts, type RemovalPlan, type RemovalTarget } from "@/lib/catalog-removal";

const BUCKET = "catalog-private";
const PATH = "admin/catalog-removals.json";
const STOCK = ["have", "wtt", "wts", "on_its_way", "otw"];

type Admin = ReturnType<typeof createServiceRoleClient>;

export type RemovalJob = {
  id: string;
  target: RemovalTarget;
  targetId: string;
  label: string;
  executeAt: string;
  createdAt: string;
  status: "scheduled" | "done" | "cancelled";
  plan: RemovalPlan;
  holderIds: string[];
  converted: Record<string, string[]>;
  sent: Record<string, number[]>;
  notices: { n: 1 | 2 | 3; sendAt: string }[];
};

type QueueFile = { jobs: RemovalJob[] };

function chunk<T>(rows: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function readQueue(admin: Admin): Promise<QueueFile> {
  const { data, error } = await admin.storage.from(BUCKET).download(PATH);
  if (error || !data) return { jobs: [] };
  try {
    const parsed = JSON.parse(await data.text()) as QueueFile;
    return { jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [] };
  } catch {
    return { jobs: [] };
  }
}

async function writeQueue(admin: Admin, queue: QueueFile) {
  const body = Buffer.from(JSON.stringify(queue));
  const { error } = await admin.storage.from(BUCKET).upload(PATH, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

export async function listHolderIds(admin: Admin, plan: RemovalPlan) {
  const users = new Set<string>();
  for (const ids of chunk(plan.itemIds, 80)) {
    const { data, error } = await admin
      .from("user_item_statuses")
      .select("user_id, qty, status")
      .in("item_id", ids)
      .in("status", STOCK);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const qty = row.qty == null ? 1 : Number(row.qty);
      if (qty > 0) users.add(String(row.user_id));
    }
    const slots = await admin.from("page_slots").select("page_id").in("item_id", ids);
    if (slots.error) throw new Error(slots.error.message);
    const pageIds = [...new Set((slots.data ?? []).map((row) => Number(row.page_id)).filter((id) => id > 0))];
    for (const pages of chunk(pageIds, 80)) {
      const pageRows = await admin.from("binder_pages").select("binder_id").in("id", pages);
      if (pageRows.error) throw new Error(pageRows.error.message);
      const binderIds = [...new Set((pageRows.data ?? []).map((row) => Number(row.binder_id)).filter((id) => id > 0))];
      if (!binderIds.length) continue;
      const binders = await admin.from("binders").select("user_id").in("id", binderIds);
      if (binders.error) throw new Error(binders.error.message);
      for (const row of binders.data ?? []) if (row.user_id) users.add(String(row.user_id));
    }
  }
  for (const ids of chunk(plan.merchIds, 80)) {
    const { data, error } = await admin
      .from("user_merch_statuses")
      .select("user_id, qty, status")
      .in("merch_id", ids)
      .in("status", STOCK);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const qty = row.qty == null ? 1 : Number(row.qty);
      if (qty > 0) users.add(String(row.user_id));
    }
  }
  return [...users];
}

export function parseRemovalDate(raw: string) {
  const day = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Elige la fecha de borrado.");
  const executeAt = new Date(`${day}T08:00:00.000Z`);
  if (Number.isNaN(executeAt.getTime())) throw new Error("Elige la fecha de borrado.");
  if (executeAt.getTime() < Date.now() + 3 * 24 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000) {
    throw new Error("La fecha tiene que ser al menos dentro de 3 días, para poder avisar tres veces.");
  }
  return executeAt;
}

function noticeTimes(executeAt: Date) {
  const start = Date.now();
  const end = executeAt.getTime();
  const mid = start + (end - start) / 2;
  let last = end - 24 * 60 * 60 * 1000;
  if (last <= mid) last = mid + 60 * 60 * 1000;
  return [
    { n: 1 as const, sendAt: new Date(start).toISOString() },
    { n: 2 as const, sendAt: new Date(mid).toISOString() },
    { n: 3 as const, sendAt: new Date(last).toISOString() },
  ];
}

export async function scheduleCatalogRemoval(admin: Admin, target: RemovalTarget, id: string, executeAt: Date) {
  const plan = await planCatalogRemoval(admin, target, id);
  const holderIds = await listHolderIds(admin, plan);
  if (!holderIds.length) {
    await applyCatalogRemoval(admin, plan);
    return { scheduled: false as const, holders: 0, ...removalCounts(plan) };
  }
  const queue = await readQueue(admin);
  const pending = queue.jobs.find((job) => job.status === "scheduled" && job.target === target && job.targetId === id);
  if (pending) throw new Error("Eso ya tiene un borrado programado.");
  const job: RemovalJob = {
    id: crypto.randomUUID(),
    target,
    targetId: id,
    label: plan.label,
    executeAt: executeAt.toISOString(),
    createdAt: new Date().toISOString(),
    status: "scheduled",
    plan,
    holderIds,
    converted: {},
    sent: {},
    notices: noticeTimes(executeAt),
  };
  queue.jobs.push(job);
  await writeQueue(admin, queue);
  await deliverDueNotices(admin, job.id);
  return { scheduled: true as const, holders: holderIds.length, executeAt: job.executeAt, ...removalCounts(plan) };
}

function personalImageUrl(url: string | null, token: string) {
  const value = String(url || "").trim();
  if (!value) return null;
  return `${value}${value.includes("?") ? "&" : "?"}personal=${token}`;
}

function pieceKey(kind: "item" | "merch", id: string | number) {
  return `${kind}:${id}`;
}

function userStillHolding(job: RemovalJob, userId: string) {
  const done = new Set(job.converted[userId] || []);
  const items = job.plan.itemIds.some((id) => !done.has(pieceKey("item", id)));
  const merch = job.plan.merchIds.some((id) => !done.has(pieceKey("merch", id)));
  return items || merch;
}

function dateLabel(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang.startsWith("en") ? "en" : "es", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });
}

function noticeText(n: number, label: string, when: string, lang: string) {
  if (lang.startsWith("en")) {
    return {
      subject: `Notice ${n}/3: “${label}” leaves the catalog on ${when}`,
      text: [
        `On ${when} we will remove “${label}” from the My K-pop Binder catalog.`,
        "If you keep it in your stock or in a binder, open the library or merch and press “Make it personal” before that date. The photo and your quantity stay with you.",
        "Sale and trade listings for that piece will close.",
        `This is notice ${n} of 3.`,
      ].join("\n\n"),
    };
  }
  return {
    subject: `Aviso ${n}/3: «${label}» sale del catálogo el ${when}`,
    text: [
      `El ${when} quitaremos «${label}» del catálogo de My K-pop Binder.`,
      "Si lo tienes en el stock o en un binder, entra en la biblioteca o en merch y pulsa «Convertir en personalizada» antes de esa fecha. Te quedas la foto y tu cantidad.",
      "Los anuncios de venta o cambio de esa pieza se cerrarán.",
      `Este es el aviso ${n} de 3.`,
    ].join("\n\n"),
  };
}

async function deliverDueNotices(admin: Admin, onlyJobId?: string) {
  const queue = await readQueue(admin);
  const now = Date.now();
  for (const job of queue.jobs) {
    if (job.status !== "scheduled") continue;
    if (onlyJobId && job.id !== onlyJobId) continue;
    const due = job.notices.filter((notice) => Date.parse(notice.sendAt) <= now);
    if (!due.length) continue;
    const langByUser = new Map<string, string>();
    for (const ids of chunk(job.holderIds, 200)) {
      const langs = await admin.from("profiles").select("user_id, language").in("user_id", ids);
      for (const row of langs.data ?? []) langByUser.set(String(row.user_id), String(row.language || "es"));
    }
    let dirty = 0;
    for (const notice of due) {
      for (const userId of job.holderIds) {
        if (!userStillHolding(job, userId)) continue;
        const already = job.sent[userId] || [];
        if (already.includes(notice.n)) continue;
        const lang = langByUser.get(userId) || "es";
        const copy = noticeText(notice.n, job.label, dateLabel(job.executeAt, lang), lang);
        const note = await admin.from("notifications").insert({
          user_id: userId,
          sender_id: SITE_ADMIN_USER_ID,
          type: "admin_message",
          content: copy.text,
          read: false,
          metadata: { catalog_removal_id: job.id, execute_at: job.executeAt, notice: notice.n },
        });
        if (note.error) {
          const retry = await admin.from("notifications").insert({
            user_id: userId,
            sender_id: SITE_ADMIN_USER_ID,
            type: "admin_message",
            content: copy.text,
            read: false,
          });
          if (retry.error) continue;
        }
        try {
          const authUser = await admin.auth.admin.getUserById(userId);
          const email = authUser.data.user?.email;
          if (email) await sendMail({ to: email, subject: copy.subject, text: copy.text });
        } catch {
          /* the in-app notice is already there; the next run does not repeat it */
        }
        job.sent[userId] = [...already, notice.n];
        dirty += 1;
        if (dirty >= 10) {
          await writeQueue(admin, queue);
          dirty = 0;
        }
      }
    }
    if (dirty) await writeQueue(admin, queue);
  }
}

export async function runDueCatalogRemovals(admin: Admin) {
  await deliverDueNotices(admin);
  const queue = await readQueue(admin);
  const now = Date.now();
  for (const job of queue.jobs) {
    if (job.status !== "scheduled") continue;
    if (Date.parse(job.executeAt) > now) continue;
    await applyCatalogRemoval(admin, job.plan);
    job.status = "done";
  }
  await writeQueue(admin, queue);
  return queue.jobs.filter((job) => job.status === "scheduled").length;
}

export async function cancelCatalogRemoval(admin: Admin, jobId: string) {
  const queue = await readQueue(admin);
  const job = queue.jobs.find((row) => row.id === jobId && row.status === "scheduled");
  if (!job) throw new Error("Ese borrado ya no está pendiente.");
  job.status = "cancelled";
  await writeQueue(admin, queue);
  return { label: job.label };
}

export async function scheduledRemovalSummaries(admin: Admin) {
  const queue = await readQueue(admin);
  return queue.jobs
    .filter((job) => job.status === "scheduled")
    .map((job) => ({
      id: job.id,
      label: job.label,
      executeAt: job.executeAt,
      holders: job.holderIds.length,
      target: job.target,
    }));
}

export async function removalsForUser(admin: Admin, userId: string) {
  const queue = await readQueue(admin);
  const items: { id: number; label: string; executeAt: string }[] = [];
  const merch: { id: string; label: string; executeAt: string }[] = [];
  for (const job of queue.jobs) {
    if (job.status !== "scheduled" || !job.holderIds.includes(userId)) continue;
    const done = new Set(job.converted[userId] || []);
    for (const id of job.plan.itemIds) {
      if (!done.has(pieceKey("item", id))) items.push({ id, label: job.label, executeAt: job.executeAt });
    }
    for (const id of job.plan.merchIds) {
      if (!done.has(pieceKey("merch", id))) merch.push({ id, label: job.label, executeAt: job.executeAt });
    }
  }
  return { items, merch };
}

export async function convertHeldPiece(admin: Admin, userId: string, kind: "item" | "merch", rawId: string) {
  const queue = await readQueue(admin);
  const key = pieceKey(kind, rawId);
  const job = queue.jobs.find((row) => {
    if (row.status !== "scheduled" || !row.holderIds.includes(userId)) return false;
    return kind === "item" ? row.plan.itemIds.includes(Number(rawId)) : row.plan.merchIds.includes(rawId);
  });
  if (!job) throw new Error("Esa pieza no está pendiente de borrado.");
  const done = new Set(job.converted[userId] || []);
  if (done.has(key)) return { ok: true, already: true };

  const foldTradeQty = async (
    table: "user_item_statuses" | "user_merch_statuses",
    idColumn: "item_id" | "merch_id",
    oldId: string | number,
    newId: string | number,
  ) => {
    const existing = await admin.from(table).select("status, qty").eq("user_id", userId).eq(idColumn, oldId);
    if (existing.error) throw new Error(existing.error.message);
    const tradeQty = (existing.data ?? [])
      .filter((row) => row.status === "wtt" || row.status === "wts")
      .reduce((sum, row) => sum + (Number(row.qty) || 0), 0);
    const removed = await admin.from(table).delete().eq("user_id", userId).eq(idColumn, oldId).in("status", ["wtt", "wts"]);
    if (removed.error) throw new Error(removed.error.message);
    const moved = await admin.from(table).update({ [idColumn]: newId }).eq("user_id", userId).eq(idColumn, oldId);
    if (moved.error) throw new Error(moved.error.message);
    if (tradeQty <= 0) return;
    const have = await admin.from(table).select("qty").eq("user_id", userId).eq(idColumn, newId).eq("status", "have").maybeSingle();
    if (have.error) throw new Error(have.error.message);
    if (have.data) {
      const updated = await admin
        .from(table)
        .update({ qty: (Number(have.data.qty) || 0) + tradeQty })
        .eq("user_id", userId)
        .eq(idColumn, newId)
        .eq("status", "have");
      if (updated.error) throw new Error(updated.error.message);
      return;
    }
    const inserted = await admin.from(table).insert({ user_id: userId, [idColumn]: newId, status: "have", qty: tradeQty });
    if (inserted.error) throw new Error(inserted.error.message);
  };

  if (kind === "item") {
    const itemId = Number(rawId);
    const { data: item, error } = await admin
      .from("items")
      .select("id, group_id, album_id, type, member, member_id, name, image_url, back_image_url")
      .eq("id", itemId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("Esa ficha ya no está.");
    const token = crypto.randomUUID();
    const copy = await admin
      .from("items")
      .insert({
        group_id: item.group_id,
        album_id: item.album_id,
        type: item.type,
        member: item.member,
        member_id: item.member_id,
        version: "personal",
        name: item.name,
        image_url: personalImageUrl(item.image_url, token),
        back_image_url: personalImageUrl(item.back_image_url, token),
      })
      .select("id")
      .maybeSingle();
    if (copy.error || !copy.data) throw new Error(copy.error?.message || "No se pudo crear la pieza personalizada.");
    const newId = Number(copy.data.id);
    await foldTradeQty("user_item_statuses", "item_id", itemId, newId);
    const binders = await admin.from("binders").select("id").eq("user_id", userId);
    const binderIds = (binders.data ?? []).map((row) => Number(row.id));
    if (binderIds.length) {
      const pages = await admin.from("binder_pages").select("id").in("binder_id", binderIds);
      const pageIds = (pages.data ?? []).map((row) => Number(row.id));
      for (const ids of chunk(pageIds, 80)) {
        const slots = await admin.from("page_slots").select("id, face").in("page_id", ids).eq("item_id", itemId);
        for (const slot of slots.data ?? []) {
          const back = String(slot.face || "") === "back";
          await admin.from("page_slots").update({
            is_custom: true,
            item_id: null,
            custom_image_url: back ? item.back_image_url || item.image_url : item.image_url,
            custom_back_image_url: back ? item.image_url : item.back_image_url,
          }).eq("id", slot.id);
        }
      }
    }
  } else {
    const { data: merch, error } = await admin.from("merch_items").select("*").eq("id", rawId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!merch) throw new Error("Esa pieza ya no está.");
    const token = crypto.randomUUID();
    const copy = await admin
      .from("merch_items")
      .insert({
        name: merch.name,
        category: merch.category,
        group_name: merch.group_name,
        image_url: personalImageUrl(merch.image_url, token),
        rarity: merch.rarity,
        album_title: merch.album_title,
        album_type: merch.album_type,
        album_version: "personal",
      })
      .select("id")
      .maybeSingle();
    if (copy.error || !copy.data) throw new Error(copy.error?.message || "No se pudo crear la pieza personalizada.");
    await foldTradeQty("user_merch_statuses", "merch_id", rawId, copy.data.id);
  }

  done.add(key);
  job.converted[userId] = [...done];
  await writeQueue(admin, queue);
  return { ok: true, already: false };
}
