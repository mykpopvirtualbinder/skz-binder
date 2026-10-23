/** Same physical card imported twice (album folder and pobs folder, or two inclusion scans). */

type TwinRow = {
  id: number;
  album_id?: number | null;
  version?: string | null;
  member?: string | null;
  image_url?: string | null;
  type?: string | null;
};

function fileStem(imageUrl: string | null | undefined) {
  let path = String(imageUrl || "");
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep raw */
  }
  const file = path.split("/").pop() || "";
  return file.replace(/\.(apng|png|jpe?g|jfif|pjpeg|webp|gif|bmp|avif|svg|hei[cf])$/i, "");
}

export function catalogTwinKey(it: TwinRow) {
  return [it.album_id ?? "", it.version ?? "", it.member ?? "", fileStem(it.image_url) || it.id].join("|");
}

function isPobRow(it: TwinRow) {
  return /pob/i.test(String(it.type || "")) || /\/pobs\//i.test(String(it.image_url || ""));
}

/** Keeps one row per file. Prefers the copy the user already stocked, then the POB path, then the lower id. */
export function dedupeCatalogTwins<T extends TwinRow>(list: T[], stockOf: (id: number) => number): T[] {
  const best = new Map<string, T>();
  for (const it of list) {
    const key = catalogTwinKey(it);
    const prev = best.get(key);
    if (!prev) {
      best.set(key, it);
      continue;
    }
    const nextStock = stockOf(it.id);
    const prevStock = stockOf(prev.id);
    if (nextStock !== prevStock) {
      if (nextStock > prevStock) best.set(key, it);
      continue;
    }
    const nextPob = isPobRow(it);
    const prevPob = isPobRow(prev);
    if (nextPob !== prevPob) {
      if (nextPob) best.set(key, it);
      continue;
    }
    if (it.id < prev.id) best.set(key, it);
  }
  const keep = new Set([...best.values()].map((row) => row.id));
  return list.filter((it) => keep.has(it.id));
}
