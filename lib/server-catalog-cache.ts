/** In-memory TTL cache for expensive public/ folder scans (warm isolates). */

type Entry<T> = { at: number; value: T };

const store = new Map<string, Entry<unknown>>();

export function peekScanCache<T>(key: string, ttlMs = 60_000): T | undefined {
  const hit = store.get(key) as Entry<T> | undefined;
  if (!hit) return undefined;
  if (Date.now() - hit.at >= ttlMs) return undefined;
  return hit.value;
}

export function setScanCache<T>(key: string, value: T) {
  store.set(key, { at: Date.now(), value });
}

export function memoScan<T>(key: string, fn: () => T, ttlMs = 60_000): T {
  const hit = peekScanCache<T>(key, ttlMs);
  if (hit !== undefined) return hit;
  const value = fn();
  setScanCache(key, value);
  return value;
}

export const CATALOG_HTTP_CACHE = "public, s-maxage=60, stale-while-revalidate=600";
