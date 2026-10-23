import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "@huggingface/transformers";

const root = path.resolve("public/mock-pcs");
const binPath = path.resolve("public/card-embeddings.bin");
const listPath = path.resolve("public/card-embedding-paths.json");
const dim = 512;

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

function normalize(data) {
  const out = new Float32Array(dim);
  let norm = 0;
  for (let i = 0; i < dim; i += 1) norm += data[i] * data[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i += 1) out[i] = data[i] / norm;
  return out;
}

const files = await walk(root);
const extractor = await pipeline("image-feature-extraction", "Xenova/clip-vit-base-patch32", { dtype: "q8" });
const vectors = new Float32Array(files.length * dim);
const paths = [];
let written = 0;
for (const file of files) {
  try {
    const out = await extractor(file);
    const row = normalize(out.data);
    vectors.set(row, written * dim);
    paths.push(`/${path.relative("public", file).split(path.sep).join("/")}`);
    written += 1;
    if (written % 250 === 0) console.log(`${written}/${files.length}`);
  } catch (error) {
    console.error("skip", file, error instanceof Error ? error.message : error);
  }
}
const used = vectors.slice(0, written * dim);
await writeFile(binPath, Buffer.from(used.buffer));
await writeFile(listPath, JSON.stringify(paths));
console.log(`wrote ${written} embeddings`);
