import { normalizeThemeId } from "@/lib/theme-unlocks";

export const THEME_COOKIE = "mkb_theme";
export const THEME_STORAGE_KEY = "theme";

export const KNOWN_THEME_IDS = ["pastel", "dark", "vibrant", "minimal", "k_pride", "iris_bloom"] as const;

export function isKnownThemeId(themeId: string): boolean {
  return (KNOWN_THEME_IDS as readonly string[]).includes(normalizeThemeId(themeId));
}

export function themeIdFromUnknown(raw: string | null | undefined): string {
  const t = normalizeThemeId(String(raw || "").trim());
  return isKnownThemeId(t) ? t : "pastel";
}

/** Aplica el tema al HTML y lo guarda para la siguiente carga (sin parpadeo). */
export function persistTheme(themeId: string) {
  const t = themeIdFromUnknown(themeId);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", t);
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(t)}; path=/; max-age=31536000; SameSite=Lax`;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, t);
  } catch {
    /* ignore */
  }
}

/** Script bloqueante de &lt;head&gt;: lee localStorage/cookie antes del primer pintado. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t="";try{t=localStorage.getItem("theme")||""}catch(e){}if(!t){var m=document.cookie.match(/(?:^|; )mkb_theme=([^;]*)/);if(m)t=decodeURIComponent(m[1])}if(t==="gay_pride")t="iris_bloom";var ok={pastel:1,dark:1,vibrant:1,minimal:1,k_pride:1,iris_bloom:1};if(!ok[t])return;document.documentElement.setAttribute("data-theme",t);document.cookie="mkb_theme="+encodeURIComponent(t)+"; path=/; max-age=31536000; SameSite=Lax"}catch(e){}})();`;
