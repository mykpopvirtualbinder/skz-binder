import { NextResponse } from "next/server";
import { rememberAccountCountry } from "@/lib/account-country";
import { attachPendingInvite, findInviterByCode, normalizeInviteCode } from "@/lib/invite-code";
import { allowedAuthRedirect, sendAuthLinkEmail, type AuthMailKind } from "@/lib/auth-link-mail";
import { countryFromRequest } from "@/lib/request-country";
import { normalizeSiteLanguage } from "@/lib/site-language";
import { createServiceRoleClient } from "@/lib/supabase-admin";

const PASSWORD_OK = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function actionLink(properties: unknown): string | null {
  if (!properties || typeof properties !== "object") return null;
  const link = (properties as { action_link?: unknown }).action_link;
  return typeof link === "string" && link.startsWith("http") ? link : null;
}

export async function POST(req: Request) {
  let body: { action?: string; email?: string; password?: string; redirectTo?: string; language?: string; inviteCode?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "signup" && action !== "recovery" && action !== "resend") {
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  }

  const email = cleanEmail(body.email);
  if (!EMAIL_OK.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Email no válido." }, { status: 400 });
  }

  const redirectTo = allowedAuthRedirect(typeof body.redirectTo === "string" ? body.redirectTo : "");
  if (!redirectTo) {
    return NextResponse.json({ error: "Destino no válido." }, { status: 400 });
  }

  const language = typeof body.language === "string" ? body.language : "es";
  const admin = createServiceRoleClient();

  if (action === "signup") {
    const password = typeof body.password === "string" ? body.password : "";
    if (!PASSWORD_OK.test(password) || password.length > 200) {
      return NextResponse.json({ error: "Contraseña no válida." }, { status: 400 });
    }

    const inviteCode = normalizeInviteCode(body.inviteCode);
    if (typeof body.inviteCode === "string" && body.inviteCode.trim() && !inviteCode) {
      return NextResponse.json({ code: "invite_invalid" }, { status: 400 });
    }
    if (inviteCode) {
      const inviter = await findInviterByCode(admin, inviteCode);
      const inviterEmail = (inviter?.email || "").trim().toLowerCase();
      if (!inviter || inviterEmail === email) {
        return NextResponse.json({ code: "invite_invalid" }, { status: 400 });
      }
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { redirectTo },
    });
    const userId = data?.user?.id ?? null;
    if (error || !userId) {
      const message = error?.message || "";
      if (/already|registered|exists/i.test(message)) {
        return NextResponse.json({ code: "already_registered" }, { status: 409 });
      }
      return NextResponse.json({ error: message || "No se pudo crear la cuenta." }, { status: 500 });
    }

    const country = countryFromRequest(req);
    try {
      await admin.from("profiles").update({ language: normalizeSiteLanguage(language) }).eq("user_id", userId);
      if (country) await rememberAccountCountry(admin, userId, country, "signup");
      if (inviteCode) await attachPendingInvite(admin, userId, inviteCode);
    } catch {
      /* El alta sigue aunque no se pueda anotar el país o el idioma. */
    }

    const link = actionLink(data.properties);
    if (!link) {
      return NextResponse.json({ code: "mail_failed", userId }, { status: 502 });
    }

    try {
      await sendAuthLinkEmail({ to: email, link, kind: "signup", language });
    } catch {
      return NextResponse.json({ code: "mail_failed", userId }, { status: 502 });
    }

    return NextResponse.json({ userId });
  }

  const kind: AuthMailKind = "recovery";
  const linkType = action === "recovery" ? "recovery" : "magiclink";
  const { data, error } = await admin.auth.admin.generateLink({
    type: linkType,
    email,
    options: { redirectTo },
  });
  const link = actionLink(data?.properties);
  if (error || !link) {
    return NextResponse.json({ ok: true });
  }

  try {
    await sendAuthLinkEmail({ to: email, link, kind: action === "resend" ? "signup" : kind, language });
  } catch {
    return NextResponse.json({ error: "No se pudo enviar el correo." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
