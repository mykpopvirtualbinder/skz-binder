export const BINDERS_RETURN_KEY = "mkb_binders_return";

export function saveBindersReturn(href: string) {
  if (typeof window === "undefined") return;
  const next = String(href || "").trim();
  if (!next || next.startsWith("/binders")) return;
  try {
    sessionStorage.setItem(BINDERS_RETURN_KEY, next);
  } catch {
    /* ignore */
  }
}

export function readBindersReturn(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BINDERS_RETURN_KEY);
    const href = String(raw || "").trim();
    if (!href || href.startsWith("/binders")) return null;
    return href;
  } catch {
    return null;
  }
}

export function clearBindersReturn() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(BINDERS_RETURN_KEY);
  } catch {
    /* ignore */
  }
}
