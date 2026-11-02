import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminTeamEmail } from "@/lib/admin-emails";
import { buildAuthConfirmLink, sendAuthLinkEmail, type AuthMailKind } from "@/lib/auth-link-mail";

/** El último aviso sale a las 72 h. El enlace sigue valiendo 24 h más. */
export const CONFIRM_CANCEL_HOURS = 96;

export const REMINDER_STAMP = {
  24: "confirm_reminder_24_at",
  48: "confirm_reminder_48_at",
  72: "confirm_reminder_72_at",
} as const;

const STAGES = [
  { hours: 72, stamp: REMINDER_STAMP[72], kind: "remind_72" as const },
  { hours: 48, stamp: REMINDER_STAMP[48], kind: "remind_48" as const },
  { hours: 24, stamp: REMINDER_STAMP[24], kind: "remind_24" as const },
] as const;

const MAX_ACTIONS = 40;

type AuthRow = {
  id: string;
  email: string;
  createdAt: string;
  meta: Record<string, unknown>;
};

export type ConfirmScheduleResult = {
  reminded: { email: string; hours: number }[];
  cancelled: { email: string; username: string | null }[];
  errors: string[];
  pending: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function siteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.mykpopbinder.com").replace(/\/$/, "");
  if (raw === "https://mykpopbinder.com") return "https://www.mykpopbinder.com";
  return raw;
}

export async function issueSignupConfirmLink(
  admin: SupabaseClient,
  email: string,
): Promise<{ link: string } | { error: string }> {
  const redirectTo = `${siteOrigin()}/login`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  const props = asRecord(data?.properties);
  const tokenHash = typeof props.hashed_token === "string" ? props.hashed_token : "";
  const reported = props.verification_type;
  const type = reported === "signup" || reported === "magiclink" ? reported : "magiclink";
  const link = buildAuthConfirmLink(redirectTo, tokenHash, type);
  if (error || !link) return { error: error?.message || "No se pudo crear el enlace de confirmación." };
  return { link };
}

async function listUnconfirmed(admin: SupabaseClient): Promise<{ users: AuthRow[]; error?: string }> {
  const users: AuthRow[] = [];
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { users, error: error.message };
    const batch = data?.users ?? [];
    for (const user of batch) {
      const row = asRecord(user);
      if (row.email_confirmed_at || row.confirmed_at || row.deleted_at) continue;
      const email = typeof row.email === "string" ? row.email.trim() : "";
      const id = typeof row.id === "string" ? row.id : "";
      const createdAt = typeof row.created_at === "string" ? row.created_at : "";
      if (!id || !createdAt || isAdminTeamEmail(email)) continue;
      users.push({ id, email, createdAt, meta: asRecord(row.app_metadata) });
    }
    if (batch.length < 200) break;
  }
  return { users };
}

async function profileOf(
  admin: SupabaseClient,
  userId: string,
): Promise<{ name: string | null; language: string | null }> {
  const { data } = await admin.from("profiles").select("display_name, language").eq("user_id", userId).maybeSingle();
  const row = asRecord(data);
  const name = typeof row.display_name === "string" && row.display_name.trim() ? row.display_name.trim() : null;
  const language = typeof row.language === "string" ? row.language : null;
  return { name, language };
}

/** Borra el alta sin confirmar y deja el nombre de usuario libre. */
export async function releaseUnconfirmedSignup(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: true; username: string | null } | { ok: false; error: string; username: string | null }> {
  const fresh = await admin.auth.admin.getUserById(userId);
  const user = fresh.data?.user;
  if (fresh.error || !user) return { ok: false, error: fresh.error?.message || "Usuario no encontrado.", username: null };
  if (user.email_confirmed_at) return { ok: false, error: "El correo ya está confirmado.", username: null };
  if (isAdminTeamEmail(user.email || "")) return { ok: false, error: "No se anula una cuenta del equipo.", username: null };

  const profile = await profileOf(admin, userId);
  const cleared = await admin.from("profiles").update({ display_name: null }).eq("user_id", userId);
  if (cleared.error) await admin.from("profiles").delete().eq("user_id", userId);

  let removed = await admin.auth.admin.deleteUser(userId);
  if (removed.error) {
    await admin.from("profiles").delete().eq("user_id", userId);
    removed = await admin.auth.admin.deleteUser(userId);
  }
  if (removed.error) return { ok: false, error: removed.error.message, username: profile.name };
  return { ok: true, username: profile.name };
}

function dueStage(ageHours: number, meta: Record<string, unknown>): (typeof STAGES)[number] | null {
  for (const stage of STAGES) {
    if (ageHours >= stage.hours && !meta[stage.stamp]) return stage;
  }
  return null;
}

function stamped(meta: Record<string, unknown>, stageHours: number, iso: string): Record<string, unknown> {
  const next = { ...meta };
  if (stageHours >= 24) next[REMINDER_STAMP[24]] = next[REMINDER_STAMP[24]] || iso;
  if (stageHours >= 48) next[REMINDER_STAMP[48]] = next[REMINDER_STAMP[48]] || iso;
  if (stageHours >= 72) next[REMINDER_STAMP[72]] = iso;
  return next;
}

export async function sendSignupConfirmEmail(
  admin: SupabaseClient,
  opts: { userId: string; email: string; kind: AuthMailKind },
): Promise<{ ok: true } | { ok: false; error: string; link?: string }> {
  const issued = await issueSignupConfirmLink(admin, opts.email);
  if ("error" in issued) return { ok: false, error: issued.error };
  const profile = await profileOf(admin, opts.userId);
  try {
    await sendAuthLinkEmail({ to: opts.email, link: issued.link, kind: opts.kind, language: profile.language });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "mail";
    return { ok: false, error: message, link: issued.link };
  }
}

export async function runSignupConfirmSchedule(admin: SupabaseClient): Promise<ConfirmScheduleResult> {
  const listed = await listUnconfirmed(admin);
  const result: ConfirmScheduleResult = {
    reminded: [],
    cancelled: [],
    errors: listed.error ? [listed.error] : [],
    pending: 0,
  };

  const now = Date.now();
  const due = listed.users
    .map((user) => ({ user, ageHours: (now - new Date(user.createdAt).getTime()) / 3_600_000 }))
    .filter((row) => {
      if (!Number.isFinite(row.ageHours)) return false;
      if (row.ageHours >= CONFIRM_CANCEL_HOURS) return true;
      return Boolean(row.user.email) && Boolean(dueStage(row.ageHours, row.user.meta));
    })
    .sort((a, b) => b.ageHours - a.ageHours);

  const batch = due.slice(0, MAX_ACTIONS);
  result.pending = Math.max(0, due.length - batch.length);

  for (const row of batch) {
    if (row.ageHours >= CONFIRM_CANCEL_HOURS) {
      const cancelled = await releaseUnconfirmedSignup(admin, row.user.id);
      if (cancelled.ok) result.cancelled.push({ email: row.user.email, username: cancelled.username });
      else if (!/ya está confirmado/i.test(cancelled.error)) result.errors.push(`${row.user.email}: ${cancelled.error}`);
      continue;
    }

    const stage = dueStage(row.ageHours, row.user.meta);
    if (!stage || !row.user.email) continue;
    const sent = await sendSignupConfirmEmail(admin, { userId: row.user.id, email: row.user.email, kind: stage.kind });
    if (!sent.ok) {
      result.errors.push(`${row.user.email}: ${sent.error}`);
      continue;
    }
    const saved = await admin.auth.admin.updateUserById(row.user.id, {
      app_metadata: stamped(row.user.meta, stage.hours, new Date().toISOString()),
    });
    if (saved.error) result.errors.push(`${row.user.email}: aviso enviado, pero no se pudo anotar (${saved.error.message}).`);
    result.reminded.push({ email: row.user.email, hours: stage.hours });
  }

  return result;
}
