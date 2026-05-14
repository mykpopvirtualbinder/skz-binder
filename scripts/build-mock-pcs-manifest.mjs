import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "public", "mock-pcs");
const OUT = path.join(ROOT, "manifest.json");

function listDirs(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function walkDirs(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current) break;
    out.push(current);
    for (const child of listDirs(current)) {
      stack.push(path.join(current, child));
    }
  }
  return out;
}

function buildManifest() {
  if (!fs.existsSync(ROOT)) {
    throw new Error(`Missing folder: ${ROOT}`);
  }

  const manifest = {};
  const dirs = walkDirs(ROOT);

  for (const dir of dirs) {
    const rel = path.relative(ROOT, dir).replace(/\\/g, "/");
    if (!rel || rel === ".") continue;

    const files = fs.readdirSync(dir);
    const fronts = files
      .filter((f) => /\.(apng|png|jpe?g|jfif|pjpeg|webp|gif|bmp|avif|svg|ico|tiff?|hei[cf])$/i.test(f))
      .filter((f) => !/-back\.(apng|png|jpe?g|jfif|pjpeg|webp|gif|bmp|avif|svg|ico|tiff?|hei[cf])$/i.test(f))
      .sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
      );
    if (fronts.length === 0) continue;

    const commonBack = files.find((f) => /-back\.(apng|png|jpe?g|jfif|pjpeg|webp|gif|bmp|avif|svg|ico|tiff?|hei[cf])$/i.test(f)) || null;
    manifest[rel] = { fronts, commonBack };
  }

  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Manifest generated: ${OUT}`);
  console.log(`Entries: ${Object.keys(manifest).length}`);
}

buildManifest();
