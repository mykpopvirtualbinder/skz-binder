const keyFor = (binderId: number) => `mkb_binder_touch:${binderId}`;

export function touchBinderActivity(binderId: number, when = new Date().toISOString()) {
  if (typeof window === "undefined" || !Number.isFinite(binderId)) return;
  try {
    const prev = localStorage.getItem(keyFor(binderId));
    const prevMs = prev ? Date.parse(prev) : NaN;
    const nextMs = Date.parse(when);
    if (Number.isFinite(prevMs) && Number.isFinite(nextMs) && prevMs > nextMs) return;
    localStorage.setItem(keyFor(binderId), when);
  } catch {
    /* ignore */
  }
}

export function readBinderActivity(binderId: number): string | null {
  if (typeof window === "undefined" || !Number.isFinite(binderId)) return null;
  try {
    const raw = localStorage.getItem(keyFor(binderId));
    return raw && Number.isFinite(Date.parse(raw)) ? raw : null;
  } catch {
    return null;
  }
}

export function laterIso(a: string | null | undefined, b: string | null | undefined): string | null {
  const aMs = a ? Date.parse(a) : NaN;
  const bMs = b ? Date.parse(b) : NaN;
  if (!Number.isFinite(aMs)) return Number.isFinite(bMs) ? (b ?? null) : null;
  if (!Number.isFinite(bMs)) return a ?? null;
  return aMs >= bMs ? (a ?? null) : (b ?? null);
}
