import fs from "fs";
import path from "path";
import type {
  FolderAlbumRegion,
  FolderAlbumSource,
  FolderTreeAlbum,
  FolderTreeCatalog,
} from "./folder-tree-catalog-shared";
import { isLibraryPcFolderName } from "./folder-tree-catalog-shared";

export type {
  FolderAlbumKind,
  FolderAlbumRegion,
  FolderAlbumSource,
  FolderTreeAlbum,
  FolderTreeCatalog,
} from "./folder-tree-catalog-shared";
export {
  compactFolderKey,
  folderAlbumMatchesTitle,
  folderAlbumFilterKey,
  findFolderAlbumByFilterKey,
  folderAlbumsForMerchFilters,
  mergeVersionLabels,
  folderMatchesLibraryGroup,
  folderVersionMatches,
  folderIsLibraryPhotocardsCollection,
  folderIsLibraryInclusionsCollection,
  itemIsMerchNotPhotocard,
  itemLibraryCollectionKind,
  folderLibraryCollectionKind,
  isLibraryPcFolderName,
  pathHasLibraryPcsUnderMerch,
  LIBRARY_COLLECTION_KIND_ORDER,
} from "./folder-tree-catalog-shared";

const ACCORDION_PACKAGING = new Set([
  "digipack",
  "jewel-case",
  "paper-case",
  "postcard",
  "fan-club",
  "fanclub",
  "compact",
]);

const SKIP_DIR_NAMES = /^(templates|desktop\.ini)$/i;
const KNOWN_ALBUM_BUCKETS = new Set([
  "photocards",
  "album",
  "pobs",
  "pob",
  "inclusions",
  "merch",
  "pop-ups",
  "pop-up",
  "portadas-album",
]);

function humanizeSlug(s: string) {
  return s
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

function regionFromFolder(name: string): FolderAlbumRegion | null {
  const n = String(name || "").trim().toLowerCase();
  if (n === "korean" || n === "korea" || n === "seoul" || /^korean[-_]?albums?$/.test(n)) return "korea";
  if (n === "japanese" || n === "japan" || /^japanese[-_]?albums?$/.test(n)) return "japan";
  if (n === "taiwanese" || n === "taiwan" || /^taiwanese[-_]?albums?$/.test(n)) return "taiwan";
  return null;
}

function isPortadasDirName(name: string) {
  const n = String(name || "").trim().toLowerCase();
  return (
    n === "portadas-album" ||
    n === "portadas album" ||
    n === "portadas de albums" ||
    n === "portadas de album" ||
    n === "album-covers" ||
    /^portadas[- ]+(de[- ]+)?albums?$/.test(n)
  );
}

function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((n) => !n.startsWith(".") && !/^silvia/i.test(n) && !SKIP_DIR_NAMES.test(n));
  } catch {
    return [];
  }
}

function dirHasImageFiles(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  try {
    return fs
      .readdirSync(dir)
      .some((f) => /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f) && !/-back\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f));
  } catch {
    return false;
  }
}

/** Todas las subcarpetas (inmediatas y anidadas), aunque estén vacías. */
function collectFolderSlugs(dir: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  function add(slug: string) {
    const t = String(slug || "").trim();
    if (!t || t === "default") return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  }
  const stack: { abs: string; rel: string }[] = [{ abs: dir, rel: "" }];
  while (stack.length) {
    const { abs, rel } = stack.pop()!;
    const children = listDirs(abs);
    if (rel) {
      add(rel);
      const leaf = rel.split("/").pop();
      if (leaf && leaf !== rel) add(leaf);
    }
    for (const child of children) {
      stack.push({ abs: path.join(abs, child), rel: rel ? `${rel}/${child}` : child });
    }
  }
  if (dirHasImageFiles(dir) && !seen.has("default")) add("default");
  return out;
}

/** Si la carpeta existe pero no tiene hijas, el propio nombre es seleccionable. */
function slugsOrSelf(dir: string | undefined, selfName: string): string[] {
  if (!dir) return [];
  const slugs = collectFolderSlugs(dir);
  if (slugs.length > 0) return slugs;
  return [selfName];
}

function normalizeKindSlug(name: string): string {
  const top = name.trim().toLowerCase();
  if (top === "fanclub") return "fan-club";
  return top;
}

/** Cualquier subcarpeta de portadas cuenta (también tipos nuevos vacíos). */
function kindsFromPortadasDir(portadasAbs: string): string[] {
  const kinds = new Set<string>();
  const children = listDirs(portadasAbs);
  if (children.length === 0) {
    kinds.add("regular");
    return [...kinds];
  }
  for (const child of children) {
    const top = normalizeKindSlug(child);
    if (top === "accordion") {
      const nested = listDirs(path.join(portadasAbs, child));
      if (nested.length === 0) {
        kinds.add("accordion");
        continue;
      }
      for (const n of nested) {
        const pack = normalizeKindSlug(n);
        if (ACCORDION_PACKAGING.has(pack) || pack === "fan-club") kinds.add(pack);
        else kinds.add(pack);
      }
      continue;
    }
    kinds.add(top);
  }
  return [...kinds];
}

function extraAlbumBucketVersions(albumDir: string, names: string[]): string[] {
  const out: string[] = [];
  for (const name of names) {
    const n = name.trim().toLowerCase();
    if (KNOWN_ALBUM_BUCKETS.has(n) || isPortadasDirName(name)) continue;
    out.push(...slugsOrSelf(path.join(albumDir, name), name.trim()));
  }
  return out;
}

function pushAlbum(albums: FolderTreeAlbum[], seen: Set<string>, row: FolderTreeAlbum) {
  const key = `${row.group_slug}:${row.region}:${row.source}:${row.album_slug}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  albums.push(row);
}

function scanMerchPcSets(args: {
  groupSlug: string;
  region: FolderAlbumRegion;
  albumSlug: string;
  albumTitle: string;
  albumDir: string;
  albums: FolderTreeAlbum[];
  seen: Set<string>;
}) {
  const merchName = listDirs(args.albumDir).find((n) => /^merch$/i.test(n));
  if (!merchName) return;
  const merchAbs = path.join(args.albumDir, merchName);
  const stack: { abs: string; rel: string }[] = [{ abs: merchAbs, rel: "" }];
  while (stack.length) {
    const { abs, rel } = stack.pop()!;
    for (const child of listDirs(abs)) {
      const childAbs = path.join(abs, child);
      const childRel = rel ? `${rel}/${child}` : child;
      if (isLibraryPcFolderName(child)) {
        pushAlbum(args.albums, args.seen, {
          group_slug: args.groupSlug,
          region: args.region,
          album_slug: `${path.basename(args.albumDir).trim()}--merch--${childRel.replace(/\//g, "--").trim()}`,
          album_title: `${args.albumTitle} — ${humanizeSlug(child)}`,
          source: "merch",
          hasPortadas: false,
          hasPhotocards: true,
          hasPobs: /^pobs?$/i.test(child),
          hasInclusions: false,
          portadasKinds: [],
          photocardsVersions: slugsOrSelf(childAbs, child.trim()),
          pobVersions: [],
          inclusionVersions: [],
        });
        continue;
      }
      stack.push({ abs: childAbs, rel: childRel });
    }
  }
}

function scanAlbumLikeDir(args: {
  groupSlug: string;
  region: FolderAlbumRegion;
  albumSlug: string;
  albumTitle: string;
  albumDir: string;
  source: FolderAlbumSource;
}): FolderTreeAlbum {
  const { groupSlug, region, albumSlug, albumTitle, albumDir, source } = args;
  const names = listDirs(albumDir);
  const filesHere = dirHasImageFiles(albumDir);
  const portadasName = names.find((n) => isPortadasDirName(n));
  const portadasKinds = portadasName
    ? kindsFromPortadasDir(path.join(albumDir, portadasName))
    : filesHere
      ? ["regular"]
      : [];

  const photocardsDir = names.find((n) => /^photocards$/i.test(n));
  const albumBucketDir = names.find((n) => /^album$/i.test(n));
  const pobsDir = names.find((n) => /^pobs?$/i.test(n));
  const inclusionsDir = names.find((n) => /^inclusions$/i.test(n));
  const popupsDir = names.find((n) => /^pop-?ups?$/i.test(n));

  const photocardsVersions = [
    ...(photocardsDir ? slugsOrSelf(path.join(albumDir, photocardsDir), "photocards") : []),
    ...(albumBucketDir ? slugsOrSelf(path.join(albumDir, albumBucketDir), "album") : []),
    ...(popupsDir ? slugsOrSelf(path.join(albumDir, popupsDir), "pop-ups") : []),
    ...extraAlbumBucketVersions(albumDir, names),
  ];

  return {
    group_slug: groupSlug,
    region,
    album_slug: albumSlug,
    album_title: albumTitle,
    source,
    hasPortadas: Boolean(portadasName) || filesHere,
    hasPhotocards: Boolean(photocardsDir || albumBucketDir || popupsDir) || photocardsVersions.length > 0,
    hasPobs: Boolean(pobsDir),
    hasInclusions: Boolean(inclusionsDir),
    portadasKinds,
    photocardsVersions,
    pobVersions: pobsDir ? slugsOrSelf(path.join(albumDir, pobsDir), "pobs") : [],
    inclusionVersions: inclusionsDir ? slugsOrSelf(path.join(albumDir, inclusionsDir), "inclusions") : [],
  };
}

function scanLooseCollection(args: {
  groupSlug: string;
  region: FolderAlbumRegion;
  albumSlug: string;
  albumTitle: string;
  dir: string;
  source: FolderAlbumSource;
}): FolderTreeAlbum {
  const names = listDirs(args.dir);
  const photocardsDir = names.find((n) => /^photocards$/i.test(n));
  const pobsDir = names.find((n) => /^pobs?$/i.test(n));
  const inclusionsDir = names.find((n) => /^inclusions$/i.test(n));
  const versions = collectFolderSlugs(args.dir);
  return {
    group_slug: args.groupSlug,
    region: args.region,
    album_slug: args.albumSlug,
    album_title: args.albumTitle,
    source: args.source,
    hasPortadas: false,
    hasPhotocards: true,
    hasPobs: Boolean(pobsDir),
    hasInclusions: Boolean(inclusionsDir),
    portadasKinds: [],
    photocardsVersions: photocardsDir ? slugsOrSelf(path.join(args.dir, photocardsDir), "photocards") : versions.length > 0 ? versions : [args.albumSlug],
    pobVersions: pobsDir ? slugsOrSelf(path.join(args.dir, pobsDir), "pobs") : [],
    inclusionVersions: inclusionsDir ? slugsOrSelf(path.join(args.dir, inclusionsDir), "inclusions") : [],
  };
}

function isAlbumLikeDir(names: string[]): boolean {
  return names.some(
    (n) =>
      isPortadasDirName(n) ||
      /^photocards$/i.test(n) ||
      /^album$/i.test(n) ||
      /^pobs?$/i.test(n) ||
      /^inclusions$/i.test(n) ||
      isLibraryPcFolderName(n),
  );
}

const GROUPING_FOLDER_NAMES = new Set([
  "korean",
  "japanese",
  "taiwanese",
  "taiwan",
  "korea",
  "japan",
  "seoul",
  "korean-album",
  "korean-albums",
  "japanese-albums",
  "taiwanese-albums",
  "brands",
  "magazines",
  "pop-ups",
  "pop-up",
  "tours",
  "tour",
  "events",
  "eventos",
  "collabs",
  "memberships",
  "seasons-greetings",
  "japanese-md",
]);

function sourceFromTopLevel(top: string, relParts: string[]): FolderAlbumSource {
  const t = top.trim().toLowerCase();
  if (t === "albums") return "albums";
  const parts = relParts.map((p) => p.trim().toLowerCase());
  const head = parts[0] || t;
  if (head === "seasons-greetings" || parts.includes("seasons-greetings")) return "seasons-greetings";
  if (head === "memberships" || parts.includes("memberships")) return "memberships";
  if (head === "collabs" || parts.includes("collabs")) return "collabs";
  if (head === "tours" || head === "tour" || parts.includes("tours") || parts.includes("tour")) return "tours";
  if (head === "japanese-md" || parts.includes("japanese-md")) return "merch";
  if (head === "pop-ups" || head === "pop-up" || parts.includes("pop-ups") || parts.includes("pop-up")) return "pop-ups";
  if (t === "events" || t === "eventos" || head === "events" || head === "eventos") return "events";
  if (
    /^(korean|japanese|taiwanese)[-_]?albums?$/.test(head) ||
    head === "korean" ||
    head === "japanese" ||
    head === "taiwanese"
  ) {
    return "albums";
  }
  if (t === "photocards" || t === "photocard") {
    if (head !== t && /^(korean|japanese|taiwanese)[-_]?albums?$/.test(head)) return "albums";
    if (parts.length > 0 && head !== t) return sourceFromTopLevel(head, parts.slice(1));
    return "other";
  }
  return "other";
}

function collectionTitle(dirName: string, parentName: string | undefined): string {
  const title = humanizeSlug(dirName);
  if (parentName && /^japanese-md$/i.test(parentName)) return `${humanizeSlug(parentName)} — ${title}`;
  if (parentName && regionFromFolder(dirName)) return `${humanizeSlug(parentName)} ${title}`;
  return title;
}

/**
 * Recorre el disco en vivo. Carpetas nuevas vacías entran solas en el índice
 * (no hay lista fija de álbumes). Junk: templates, silvia*, .*, desktop.ini.
 */
export function scanFolderTreeCatalog(cwd: string = process.cwd()): FolderTreeCatalog {
  const groupsRoot = path.join(cwd, "public", "mock-pcs", "groups");
  const albums: FolderTreeAlbum[] = [];
  const seen = new Set<string>();
  if (!fs.existsSync(groupsRoot)) return { albums };

  function addAlbumLike(args: {
    groupSlug: string;
    region: FolderAlbumRegion;
    albumSlug: string;
    albumTitle: string;
    albumDir: string;
    source: FolderAlbumSource;
  }) {
    pushAlbum(albums, seen, scanAlbumLikeDir(args));
    scanMerchPcSets({ ...args, albums, seen });
  }

  function walkLoose(args: {
    groupSlug: string;
    region: FolderAlbumRegion;
    source: FolderAlbumSource;
    slug: string;
    title: string;
    dir: string;
    depth: number;
    parentName?: string;
  }) {
    const names = listDirs(args.dir);
    if (isAlbumLikeDir(names)) {
      addAlbumLike({
        groupSlug: args.groupSlug,
        region: args.region,
        albumSlug: args.slug,
        albumTitle: args.title,
        albumDir: args.dir,
        source: args.source,
      });
      return;
    }
    if (names.length === 0) {
      pushAlbum(
        albums,
        seen,
        scanLooseCollection({
          groupSlug: args.groupSlug,
          region: args.region,
          albumSlug: args.slug,
          albumTitle: args.title,
          dir: args.dir,
          source: args.source,
        }),
      );
      return;
    }
    const base = path.basename(args.dir).trim().toLowerCase();
    const keepWalking = args.depth < 1 || (GROUPING_FOLDER_NAMES.has(base) && args.depth < 4);
    if (keepWalking) {
      for (const child of names) {
        const childKey = child.trim().toLowerCase();
        if (childKey === "seasons-greetings") {
          const kindDir = path.join(args.dir, child);
          for (const regionFolder of listDirs(kindDir)) {
            const region = regionFromFolder(regionFolder) ?? args.region;
            const regionDir = path.join(kindDir, regionFolder);
            for (const yearRaw of listDirs(regionDir)) {
              addAlbumLike({
                groupSlug: args.groupSlug,
                region,
                albumSlug: yearRaw.trim(),
                albumTitle: humanizeSlug(yearRaw),
                albumDir: path.join(regionDir, yearRaw),
                source: "seasons-greetings",
              });
            }
          }
          continue;
        }
        let childSource = args.source;
        if (childKey === "tours" || childKey === "tour") childSource = "tours";
        else if (childKey === "japanese-md") childSource = "merch";
        else if (childKey === "pop-ups" || childKey === "pop-up") childSource = "pop-ups";
        else if (childKey === "memberships") childSource = "memberships";
        else if (childKey === "collabs") childSource = "collabs";
        else if (childKey === "events" || childKey === "eventos") childSource = "events";
        else if (/^(korean|japanese|taiwanese)[-_]?albums?$/.test(childKey)) childSource = "albums";
        const childRegion =
          childKey === "japanese-md" ? "japan" : regionFromFolder(child) ?? args.region;
        walkLoose({
          groupSlug: args.groupSlug,
          region: childRegion,
          source: childSource,
          slug: `${args.slug}-${child.trim()}`,
          title: collectionTitle(child, path.basename(args.dir)),
          dir: path.join(args.dir, child),
          depth: args.depth + 1,
          parentName: path.basename(args.dir),
        });
      }
      return;
    }
    pushAlbum(
      albums,
      seen,
      scanLooseCollection({
        groupSlug: args.groupSlug,
        region: args.region,
        albumSlug: args.slug,
        albumTitle: args.title,
        dir: args.dir,
        source: args.source,
      }),
    );
    scanMerchPcSets({
      groupSlug: args.groupSlug,
      region: args.region,
      albumSlug: args.slug,
      albumTitle: args.title,
      albumDir: args.dir,
      albums,
      seen,
    });
  }

  for (const groupSlug of listDirs(groupsRoot)) {
    const groupDir = path.join(groupsRoot, groupSlug);

    const albumsRoot = path.join(groupDir, "albums");
    if (fs.existsSync(albumsRoot)) {
      for (const regionFolder of listDirs(albumsRoot)) {
        const region = regionFromFolder(regionFolder) ?? "unknown";
        const regionDir = path.join(albumsRoot, regionFolder);
        for (const albumSlugRaw of listDirs(regionDir)) {
          const albumSlug = albumSlugRaw.trim();
          addAlbumLike({
            groupSlug,
            region,
            albumSlug,
            albumTitle: humanizeSlug(albumSlug),
            albumDir: path.join(regionDir, albumSlugRaw),
            source: "albums",
          });
        }
      }
    }

    for (const top of listDirs(groupDir)) {
      const t = top.trim().toLowerCase();
      if (t === "albums") continue;
      const topDir = path.join(groupDir, top);
      if (t === "others" || t === "otros") {
        for (const kind of listDirs(topDir)) {
          const kindDir = path.join(topDir, kind);
          const source = sourceFromTopLevel(top, [kind]);
          if (source === "seasons-greetings") {
            for (const regionFolder of listDirs(kindDir)) {
              const region = regionFromFolder(regionFolder) ?? "unknown";
              const regionDir = path.join(kindDir, regionFolder);
              for (const yearRaw of listDirs(regionDir)) {
                addAlbumLike({
                  groupSlug,
                  region,
                  albumSlug: yearRaw.trim(),
                  albumTitle: humanizeSlug(yearRaw),
                  albumDir: path.join(regionDir, yearRaw),
                  source: "seasons-greetings",
                });
              }
            }
            continue;
          }
          walkLoose({
            groupSlug,
            region: "korea",
            source,
            slug: kind.trim(),
            title: humanizeSlug(kind),
            dir: kindDir,
            depth: 1,
            parentName: kind,
          });
        }
        continue;
      }
      if (t === "events" || t === "eventos") {
        for (const kind of listDirs(topDir)) {
          const k = kind.trim().toLowerCase();
          const source: FolderAlbumSource =
            k === "tours" || k === "tour" ? "tours" : k === "pop-ups" || k === "pop-up" ? "pop-ups" : "events";
          walkLoose({
            groupSlug,
            region: "korea",
            source,
            slug: kind.trim(),
            title: humanizeSlug(kind),
            dir: path.join(topDir, kind),
            depth: 1,
            parentName: kind,
          });
        }
        continue;
      }
      walkLoose({
        groupSlug,
        region: "korea",
        source: sourceFromTopLevel(top, []),
        slug: top.trim(),
        title: humanizeSlug(top),
        dir: topDir,
        depth: 0,
        parentName: top,
      });
    }
  }

  return { albums };
}
