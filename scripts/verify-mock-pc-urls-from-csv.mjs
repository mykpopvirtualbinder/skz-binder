#!/usr/bin/env node
/**
 * Comprueba que cada URL /mock-pcs/... del items_import.csv exista bajo public/.
 * Útil cuando en local o en Vercel las tarjetas salen en blanco: casi siempre es
 * carpeta sin commit (??) o archivos borrados del índice (git status D).
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CSV = path.join(ROOT, "items_import.csv");
const PUBLIC = path.join(ROOT, "public");

function extractMockPcUrls(line) {
  const out = [];
  const re = /\/mock-pcs[^"\s,]*/gi;
  let m;
  while ((m = re.exec(line))) out.push(m[0]);
  return out;
}

function urlToFsPath(url) {
  const u = url.split("?")[0].trim();
  const pathname = u.startsWith("/") ? u.slice(1) : u;
  const parts = pathname.split("/").filter(Boolean);
  const decoded = parts.map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  return path.join(PUBLIC, ...decoded);
}

function main() {
  if (!fs.existsSync(CSV)) {
    console.error(`No existe ${CSV} (ejecuta antes: node scripts/build-items-csv.mjs)`);
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const urls = new Set();
  for (const line of lines) {
    for (const u of extractMockPcUrls(line)) urls.add(u);
  }

  const missing = [];
  for (const u of urls) {
    const fsPath = urlToFsPath(u);
    if (!fs.existsSync(fsPath)) missing.push({ u, fsPath });
  }

  console.log(`URLs /mock-pcs únicas en CSV: ${urls.size}`);
  console.log(`Archivos que NO existen bajo public/: ${missing.length}`);
  if (missing.length) {
    console.log("\nPrimeras 40 rutas faltantes:");
    for (const { u, fsPath } of missing.slice(0, 40)) {
      console.log(`  ${u}`);
      console.log(`    -> ${path.relative(ROOT, fsPath)}`);
    }
    if (missing.length > 40) console.log(`  ... y ${missing.length - 40} más`);
    process.exit(1);
  }
  console.log("OK: todas las URLs del CSV tienen archivo en public/");
}

main();
