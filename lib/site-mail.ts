import { timingSafeEqual } from "crypto";
import { simpleParser, type AddressObject } from "mailparser";
import { Resend } from "resend";
import { SITE_ADMIN_EMAIL } from "@/lib/admin-emails";
import { createServiceRoleClient } from "@/lib/supabase-admin";

const ACCOUNT = SITE_ADMIN_EMAIL;
const LIST_LIMIT = 40;

export type MailSummary = {
  uid: string;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  seen: boolean;
};

export type MailMessage = MailSummary & {
  text: string;
  html: string;
  messageId: string;
};

export type MailFolder = {
  path: string;
  name: string;
  parentPath: string;
  specialUse: string;
  delimiter: string;
  selectable: boolean;
};

type EmailRow = {
  id: string;
  direction: string;
  folder: string;
  sender: string;
  recipient: string;
  subject: string;
  body_text: string;
  html_body: string;
  message_id: string | null;
  in_reply_to: string | null;
  seen: boolean;
  created_at: string;
};

const SYSTEM: MailFolder[] = [
  { path: "inbox", name: "inbox", parentPath: "", specialUse: "\\Inbox", delimiter: "/", selectable: true },
  { path: "sent", name: "sent", parentPath: "", specialUse: "\\Sent", delimiter: "/", selectable: true },
  { path: "archive", name: "archive", parentPath: "", specialUse: "\\Archive", delimiter: "/", selectable: true },
  { path: "trash", name: "trash", parentPath: "", specialUse: "\\Trash", delimiter: "/", selectable: true },
];

const SYSTEM_PATHS = new Set(SYSTEM.map((folder) => folder.path));

function db() {
  return createServiceRoleClient();
}

export function mailAccount() {
  return { user: ACCOUNT, configured: true };
}

export function normalizeBox(value: string) {
  const box = value.trim();
  if (!box || box.toUpperCase() === "INBOX") return "inbox";
  return box.slice(0, 200);
}

function summary(row: EmailRow): MailSummary {
  return {
    uid: String(row.id),
    subject: row.subject || "(sin asunto)",
    from: row.sender || "",
    to: row.recipient || "",
    date: row.created_at || null,
    seen: Boolean(row.seen),
  };
}

function sanitizeMailHtml(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|form|base|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|form|base|svg)\b[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, " $1=\"#\"")
    .slice(0, 500_000);
}

function addressText(value: AddressObject | AddressObject[] | undefined) {
  if (!value) return "";
  if (Array.isArray(value)) return value.map((item) => item.text || "").filter(Boolean).join(", ");
  return value.text || "";
}

function cleanFolderName(name: string) {
  const clean = name.replace(/[\\/\0]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!clean) throw new Error("BAD_NAME");
  return clean;
}

async function customFolders(): Promise<MailFolder[]> {
  const { data, error } = await db().from("email_folders").select("path, parent_path").order("path");
  if (error) throw new Error(error.message);
  return ((data || []) as Array<{ path: string; parent_path: string }>).map((row) => ({
    path: row.path,
    name: row.path.split("/").pop() || row.path,
    parentPath: row.parent_path || "",
    specialUse: "",
    delimiter: "/",
    selectable: true,
  }));
}

export async function listFolders(): Promise<MailFolder[]> {
  return [...SYSTEM, ...(await customFolders())];
}

async function assertFolder(path: string) {
  if (SYSTEM_PATHS.has(path)) return;
  const folders = await customFolders();
  if (!folders.some((folder) => folder.path === path)) throw new Error("BAD_FOLDER");
}

export async function listMailbox(boxInput: string) {
  const box = normalizeBox(boxInput);
  const folders = await listFolders();
  const { data, error } = await db()
    .from("emails")
    .select("id, direction, folder, sender, recipient, subject, seen, created_at")
    .eq("folder", box)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(error.message);
  return {
    user: ACCOUNT,
    box,
    folders,
    messages: ((data || []) as EmailRow[]).map(summary),
  };
}

export async function countUnseen() {
  const { count, error } = await db()
    .from("emails")
    .select("id", { count: "exact", head: true })
    .eq("folder", "inbox")
    .eq("seen", false);
  if (error) throw new Error(error.message);
  return count || 0;
}

export async function readMessage(uid: string): Promise<MailMessage | null> {
  const { data, error } = await db().from("emails").select("*").eq("id", uid).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as EmailRow;
  if (!row.seen) {
    await db().from("emails").update({ seen: true }).eq("id", uid);
  }
  return {
    ...summary({ ...row, seen: true }),
    text: row.body_text || "",
    html: row.html_body ? sanitizeMailHtml(row.html_body) : "",
    messageId: row.message_id || "",
  };
}

export async function moveMessage(uid: string, destinationInput: string) {
  const destination = normalizeBox(destinationInput);
  await assertFolder(destination);
  const { error } = await db().from("emails").update({ folder: destination }).eq("id", uid);
  if (error) throw new Error(error.message);
}

export async function archiveMessage(uid: string) {
  await moveMessage(uid, "archive");
}

export async function deleteMessage(uid: string, boxInput: string) {
  const box = normalizeBox(boxInput);
  if (box === "trash") {
    const { error } = await db().from("emails").delete().eq("id", uid);
    if (error) throw new Error(error.message);
    return;
  }
  await moveMessage(uid, "trash");
}

export async function createFolder(parentInput: string, nameInput: string) {
  const name = cleanFolderName(nameInput);
  const parent = parentInput.trim() ? normalizeBox(parentInput) : "";
  if (parent) await assertFolder(parent);
  const path = parent ? `${parent}/${name}` : name;
  if (SYSTEM_PATHS.has(path.toLowerCase()) || path.length > 180) throw new Error("BAD_NAME");
  const { error } = await db().from("email_folders").insert({ path, parent_path: parent });
  if (error) {
    if (error.code === "23505") return;
    throw new Error(error.message);
  }
}

export async function deleteFolder(pathInput: string) {
  const path = normalizeBox(pathInput);
  if (SYSTEM_PATHS.has(path)) throw new Error("PROTECTED_FOLDER");
  const folders = await customFolders();
  if (folders.some((folder) => folder.path.startsWith(`${path}/`))) throw new Error("FOLDER_HAS_CHILDREN");
  if (!folders.some((folder) => folder.path === path)) throw new Error("BAD_FOLDER");
  const removed = await db().from("emails").delete().eq("folder", path);
  if (removed.error) throw new Error(removed.error.message);
  const { error } = await db().from("email_folders").delete().eq("path", path);
  if (error) throw new Error(error.message);
}

function recipients(value: string) {
  const to = value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!to.length || to.length > 10 || to.some((address) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))) {
    throw new Error("BAD_RECIPIENT");
  }
  return to;
}

export async function sendMail(input: { to: string; subject: string; text: string; inReplyTo?: string }) {
  const to = recipients(input.to);
  const subject = input.subject.replace(/[\r\n\0]/g, "").trim().slice(0, 200) || "(sin asunto)";
  const text = input.text.replace(/\0/g, "").trim().slice(0, 20_000);
  if (!text) throw new Error("EMPTY_BODY");
  const inReplyTo = input.inReplyTo?.replace(/[\r\n\0]/g, "").trim().slice(0, 500) || "";

  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) throw new Error("MISSING_RESEND");
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: `MyKpopBinder <${ACCOUNT}>`,
    to,
    subject,
    text,
    headers: inReplyTo ? { "In-Reply-To": inReplyTo, References: inReplyTo } : undefined,
  });
  if (error) throw new Error(`RESEND:${error.message || "rejected"}`);

  const saved = await db().from("emails").insert({
    direction: "outgoing",
    folder: "sent",
    sender: `My K-pop Binder <${ACCOUNT}>`,
    recipient: to.join(", "),
    subject,
    body_text: text,
    html_body: "",
    message_id: data?.id ? `<${data.id}@resend>` : null,
    in_reply_to: inReplyTo || null,
    seen: true,
  });
  if (saved.error) throw new Error("SENT_NOT_SAVED");
}

export function inboundAuthorized(header: string | null, secret: string) {
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const left = Buffer.from(token);
  const right = Buffer.from(secret);
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function storeIncoming(raw: Buffer, envelopeTo: string, truncated: boolean) {
  const mail = await simpleParser(raw);
  const messageId = (mail.messageId || "").replace(/[\r\n\0]/g, "").trim().slice(0, 500);
  const to = addressText(mail.to) || envelopeTo || ACCOUNT;
  const recipient = `${to} ${envelopeTo}`.toLowerCase();
  if (!recipient.includes("@mykpopbinder.com")) throw new Error("FOREIGN_RECIPIENT");

  let text = (mail.text || "").replace(/\0/g, "").slice(0, 200_000);
  if (truncated) {
    text = `${text}\n\n[Este mensaje era demasiado grande y se ha guardado incompleto.]`.trim();
  }
  const html = typeof mail.html === "string" ? sanitizeMailHtml(mail.html) : "";
  const createdAt = mail.date && !Number.isNaN(mail.date.getTime()) ? mail.date.toISOString() : new Date().toISOString();
  const inserted = await db().from("emails").insert({
    direction: "incoming",
    folder: "inbox",
    sender: (mail.from?.text || "").slice(0, 500),
    recipient: to.slice(0, 500),
    subject: (mail.subject || "(sin asunto)").replace(/[\r\n\0]/g, "").trim().slice(0, 500) || "(sin asunto)",
    body_text: text,
    html_body: html,
    message_id: messageId || null,
    in_reply_to: (typeof mail.inReplyTo === "string" ? mail.inReplyTo : "").slice(0, 500) || null,
    seen: false,
    created_at: createdAt,
  });
  if (inserted.error && inserted.error.code !== "23505") throw new Error(inserted.error.message);
}

export function publicMailError(err: unknown): { status: number; error: string } {
  const message = err instanceof Error ? err.message : "";
  if (message === "BAD_RECIPIENT") return { status: 400, error: "El destinatario no es un correo válido." };
  if (message === "EMPTY_BODY") return { status: 400, error: "Escribe el mensaje antes de enviarlo." };
  if (message === "BAD_FOLDER") return { status: 400, error: "Esa carpeta no existe." };
  if (message === "BAD_NAME") return { status: 400, error: "El nombre de la carpeta no es válido." };
  if (message === "PROTECTED_FOLDER") return { status: 400, error: "Esa carpeta del buzón no se puede borrar." };
  if (message === "FOLDER_HAS_CHILDREN") return { status: 400, error: "Borra primero las subcarpetas." };
  if (message === "MISSING_RESEND") return { status: 503, error: "Falta RESEND_API_KEY en el servidor." };
  if (message === "SENT_NOT_SAVED") return { status: 502, error: "El mensaje ha salido, pero no se ha guardado en Enviados." };
  if (message.startsWith("RESEND:")) {
    return { status: 502, error: `No se ha podido enviar. ${message.slice(7).slice(0, 180)}` };
  }
  if (/emails|email_folders|schema cache|does not exist/i.test(message)) {
    return { status: 503, error: "Falta crear la tabla de correo en Supabase." };
  }
  return { status: 502, error: "No se ha podido completar la acción en el correo." };
}
