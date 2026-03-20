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
function walkDirs(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const full = path.join(dir, e.name);
    out.push(full);
    out.push(...walkDirs(full));
  }
  return out;
}

function relFromRoot(abs) {
  return abs.replace(ROOT + path.sep, "").split(path.sep).join("/");
}

function numPrefix(file) {
  const m = file.match(/^(\d+)-/);
  return m ? Number(m[1]) : 999999;
}

function stripExt(file) {
  return file.replace(/\.(png|jpe?g)$/i, "");
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
    if (!/\.(png|jpe?g)$/i.test(f)) continue;
    const base = stripExt(f).toLowerCase();

    if (/(^|-)back-ot8$/.test(base)) {
      common = f;
      byToken.set("ot8", f);
      continue;
    }

    const m = base.match(/-back-(.+)$/i);
    if (m && m[1]) {
      const token = m[1].trim();
      if (token) byToken.set(token, f);
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
 *
 * Caso B (genérico):
 *   photocards/<type...>/<album_slug>/<version_slug>
 *   ej: events/japan/skz2020/skz2020-high-touch-venue
 *   ej: seasons-greetings/korean/2021/polaroid
 */
function parsePathMeta(absDir) {
  const rel = relFromRoot(absDir);
  const parts = rel.split("/").filter(Boolean);

  const idxGroup = parts.indexOf("groups") >= 0 ? parts.indexOf("groups") : parts.indexOf("group");
  const idxPhotocards = parts.indexOf("photocards");

  const group_slug = idxGroup >= 0 && parts[idxGroup + 1] ? parts[idxGroup + 1] : "";

  const tail = idxPhotocards >= 0 ? parts.slice(idxPhotocards + 1) : [];

  if (!group_slug || tail.length < 2) {
    return { rel, group_slug, album_slug: "", version_slug: "", type: "", isLeaf: false };
  }

  // --- Caso albums: japanese-albums / korean-albums ---
  const first = tail[0] ?? "";
const isAlbumsBucket = /-albums?$/i.test(first); // acepta korean-album y japanese-albums
  if (isAlbumsBucket) {
    // Necesitamos: <bucket>/<album>/<...>/<version>
    if (tail.length < 3) {
      return { rel, group_slug, album_slug: "", version_slug: "", type: "", isLeaf: false };
    }

    const bucket = tail[0];             // "japanese-albums" | "korean-albums"
    const album_slug = tail[1];         // "all-in" | "5star" | "skz2020" ...
    const version_slug = tail[tail.length - 1]; // "a" | "hmv" | "digipack" ...

    // tipo = bucket + (lo que haya entre album y version)
    // ej: japanese-albums/all-in/album/a  -> type: "japanese-albums/album"
    // ej: japanese-albums/all-in/pob/hmv  -> type: "japanese-albums/pob"
    // ej: korean-albums/5star/a           -> type: "korean-albums"
    const middle = tail.slice(2, tail.length - 1); // puede ser [] o ["album"] o ["pob"]...
    const type = [bucket, ...middle].filter(Boolean).join("/");

    return { rel, group_slug, album_slug, version_slug, type, isLeaf: true };
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

  const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f));
  if (files.length === 0) continue;

  const fronts = files
    .filter((f) => /-front-/.test(f))
    .sort((a, b) => (numPrefix(a) - numPrefix(b)) || a.localeCompare(b, "en", { numeric: true }));

  if (fronts.length === 0) continue;

  const { byToken, commonBack } = indexBacks(files);

for (const f of fronts) {
  const memberTokens = parseMemberTokensFromFront(f);
  const member = memberTokens;
  const version = version_slug;
  const name = "";

  const frontUrl = `/mock-pcs/${rel}/${f}`;

  let backFile = "";
  const tokens = memberTokens ? memberTokens.split(/\s+/).filter(Boolean) : [];

  if (tokens.includes("ot8")) {
    backFile = byToken.get("ot8") || commonBack || "";
  } else if (tokens.length === 1) {
    backFile = byToken.get(tokens[0]) || commonBack || byToken.get("ot8") || "";
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
    candidates.map((k) => byToken.get(k)).find(Boolean) ||
    byToken.get("ot8") ||
    commonBack ||
    "";
}

 
  const backUrl = backFile ? `/mock-pcs/${rel}/${backFile}` : "";
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
}

// ✅ Esto va FUERA de los bucles
const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
fs.writeFileSync(OUT, csv, "utf8");

console.log(`OK -> ${OUT}`);
console.log(`Filas (sin cabecera): ${rows.length - 1}`);