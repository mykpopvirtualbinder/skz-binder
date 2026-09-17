import { collectionOptionDedupeKey } from "./collection-filters";

export type FolderAlbumRegion = "korea" | "japan" | "taiwan" | "unknown";
export type FolderAlbumKind =
  | "regular"
  | "accordion"
  | "digipack"
  | "jewel-case"
  | "paper-case"
  | "postcard"
  | "fan-club"
  | "vinyl"
  | "skzoo"
  | "platform"
  | "limited"
  | "other";

export type FolderAlbumSource =
  | "albums"
  | "seasons-greetings"
  | "tours"
  | "merch"
  | "pop-ups"
  | "events"
  | "memberships"
  | "collabs"
  | "other";

export type LibraryCollectionKind = "all" | FolderAlbumSource;

export const LIBRARY_COLLECTION_KIND_ORDER: Exclude<LibraryCollectionKind, "all">[] = [
  "albums",
  "seasons-greetings",
  "tours",
  "merch",
  "pop-ups",
  "memberships",
  "collabs",
  "events",
  "other",
];

export type FolderTreeAlbum = {
  group_slug: string;
  region: FolderAlbumRegion;
  album_slug: string;
  album_title: string;
  source: FolderAlbumSource;
  hasPortadas: boolean;
  hasPhotocards: boolean;
  hasPobs: boolean;
  hasInclusions: boolean;
  /** Slugs de `portadas-album/` (incl. tipos nuevos, no solo el enum fijo). */
  portadasKinds: string[];
  photocardsVersions: string[];
  pobVersions: string[];
  inclusionVersions: string[];
};

export type FolderTreeCatalog = {
  albums: FolderTreeAlbum[];
};

export function compactFolderKey(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function folderVersionMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = compactFolderKey(String(a || ""));
  const kb = compactFolderKey(String(b || ""));
  return Boolean(ka && kb && ka === kb);
}

export function folderAlbumMatchesTitle(folder: FolderTreeAlbum, title: string): boolean {
  const t = String(title || "").trim();
  if (!t) return false;
  const a = compactFolderKey(folder.album_title);
  const b = compactFolderKey(t);
  if (a && b && a === b) return true;
  const slug = compactFolderKey(folder.album_slug.replace(/&/g, "and"));
  if (slug && b && (slug === b || slug === compactFolderKey(t.replace(/&/g, "and")))) return true;
  const da = collectionOptionDedupeKey(folder.album_title, null, folder.region);
  const db = collectionOptionDedupeKey(t);
  if (da && db && da === db) return true;
  const slugKey = collectionOptionDedupeKey(folder.album_slug, null, folder.region);
  if (slugKey && db && slugKey === db) return true;
  return false;
}

export function folderAlbumFilterKey(folder: FolderTreeAlbum): string {
  return `folder:${folder.group_slug}:${folder.region}:${folder.source}:${folder.album_slug}`;
}

export function findFolderAlbumByFilterKey(
  catalog: FolderTreeCatalog | null | undefined,
  key: string,
): FolderTreeAlbum | undefined {
  if (!key.startsWith("folder:")) return undefined;
  return (catalog?.albums ?? []).find((a) => folderAlbumFilterKey(a) === key);
}

export function folderAlbumsForMerchFilters(
  catalog: FolderTreeCatalog | null | undefined,
  opts: { group: string; region: string; albumTitle: string },
): FolderTreeAlbum[] {
  const albums = catalog?.albums ?? [];
  return albums.filter((a) => {
    if (a.source !== "albums") return false;
    if (opts.group !== "Todos") {
      const g = a.group_slug.replace(/[-_]+/g, " ");
      if (!compactFolderKey(g).includes(compactFolderKey(opts.group)) && !compactFolderKey(opts.group).includes(compactFolderKey(g))) {
        return false;
      }
    }
    if (opts.region !== "Todos" && a.region !== opts.region) return false;
    if (opts.albumTitle !== "Todos" && !folderAlbumMatchesTitle(a, opts.albumTitle)) return false;
    return true;
  });
}

export function mergeVersionLabels(fromItems: string[], fromFolders: string[]): string[] {
  const map = new Map<string, string>();
  for (const v of fromItems) {
    const trimmed = String(v || "").trim();
    if (!trimmed) continue;
    const k = compactFolderKey(trimmed);
    if (k && !map.has(k)) map.set(k, trimmed);
  }
  for (const v of fromFolders) {
    const trimmed = String(v || "").trim();
    if (!trimmed || trimmed === "default") continue;
    const k = compactFolderKey(trimmed);
    if (k && !map.has(k)) map.set(k, trimmed);
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true }));
}

export function folderMatchesLibraryGroup(
  folder: FolderTreeAlbum,
  groupName: string | null | undefined,
): boolean {
  const n = String(groupName || "").trim();
  if (!n) return true;
  const slug = folder.group_slug.replace(/[-_]+/g, " ");
  const a = compactFolderKey(slug);
  const b = compactFolderKey(n);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

export function folderIsLibraryPhotocardsCollection(folder: FolderTreeAlbum): boolean {
  if (folder.source !== "albums") return true;
  return folder.hasPhotocards || folder.hasPobs || folder.photocardsVersions.length > 0 || folder.pobVersions.length > 0;
}

const LIBRARY_PC_FOLDER =
  /(^|\/)(photocards?|photo-?cards?|pobs?|polaroids?|polaroid-set|photo-card-set|photocard-set|trading-cards?)(\/|$)/i;

export function isLibraryPcFolderName(name: string): boolean {
  const n = String(name || "").trim();
  if (!n) return false;
  if (/^(playing-cards?|trading-card-case)$/i.test(n)) return false;
  if (/^(photocards?|photo-?cards?|pobs?|polaroid-set)$/i.test(n)) return true;
  if (/photocard-set|photo-card-set|polaroid-set/i.test(n)) return true;
  if (/^trading-cards?(-[a-z0-9]+)?$/i.test(n)) return true;
  return false;
}

/** Photocards that live under a merch folder (not playing cards / polaroid goods). */
export function pathHasLibraryPcsUnderMerch(raw: string): boolean {
  const parts = String(raw || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  const merchAt = parts.findIndex((p) => /^merch$/i.test(p));
  if (merchAt < 0) return false;
  return parts.slice(merchAt + 1).some((p) => isLibraryPcFolderName(p));
}

function decodeCatalogPath(raw: string): string {
  const s = String(raw || "").split("?")[0];
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function itemCatalogBlob(item: {
  type?: string | null;
  image_url?: string | null;
  version?: string | null;
}): { url: string; blob: string } {
  const type = String(item.type ?? "");
  const version = String(item.version ?? "");
  const url = decodeCatalogPath(String(item.image_url ?? "")).replace(/\\/g, "/");
  return { url, blob: `${type} ${url} ${version}`.toLowerCase() };
}

/** Playing cards and tour clothes stay on /merch. Photocard-sets and polaroid-sets under merch go to Library. */
export function itemIsMerchNotPhotocard(item: {
  type?: string | null;
  image_url?: string | null;
  version?: string | null;
}): boolean {
  const { url, blob } = itemCatalogBlob(item);

  if (/(^|\/)merch(\/|$)/i.test(String(item.type ?? "")) || /\/merch\//i.test(url)) {
    if (pathHasLibraryPcsUnderMerch(blob)) return false;
    return true;
  }

  const popUp = /pop[\s_%-]*ups?/.test(blob);
  if (popUp && !LIBRARY_PC_FOLDER.test(blob.replace(/\\/g, "/"))) return true;

  if (/\/(events|eventos)\//i.test(url) || /(^|\/)events?\//i.test(String(item.type ?? ""))) {
    const looksLikePcFile = /\d{2,3}-(?:front|back)-/i.test(url);
    if (!LIBRARY_PC_FOLDER.test(blob) && !looksLikePcFile) return true;
  }

  return false;
}

export function itemLibraryCollectionKind(item: {
  type?: string | null;
  image_url?: string | null;
  version?: string | null;
}): Exclude<LibraryCollectionKind, "all"> {
  const { url, blob } = itemCatalogBlob(item);
  const path = blob.replace(/\\/g, "/");

  if (/\/merch\//i.test(url) || /(^|\/)merch(\/|$)/i.test(String(item.type ?? ""))) {
    if (pathHasLibraryPcsUnderMerch(path)) return "merch";
  }
  if (/japanese[-_]?md/i.test(path)) return "merch";
  if (/seasons[-_ ]greetings|season'?s?\s*greetings/i.test(path)) return "seasons-greetings";
  if (/(^|\/)(tours?|tour)(\/|$)/i.test(path) || /\brun[\s._-]*it\b/i.test(path)) return "tours";
  if (/pop[\s_%-]*ups?/i.test(path)) return "pop-ups";
  if (/(^|\/)memberships?(\/|$)/i.test(path)) return "memberships";
  if (/(^|\/)collabs?(\/|$)/i.test(path)) return "collabs";
  if (/(^|\/)(events|eventos)(\/|$)/i.test(path)) return "events";
  if (
    /(^|\/)albums?(\/|$)/i.test(path) ||
    /(^|\/)(korean|japanese|taiwanese)[-_]?albums?(\/|$)/i.test(path)
  ) {
    return "albums";
  }
  return "other";
}

export function folderLibraryCollectionKind(folder: FolderTreeAlbum): Exclude<LibraryCollectionKind, "all"> {
  if (folder.source === "albums") return "albums";
  if (folder.source === "seasons-greetings") return "seasons-greetings";
  if (folder.source === "tours") return "tours";
  if (folder.source === "merch") return "merch";
  if (folder.source === "pop-ups") return "pop-ups";
  if (folder.source === "memberships") return "memberships";
  if (folder.source === "collabs") return "collabs";
  if (folder.source === "events") return "events";
  const slug = `${folder.album_slug} ${folder.album_title}`.toLowerCase();
  if (/(^|\/)(tours?|tour)(\/|$)/i.test(slug) || /\brun[\s._-]*it\b/i.test(slug)) return "tours";
  if (/pop[\s_%-]*ups?/i.test(slug)) return "pop-ups";
  if (/merch/i.test(slug)) return "merch";
  return "other";
}

export function folderIsLibraryInclusionsCollection(folder: FolderTreeAlbum): boolean {
  return folder.hasInclusions || folder.inclusionVersions.length > 0;
}
