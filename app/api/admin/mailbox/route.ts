import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { archiveMessage, countUnseen, deleteMessage, listInbox, mailAccount, publicMailError, readMessage, sendMail } from "@/lib/arsys-mail";

export const runtime = "nodejs";
export const maxDuration = 30;

function uidFrom(value: unknown): number | null {
  const uid = Number(value);
  if (!Number.isInteger(uid) || uid <= 0 || uid > 2_147_483_647) return null;
  return uid;
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

  const uid = uidFrom(url.searchParams.get("uid"));
  try {
    if (uid) {
      const message = await readMessage(uid);
      if (!message) return NextResponse.json({ error: "Ese mensaje ya no está en la bandeja." }, { status: 404 });
      return NextResponse.json({ configured: true, account: account.user, message });
    }
    const inbox = await listInbox();
    return NextResponse.json({ configured: true, account: inbox.user, messages: inbox.messages });
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

  let body: { action?: string; uid?: number; to?: string; subject?: string; text?: string; inReplyTo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  try {
    if (body.action === "delete" || body.action === "archive") {
      const uid = uidFrom(body.uid);
      if (!uid) return NextResponse.json({ error: "Mensaje no válido." }, { status: 400 });
      if (body.action === "archive") await archiveMessage(uid);
      else await deleteMessage(uid);
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
