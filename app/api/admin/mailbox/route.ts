import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import {
  archiveMessage,
  countUnseen,
  createFolder,
  deleteFolder,
  deleteMessage,
  listMailbox,
  mailAccount,
  moveMessage,
  publicMailError,
  readMessage,
  sendMail,
} from "@/lib/arsys-mail";

export const runtime = "nodejs";
export const maxDuration = 30;

function uidFrom(value: unknown): number | null {
  const uid = Number(value);
  if (!Number.isInteger(uid) || uid <= 0 || uid > 2_147_483_647) return null;
  return uid;
}

function textFrom(value: unknown, max: number) {
  return String(value || "").replace(/[\r\n\0]/g, "").trim().slice(0, max);
}

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  const account = mailAccount();
  if (!account.configured) {
    return NextResponse.json(
      { configured: false, account: account.user, error: "Falta ARSYS_MAIL_PASSWORD en el servidor." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  if (url.searchParams.get("unseen") === "1") {
    try {
      const unseen = await countUnseen();
      return NextResponse.json({ configured: true, account: account.user, unseen });
    } catch (err) {
      const pub = publicMailError(err);
      return NextResponse.json({ configured: true, account: account.user, unseen: 0, error: pub.error }, { status: pub.status });
    }
  }

  const box = textFrom(url.searchParams.get("box"), 200) || "INBOX";
  const fresh = url.searchParams.get("fresh") === "1";
  const uid = uidFrom(url.searchParams.get("uid"));
  try {
    if (uid) {
      const message = await readMessage(uid, box);
      if (!message) return NextResponse.json({ error: "Ese mensaje ya no está en la carpeta." }, { status: 404 });
      return NextResponse.json({ configured: true, account: account.user, message });
    }
    const listed = await listMailbox(box, fresh);
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

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  const account = mailAccount();
  if (!account.configured) {
    return NextResponse.json({ configured: false, error: "Falta ARSYS_MAIL_PASSWORD en el servidor." }, { status: 503 });
  }

  let body: {
    action?: string;
    uid?: number;
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

  const box = textFrom(body.box, 200) || "INBOX";
  try {
    if (body.action === "delete" || body.action === "archive" || body.action === "move") {
      const uid = uidFrom(body.uid);
      if (!uid) return NextResponse.json({ error: "Mensaje no válido." }, { status: 400 });
      if (body.action === "archive") await archiveMessage(uid, box);
      else if (body.action === "move") await moveMessage(uid, box, textFrom(body.destination, 200));
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
