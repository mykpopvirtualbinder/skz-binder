/**
 * Genera public/avatar-assets-manifest.json escaneando carpetas bajo /public.
 * Debe mantenerse alineado con lib/avatarPublicCatalog.ts (misma lógica de rutas).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(PUBLIC, "avatar-assets-manifest.json");

const IMG_RE = /\.(png|jpe?g|webp|gif|svg)$/i;

function sortPaths(paths) {
  return paths.sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }),
  );
}

function listImagesFlat(publicSubdir) {
  const abs = path.join(PUBLIC, publicSubdir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return [];
  const names = fs.readdirSync(abs);
  const prefix = `/${publicSubdir.replace(/\\/g, "/")}`.replace(/\/+$/, "");
  const out = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const fp = path.join(abs, name);
    if (!fs.statSync(fp).isFile()) continue;
    if (!IMG_RE.test(name)) continue;
    out.push(`${prefix}/${name}`);
  }
  return sortPaths(out);
}

function walkImagesRecursive(publicSubdir, maxDepth) {
  const rootAbs = path.join(PUBLIC, publicSubdir);
  if (!fs.existsSync(rootAbs) || !fs.statSync(rootAbs).isDirectory()) return [];
  const webRoot = `/${publicSubdir.replace(/\\/g, "/")}`.replace(/\/+$/, "");
  const out = [];

  const walk = (dirAbs, relFromSub, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue;
      const abs = path.join(dirAbs, ent.name);
      const rel = relFromSub ? `${relFromSub}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(abs, rel, depth + 1);
      else if (IMG_RE.test(ent.name)) {
        out.push(`${webRoot}/${rel.replace(/\\/g, "/")}`);
      }
    }
  };

  walk(rootAbs, "", 0);
  return sortPaths(out);
}

const memberBadgePaths = sortPaths([
  ...walkImagesRecursive("members", 8),
  ...walkImagesRecursive("kawaii/members", 8),
]);

const skzooPaths = sortPaths([
  ...walkImagesRecursive("zootopia/stray-kids", 8),
  ...walkImagesRecursive("kawaii/zootopia/stray-kids", 8),
]);

/** Pack VIP kawaii: todo bajo /kawaii excepto rutas reservadas a medallitas (evita duplicar en dos bloques). */
const kawaiiPremiumPaths = sortPaths(
  walkImagesRecursive("kawaii", 10).filter(
    (p) =>
      !p.startsWith("/kawaii/members/") &&
      !p.startsWith("/kawaii/zootopia/"),
  ),
);

const catalog = {
  version: 1,
  generatedAt: new Date().toISOString(),
  basic: listImagesFlat("basic"),
  lightstick: listImagesFlat("lightstick"),
  kawaiiPremium: kawaiiPremiumPaths,
  vipBadges: {
    groups: listImagesFlat("groups"),
    members: memberBadgePaths,
    skzoo: skzooPaths,
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2), "utf8");
console.log(`avatar-assets-manifest.json → ${OUT}`);
console.log(
  `counts: basic=${catalog.basic.length} lightstick=${catalog.lightstick.length} premium=${catalog.kawaiiPremium.length} vip groups=${catalog.vipBadges.groups.length} members=${catalog.vipBadges.members.length} skzoo=${catalog.vipBadges.skzoo.length}`,
);
