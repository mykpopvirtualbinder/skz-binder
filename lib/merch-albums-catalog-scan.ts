import { createHash } from "crypto";
import fs from "fs";
import path from "path";

export type MerchAlbumCatalogRow = {
  id: string;
  name: string;
  category: string;
  group_name: string;
  image_url: string;
  rarity: string;
  album_title: string;
  album_type: string | null;
  album_version: string;
};

const ALBUM_CATEGORY = "Álbumes";

function isAlbumBucket(name: string) {
  return /-albums?$/i.test(name) || /^(korean|japanese|taiwanese|taiwan)$/i.test(name);
}

function isPackagingFolderName(name: string) {
  const n = String(name || "").toLowerCase();
  if (!n) return false;
  if (/^fan-?club$/i.test(n)) return true;
  return /^(accordion|digipack|vinyl|paper-case|jewel-case|postcard|platform|compact|skzoo)$/i.test(n);
}

const ACCORDION_PACKAGING_FOLDERS = new Set([
  "digipack",
  "jewel-case",
  "paper-case",
  "postcard",
  "fan-club",
  "fanclub",
  "compact",
]);

function isPortadasDirName(name: string) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return false;
  return (
    n === "portadas-album" ||
    n === "portadas album" ||
    n === "portadas de albums" ||
    n === "portadas de album" ||
    n === "album-covers" ||
    /^portadas[- ]+(de[- ]+)?albums?$/.test(n)
  );
}

function isKindFolderName(name: string) {
  const n = String(name || "").trim().toLowerCase();
  return /^(regular|accordion|vinyl|skzoo|platform)$/.test(n);
}

function humanizeSlug(s: string) {
  return s
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

function uuidFromPath(key: string) {
  const hash = createHash("sha256").update(key, "utf8").digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function listImageFronts(dir: string) {
  const files = fs.readdirSync(dir);
  return files
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .filter((f) => !/-back\.(png|jpe?g|webp)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function walkDirs(root: string) {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current) break;
    if (!fs.existsSync(current)) break;
    out.push(current);
    for (const name of fs.readdirSync(current, { withFileTypes: true })) {
      if (name.isDirectory()) stack.push(path.join(current, name.name));
    }
  }
  return out;
}

function buildName(album_title: string, album_type: string, album_version: string) {
  if (album_type) return `${album_title} — ${album_type.replace(/\//g, " · ")} · ${album_version}`;
  return `${album_title} — ${album_version}`;
}

/**
 * Escanea un árbol bajo `rootAbs`.
 * `mapRel` convierte relativo a rootAbs → ruta lógica grupo/región/álbum (ej. stray-kids/korean/5star).
 * `publicDir` es `.../public` para construir image_url con la ruta real en disco.
 */
function scanTree(
  rootAbs: string,
  mapRel: (rel: string) => string,
  publicDir: string,
): MerchAlbumCatalogRow[] {
  const rows: MerchAlbumCatalogRow[] = [];

  function toPublicImageUrl(publicRelFile: string) {
    const relUrl = publicRelFile
      .split("/")
      .filter(Boolean)
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    return `/${relUrl}`;
  }

  function publicRelFor(dir: string, file: string) {
    return path.relative(publicDir, path.join(dir, file)).replace(/\\/g, "/");
  }

  function pushRow(args: {
    groupName: string;
    albumSlug: string;
    album_type: string | null;
    album_version: string;
    dir: string;
    file: string;
  }) {
    const { groupName, albumSlug, album_type, album_version, dir, file } = args;
    const album_title = humanizeSlug(albumSlug);
    const publicRelFile = publicRelFor(dir, file);
    const id = uuidFromPath(`merch-album:${publicRelFile}`);
    const image_url = toPublicImageUrl(publicRelFile);
    rows.push({
      id,
      name: buildName(album_title, album_type ?? "", album_version),
      category: ALBUM_CATEGORY,
      group_name: groupName,
      image_url,
      rarity: "Común",
      album_title,
      album_type: album_type && String(album_type).trim() ? album_type : null,
      album_version,
    });
  }

  if (!fs.existsSync(rootAbs)) return [];

  const dirs = walkDirs(rootAbs);

  for (const dir of dirs) {
    const rawRel = path.relative(rootAbs, dir).replace(/\\/g, "/");
    if (!rawRel || rawRel === ".") continue;
    const rel = mapRel(rawRel);
    const parts = rel.split("/").filter(Boolean);
    if (parts.length !== 3) continue;
    if (!isAlbumBucket(parts[1]!)) continue;

    const groupName = parts[0]!;
    const albumSlug = parts[2]!;
    const files = listImageFronts(dir);
    for (const f of files) {
      const stem = f.replace(/\.(png|jpe?g|webp)$/i, "");
      pushRow({
        groupName,
        albumSlug,
        album_type: null,
        album_version: humanizeSlug(stem),
        dir,
        file: f,
      });
    }
  }

  for (const dir of dirs) {
    const rawRel = path.relative(rootAbs, dir).replace(/\\/g, "/");
    if (!rawRel || rawRel === ".") continue;
    const rel = mapRel(rawRel);
    const parts = rel.split("/").filter(Boolean);
    if (parts.length < 4) continue;
    if (!isAlbumBucket(parts[1]!)) continue;

    const files = listImageFronts(dir);
    if (files.length === 0) continue;

    const groupName = parts[0]!;
    const albumSlug = parts[2]!;
    const tail = parts.slice(3);

    if (tail.length >= 2) {
      const versionSlug = tail[tail.length - 1]!;
      const middle = tail.slice(0, -1);
      const album_type = middle.join("/");
      const folderVersion = humanizeSlug(versionSlug);
      for (const f of files) {
        const stem = f.replace(/\.(png|jpe?g|webp)$/i, "");
        const album_version = files.length > 1 ? humanizeSlug(stem) : folderVersion;
        pushRow({
          groupName,
          albumSlug,
          album_type,
          album_version,
          dir,
          file: f,
        });
      }
      continue;
    }

    const leaf = tail[0]!;
    if (isPackagingFolderName(leaf)) {
      for (const f of files) {
        const stem = f.replace(/\.(png|jpe?g|webp)$/i, "");
        pushRow({
          groupName,
          albumSlug,
          album_type: leaf,
          album_version: humanizeSlug(stem),
          dir,
          file: f,
        });
      }
    } else {
      for (const f of files) {
        const stem = f.replace(/\.(png|jpe?g|webp)$/i, "");
        const album_version = files.length > 1 ? humanizeSlug(stem) : humanizeSlug(leaf);
        pushRow({
          groupName,
          albumSlug,
          album_type: null,
          album_version,
          dir,
          file: f,
        });
      }
    }
  }

  return rows;
}

/**
 * Árbol actual:
 * `groups/<grupo>/albums/<región>/<álbum>/portadas-album/{regular|accordion|skzoo|vinyl}/…`
 *
 * Legado (grupo):
 * `groups/<grupo>/portadas de albums/<región>/<álbum>/…`
 */
function scanPortadasTreeForAlbum(args: {
  groupName: string;
  albumSlug: string;
  portadasAbs: string;
  publicDir: string;
}): MerchAlbumCatalogRow[] {
  const { groupName, albumSlug, portadasAbs, publicDir } = args;
  const rows: MerchAlbumCatalogRow[] = [];
  if (!fs.existsSync(portadasAbs)) return rows;

  function toPublicImageUrl(publicRelFile: string) {
    const relUrl = publicRelFile
      .split("/")
      .filter(Boolean)
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    return `/${relUrl}`;
  }

  function pushFromDir(dir: string, album_type: string | null) {
    const files = listImageFronts(dir);
    if (files.length === 0) return;
    for (const file of files) {
      const stem = file.replace(/\.(png|jpe?g|webp)$/i, "");
      const album_version = humanizeSlug(stem);
      const publicRelFile = path.relative(publicDir, path.join(dir, file)).replace(/\\/g, "/");
      const id = uuidFromPath(`merch-album:${publicRelFile}`);
      const album_title = humanizeSlug(albumSlug);
      rows.push({
        id,
        name: buildName(album_title, album_type ?? "", album_version),
        category: ALBUM_CATEGORY,
        group_name: groupName,
        image_url: toPublicImageUrl(publicRelFile),
        rarity: "Común",
        album_title,
        album_type: album_type && String(album_type).trim() ? album_type : null,
        album_version,
      });
    }
  }

  const dirs = walkDirs(portadasAbs);
  for (const dir of dirs) {
    const rel = path.relative(portadasAbs, dir).replace(/\\/g, "/");
    const parts = rel && rel !== "." ? rel.split("/").filter(Boolean) : [];
    const files = listImageFronts(dir);
    if (files.length === 0) continue;

    if (parts.length === 0) {
      pushFromDir(dir, null);
      continue;
    }

    const top = parts[0]!.toLowerCase();
    if (top === "regular") {
      pushFromDir(dir, null);
      continue;
    }
    if (top === "accordion") {
      const nested = parts.slice(1);
      if (nested.length === 0) {
        pushFromDir(dir, "accordion");
        continue;
      }
      const packaging = nested[0]!.toLowerCase();
      const album_type = ACCORDION_PACKAGING_FOLDERS.has(packaging)
        ? packaging === "fanclub"
          ? "fan-club"
          : packaging
        : nested.join("/");
      pushFromDir(dir, album_type);
      continue;
    }
    if (isKindFolderName(top) || isPackagingFolderName(top)) {
      const album_type = top === "fanclub" ? "fan-club" : top;
      pushFromDir(dir, album_type);
      continue;
    }

    pushFromDir(dir, parts.join("/"));
  }

  return rows;
}

function scanAlbumsEmbeddedPortadas(cwd: string, publicDir: string): MerchAlbumCatalogRow[] {
  const groupsRoot = path.join(cwd, "public", "mock-pcs", "groups");
  if (!fs.existsSync(groupsRoot)) return [];
  const rows: MerchAlbumCatalogRow[] = [];

  for (const groupEntry of fs.readdirSync(groupsRoot, { withFileTypes: true })) {
    if (!groupEntry.isDirectory()) continue;
    const albumsRoot = path.join(groupsRoot, groupEntry.name, "albums");
    if (!fs.existsSync(albumsRoot)) continue;

    for (const regionEntry of fs.readdirSync(albumsRoot, { withFileTypes: true })) {
      if (!regionEntry.isDirectory()) continue;
      if (!isAlbumBucket(regionEntry.name)) continue;
      const regionDir = path.join(albumsRoot, regionEntry.name);

      for (const albumEntry of fs.readdirSync(regionDir, { withFileTypes: true })) {
        if (!albumEntry.isDirectory()) continue;
        const albumDir = path.join(regionDir, albumEntry.name);
        let names: string[] = [];
        try {
          names = fs.readdirSync(albumDir);
        } catch {
          continue;
        }
        for (const name of names) {
          if (!isPortadasDirName(name)) continue;
          const portadasAbs = path.join(albumDir, name);
          if (!fs.statSync(portadasAbs).isDirectory()) continue;
          rows.push(
            ...scanPortadasTreeForAlbum({
              groupName: groupEntry.name,
              albumSlug: albumEntry.name,
              portadasAbs,
              publicDir,
            }),
          );
        }
      }
    }
  }

  return rows;
}

function scanMockPcsGroupLevelPortadas(cwd: string, publicDir: string): MerchAlbumCatalogRow[] {
  const groupsRoot = path.join(cwd, "public", "mock-pcs", "groups");
  if (!fs.existsSync(groupsRoot)) return [];
  const rows: MerchAlbumCatalogRow[] = [];
  for (const entry of fs.readdirSync(groupsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let names: string[] = [];
    try {
      names = fs.readdirSync(path.join(groupsRoot, entry.name));
    } catch {
      continue;
    }
    for (const coversName of names) {
      if (!isPortadasDirName(coversName)) continue;
      const root = path.join(groupsRoot, entry.name, coversName);
      if (!fs.statSync(root).isDirectory()) continue;
      rows.push(
        ...scanTree(
          root,
          (r) => {
            const cleaned = String(r || "").replace(/^other\//i, "");
            return cleaned ? `${entry.name}/${cleaned}` : entry.name;
          },
          publicDir,
        ),
      );
    }
  }
  return rows;
}

/**
 * Escanea álbumes para merch:
 * - `public/mock-pcs/groups/<grupo>/albums/<región>/<álbum>/portadas-album/…`
 * - `public/mock-pcs/groups/<grupo>/portadas de albums/<región>/<álbum>/…` (legado)
 * - `public/albums/<grupo>/korean|japanese|taiwan/<álbum>/…` (legado)
 * - `public/stray-kids/korean/…` si albums está vacío
 */
export function scanMerchAlbumsFromPublicAlbums(cwd: string = process.cwd()): MerchAlbumCatalogRow[] {
  const publicDir = path.join(cwd, "public");
  const fromEmbedded = scanAlbumsEmbeddedPortadas(cwd, publicDir);
  const fromGroupLevel = fromEmbedded.length > 0 ? [] : scanMockPcsGroupLevelPortadas(cwd, publicDir);
  const fromPortadas = fromEmbedded.length > 0 ? fromEmbedded : fromGroupLevel;
  const primary = path.join(cwd, "public", "albums");
  const legacyStrayKids = path.join(cwd, "public", "stray-kids");

  const fromPrimary = fs.existsSync(primary) ? scanTree(primary, (r) => r, publicDir) : [];
  let fromLegacy: MerchAlbumCatalogRow[] = [];
  if (fromPortadas.length === 0 && fromPrimary.length === 0 && fs.existsSync(legacyStrayKids)) {
    fromLegacy = scanTree(legacyStrayKids, (r) => (r ? `stray-kids/${r}` : "stray-kids"), publicDir);
  }

  const merged = fromPortadas.length > 0 ? fromPortadas : [...fromPrimary, ...fromLegacy];
  const seen = new Map<string, MerchAlbumCatalogRow>();
  for (const r of merged) {
    seen.set(r.id, r);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}
