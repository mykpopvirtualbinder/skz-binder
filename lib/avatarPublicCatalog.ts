import fs from "node:fs";
import path from "node:path";

const IMG_RE = /\.(png|jpe?g|webp|gif|svg)$/i;

function sortPaths(paths: string[]) {
  return paths.sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }),
  );
}

function listImagesFlat(publicSubdir: string): string[] {
  const abs = path.join(process.cwd(), "public", publicSubdir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return [];
  const names = fs.readdirSync(abs);
  const prefix = `/${publicSubdir.replace(/\\/g, "/")}`.replace(/\/+$/, "");
  const out: string[] = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const fp = path.join(abs, name);
    if (!fs.statSync(fp).isFile()) continue;
    if (!IMG_RE.test(name)) continue;
    out.push(`${prefix}/${name}`);
  }
  return sortPaths(out);
}

function walkImagesRecursive(
  publicSubdir: string,
  maxDepth: number,
): string[] {
  const rootAbs = path.join(process.cwd(), "public", publicSubdir);
  if (!fs.existsSync(rootAbs) || !fs.statSync(rootAbs).isDirectory()) return [];
  const webRoot = `/${publicSubdir.replace(/\\/g, "/")}`.replace(/\/+$/, "");
  const out: string[] = [];

  const walk = (dirAbs: string, relFromSub: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
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

export type AvatarPublicCatalog = {
  version: 1;
  generatedAt: string;
  basic: string[];
  lightstick: string[];
  kawaiiPremium: string[];
  vipBadges: {
    groups: string[];
    members: string[];
    skzoo: string[];
  };
};

export function buildAvatarPublicCatalog(): AvatarPublicCatalog {
  const memberBadgePaths = sortPaths([
    ...walkImagesRecursive("members", 8),
    ...walkImagesRecursive("kawaii/members", 8),
  ]);
  const skzooPaths = sortPaths([
    ...walkImagesRecursive("zootopia/stray-kids", 8),
    ...walkImagesRecursive("kawaii/zootopia/stray-kids", 8),
  ]);
  const kawaiiPremiumPaths = sortPaths(
    walkImagesRecursive("kawaii", 10).filter(
      (p) =>
        !p.startsWith("/kawaii/members/") &&
        !p.startsWith("/kawaii/zootopia/"),
    ),
  );

  return {
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
}

export function loadAvatarCatalogFromManifestFile(): AvatarPublicCatalog | null {
  const fp = path.join(process.cwd(), "public", "avatar-assets-manifest.json");
  if (!fs.existsSync(fp)) return null;
  try {
    const raw = fs.readFileSync(fp, "utf8");
    const data = JSON.parse(raw) as AvatarPublicCatalog;
    if (!data || data.version !== 1 || !data.vipBadges) return null;
    return data;
  } catch {
    return null;
  }
}
