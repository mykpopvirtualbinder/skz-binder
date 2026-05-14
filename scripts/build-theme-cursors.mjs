/**
 * Cursores por tema en `public/cursors/*.png`.
 *
 * Fuente (la primera que exista):
 *   1) `public/cursors/import/<nombre>.png`  ← pon aquí tus imágenes grandes
 *   2) `public/cursors/originals/<nombre>.png`
 *   3) Plantilla SVG solo si no hay PNG (evitar en producción)
 *
 * Escala: **1/12** del ancho y alto del PNG de entrada (la mitad respecto a 1/6).
 * Tope: lado máximo **128px** (límite habitual de cursores en navegadores).
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "cursors");
const IMPORT_DIR = path.join(OUT_DIR, "import");
const ORIG_DIR = path.join(OUT_DIR, "originals");

const INTERNAL = 236;
/** Escala lineal respecto al PNG de entrada (1/12 = mitad de 1/6) */
const SCALE = 1 / 12;
/** Los navegadores suelen ignorar cursores > ~128px */
const MAX_CURSOR_SIDE = 128;

function svgForTheme({ shadow, fill, stroke }) {
  const d =
    "M6 5L6 22L11 16L14 25L17 23L13 14L23 14L23 9L12 9L9 5Q8 4 7 4Q6 4 6 5Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${INTERNAL}" height="${INTERNAL}" viewBox="0 0 32 32">
  <path fill="${shadow}" d="${d}" transform="translate(0.75,0.75)"/>
  <path fill="${fill}" stroke="${stroke}" stroke-width="0.9" stroke-linejoin="round" stroke-linecap="round" d="${d}"/>
</svg>`;
}

const THEMES = [
  {
    file: "basic.png",
    svgColors: { shadow: "#b889b0", fill: "#f8d8ea", stroke: "#ffffff" },
  },
  {
    file: "midnight-neon.png",
    svgColors: { shadow: "#15606f", fill: "#7cecff", stroke: "#dff8ff" },
  },
  {
    file: "anime-vibrant.png",
    svgColors: { shadow: "#d45a08", fill: "#ffb04a", stroke: "#fff8ed" },
  },
  {
    file: "korean-cafe.png",
    svgColors: { shadow: "#5c4030", fill: "#d9c4a8", stroke: "#fdf8f2" },
  },
  {
    file: "k-pride.png",
    svgColors: { shadow: "#003d8a", fill: "#ff8892", stroke: "#ffffff" },
  },
];

function targetSize(w, h) {
  let tw = Math.max(1, Math.round(w * SCALE));
  let th = Math.max(1, Math.round(h * SCALE));
  const maxDim = Math.max(tw, th);
  if (maxDim > MAX_CURSOR_SIDE) {
    const f = MAX_CURSOR_SIDE / maxDim;
    tw = Math.max(1, Math.round(tw * f));
    th = Math.max(1, Math.round(th * f));
  }
  return { tw, th };
}

function decodePngAlpha(buf) {
  let p = 8;
  let w = 0,
    h = 0;
  const chunks = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    chunks.push({ type, data });
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
    }
    if (type === "IEND") break;
    p += 12 + len;
  }
  const idat = Buffer.concat(
    chunks.filter((c) => c.type === "IDAT").map((c) => c.data)
  );
  const raw = zlib.inflateSync(idat);
  const bpp = 4;
  const stride = w * bpp;
  const rows = [];
  let o = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[o++];
    const row = Buffer.from(raw.subarray(o, o + stride));
    o += stride;
    if (filter === 1) {
      for (let i = 0; i < stride; i++)
        row[i] = (row[i] + (i >= bpp ? row[i - bpp] : 0)) & 255;
    } else if (filter === 2) {
      for (let i = 0; i < stride; i++) row[i] = (row[i] + prev[i]) & 255;
    } else if (filter === 3) {
      for (let i = 0; i < stride; i++) {
        const left = i >= bpp ? row[i - bpp] : 0;
        row[i] = (row[i] + ((left + prev[i]) >> 1)) & 255;
      }
    } else if (filter === 4) {
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? row[i - bpp] : 0;
        const b = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        const pr = a + b - c;
        const pa = Math.abs(pr - a),
          pb = Math.abs(pr - b),
          pc = Math.abs(pr - c);
        let val = a;
        if (pb <= pa && pb <= pc) val = b;
        else if (pc <= pa && pc <= pb) val = c;
        row[i] = (row[i] + val) & 255;
      }
    }
    rows.push(row);
    prev = row;
  }
  return { w, h, rows };
}

function hotspotFromBuffer(pngBuf) {
  const { w, h, rows } = decodePngAlpha(pngBuf);
  let best = null;
  for (let y = 0; y < h * 0.42; y++) {
    for (let x = 0; x < w * 0.48; x++) {
      const a = rows[y][x * 4 + 3];
      if (a > 200) {
        const s = x + y;
        if (!best || s < best.s) best = { x, y, s };
      }
    }
  }
  return best ? { x: best.x, y: best.y } : { x: 0, y: 0 };
}

/**
 * @returns {{ kind: 'raster', path: string, label: string } | { kind: 'svg', svgColors: object }}
 */
async function resolveSource(file, svgColors) {
  const importPath = path.join(IMPORT_DIR, file);
  const origPath = path.join(ORIG_DIR, file);

  if (fs.existsSync(importPath)) {
    return { kind: "raster", path: importPath, label: "import/" };
  }
  if (fs.existsSync(origPath)) {
    return { kind: "raster", path: origPath, label: "originals/" };
  }

  return { kind: "svg", svgColors };
}

async function buildOne({ file, svgColors }) {
  const src = await resolveSource(file, svgColors);
  let pipeline;
  let sourcePx;
  let sourceLabel;

  if (src.kind === "raster") {
    const meta = await sharp(src.path).metadata();
    const w = meta.width || INTERNAL;
    const h = meta.height || INTERNAL;
    sourcePx = `${w}×${h}`;
    sourceLabel = src.label;
    const { tw, th } = targetSize(w, h);
    pipeline = sharp(src.path).resize(tw, th, {
      kernel: sharp.kernel.lanczos3,
      fit: "inside",
    });
  } else {
    sourcePx = `${INTERNAL}×${INTERNAL} (SVG fallback)`;
    sourceLabel = "svg";
    console.warn(
      `[build:cursors] ${file}: no hay PNG en import/ ni originals/ — usando SVG de respuesta. Copia tus assets a public/cursors/import/`
    );
    const svg = svgForTheme(svgColors);
    const { tw, th } = targetSize(INTERNAL, INTERNAL);
    pipeline = sharp(Buffer.from(svg)).resize(tw, th, {
      kernel: sharp.kernel.lanczos3,
      fit: "inside",
    });
  }

  const pngBuf = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  const outPath = path.join(OUT_DIR, file);
  fs.writeFileSync(outPath, pngBuf);
  const metaOut = await sharp(pngBuf).metadata();
  const tip = hotspotFromBuffer(pngBuf);
  return {
    file,
    tip,
    tw: metaOut.width,
    th: metaOut.height,
    sourcePx,
    sourceLabel,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
  fs.mkdirSync(ORIG_DIR, { recursive: true });

  const results = [];
  for (const t of THEMES) {
    results.push(await buildOne(t));
  }

  console.log(
    `Salida public/cursors/ (×${SCALE.toFixed(4)} = 1/12 del original; max lado ${MAX_CURSOR_SIDE}px):`
  );
  for (const { file, tip, tw, th, sourcePx, sourceLabel } of results) {
    console.log(
      `  ${file}  → ${tw}×${th}px  (fuente: ${sourceLabel} ${sourcePx})  hotspot ${tip.x} ${tip.y}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
