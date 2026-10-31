import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeUsername, usernameKey } from "@/lib/username";

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate|unique/i.test(error.message || "");
}

/** Dueño de ese nombre, si hay uno distinto de exceptUserId. */
export async function usernameOwnerId(
  admin: SupabaseClient,
  username: string,
  exceptUserId?: string,
): Promise<string | null> {
  const key = usernameKey(username);
  if (!key) return null;
  const { data, error } = await admin
    .from("profiles")
    .select("user_id, display_name")
    .ilike("display_name", escapeIlike(key))
    .limit(20);
  if (error) throw error;
  const hit = (data || []).find((row) => {
    if (exceptUserId && row.user_id === exceptUserId) return false;
    return usernameKey(String(row.display_name || "")) === key;
  });
  return hit ? String(hit.user_id) : null;
}

/** Reserva el nombre en el perfil recién creado. Reintenta por si la fila llega un instante después. */
export async function claimUsername(
  admin: SupabaseClient,
  userId: string,
  username: string,
  extra: Record<string, string>,
): Promise<{ ok: true } | { ok: false; taken: boolean }> {
  const name = normalizeUsername(username);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await admin
      .from("profiles")
      .update({ ...extra, display_name: name })
      .eq("user_id", userId)
      .select("user_id");
    if (!error && data && data.length > 0) return { ok: true };
    if (isUniqueViolation(error)) return { ok: false, taken: true };
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return { ok: false, taken: false };
}
