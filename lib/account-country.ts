import type { SupabaseClient } from "@supabase/supabase-js";

function asCode(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value) ? value : null;
}

/** Guarda el país en app_metadata. El de alta no se pisa; la visita solo cambia si es otro país. */
export async function rememberAccountCountry(
  admin: SupabaseClient,
  userId: string,
  country: string,
  mode: "signup" | "visit",
): Promise<void> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return;

  const prev = (data.user.app_metadata ?? {}) as Record<string, unknown>;
  const signup = asCode(prev.signup_country);
  const seen = asCode(prev.last_seen_country);
  if (mode === "visit" && seen === country) return;
  if (mode === "signup" && signup === country && seen === country) return;

  const next: Record<string, unknown> = { ...prev, last_seen_country: country };
  if (mode === "signup") next.signup_country = country;
  else if (signup) next.signup_country = signup;
  else delete next.signup_country;

  await admin.auth.admin.updateUserById(userId, { app_metadata: next });
}
