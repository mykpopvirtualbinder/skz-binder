import { NextResponse } from "next/server";
import { isAdminTeamEmail } from "@/lib/admin-emails";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { createServiceRoleClient } from "@/lib/supabase-admin";

const ACTIONS = [
  "reset_password",
  "unlock_login",
  "lock_login",
  "confirm_email",
  "sign_out_all",
] as const;

type AuthAction = (typeof ACTIONS)[number];

function isAuthAction(v: unknown): v is AuthAction {
  return typeof v === "string" && (ACTIONS as readonly string[]).includes(v);
}

function publicSiteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.mykpopbinder.com").replace(/\/$/, "");
  if (raw === "https://mykpopbinder.com") return "https://www.mykpopbinder.com";
  return raw;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function isCurrentlyBanned(authUser: Record<string, unknown>): boolean {
  const bannedUntil = authUser.banned_until;
  if (!bannedUntil) return false;
  const d = new Date(String(bannedUntil));
  return Number.isFinite(d.getTime()) && d.getTime() > Date.now();
}

async function revokeAllSessions(
  admin: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  currentlyBanned: boolean,
): Promise<{ error: string | null }> {
  const sess = await admin.schema("auth").from("sessions").delete().eq("user_id", userId);
  if (!sess.error) {
    await admin.schema("auth").from("refresh_tokens").update({ revoked: true }).eq("user_id", userId);
    return { error: null };
  }

  if (currentlyBanned) {
    return {
      error:
        "No se pudieron cerrar las sesiones (sin acceso a auth.sessions). La cuenta sigue bloqueada.",
    };
  }

  const ban = await admin.auth.admin.updateUserById(userId, { ban_duration: "1s" });
  if (ban.error) return { error: ban.error.message };
  const unban = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (unban.error) return { error: unban.error.message };
  return { error: null };
}

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  let body: { user_id?: string; action?: string };
  try {
    body = (await req.json()) as { user_id?: string; action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  if (!isAuthAction(body.action)) {
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  }
  const action = body.action;

  try {
    const admin = createServiceRoleClient();
    const { data: fetched, error: fetchErr } = await admin.auth.admin.getUserById(userId);
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    const authUser = asRecord(fetched?.user);
    if (!fetched?.user || !authUser.id) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }
    if (authUser.deleted_at) {
      return NextResponse.json({ error: "Esta cuenta está eliminada." }, { status: 409 });
    }

    const email = typeof authUser.email === "string" ? authUser.email.trim() : "";
    const origin = publicSiteOrigin();
    const recoveryRedirect = `${origin}/update-password`;

    if (action === "reset_password") {
      if (!email) return NextResponse.json({ error: "Este usuario no tiene email." }, { status: 400 });

      const { error: mailErr } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryRedirect,
      });

      let recoveryLink: string | null = null;
      if (mailErr) {
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: recoveryRedirect },
        });
        if (linkErr) {
          return NextResponse.json(
            { error: mailErr.message || linkErr.message },
            { status: 500 },
          );
        }
        const actionLink = asRecord(linkData?.properties).action_link;
        recoveryLink = typeof actionLink === "string" ? actionLink : null;
      }

      return NextResponse.json({
        ok: true,
        emailed: !mailErr,
        recovery_link: recoveryLink,
        message: mailErr
          ? `No se pudo enviar el email (${mailErr.message}). Copia el enlace de recuperación y envíaselo al usuario.`
          : `Hemos enviado un email de recuperación a ${email}.`,
      });
    }

    if (action === "unlock_login") {
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        ok: true,
        is_banned: false,
        message: "Inicio de sesión desbloqueado. El usuario ya puede entrar.",
      });
    }

    if (action === "lock_login") {
      if (isAdminTeamEmail(email)) {
        return NextResponse.json({ error: "No se puede bloquear una cuenta del equipo admin." }, { status: 403 });
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        ok: true,
        is_banned: true,
        message: "Inicio de sesión bloqueado. La cuenta sigue existiendo, pero no puede entrar.",
      });
    }

    if (action === "confirm_email") {
      const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        ok: true,
        email_confirmed: true,
        message: "Email marcado como confirmado. El usuario ya puede iniciar sesión.",
      });
    }

    const { error: signOutErr } = await revokeAllSessions(admin, userId, isCurrentlyBanned(authUser));
    if (signOutErr) return NextResponse.json({ error: signOutErr }, { status: 500 });
    return NextResponse.json({
      ok: true,
      message: "Se han cerrado todas las sesiones de este usuario. Tendrá que volver a iniciar sesión.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
