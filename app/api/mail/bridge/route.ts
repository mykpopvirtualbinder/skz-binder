import { NextResponse } from "next/server";
import {
  countUnseen,
  deleteMessages,
  inboundAuthorized,
  listMailbox,
  moveMessage,
  publicMailError,
  readAttachment,
  readMessage,
  sendMail,
  setMessagesSeen,
} from "@/lib/site-mail";

export const runtime = "nodejs";
export const maxDuration = 30;

const FOLDERS = new Set(["inbox", "sent", "archive", "trash"]);

function folderFrom(value: string | null | undefined) {
  const folder = (value || "").trim().toLowerCase();
  if (!folder || folder === "inbox") return folder ? "inbox" : null;
  return FOLDERS.has(folder) ? folder : null;
}

function uidFrom(value: unknown) {
  const uid = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) return null;
  return uid;
}

function authorized(req: Request) {
  const secret = (process.env.MAIL_BRIDGE_SECRET || "").trim();
  if (!secret) return "missing" as const;
  if (!inboundAuthorized(req.headers.get("authorization"), secret)) return "denied" as const;
  return "ok" as const;
}

function gate(req: Request) {
  const state = authorized(req);
  if (state === "missing") return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (state === "denied") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

export async function GET(req: Request) {
  const denied = gate(req);
  if (denied) return denied;
  const url = new URL(req.url);
  try {
    if (url.searchParams.get("unseen") === "1") {
      const unseen = await countUnseen();
      const listed = await listMailbox("inbox");
      const items = listed.messages.filter((row) => !row.seen).map((row) => ({
        id: row.uid,
        from: row.from,
        subject: row.subject,
      }));
      return NextResponse.json({ unseen, items });
    }
    const fileId = uidFrom(url.searchParams.get("file"));
    if (fileId) {
      const file = await readAttachment(fileId);
      if (!file) return NextResponse.json({ error: "Ese archivo ya no está." }, { status: 404 });
      const filename = encodeURIComponent(file.filename);
      return new NextResponse(new Uint8Array(file.bytes), {
        headers: {
          "Content-Type": file.contentType,
          "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const id = uidFrom(url.searchParams.get("id"));
    if (id) {
      const message = await readMessage(id);
      if (!message) return NextResponse.json({ error: "Ese mensaje ya no está." }, { status: 404 });
      return NextResponse.json({
        message: {
          id: message.uid,
          account: "binder",
          folder: "inbox",
          from: message.from,
          to: message.to,
          subject: message.subject,
          seen: true,
          files: message.attachments.length,
          createdAt: message.date || new Date().toISOString(),
          messageId: message.messageId,
          text: message.text,
          html: message.html,
          inReplyTo: message.inReplyTo,
          attachments: message.attachments,
        },
      });
    }
    const folder = folderFrom(url.searchParams.get("folder") || "inbox");
    if (!folder) return NextResponse.json({ error: "Esa carpeta no existe." }, { status: 400 });
    const listed = await listMailbox(folder);
    return NextResponse.json({
      messages: listed.messages.map((row) => ({
        id: row.uid,
        account: "binder",
        folder,
        from: row.from,
        to: row.to,
        subject: row.subject,
        seen: row.seen,
        files: row.files,
        createdAt: row.date || new Date().toISOString(),
        messageId: "",
      })),
    });
  } catch (err) {
    const pub = publicMailError(err);
    return NextResponse.json({ error: pub.error }, { status: pub.status });
  }
}

export async function POST(req: Request) {
  const denied = gate(req);
  if (denied) return denied;
  let body: {
    action?: string;
    folder?: string;
    ids?: string[];
    seen?: boolean;
    destination?: string;
    to?: string;
    subject?: string;
    text?: string;
    inReplyTo?: string;
    forwardId?: string;
    files?: Array<{ filename?: string; contentType?: string; contentBase64?: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const folder = folderFrom(body.folder || "inbox");
  if (!folder) return NextResponse.json({ error: "Esa carpeta no existe." }, { status: 400 });
  const ids = Array.isArray(body.ids) ? body.ids.map(uidFrom).filter((id): id is string => Boolean(id)).slice(0, 40) : [];
  try {
    if (body.action === "delete") {
      if (!ids.length) return NextResponse.json({ error: "Mensaje no válido." }, { status: 400 });
      await deleteMessages(ids, folder);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "seen") {
      if (!ids.length) return NextResponse.json({ error: "Mensaje no válido." }, { status: 400 });
      await setMessagesSeen(ids, Boolean(body.seen));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "move") {
      const destination = folderFrom(body.destination);
      if (!destination || destination === "sent") return NextResponse.json({ error: "Esa carpeta no existe." }, { status: 400 });
      if (!ids.length) return NextResponse.json({ error: "Mensaje no válido." }, { status: 400 });
      for (const id of ids) await moveMessage(id, destination);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "send") {
      const uploaded = Array.isArray(body.files) ? body.files.slice(0, 8) : [];
      const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
      let total = 0;
      for (const file of uploaded) {
        const content = Buffer.from(String(file.contentBase64 || ""), "base64");
        if (!content.length) continue;
        total += content.length;
        if (total > 3_500_000) return NextResponse.json({ error: "Los adjuntos pesan demasiado. El máximo es 3 MB." }, { status: 400 });
        attachments.push({
          filename: String(file.filename || "adjunto").slice(0, 120),
          content,
          contentType: String(file.contentType || "application/octet-stream").slice(0, 160),
        });
      }
      const forwardId = uidFrom(body.forwardId);
      if (forwardId) {
        const original = await readMessage(forwardId);
        for (const file of original?.attachments || []) {
          if (attachments.length >= 8) break;
          const stored = await readAttachment(file.id);
          if (!stored) continue;
          total += stored.bytes.length;
          if (total > 3_500_000) return NextResponse.json({ error: "Los adjuntos pesan demasiado. El máximo es 3 MB." }, { status: 400 });
          attachments.push({ filename: stored.filename, content: stored.bytes, contentType: stored.contentType });
        }
      }
      await sendMail({
        to: String(body.to || ""),
        subject: String(body.subject || ""),
        text: String(body.text || ""),
        inReplyTo: body.inReplyTo ? String(body.inReplyTo) : undefined,
        attachments,
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  } catch (err) {
    const pub = publicMailError(err);
    return NextResponse.json({ error: pub.error }, { status: pub.status });
  }
}
