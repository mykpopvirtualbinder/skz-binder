const STORAGE_KEY = "mkb:acting-as";
const COOKIE = "mkb_acting_as";

export type AdminActingAs = { name: string };

export function rememberAdminActingAs(value: AdminActingAs) {
  const name = value.name.trim().slice(0, 80) || "este usuario";
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ name }));
  } catch {
    /* ignore */
  }
  document.cookie = `${COOKIE}=${encodeURIComponent(name)}; path=/; max-age=86400; samesite=lax`;
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
  } catch {
    /* ignore */
  }
  document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`;
}
