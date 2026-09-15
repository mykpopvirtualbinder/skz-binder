// scripts/build-items-csv.mjs
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "public", "mock-pcs");
const OUT = path.join(process.cwd(), "items_import.csv");
const GROUPS_LOOKUP = path.join(process.cwd(), "groups_lookup.csv");
const ALBUMS_LOOKUP = path.join(process.cwd(), "albums_lookup.csv");

function csvCell(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function loadSlugToIdMap(csvPath) {
  const map = new Map();
  if (!fs.existsSync(csvPath)) return map;

  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return map;

  for (let i = 1; i < lines.length; i++) {
    const [slug, id] = lines[i].split(",").map((s) => (s ?? "").trim());
    const n = Number(id);
    if (slug && Number.isFinite(n)) map.set(slug, n);
  }
  return map;
}
function regionToAlbumBucket(region) {
  if (/^korean$/i.test(region)) return "korean-albums";
  if (/^japanese$/i.test(region)) return "japanese-albums";
  if (/^taiwanese$|^taiwan$/i.test(region)) return "taiwanese-albums";
  return "";
}

function isPortadasFolder(name) {
  const n = String(name || "").trim();
  return (
    /^portadas[- ]+(de[- ]+)?albums?$/i.test(n) ||
    /^portadas-album$/i.test(n) ||
    /^album-covers$/i.test(n)
  );
}

function isSkippedFolder(name) {
  return (
    isPortadasFolder(name) ||
    /^templates$/i.test(name) ||
    /^other$/i.test(name) ||
    /^silvia/i.test(name)
  );
}

function walkDirs(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (isSkippedFolder(e.name)) continue;
    const full = path.join(dir, e.name);
    out.push(full);
    out.push(...walkDirs(full));
  }
  return out;
}

function relFromRoot(abs) {
  return abs.replace(ROOT + path.sep, "").split(path.sep).join("/");
}

/** Codifica segmentos para URLs en public/mock-pcs (espacios, Unicode en nombres de archivo). */
function mockPcPublicHref(rel, filename) {
  const relSegs = String(rel)
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return encodeURIComponent(decodeURIComponent(s));
      } catch {
        return encodeURIComponent(s);
      }
    });
  let fn;
  try {
    fn = encodeURIComponent(decodeURIComponent(filename));
  } catch {
    fn = encodeURIComponent(filename);
  }
  return `/mock-pcs/${relSegs.join("/")}/${fn}`;
}

function numPrefix(file) {
  const m = file.match(/^(\d+)-/);
  return m ? Number(m[1]) : 999999;
}

function stripExt(file) {
  // Sync with lib/pc-image-extensions.ts (PC_IMAGE_EXTENSIONS + heic/heif via hei[cf])
  return file.replace(/\.(apng|png|jpe?g|jfif|pjpeg|webp|gif|bmp|avif|svg|ico|tiff?|hei[cf])$/i, "");
}

function isBackFile(file) {
  const base = stripExt(file);
  return /(?:^|-)back(?:-|$)/i.test(base);
}

/** Misma lógica que en Library: emparejar `seung-min` con front `seungmin`, etc. */
function memberTokenKey(token) {
  return String(token ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

function registerBackToken(map, token, file) {
  const raw = String(token ?? "").trim();
  if (!raw) return;
  map.set(raw, file);
  const k = memberTokenKey(raw);
  if (k) map.set(k, file);
}

/**
 * FRONT rules:
 * - 001-front-bang-chan.png
 * - 002-front-bang-chan+felix.png
 * - 003-front-ot8.png
 *
 * Devuelve tokens separados por espacio:
 * - "bang-chan"
 * - "bang-chan felix"
 * - "ot8"
 */
function parseMemberTokensFromFront(file) {
  const base = stripExt(file);
  const m = base.match(/-front-(.+)$/i);
  if (!m) return "";
  const tail = m[1].trim();
  if (!tail) return "";

  if (tail.toLowerCase() === "ot8") return "ot8";

  if (tail.includes("_")) return tail.split("_").map((x) => x.trim()).filter(Boolean).join(" ");
  if (tail.includes("+")) return tail.split("+").map((x) => x.trim()).filter(Boolean).join(" ");

  return tail;
}

/**
 * BACK rules:
 * - back-ot8.png
 * - 001-back-ot8.png
 * - 001-back-bang-chan.png
 */
function indexBacks(files) {
  const byToken = new Map(); // token -> filename
  let common = null;

  for (const f of files) {
    if (!/\.(apng|png|jpe?g|jfif|pjpeg|webp|gif|bmp|avif|svg|ico|tiff?|hei[cf])$/i.test(f)) continue;
    const base = stripExt(f).toLowerCase();

    if (/(^|-)back-ot8$/.test(base)) {
      common = f;
      registerBackToken(byToken, "ot8", f);
      continue;
    }

    const m = base.match(/-back-(.+)$/i);
    if (m && m[1]) {
      const token = m[1].trim();
      if (token) registerBackToken(byToken, token, f);
    }

    if (/(^|-)back$/.test(base) && !common) common = f;
  }

  return { byToken, commonBack: common };
}

/**
 * Deducción robusta de metadatos según tu árbol real:
 *
 * /mock-pcs/groups/<group_slug>/photocards/<...tail...>
 *
 * Caso A (albums):
 *   photocards/japanese-albums/<album_slug>/<subtype...>/<version_slug>
 *   photocards/korean-albums/<album_slug>/<subtype...>/<version_slug>
 *   photocards/taiwanese-albums/<album_slug>/<subtype...>/<version_slug>
 *   (también: primer segmento `korean` | `japanese` | `taiwanese` sin sufijo -albums)
 *   Subcarpetas extra (p. ej. karma/vinyl/limited/a) van en `type` como
 *   korean-albums/karma/vinyl — el último segmento sigue siendo la hoja (versión).
 *
 * Caso B (genérico):
 *   photocards/<type...>/<album_slug>/<version_slug>
 *   ej: events/japan/skz2020/skz2020-high-touch-venue
 *   ej: seasons-greetings/korean/2021/polaroid
 *
 * Caso C (inclusions / merch sueltos):
 *   groups/<group_slug>/inclusions/<...>/<album_slug>/<version_slug>
 *   ej: inclusions/seasons-greetings/japanese/2025-your-hero/sticker-set
 */
function parseAlbumContentRest({ rel, group_slug, album_slug, prefixType, rest }) {
  const emptyMeta = { rel, group_slug, album_slug: "", version_slug: "", type: "", isLeaf: false };
  if (!album_slug || !Array.isArray(rest) || rest.length === 0) return emptyMeta;
  if (rest[0] && isPortadasFolder(rest[0])) return emptyMeta;

  const bucket = rest[0] || "";
  const tail = rest.slice(1);

  if (/^inclusions$/i.test(bucket)) {
    const version_slug = tail.length ? tail[tail.length - 1] : "default";
    const mid = tail.length >= 1 ? tail.slice(0, -1) : [];
    const type = ["inclusions", prefixType, ...mid].filter(Boolean).join("/");
    return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
  }

  if (/^pobs?$/i.test(bucket) || /^pop-ups?$/i.test(bucket) || /^pop[\s_-]?ups?$/i.test(bucket)) {
    const version_slug = tail.length ? tail[tail.length - 1] : bucket;
    const mid = tail.length >= 1 ? tail.slice(0, -1) : [];
    const type = [prefixType, bucket, ...mid].filter(Boolean).join("/");
    return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
  }

  if (/^photocards$/i.test(bucket) || /^album$/i.test(bucket)) {
    if (tail.length === 0) {
      return { rel, group_slug, album_slug, version_slug: "default", type: prefixType, isLeaf: true };
    }
    const version_slug = tail[tail.length - 1];
    const mid = tail.slice(0, -1);
    const type = [prefixType, ...mid].filter(Boolean).join("/");
    return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
  }

  const version_slug = rest[rest.length - 1];
  const mid = rest.slice(0, -1);
  const type = [prefixType, ...mid].filter(Boolean).join("/");
  return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
}

function parsePathMeta(absDir) {
  const rel = relFromRoot(absDir);
  const parts = rel.split("/").filter(Boolean);

  const idxGroup = parts.indexOf("groups") >= 0 ? parts.indexOf("groups") : parts.indexOf("group");
  const group_slug = idxGroup >= 0 && parts[idxGroup + 1] ? parts[idxGroup + 1] : "";
  const afterGroup = idxGroup >= 0 ? parts.slice(idxGroup + 2) : parts;
  const emptyMeta = { rel, group_slug, album_slug: "", version_slug: "", type: "", isLeaf: false };

  if (afterGroup.some((p) => isPortadasFolder(p))) {
    return emptyMeta;
  }

  if (afterGroup[0] && isPortadasFolder(afterGroup[0])) {
    return emptyMeta;
  }

  // Árbol actual: groups/<g>/albums/<región>/<álbum>/{photocards|inclusions|pobs|pop-ups|album}/...
  if (/^albums?$/i.test(afterGroup[0] || "")) {
    const albumRootBucket = regionToAlbumBucket(afterGroup[1] || "");
    if (albumRootBucket && afterGroup[2]) {
      return parseAlbumContentRest({
        rel,
        group_slug,
        album_slug: afterGroup[2],
        prefixType: albumRootBucket,
        rest: afterGroup.slice(3),
      });
    }
  }

  // Árbol: groups/<g>/others|otros/{seasons-greetings|memberships|collabs}/...
  if (/^(others|otros)$/i.test(afterGroup[0] || "") && afterGroup.length >= 3) {
    const inner = afterGroup.slice(1);
    if (/^seasons-greetings$/i.test(inner[0] || "") && inner[1] && inner[2]) {
      const region = String(inner[1] ?? "").toLowerCase();
      return parseAlbumContentRest({
        rel,
        group_slug,
        album_slug: String(inner[2] ?? "").trim(),
        prefixType: `seasons-greetings/${region}`,
        rest: inner.slice(3),
      });
    }
    const contentIdx = inner.findIndex(
      (s) =>
        /^photocards$/i.test(s) ||
        /^inclusions$/i.test(s) ||
        /^pobs?$/i.test(s) ||
        /^pop-ups?$/i.test(s) ||
        /^pop[\s_-]?ups?$/i.test(s),
    );
    if (contentIdx >= 1) {
      const album_slug = inner[contentIdx - 1];
      const prefixType = inner.slice(0, contentIdx - 1).join("/") || inner[0];
      return parseAlbumContentRest({
        rel,
        group_slug,
        album_slug,
        prefixType,
        rest: inner.slice(contentIdx),
      });
    }
  }

  // Árbol: groups/<g>/events|eventos/{tours|pop-ups|fan-meetings}/...
  if (/^(events|eventos)$/i.test(afterGroup[0] || "") && afterGroup.length >= 3) {
    const inner = afterGroup.slice(1);
    const contentIdx = inner.findIndex(
      (s) =>
        /^photocards$/i.test(s) ||
        /^inclusions$/i.test(s) ||
        /^pobs?$/i.test(s) ||
        /^pop-ups?$/i.test(s),
    );
    if (contentIdx >= 1) {
      const album_slug = inner[contentIdx - 1];
      const prefixType = ["events", ...inner.slice(0, contentIdx - 1)].join("/");
      return parseAlbumContentRest({
        rel,
        group_slug,
        album_slug,
        prefixType,
        rest: inner.slice(contentIdx),
      });
    }
  }

  // Árbol legado: groups/<g>/album/<región>/<álbum>/...
  const albumRootBucket = afterGroup[0] === "album" ? regionToAlbumBucket(afterGroup[1] || "") : "";
  if (albumRootBucket) {
    const album_slug = afterGroup[2] || "";
    const rest = afterGroup.slice(3);
    if (!album_slug || rest.length === 0) return emptyMeta;
    const version_slug = rest.length >= 2 ? rest[rest.length - 1] : "default";
    const middle = rest.length >= 2 ? rest.slice(0, -1) : rest;
    const type = [albumRootBucket, ...middle].filter(Boolean).join("/");
    return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
  }

  // Árbol nuevo: groups/<g>/seasons-greetings/<región>/...
  if (/^seasons-greetings$/i.test(afterGroup[0] || "")) {
    if (afterGroup.length === 2) return emptyMeta;
    if (afterGroup.length === 3) {
      const region = String(afterGroup[1] ?? "").toLowerCase();
      if (region === "korean" || region === "japanese" || region === "taiwanese") {
        return {
          rel,
          group_slug,
          album_slug: afterGroup[2] ?? "",
          version_slug: "default",
          type: `seasons-greetings/${region}`,
          isLeaf: true,
        };
      }
    }
    if (afterGroup.length >= 4) {
      const region = String(afterGroup[1] ?? "").toLowerCase();
      const album_slug = afterGroup[afterGroup.length - 2];
      const version_slug = afterGroup[afterGroup.length - 1];
      const mid = afterGroup.slice(2, -2);
      const type = [`seasons-greetings/${region}`, ...mid].filter(Boolean).join("/");
      return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
    }
  }

  // Árbol nuevo: groups/<g>/otros/{seasons-greetings|collab}/...
  if (/^otros$/i.test(afterGroup[0] || "") && afterGroup.length >= 3) {
    const album_slug = afterGroup[afterGroup.length - 2];
    const version_slug = afterGroup[afterGroup.length - 1];
    const type = afterGroup.slice(1, -2).length
      ? afterGroup.slice(1, -2).join("/")
      : afterGroup.slice(0, -2).join("/");
    return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
  }

  // Árbol nuevo: groups/<g>/eventos/{events|tour|pop-ups}/...
  if (/^eventos$/i.test(afterGroup[0] || "") && afterGroup.length >= 3) {
    const album_slug = afterGroup[afterGroup.length - 2];
    const version_slug = afterGroup[afterGroup.length - 1];
    const type = afterGroup.slice(0, -2).join("/");
    return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
  }

  // Árbol nuevo: groups/<g>/collab/...
  if (/^collab$/i.test(afterGroup[0] || "") && afterGroup.length >= 3) {
    const album_slug = afterGroup[afterGroup.length - 2];
    const version_slug = afterGroup[afterGroup.length - 1];
    const type = afterGroup.slice(0, -2).join("/");
    return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
  }

  const idxInclusions = parts.indexOf("inclusions");
  if (idxInclusions >= 0 && group_slug) {
    const incTail = parts.slice(idxInclusions + 1).filter(Boolean);
    if (incTail.length >= 2) {
      const album_slug = incTail[incTail.length - 2];
      const version_slug = incTail[incTail.length - 1];
      const mid = incTail.slice(0, -2);
      const type = mid.length ? `inclusions/${mid.join("/")}` : "inclusions";
      return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
    }
    if (incTail.length === 1) {
      return {
        rel,
        group_slug,
        album_slug: incTail[0],
        version_slug: "default",
        type: "inclusions",
        isLeaf: true,
      };
    }
    return { rel, group_slug, album_slug: "", version_slug: "", type: "", isLeaf: false };
  }

  const idxPhotocards = parts.indexOf("photocards");

  const tail = idxPhotocards >= 0 ? parts.slice(idxPhotocards + 1) : [];

  if (!group_slug || tail.length < 2) {
    return { rel, group_slug, album_slug: "", version_slug: "", type: "", isLeaf: false };
  }

  // --- Caso albums: *-album(s) o carpetas korean / japanese / taiwanese ---
  const first = tail[0] ?? "";
  const isAlbumsBucket =
    /-albums?$/i.test(first) || /^(korean|japanese|taiwanese)$/i.test(first);
  if (isAlbumsBucket) {
    // Necesitamos: <bucket>/<album>/<...>/<version>
    if (tail.length < 3) {
      return { rel, group_slug, album_slug: "", version_slug: "", type: "", isLeaf: false };
    }

    const bucketRaw = tail[0];
    const bucket =
      /^korean$/i.test(bucketRaw)
        ? "korean-albums"
        : /^japanese$/i.test(bucketRaw)
          ? "japanese-albums"
          : /^taiwanese$/i.test(bucketRaw)
            ? "taiwanese-albums"
            : bucketRaw;
    const album_slug = tail[1]; // "all-in" | "5star" | "karma" ...
    const version_slug = tail[tail.length - 1]; // "a" | "hmv" | "digipack" ...

    // tipo = bucket canónico + (lo que haya entre album y version)
    // ej: korean-albums/karma/vinyl/limited/a -> type: "korean-albums/karma/vinyl"
    const middle = tail.slice(2, tail.length - 1); // [] | ["vinyl"] | ["pob"] ...
    const type = [bucket, ...middle].filter(Boolean).join("/");

    return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
  }

  // --- Season's Greetings (photocards/seasons-greetings/...) ---
  // Carpetas solo "seasons-greetings/korean" o ".../japanese" NO son hojas (evita type vacío y metadatos basura).
  // Con 3 segmentos: .../korean/2021-fotos-sin-subcarpeta → album=última carpeta, version=default.
  if (/^seasons-greetings$/i.test(first)) {
    if (tail.length === 2) {
      return { rel, group_slug, album_slug: "", version_slug: "", type: "", isLeaf: false };
    }
    if (tail.length === 3) {
      const region = String(tail[1] ?? "").toLowerCase();
      if (region === "korean" || region === "japanese" || region === "taiwanese") {
        const album_slug = tail[2] ?? "";
        return {
          rel,
          group_slug,
          album_slug,
          version_slug: "default",
          type: `seasons-greetings/${region}`,
          isLeaf: true,
        };
      }
    }
  }

  // --- Caso genérico: último-2 son album/version ---
  const album_slug = tail[tail.length - 2];
  const version_slug = tail[tail.length - 1];
  const type = tail.slice(0, tail.length - 2).join("/") || "";

  return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
}

const dirs = fs.existsSync(ROOT) ? walkDirs(ROOT) : [];
const groupIdBySlug = loadSlugToIdMap(GROUPS_LOOKUP);
const albumIdBySlug = loadSlugToIdMap(ALBUMS_LOOKUP);
const rows = [];

// Header REAL de la tabla items
rows.push(["group_id","album_id","type","member","version","name","image_url","back_image_url"])
for (const dir of dirs) {
  const { rel, group_slug, album_slug, version_slug, type, isLeaf } = parsePathMeta(dir);
 const group_id = groupIdBySlug.get(group_slug) ?? "";
const album_id = albumIdBySlug.get(album_slug) ?? "";
if (isLeaf && !type) console.log("TYPE VACÍO EN:", rel);
  if (!isLeaf) continue;

  const files = fs.readdirSync(dir).filter((f) => /\.(apng|png|jpe?g|jfif|pjpeg|webp|gif|bmp|avif|svg|ico|tiff?|hei[cf])$/i.test(f));
  if (files.length === 0) continue;

  const fronts = files
    .filter((f) => /-front-/.test(f))
    .sort((a, b) => (numPrefix(a) - numPrefix(b)) || a.localeCompare(b, "en", { numeric: true }));

  const { byToken, commonBack } = indexBacks(files);

  if (fronts.length > 0) {
    for (const f of fronts) {
  const memberTokens = parseMemberTokensFromFront(f);
  const member = memberTokens;
  const version = version_slug;
  const name = "";

  const frontUrl = mockPcPublicHref(rel, f);

  let backFile = "";
  const tokens = memberTokens ? memberTokens.split(/\s+/).filter(Boolean) : [];

  const pickBack = (key) => byToken.get(key) || byToken.get(memberTokenKey(key));

  if (tokens.includes("ot8")) {
    backFile = pickBack("ot8") || commonBack || "";
  } else if (tokens.length === 1) {
    backFile = pickBack(tokens[0]) || commonBack || pickBack("ot8") || "";
  } else if (tokens.length > 1) {
  const norm = tokens.map((t) => t.toLowerCase());
  const rev = [...norm].reverse();
  const sorted = [...norm].sort();

  const candidates = [
    norm.join("+"), rev.join("+"), sorted.join("+"),
    norm.join("_"), rev.join("_"), sorted.join("_"),
    norm.join(" "), rev.join(" "), sorted.join(" "),
  ];

  backFile =
    candidates.map((k) => pickBack(k)).find(Boolean) ||
    pickBack("ot8") ||
    commonBack ||
    "";
}

 
  const backUrl = backFile ? mockPcPublicHref(rel, backFile) : "";
rows.push([

group_id,
album_id,
type,
member,
version,
name,
frontUrl,
 backUrl
]);
}
  } else {
    const loose = files
      .filter((f) => /\.(apng|png|jpe?g|jfif|pjpeg|webp|gif|bmp|avif|svg|ico|tiff?|hei[cf])$/i.test(f))
      .filter((f) => !isBackFile(f))
      .sort((a, b) => (numPrefix(a) - numPrefix(b)) || a.localeCompare(b, "en", { numeric: true }));

    for (const f of loose) {
      const member = "";
      const version = version_slug || "default";
      const name = stripExt(f);
      const frontUrl = mockPcPublicHref(rel, f);
      rows.push([group_id, album_id, type, member, version, name, frontUrl, ""]);
    }
  }

  if (fronts.length > 0) {
    const looseMisc = files
      .filter((f) => /\.(apng|png|jpe?g|jfif|pjpeg|webp|gif|bmp|avif|svg|ico|tiff?|hei[cf])$/i.test(f))
      .filter((f) => !isBackFile(f))
      .filter((f) => !/-front-/.test(f))
      .sort((a, b) => (numPrefix(a) - numPrefix(b)) || a.localeCompare(b, "en", { numeric: true }));

    for (const f of looseMisc) {
      const member = "";
      const version = version_slug || "default";
      const name = stripExt(f);
      const frontUrl = mockPcPublicHref(rel, f);
      rows.push([group_id, album_id, type, member, version, name, frontUrl, ""]);
    }
  }
}

// ✅ Esto va FUERA de los bucles
const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
fs.writeFileSync(OUT, csv, "utf8");

console.log(`OK -> ${OUT}`);
console.log(`Filas (sin cabecera): ${rows.length - 1}`);