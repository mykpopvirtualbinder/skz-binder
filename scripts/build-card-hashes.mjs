import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("public/mock-pcs");
const out = path.resolve("public/card-hashes.json");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(png|jpe?g|webp)$/i.test(entry.name) && /-front[-.]/i.test(entry.name)) files.push(full);
  }
  return files;
}

function hashFromRgb(data) {
  let bits = "";
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = (y * 9 + x) * 3;
      const right = left + 3;
      const a = data[left] + data[left + 1] + data[left + 2];
      const b = data[right] + data[right + 1] + data[right + 2];
      bits += a > b ? "1" : "0";
    }
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += Number.parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

const files = await walk(root);
const hashes = {};
let done = 0;
const queue = files.slice();
async function worker() {
  while (queue.length) {
    const file = queue.pop();
    if (!file) return;
    try {
      const { data } = await sharp(file).resize(9, 8, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const rel = `/${path.relative("public", file).split(path.sep).join("/")}`;
      hashes[rel] = hashFromRgb(data);
    } catch {
      /* skip unreadable */
    }
    done += 1;
    if (done % 500 === 0) console.log(`${done}/${files.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, () => worker()));
await writeFile(out, JSON.stringify(hashes));
console.log(`wrote ${Object.keys(hashes).length} hashes`);
