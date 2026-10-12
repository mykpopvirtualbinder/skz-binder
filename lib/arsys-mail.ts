import { ImapFlow, type FetchMessageObject, type ListResponse } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

const IMAP_HOST = "imap.serviciodecorreo.es";
const IMAP_PORT = 993;
const SMTP_HOST = "smtp.serviciodecorreo.es";
const SMTP_PORT = 465;
const DEFAULT_USER = "info@mykpopbinder.com";
const LIST_LIMIT = 30;
const SOURCE_MAX = 400_000;
const FOLDER_TTL = 60_000;
const LIST_TTL = 12_000;
const POOL_IDLE = 50_000;

export type MailSummary = {
  uid: number;
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

type MailAuth = { user: string; pass: string };

type Pool = {
  client: ImapFlow;
  user: string;
  chain: Promise<unknown>;
  timer: ReturnType<typeof setTimeout> | null;
};

let pool: Pool | null = null;
let connecting: Promise<ImapFlow> | null = null;
let folderCache: { at: number; folders: MailFolder[] } | null = null;
const listCache = new Map<string, { at: number; messages: MailSummary[] }>();
let unseenCache: { at: number; value: number } | null = null;

export function mailAccount() {
  const user = (process.env.ARSYS_MAIL_USER || DEFAULT_USER).trim() || DEFAULT_USER;
  const pass = (process.env.ARSYS_MAIL_PASSWORD || "").trim();
  return { user, configured: pass.length > 0 };
}

function authOrThrow(): MailAuth {
  const user = (process.env.ARSYS_MAIL_USER || DEFAULT_USER).trim() || DEFAULT_USER;
  const pass = (process.env.ARSYS_MAIL_PASSWORD || "").trim();
  if (!pass) throw new Error("MISSING_PASSWORD");
  return { user, pass };
}

function formatAddresses(list: Array<{ name?: string; address?: string }> | undefined): string {
  if (!list?.length) return "";
  return list
    .map((item) => {
      const address = item.address?.trim() || "";
      const name = item.name?.trim() || "";
      if (name && address) return `${name} <${address}>`;
      return address || name;
    })
    .filter(Boolean)
    .join(", ");
}

function sanitizeMailHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<(iframe|object|embed|form|base|meta|link)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(iframe|object|embed|form|base|meta|link)\b[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

function isConnErr(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  return /socket|closed|ECONNRESET|not available|timeout|Unexpected close/i.test(message);
}

function dropPool() {
  const current = pool;
  pool = null;
  if (!current) return;
  if (current.timer) clearTimeout(current.timer);
  try {
    current.client.close();
  } catch {
    /* la conexión ya estaba cerrada */
  }
}

function touchPool() {
  if (!pool) return;
  if (pool.timer) clearTimeout(pool.timer);
  pool.timer = setTimeout(() => dropPool(), POOL_IDLE);
}

async function sharedClient(auth: MailAuth): Promise<ImapFlow> {
  if (pool && pool.user === auth.user && pool.client.usable) return pool.client;
  if (connecting) return connecting;
  connecting = (async () => {
    dropPool();
    const client = new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: true,
      auth,
      logger: false,
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 20000,
    });
    await client.connect();
    pool = { client, user: auth.user, chain: Promise.resolve(), timer: null };
    return client;
  })();
  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

async function withImap<T>(run: (client: ImapFlow) => Promise<T>): Promise<T> {
  const auth = authOrThrow();
  const client = await sharedClient(auth);
  const current = pool;
  if (!current || current.client !== client) return withImap(run);
  const task = current.chain.then(() => run(current.client));
  current.chain = task.then(
    () => undefined,
    () => undefined,
  );
  try {
    const value = await task;
    touchPool();
    return value;
  } catch (err) {
    if (isConnErr(err)) dropPool();
    throw err;
  }
}

function summaryFromFetch(message: FetchMessageObject): MailSummary {
  const flags = message.flags || new Set<string>();
  const rawDate = message.envelope?.date || message.internalDate || null;
  const parsed = rawDate instanceof Date ? rawDate : rawDate ? new Date(rawDate) : null;
  return {
    uid: message.uid,
    subject: message.envelope?.subject?.trim() || "(sin asunto)",
    from: formatAddresses(message.envelope?.from),
    to: formatAddresses(message.envelope?.to),
    date: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
    seen: flags.has("\\Seen"),
  };
}

const USE_BY_NAME: Record<string, string> = {
  inbox: "\\Inbox",
  sent: "\\Sent",
  sentitems: "\\Sent",
  sentmessages: "\\Sent",
  sentmail: "\\Sent",
  outbox: "\\Sent",
  enviados: "\\Sent",
  drafts: "\\Drafts",
  draft: "\\Drafts",
  borradores: "\\Drafts",
  archive: "\\Archive",
  archives: "\\Archive",
  archivo: "\\Archive",
  junk: "\\Junk",
  spam: "\\Junk",
  junkemail: "\\Junk",
  bulkmail: "\\Junk",
  nodeseado: "\\Junk",
  trash: "\\Trash",
  deleted: "\\Trash",
  deleteditems: "\\Trash",
  deletedmessages: "\\Trash",
  bin: "\\Trash",
  papelera: "\\Trash",
  eliminados: "\\Trash",
};

function folderFromList(box: ListResponse): MailFolder {
  const name = box.name || box.path;
  const key = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  return {
    path: box.path,
    name,
    parentPath: box.parentPath || "",
    specialUse: box.specialUse || USE_BY_NAME[key] || (box.path.toUpperCase() === "INBOX" ? "\\Inbox" : ""),
    delimiter: box.delimiter || ".",
    selectable: !box.flags?.has("\\Noselect"),
  };
}

async function loadFolders(client: ImapFlow, fresh: boolean): Promise<MailFolder[]> {
  if (!fresh && folderCache && Date.now() - folderCache.at < FOLDER_TTL) return folderCache.folders;
  const listed = await client.list({ listOnly: true });
  const folders = listed.map(folderFromList).filter((folder) => folder.path && !folder.path.startsWith("."));
  folderCache = { at: Date.now(), folders };
  return folders;
}

function resolveBox(folders: MailFolder[], box: string): MailFolder {
  const wanted = (box || "INBOX").trim();
  const found = folders.find((folder) => folder.path === wanted || folder.path.toUpperCase() === wanted.toUpperCase());
  if (!found || !found.selectable) throw new Error("BAD_FOLDER");
  return found;
}

function folderByUse(folders: MailFolder[], specialUse: string, pattern: RegExp): MailFolder | null {
  return (
    folders.find((folder) => folder.specialUse === specialUse) ||
    folders.find((folder) => pattern.test(folder.path) || pattern.test(folder.name)) ||
    null
  );
}

function clearListCache() {
  listCache.clear();
  unseenCache = null;
}

export function clearUnseenCache() {
  unseenCache = null;
}

async function fetchSummaries(client: ImapFlow, path: string): Promise<MailSummary[]> {
  const lock = await client.getMailboxLock(path);
  try {
    const exists = client.mailbox && typeof client.mailbox === "object" ? client.mailbox.exists : 0;
    if (!exists) return [];
    const start = Math.max(1, exists - LIST_LIMIT + 1);
    const messages: MailSummary[] = [];
    for await (const message of client.fetch(`${start}:*`, {
      uid: true,
      flags: true,
      envelope: true,
      internalDate: true,
    })) {
      messages.push(summaryFromFetch(message));
    }
    messages.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
    return messages;
  } finally {
    lock.release();
  }
}

export async function listMailbox(box = "INBOX", fresh = false): Promise<{ user: string; box: string; folders: MailFolder[]; messages: MailSummary[] }> {
  const auth = authOrThrow();
  return withImap(async (client) => {
    const folders = await loadFolders(client, fresh);
    const target = resolveBox(folders, box);
    const cached = listCache.get(target.path);
    if (!fresh && cached && Date.now() - cached.at < LIST_TTL) {
      return { user: auth.user, box: target.path, folders, messages: cached.messages };
    }
    const messages = await fetchSummaries(client, target.path);
    listCache.set(target.path, { at: Date.now(), messages });
    return { user: auth.user, box: target.path, folders, messages };
  });
}

export async function listInbox() {
  const listed = await listMailbox("INBOX");
  return { user: listed.user, messages: listed.messages };
}

export async function readMessage(uid: number, box = "INBOX"): Promise<MailMessage | null> {
  return withImap(async (client) => {
    const folders = await loadFolders(client, false);
    const target = resolveBox(folders, box);
    const lock = await client.getMailboxLock(target.path);
    try {
      const fetched = await client.fetchOne(
        String(uid),
        { uid: true, flags: true, envelope: true, internalDate: true, source: { maxLength: SOURCE_MAX } },
        { uid: true },
      );
      if (!fetched || !fetched.source) return null;
      const parsed = await simpleParser(fetched.source);
      const base = summaryFromFetch(fetched);
      const htmlRaw = typeof parsed.html === "string" ? parsed.html : "";
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      const cached = listCache.get(target.path);
      if (cached) {
        cached.messages = cached.messages.map((item) => (item.uid === uid ? { ...item, seen: true } : item));
      }
      unseenCache = null;
      return {
        ...base,
        seen: true,
        text: parsed.text || "",
        html: htmlRaw ? sanitizeMailHtml(htmlRaw) : "",
        messageId: parsed.messageId || "",
      };
    } finally {
      lock.release();
    }
  });
}

async function moveInside(client: ImapFlow, uid: number, box: string, destination: string) {
  const folders = await loadFolders(client, false);
  const source = resolveBox(folders, box);
  const target = resolveBox(folders, destination);
  if (source.path === target.path) return;
  const lock = await client.getMailboxLock(source.path);
  try {
    await client.messageMove(String(uid), target.path, { uid: true });
  } finally {
    lock.release();
  }
  clearListCache();
}

export async function moveMessage(uid: number, box: string, destination: string) {
  await withImap((client) => moveInside(client, uid, box, destination));
}

export async function archiveMessage(uid: number, box = "INBOX") {
  await withImap(async (client) => {
    const folders = await loadFolders(client, false);
    let archive = folderByUse(folders, "\\Archive", /archive|archivo|archiv/i);
    if (!archive) {
      await client.mailboxCreate("Archive");
      folderCache = null;
      const again = await loadFolders(client, true);
      archive = folderByUse(again, "\\Archive", /archive|archivo|archiv/i);
      if (!archive) throw new Error("NO_ARCHIVE");
    }
    await moveInside(client, uid, box, archive.path);
  });
}

export async function deleteMessage(uid: number, box = "INBOX") {
  await withImap(async (client) => {
    const folders = await loadFolders(client, false);
    const source = resolveBox(folders, box);
    const trash = folderByUse(folders, "\\Trash", /trash|papelera|deleted|eliminados|bin/i);
    if (trash && source.path !== trash.path) {
      await moveInside(client, uid, source.path, trash.path);
      return;
    }
    const lock = await client.getMailboxLock(source.path);
    try {
      await client.messageFlagsAdd(String(uid), ["\\Deleted"], { uid: true });
      await client.messageDelete(String(uid), { uid: true });
    } finally {
      lock.release();
    }
    clearListCache();
  });
}

function cleanFolderName(name: string) {
  const clean = name.trim();
  if (clean.length < 1 || clean.length > 40 || /[./\\]/.test(clean)) throw new Error("BAD_NAME");
  return clean;
}

export async function createFolder(parent: string, name: string) {
  const clean = cleanFolderName(name);
  await withImap(async (client) => {
    const folders = await loadFolders(client, true);
    if (!parent.trim()) {
      await client.mailboxCreate(clean);
    } else {
      const base = folders.find((folder) => folder.path === parent.trim());
      if (!base) throw new Error("BAD_FOLDER");
      const delimiter = base.delimiter || ".";
      await client.mailboxCreate(`${base.path}${delimiter}${clean}`);
    }
    folderCache = null;
    clearListCache();
  });
}

export async function deleteFolder(path: string) {
  await withImap(async (client) => {
    const folders = await loadFolders(client, true);
    const target = folders.find((folder) => folder.path === path.trim());
    if (!target) throw new Error("BAD_FOLDER");
    if (target.specialUse || target.path.toUpperCase() === "INBOX") throw new Error("PROTECTED_FOLDER");
    const hasChild = folders.some((folder) => folder.parentPath === target.path);
    if (hasChild) throw new Error("FOLDER_HAS_CHILDREN");
    await client.mailboxDelete(target.path);
    folderCache = null;
    clearListCache();
  });
}

export async function countUnseen(): Promise<number> {
  if (unseenCache && Date.now() - unseenCache.at < 20000) return unseenCache.value;
  const value = await withImap(async (client) => {
    const status = await client.status("INBOX", { unseen: true });
    return status ? status.unseen || 0 : 0;
  });
  unseenCache = { at: Date.now(), value };
  return value;
}

export async function sendMail(input: { to: string; subject: string; text: string; inReplyTo?: string }): Promise<void> {
  const { user, pass } = authOrThrow();
  const to = input.to
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!to.length || to.some((address) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))) {
    throw new Error("BAD_RECIPIENT");
  }
  const subject = input.subject.trim().slice(0, 200) || "(sin asunto)";
  const text = input.text.trim().slice(0, 20000);
  if (!text) throw new Error("EMPTY_BODY");

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
  });
  await transport.sendMail({
    from: `My K-pop Binder <${user}>`,
    to: to.join(", "),
    subject,
    text,
    inReplyTo: input.inReplyTo || undefined,
    references: input.inReplyTo || undefined,
  });
}

export function publicMailError(err: unknown): { status: number; error: string } {
  const message = err instanceof Error ? err.message : "";
  const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code || "") : "";
  if (message === "MISSING_PASSWORD") return { status: 503, error: "Falta ARSYS_MAIL_PASSWORD en el servidor." };
  if (message === "BAD_RECIPIENT") return { status: 400, error: "El destinatario no es un correo válido." };
  if (message === "EMPTY_BODY") return { status: 400, error: "Escribe el mensaje antes de enviarlo." };
  if (message === "BAD_FOLDER") return { status: 400, error: "Esa carpeta no existe." };
  if (message === "BAD_NAME") return { status: 400, error: "El nombre de la carpeta no es válido." };
  if (message === "PROTECTED_FOLDER") return { status: 400, error: "Esa carpeta del buzón no se puede borrar." };
  if (message === "FOLDER_HAS_CHILDREN") return { status: 400, error: "Borra primero las subcarpetas." };
  if (message === "NO_ARCHIVE") return { status: 502, error: "Arsys no tiene una carpeta de archivo." };
  if (code === "EAUTH" || /auth|authentication|invalid credentials/i.test(message)) {
    return { status: 502, error: "Arsys ha rechazado el acceso. Revisa ARSYS_MAIL_PASSWORD." };
  }
  if (code === "CONNECT_TIMEOUT" || /timeout|ETIMEDOUT|ENOTFOUND/i.test(message)) {
    return { status: 504, error: "Arsys no ha respondido a tiempo." };
  }
  return { status: 502, error: "No se ha podido conectar con el correo de Arsys." };
}
