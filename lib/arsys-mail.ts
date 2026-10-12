import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

const IMAP_HOST = "imap.serviciodecorreo.es";
const IMAP_PORT = 993;
const SMTP_HOST = "smtp.serviciodecorreo.es";
const SMTP_PORT = 465;
const DEFAULT_USER = "info@mykpopbinder.com";
const LIST_LIMIT = 40;
const SOURCE_MAX = 1_500_000;

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

type MailAuth = { user: string; pass: string };

export function mailAccount() {
  const user = (process.env.ARSYS_MAIL_USER || DEFAULT_USER).trim() || DEFAULT_USER;
  const pass = (process.env.ARSYS_MAIL_PASSWORD || "").trim();
  return { user, configured: pass.length > 0 };
}

function authOrThrow(): MailAuth {
  const user = (process.env.ARSYS_MAIL_USER || DEFAULT_USER).trim() || DEFAULT_USER;
  const pass = (process.env.ARSYS_MAIL_PASSWORD || "").trim();
  if (!pass) {
    const err = new Error("MISSING_PASSWORD");
    throw err;
  }
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

async function withImap<T>(run: (client: ImapFlow) => Promise<T>): Promise<T> {
  const { user, pass } = authOrThrow();
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user, pass },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 25000,
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
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

export async function listInbox(): Promise<{ user: string; messages: MailSummary[] }> {
  return withImap(async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const exists = client.mailbox && typeof client.mailbox === "object" ? client.mailbox.exists : 0;
      if (!exists) return { user: authOrThrow().user, messages: [] };
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
      messages.sort((a, b) => {
        const ad = a.date ? Date.parse(a.date) : 0;
        const bd = b.date ? Date.parse(b.date) : 0;
        return bd - ad;
      });
      return { user: (process.env.ARSYS_MAIL_USER || DEFAULT_USER).trim() || DEFAULT_USER, messages };
    } finally {
      lock.release();
    }
  });
}

export async function readMessage(uid: number): Promise<MailMessage | null> {
  return withImap(async (client) => {
    const lock = await client.getMailboxLock("INBOX");
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

async function trashPath(client: ImapFlow): Promise<string | null> {
  const boxes = await client.list();
  const trash = boxes.find((box) => box.specialUse === "\\Trash");
  if (trash?.path) return trash.path;
  const named = boxes.find((box) => /trash|papelera|deleted|bin/i.test(box.path));
  return named?.path || null;
}

export async function deleteMessage(uid: number): Promise<void> {
  await withImap(async (client) => {
    const destination = await trashPath(client);
    const lock = await client.getMailboxLock("INBOX");
    try {
      if (destination) {
        await client.messageMove(String(uid), destination, { uid: true });
        return;
      }
      await client.messageFlagsAdd(String(uid), ["\\Deleted"], { uid: true });
      await client.messageDelete(String(uid), { uid: true });
    } finally {
      lock.release();
    }
  });
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
    connectionTimeout: 15000,
    greetingTimeout: 15000,
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
  if (message === "MISSING_PASSWORD") {
    return { status: 503, error: "Falta ARSYS_MAIL_PASSWORD en el servidor." };
  }
  if (message === "BAD_RECIPIENT") return { status: 400, error: "El destinatario no es un correo válido." };
  if (message === "EMPTY_BODY") return { status: 400, error: "Escribe el mensaje antes de enviarlo." };
  if (code === "EAUTH" || /auth|authentication|invalid credentials/i.test(message)) {
    return { status: 502, error: "Arsys ha rechazado el acceso. Revisa ARSYS_MAIL_PASSWORD." };
  }
  if (code === "CONNECT_TIMEOUT" || /timeout|ETIMEDOUT|ENOTFOUND/i.test(message)) {
    return { status: 504, error: "Arsys no ha respondido a tiempo." };
  }
  return { status: 502, error: "No se ha podido conectar con el correo de Arsys." };
}
