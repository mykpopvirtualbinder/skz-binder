import { collectionOptionDedupeKey, isSeasonsGreetings } from "./collection-filters";

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

export type FolderAlbumSource = "albums" | "seasons-greetings" | "events" | "memberships" | "collabs" | "other";

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
  const da = collectionOptionDedupeKey(folder.album_title);
  const db = collectionOptionDedupeKey(t);
  if (da && db && da === db) return true;
  if (isSeasonsGreetings(folder.album_title) || isSeasonsGreetings(t)) {
    const ya = da.startsWith("sg:") ? da : collectionOptionDedupeKey(folder.album_slug);
    const yb = db.startsWith("sg:") ? db : collectionOptionDedupeKey(t);
    if (ya && yb && ya === yb) return true;
  }
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

export function folderIsLibraryInclusionsCollection(folder: FolderTreeAlbum): boolean {
  return folder.hasInclusions || folder.inclusionVersions.length > 0;
}
