import { compactFolderKey, isLibraryPcFolderName, pathHasLibraryPcsUnderMerch } from "./folder-tree-catalog-shared";

export type MerchGoodsKind = "albums" | "tours" | "pop-ups" | "events" | "other";

export const MERCH_GOODS_KIND_ORDER: MerchGoodsKind[] = ["albums", "tours", "pop-ups", "events", "other"];

function decodePath(raw: string): string {
  const s = String(raw || "").split("?")[0];
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function humanizeSlug(s: string) {
  return String(s || "")
    .replace(/\.[^.]+$/, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/** Path segments after `groups/<slug>`, dropping the production `photocards/` root. */
export function merchLogicalSegments(raw: string): string[] {
  const parts = decodePath(raw).replace(/\\/g, "/").split("/").filter(Boolean);
  const gi = parts.findIndex((p) => p === "groups" || p === "group");
  let rest = gi >= 0 ? parts.slice(gi + 2) : parts;
  if (
    /^photocards?$/i.test(rest[0] || "") &&
    rest[1] &&
    /^(japanese-albums|korean-album|korean-albums|events|seasons-greetings|japanese-md)$/i.test(rest[1])
  ) {
    rest = rest.slice(1);
  }
  return rest;
}

export function merchPathLooksLikeLibraryPhotocard(raw: string): boolean {
  const n = decodePath(raw).replace(/\\/g, "/");
  if (pathHasLibraryPcsUnderMerch(n)) return true;
  if (/high[-_ ]?five|hi[-_ ]?touch|high[-_ ]?touch/i.test(n)) return true;
  return merchLogicalSegments(n).some((p) => isLibraryPcFolderName(p));
}

export function merchGoodsKindFromItem(item: {
  image_url?: string | null;
  category?: string | null;
  album_title?: string | null;
}): MerchGoodsKind {
  const url = decodePath(String(item.image_url || ""));
  const blob = `${url} ${item.category || ""} ${item.album_title || ""}`.toLowerCase();
  if (/pop[\s_%-]*ups?/.test(blob)) return "pop-ups";
  if (/(^|\/)(tours?|tour)(\/|$)/.test(blob) || /run[\s._-]*it/.test(blob)) return "tours";
  if (/\/merch\//i.test(url) && /(japanese-albums|korean-album|\/albums\/)/i.test(url)) return "albums";
  if (/\/merch\//i.test(url)) return "tours";
  if (/(^|\/)(events|eventos)(\/|$)/i.test(blob)) return "events";
  return "other";
}

export function merchGoodsCollectionName(item: {
  image_url?: string | null;
  album_title?: string | null;
}): string {
  const segs = merchLogicalSegments(String(item.image_url || ""));
  const merchAt = segs.findIndex((p) => /^merch$/i.test(p));
  if (merchAt > 0) {
    const parent = segs[merchAt - 1] || "";
    if (/run-it-in-japan|run-it-in-seoul|world-tour/i.test(parent)) {
      return humanizeSlug(parent.replace(/^stray-kids-world-tour-/i, ""));
    }
    if (parent && !/^(korean|japanese|events|tour|tours|album)$/i.test(parent)) {
      return humanizeSlug(parent);
    }
  }
  const tourAt = segs.findIndex((p) => /^(tours?|tour)$/i.test(p));
  if (tourAt >= 0) {
    const after = segs.slice(tourAt + 1).filter((p) => !/^run-it$/i.test(p) && !/^merch$/i.test(p) && !/\./.test(p));
    const named = after.find((p) => /run-it|world-tour|stray-kids/i.test(p)) || after[0];
    if (named) return humanizeSlug(named.replace(/^stray-kids-world-tour-/i, ""));
  }
  const popIdx = segs.findIndex((p) => /pop-?ups?/i.test(p));
  if (popIdx >= 0) {
    const names = segs.slice(popIdx + 1).filter((p) => !/\./.test(p) && !isLibraryPcFolderName(p));
    if (names.length >= 2) return `${humanizeSlug(names[0])} — ${humanizeSlug(names[1])}`;
    if (names[0]) return humanizeSlug(names[0]);
  }
  if (item.album_title?.trim()) return item.album_title.trim();
  return "";
}

export function merchGoodsProductSet(item: { image_url?: string | null; name?: string | null }): string {
  const segs = merchLogicalSegments(String(item.image_url || ""));
  if (segs.length < 2) return String(item.name || "").trim();
  const file = segs[segs.length - 1] || "";
  const parent = segs[segs.length - 2] || "";
  if (/^merch$/i.test(parent) || /pop-up-/i.test(parent) || /^pop-?ups?$/i.test(parent)) {
    return humanizeSlug(file);
  }
  return humanizeSlug(parent);
}

export function merchGoodsMeta(item: {
  image_url?: string | null;
  album_title?: string | null;
  name?: string | null;
  category?: string | null;
}): { kind: MerchGoodsKind; collection: string; productSet: string } {
  return {
    kind: merchGoodsKindFromItem(item),
    collection: merchGoodsCollectionName(item),
    productSet: merchGoodsProductSet(item),
  };
}

export function merchGoodsNameMatches(a: string, b: string): boolean {
  const ka = compactFolderKey(a);
  const kb = compactFolderKey(b);
  return Boolean(ka && kb && ka === kb);
}
