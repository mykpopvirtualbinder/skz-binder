import { NextResponse } from "next/server";
import { rememberAccountCountry } from "@/lib/account-country";
import { attachPendingInvite, ensureOwnInviteCode, findInviterByCode, INVITE_USE_LIMIT, normalizeInviteCode } from "@/lib/invite-code";
import { allowedAuthRedirect, buildAuthConfirmLink, sendAuthLinkEmail, type AuthMailKind } from "@/lib/auth-link-mail";
import { countryFromRequest } from "@/lib/request-country";
import { normalizeSiteLanguage } from "@/lib/site-language";
import { isEmailOk } from "@/lib/email-policy";
import { isPasswordOk } from "@/lib/password-policy";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { isUsernameShapeOk, normalizeUsername } from "@/lib/username";
import { claimUsername, usernameOwnerId } from "@/lib/username-availability";

function cleanEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function confirmLink(
  properties: unknown,
  redirectTo: string,
  fallback: "signup" | "recovery" | "magiclink",
): string | null {
  if (!properties || typeof properties !== "object") return null;
  const record = properties as { hashed_token?: unknown; verification_type?: unknown };
  const hash = typeof record.hashed_token === "string" ? record.hashed_token : "";
  const reported = record.verification_type;
  const type = reported === "signup" || reported === "recovery" || reported === "magiclink" ? reported : fallback;
  return buildAuthConfirmLink(redirectTo, hash, type);
}

export async function POST(req: Request) {
  let body: { action?: string; email?: string; password?: string; redirectTo?: string; language?: string; inviteCode?: string; username?: string };
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
  if (!isEmailOk(email)) {
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
    if (!isPasswordOk(password)) {
      return NextResponse.json({ error: "Contraseña no válida." }, { status: 400 });
    }

    const username = normalizeUsername(typeof body.username === "string" ? body.username : "");
    if (!isUsernameShapeOk(username)) {
      return NextResponse.json({ code: "username_invalid" }, { status: 400 });
    }
    try {
      if (await usernameOwnerId(admin, username)) {
        return NextResponse.json({ code: "username_taken" }, { status: 409 });
      }
    } catch {
      return NextResponse.json({ error: "No se pudo comprobar el nombre de usuario." }, { status: 500 });
    }

    const inviteCode = normalizeInviteCode(body.inviteCode);
    if (typeof body.inviteCode === "string" && body.inviteCode.trim() && !inviteCode) {
      return NextResponse.json({ code: "invite_invalid" }, { status: 400 });
    }
    if (inviteCode) {
      const inviter = await findInviterByCode(admin, inviteCode);
      const inviterEmail = (inviter?.email || "").trim().toLowerCase();
      const used = Math.max(0, Number(inviter?.app_metadata?.invite_signups) || 0);
      if (!inviter || inviterEmail === email) {
        return NextResponse.json({ code: "invite_invalid" }, { status: 400 });
      }
      if (used >= INVITE_USE_LIMIT) {
        return NextResponse.json({ code: "invite_full" }, { status: 400 });
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

    const claimed = await claimUsername(admin, userId, username, { language: normalizeSiteLanguage(language) });
    if (!claimed.ok) {
      await admin.from("profiles").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
      if (claimed.taken) return NextResponse.json({ code: "username_taken" }, { status: 409 });
      return NextResponse.json({ error: "No se pudo reservar el nombre de usuario." }, { status: 500 });
    }

    const country = countryFromRequest(req);
    let ownCode: string | null = null;
    try {
      await admin.from("profiles").update({ language: normalizeSiteLanguage(language) }).eq("user_id", userId);
      if (country) await rememberAccountCountry(admin, userId, country, "signup");
      if (inviteCode) await attachPendingInvite(admin, userId, inviteCode);
      ownCode = await ensureOwnInviteCode(admin, userId);
    } catch {
      /* El alta sigue aunque no se pueda anotar el país, el idioma o el código. */
    }

    const signupPayload = { userId, inviteCode: ownCode, friendKoins: 100, referrerKoins: 100 };
    const link = confirmLink(data.properties, redirectTo, "signup");
    if (!link) {
      return NextResponse.json({ code: "mail_failed", ...signupPayload }, { status: 502 });
    }

    try {
      await sendAuthLinkEmail({ to: email, link, kind: "signup", language });
    } catch {
      return NextResponse.json({ code: "mail_failed", ...signupPayload }, { status: 502 });
    }

    return NextResponse.json(signupPayload);
  }

  const kind: AuthMailKind = "recovery";
  const linkType = action === "recovery" ? "recovery" : "magiclink";
  const { data, error } = await admin.auth.admin.generateLink({
    type: linkType,
    email,
    options: { redirectTo },
  });
  const link = confirmLink(data?.properties, redirectTo, linkType);
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
