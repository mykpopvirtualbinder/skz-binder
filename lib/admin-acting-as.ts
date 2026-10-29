const STORAGE_KEY = "mkb:acting-as";
const SESSION_KEY = "mkb:acting-admin-session";
const COOKIE = "mkb_acting_as";

export type AdminActingAs = { name: string };
export type AdminReturnSession = { access_token: string; refresh_token: string };

export function rememberAdminActingAs(value: AdminActingAs & Partial<AdminReturnSession>) {
  const name = value.name.trim().slice(0, 80) || "este usuario";
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ name }));
    if (value.access_token && value.refresh_token) {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ access_token: value.access_token, refresh_token: value.refresh_token }),
      );
    }
  } catch {
    /* ignore */
  }
  document.cookie = `${COOKIE}=${encodeURIComponent(name)}; path=/; max-age=86400; samesite=lax`;
}

export function takeAdminReturnSession(): AdminReturnSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminReturnSession>;
    if (!parsed.access_token || !parsed.refresh_token) return null;
    return { access_token: parsed.access_token, refresh_token: parsed.refresh_token };
  } catch {
    return null;
  }
}

export function readAdminActingAs(): AdminActingAs | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { name?: string };
      const name = String(parsed?.name || "").trim();
      if (name) return { name };
    }
  } catch {
    /* ignore */
  }
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${COOKIE}=`));
  if (!match) return null;
  const name = decodeURIComponent(match.slice(COOKIE.length + 1)).trim();
  return name ? { name } : null;
}

export function clearAdminActingAs() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`;
}
