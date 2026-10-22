import { timingSafeEqual } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { simpleParser, type AddressObject } from "mailparser";
import { Resend } from "resend";
import { SITE_ADMIN_EMAIL } from "@/lib/admin-emails";
import { createServiceRoleClient } from "@/lib/supabase-admin";

const ACCOUNT = SITE_ADMIN_EMAIL;
const LIST_LIMIT = 40;
const SIGNATURE_URL = "https://www.mykpopbinder.com/branding/mailing/signature.jpg";
const SIGNATURE_TEXT = [
  "",
  "--",
  "STAFF M.K.B.",
  "Collect · Trade · Connect",
  "Instagram: @mykpopbinder",
  "https://www.mykpopbinder.com",
  ACCOUNT,
].join("\n");

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mailHtml(text: string, imageSrc: string) {
  const img = `<img src="${imageSrc}" alt="STAFF M.K.B. Collect · Trade · Connect" width="280" style="width:280px;max-width:100%;height:auto;border:0;display:block;" />`;
  return `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.5;color:#2a2440;white-space:pre-wrap;">${escapeHtml(text)}</div><p style="margin:28px 0 0;">${img}</p>`;
}

function signatureFile() {
  return readFileSync(join(process.cwd(), "public/branding/mailing/signature.jpg"));
}

export type MailSummary = {
  uid: string;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  seen: boolean;
  files: number;
};

export type MailFile = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  base64: string;
};

export type MailMessage = MailSummary & {
  text: string;
  html: string;
  messageId: string;
  attachments: MailFile[];
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
  email_attachments?: { id: string }[] | null;
};

type AttachmentRow = {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  content_base64: string;
  cid: string;
};

const MAX_STORED_FILES = 12;
const MAX_STORED_BYTES = 16_000_000;

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
    files: Array.isArray(row.email_attachments) ? row.email_attachments.length : 0,
  };
}

function missingAttachmentsTable(message: string) {
  return /email_attachments|schema cache|relationship/i.test(message);
}

function attachmentName(filename: string, contentType: string, index: number) {
  const raw = filename.split(/[/\\]/).pop()?.replace(/[\r\n\0"]/g, "").trim() || "";
  if (raw) return raw.slice(0, 120);
  const ext = contentType.split("/")[1]?.split(";")[0]?.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  return `adjunto-${index + 1}.${ext}`;
}

async function persistAttachments(
  emailId: string,
  files: { filename?: string; contentType?: string; content: Buffer; cid?: string }[],
) {
  let total = 0;
  const rows: Array<{
    email_id: string;
    filename: string;
    content_type: string;
    size_bytes: number;
    content_base64: string;
    cid: string;
  }> = [];
  for (const file of files) {
    if (!file.content?.length || rows.length >= MAX_STORED_FILES) continue;
    if (total + file.content.length > MAX_STORED_BYTES) break;
    total += file.content.length;
    const contentType = (file.contentType || "application/octet-stream").slice(0, 160);
    rows.push({
      email_id: emailId,
      filename: attachmentName(file.filename || "", contentType, rows.length),
      content_type: contentType,
      size_bytes: file.content.length,
      content_base64: file.content.toString("base64"),
      cid: (file.cid || "").replace(/^<|>$/g, "").slice(0, 300),
    });
  }
  if (!rows.length) return;
  const { error } = await db().from("email_attachments").insert(rows);
  if (error && !missingAttachmentsTable(error.message)) throw new Error(error.message);
}

function embedCid(html: string, files: AttachmentRow[]) {
  let next = html;
  for (const file of files) {
    if (!file.cid || !file.content_base64) continue;
    const data = `data:${file.content_type || "application/octet-stream"};base64,${file.content_base64}`;
    next = next.split(`cid:${file.cid}`).join(data);
  }
  return next;
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
  const columns = "id, direction, folder, sender, recipient, subject, seen, created_at";
  const withFiles = await db()
    .from("emails")
    .select(`${columns}, email_attachments(id)`)
    .eq("folder", box)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  const listed = withFiles.error && missingAttachmentsTable(withFiles.error.message)
    ? await db().from("emails").select(columns).eq("folder", box).order("created_at", { ascending: false }).limit(LIST_LIMIT)
    : withFiles;
  if (listed.error) throw new Error(listed.error.message);
  return {
    user: ACCOUNT,
    box,
    folders,
    messages: ((listed.data || []) as EmailRow[]).map(summary),
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
  const filesQuery = await db()
    .from("email_attachments")
    .select("id, filename, content_type, size_bytes, content_base64, cid")
    .eq("email_id", uid);
  if (filesQuery.error && !missingAttachmentsTable(filesQuery.error.message)) throw new Error(filesQuery.error.message);
  const fileRows = (filesQuery.error ? [] : filesQuery.data || []) as AttachmentRow[];
  const html = row.html_body ? embedCid(sanitizeMailHtml(row.html_body), fileRows) : "";
  return {
    ...summary({ ...row, seen: true }),
    files: fileRows.length,
    text: row.body_text || "",
    html,
    messageId: row.message_id || "",
    attachments: fileRows.map((file) => ({
      id: file.id,
      filename: file.filename,
      contentType: file.content_type,
      size: file.size_bytes,
      base64: file.content_base64,
    })),
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

export async function deleteMessages(uids: string[], boxInput: string) {
  const ids = [...new Set(uids)].slice(0, 40);
  if (!ids.length) return;
  const box = normalizeBox(boxInput);
  if (box === "trash") {
    const { error } = await db().from("emails").delete().in("id", ids);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await db().from("emails").update({ folder: "trash" }).in("id", ids);
  if (error) throw new Error(error.message);
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

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}) {
  const to = recipients(input.to);
  const subject = input.subject.replace(/[\r\n\0]/g, "").trim().slice(0, 200) || "(sin asunto)";
  const text = input.text.replace(/\0/g, "").trim().slice(0, 20_000);
  const files = (input.attachments || []).slice(0, 8);
  if (!text && !files.length) throw new Error("EMPTY_BODY");
  const message = text || "Te envío los archivos adjuntos.";
  const inReplyTo = input.inReplyTo?.replace(/[\r\n\0]/g, "").trim().slice(0, 500) || "";
  const attached = files.length ? `\n\nAdjuntos: ${files.map((file) => file.filename).join(", ")}` : "";

  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) throw new Error("MISSING_RESEND");
  const plain = `${message}${attached}${SIGNATURE_TEXT}`;
  let image: Buffer | null = null;
  try {
    image = signatureFile();
  } catch {
    image = null;
  }
  const html = mailHtml(`${message}${attached}`, image ? "cid:staff-signature" : SIGNATURE_URL);
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: `MyKpopBinder <${ACCOUNT}>`,
    to,
    subject,
    text: plain,
    html,
    attachments: [
      ...(image ? [{ filename: "signature.jpg", content: image, contentType: "image/jpeg", contentId: "staff-signature" }] : []),
      ...files.map((file) => ({ filename: file.filename, content: file.content, contentType: file.contentType })),
    ],
    headers: inReplyTo ? { "In-Reply-To": inReplyTo, References: inReplyTo } : undefined,
  });
  if (error) throw new Error(`RESEND:${error.message || "rejected"}`);

  const saved = await db().from("emails").insert({
    direction: "outgoing",
    folder: "sent",
    sender: `My K-pop Binder <${ACCOUNT}>`,
    recipient: to.join(", "),
    subject,
    body_text: plain,
    html_body: mailHtml(`${message}${attached}`, SIGNATURE_URL),
    message_id: data?.id ? `<${data.id}@resend>` : null,
    in_reply_to: inReplyTo || null,
    seen: true,
  }).select("id").maybeSingle();
  if (saved.error || !saved.data) throw new Error("SENT_NOT_SAVED");
  await persistAttachments(saved.data.id, files.map((file) => ({
    filename: file.filename,
    contentType: file.contentType,
    content: file.content,
  })));
}

export function inboundAuthorized(header: string | null, secret: string) {
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const left = Buffer.from(token);
  const right = Buffer.from(secret);
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function storeIncoming(raw: Buffer, envelopeTo: string) {
  const mail = await simpleParser(raw);
  const messageId = (mail.messageId || "").replace(/[\r\n\0]/g, "").trim().slice(0, 500);
  const to = addressText(mail.to) || envelopeTo || ACCOUNT;
  const recipient = `${to} ${envelopeTo}`.toLowerCase();
  if (!recipient.includes("@mykpopbinder.com")) throw new Error("FOREIGN_RECIPIENT");

  let text = (mail.text || "").replace(/\0/g, "").slice(0, 200_000);
  const parsedFiles = (mail.attachments || []).map((file) => ({
    filename: file.filename || "",
    contentType: file.contentType || "application/octet-stream",
    content: file.content,
    cid: file.cid,
  })).filter((file) => file.content?.length);
  if (!text.trim() && parsedFiles.length) {
    text = `Adjuntos: ${parsedFiles.map((file, index) => attachmentName(file.filename, file.contentType, index)).join(", ")}`;
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
  }).select("id").maybeSingle();
  if (inserted.error?.code === "23505") {
    if (!messageId || !parsedFiles.length) return;
    const existing = await db().from("emails").select("id").eq("message_id", messageId).eq("direction", "incoming").maybeSingle();
    if (!existing.data?.id) return;
    const already = await db().from("email_attachments").select("id").eq("email_id", existing.data.id).limit(1);
    if (already.error || already.data?.length) return;
    await persistAttachments(existing.data.id, parsedFiles);
    return;
  }
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message || "No se ha podido guardar el correo.");
  if (parsedFiles.length) await persistAttachments(inserted.data.id, parsedFiles);
}

const MAX_INBOUND_BYTES = 18_000_000;

export async function storeInboundChunk(input: {
  uploadId: string;
  seq: number;
  parts: number;
  totalBytes: number;
  envelopeTo: string;
  bytes: Buffer;
}) {
  if (
    !/^[0-9a-f-]{36}$/i.test(input.uploadId) ||
    input.parts < 2 ||
    input.parts > 12 ||
    input.seq < 0 ||
    input.seq >= input.parts ||
    input.totalBytes > MAX_INBOUND_BYTES ||
    input.bytes.length > 3_000_000
  ) {
    throw new Error("TOO_BIG");
  }
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await db().from("email_inbound_chunks").delete().lt("created_at", cutoff);
  const saved = await db().from("email_inbound_chunks").upsert({
    upload_id: input.uploadId,
    seq: input.seq,
    parts: input.parts,
    total_bytes: input.totalBytes,
    envelope_to: input.envelopeTo.slice(0, 500),
    content_base64: input.bytes.toString("base64"),
  }, { onConflict: "upload_id,seq" });
  if (saved.error) {
    if (missingAttachmentsTable(saved.error.message) || /email_inbound_chunks/i.test(saved.error.message)) {
      throw new Error("MISSING_CHUNKS");
    }
    throw new Error(saved.error.message);
  }
  const listed = await db()
    .from("email_inbound_chunks")
    .select("seq, content_base64")
    .eq("upload_id", input.uploadId);
  if (listed.error) throw new Error(listed.error.message);
  const rows = (listed.data || []) as Array<{ seq: number; content_base64: string }>;
  if (rows.length < input.parts) return;
  const raw = Buffer.concat(rows.sort((a, b) => a.seq - b.seq).map((row) => Buffer.from(row.content_base64, "base64")));
  await db().from("email_inbound_chunks").delete().eq("upload_id", input.uploadId);
  await storeIncoming(raw, input.envelopeTo);
}

export function publicMailError(err: unknown): { status: number; error: string } {
  const message = err instanceof Error ? err.message : "";
  if (message === "BAD_RECIPIENT") return { status: 400, error: "El destinatario no es un correo válido." };
  if (message === "EMPTY_BODY") return { status: 400, error: "Escribe el mensaje antes de enviarlo." };
  if (message === "TOO_BIG") return { status: 413, error: "Los adjuntos pesan demasiado." };
  if (message === "MISSING_CHUNKS") return { status: 503, error: "Falta la tabla de adjuntos grandes en Supabase." };
  if (message === "TOO_MANY") return { status: 400, error: "Puedes adjuntar hasta 8 archivos." };
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
