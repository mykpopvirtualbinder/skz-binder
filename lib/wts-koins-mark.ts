/** Marker so WTS K-oins survive if `price_koins` is missing from PostgREST. */
const WTS_KOINS_MARK = /(?:^|\n)\[KOINS:(\d+)\]\s*/g;
const WTS_META_MARK = /(?:^|\n)\[WTS_META:([^\]]+)\]\s*/g;

export type WtsListingExtras = {
  origin?: string;
  shipping?: string;
  negotiable?: boolean;
};

export function parseWtsKoinsFromComment(comment: string | null | undefined): number {
  const matches = [...String(comment || "").matchAll(WTS_KOINS_MARK)];
  const last = matches[matches.length - 1];
  const n = last ? Number(last[1]) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function parseWtsListingExtras(comment: string | null | undefined): WtsListingExtras {
  const matches = [...String(comment || "").matchAll(WTS_META_MARK)];
  const last = matches[matches.length - 1];
  if (!last) return {};
  try {
    const j = JSON.parse(last[1]) as { o?: string; s?: string; n?: boolean };
    return {
      origin: typeof j.o === "string" ? j.o : undefined,
      shipping: typeof j.s === "string" ? j.s : undefined,
      negotiable: Boolean(j.n),
    };
  } catch {
    return {};
  }
}

export function stripWtsKoinsMark(comment: string | null | undefined): string {
  return String(comment || "").replace(WTS_KOINS_MARK, "").replace(WTS_META_MARK, "").trimEnd();
}

export function withWtsKoinsMark(comment: string | null | undefined, koins: number): string {
  const base = stripWtsKoinsMark(comment);
  const n = Number.isFinite(koins) ? Math.max(0, Math.floor(koins)) : 0;
  if (n <= 0) return base;
  return base ? `${base}\n[KOINS:${n}]` : `[KOINS:${n}]`;
}

export function withWtsListingMarks(
  comment: string | null | undefined,
  koins: number,
  extras: WtsListingExtras = {},
): string {
  let base = withWtsKoinsMark(comment, koins);
  const meta: Record<string, unknown> = {};
  if (extras.origin?.trim()) meta.o = extras.origin.trim();
  if (extras.shipping?.trim()) meta.s = extras.shipping.trim();
  if (extras.negotiable) meta.n = true;
  if (!Object.keys(meta).length) return base;
  return base ? `${base}\n[WTS_META:${JSON.stringify(meta)}]` : `[WTS_META:${JSON.stringify(meta)}]`;
}

export function resolveWtsKoins(priceKoins: unknown, comment: string | null | undefined): number | null {
  const fromCol = Number(priceKoins);
  if (Number.isFinite(fromCol) && fromCol > 0) return Math.floor(fromCol);
  const fromMark = parseWtsKoinsFromComment(comment);
  return fromMark > 0 ? fromMark : null;
}
