import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import {
  archiveMessage,
  countUnseen,
  createFolder,
  deleteFolder,
  deleteMessage,
  deleteMessages,
  listMailbox,
  mailAccount,
  moveMessage,
  normalizeBox,
  publicMailError,
  readAttachment,
  readMessage,
  sendMail,
  setMessagesSeen,
} from "@/lib/site-mail";

export const runtime = "nodejs";
export const maxDuration = 30;

function uidFrom(value: unknown): string | null {
  const uid = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) return null;
  return uid;
}

function textFrom(value: unknown, max: number) {
  return String(value || "").replace(/[\r\n\0]/g, "").trim().slice(0, max);
}

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  const account = mailAccount();
  const url = new URL(req.url);
  if (url.searchParams.get("unseen") === "1") {
    try {
      const unseen = await countUnseen();
      const listed = await listMailbox("inbox");
      const items = listed.messages.filter((row) => !row.seen).map((row) => ({ id: row.uid, from: row.from, subject: row.subject }));
      return NextResponse.json({ configured: true, account: account.user, unseen, items });
    } catch (err) {
      const pub = publicMailError(err);
      return NextResponse.json({ configured: true, account: account.user, unseen: 0, error: pub.error }, { status: pub.status });
    }
  }

  const box = normalizeBox(textFrom(url.searchParams.get("box"), 200));
  const fileId = uidFrom(url.searchParams.get("file"));
  const uid = uidFrom(url.searchParams.get("uid"));
  try {
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
    if (uid) {
      const message = await readMessage(uid);
      if (!message) return NextResponse.json({ error: "Ese mensaje ya no está en la carpeta." }, { status: 404 });
      return NextResponse.json({ configured: true, account: account.user, message });
    }
    const listed = await listMailbox(box);
    return NextResponse.json({
      configured: true,
      account: listed.user,
      box: listed.box,
      folders: listed.folders,
      messages: listed.messages,
    });
  } catch (err) {
    const pub = publicMailError(err);
    return NextResponse.json({ configured: true, account: account.user, error: pub.error }, { status: pub.status });
  }
}

function safeFilename(name: string) {
  const base = name.split(/[/\\]/).pop()?.replace(/[\r\n\0]/g, "").trim() || "adjunto";
  return base.slice(0, 120) || "adjunto";
}

async function sendWithFiles(req: Request) {
  try {
    const form = await req.formData();
    if (String(form.get("action") || "") !== "send") {
      return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
    }
    const picked = form.getAll("file").filter((item): item is File => item instanceof File && item.size > 0);
    if (picked.length > 8) return NextResponse.json({ error: "Puedes adjuntar hasta 8 archivos." }, { status: 400 });
    let total = 0;
    const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
    for (const file of picked) {
      total += file.size;
      if (total > 3_500_000) return NextResponse.json({ error: "Los adjuntos pesan demasiado. El máximo es 3 MB." }, { status: 400 });
      attachments.push({
        filename: safeFilename(file.name),
        content: Buffer.from(await file.arrayBuffer()),
        contentType: file.type || "application/octet-stream",
      });
    }
    await sendMail({
      to: String(form.get("to") || ""),
      subject: String(form.get("subject") || ""),
      text: String(form.get("text") || ""),
      inReplyTo: form.get("inReplyTo") ? String(form.get("inReplyTo")) : undefined,
      attachments,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const pub = publicMailError(err);
    return NextResponse.json({ error: pub.error }, { status: pub.status });
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    return sendWithFiles(req);
  }

  let body: {
    action?: string;
    uid?: string;
    uids?: string[];
    seen?: boolean;
    box?: string;
    destination?: string;
    parent?: string;
    name?: string;
    path?: string;
    to?: string;
    subject?: string;
    text?: string;
    inReplyTo?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const box = normalizeBox(textFrom(body.box, 200));
  try {
    if (body.action === "seen") {
      const uids = Array.isArray(body.uids) ? body.uids.map(uidFrom).filter((uid): uid is string => Boolean(uid)) : [];
      if (!uids.length) return NextResponse.json({ error: "Mensaje no válido." }, { status: 400 });
      await setMessagesSeen(uids, Boolean(body.seen));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "delete-many") {
      const uids = Array.isArray(body.uids) ? body.uids.map(uidFrom).filter((uid): uid is string => Boolean(uid)) : [];
      if (!uids.length) return NextResponse.json({ error: "Mensaje no válido." }, { status: 400 });
      await deleteMessages(uids, box);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "delete" || body.action === "archive" || body.action === "move") {
      const uid = uidFrom(body.uid);
      if (!uid) return NextResponse.json({ error: "Mensaje no válido." }, { status: 400 });
      if (body.action === "archive") await archiveMessage(uid);
      else if (body.action === "move") await moveMessage(uid, textFrom(body.destination, 200));
      else await deleteMessage(uid, box);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "create-folder") {
      await createFolder(textFrom(body.parent, 200), String(body.name || ""));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "delete-folder") {
      await deleteFolder(textFrom(body.path, 200));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "send") {
      await sendMail({
        to: String(body.to || ""),
        subject: String(body.subject || ""),
        text: String(body.text || ""),
        inReplyTo: body.inReplyTo ? String(body.inReplyTo) : undefined,
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  } catch (err) {
    const pub = publicMailError(err);
    return NextResponse.json({ error: pub.error }, { status: pub.status });
  }
}
