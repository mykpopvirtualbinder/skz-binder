/**
 * Extensiones de imagen que tratamos como válidas para photocards / URLs estáticas
 * (`<img>`, escaneo de `public/mock-pcs`, CSV de items). Mantener alineado con
 * `scripts/build-items-csv.mjs` y `scripts/build-mock-pcs-manifest.mjs` (regex allí duplicada).
 */
export const PC_IMAGE_EXTENSIONS = [
  "png",
  "apng",
  "jpg",
  "jpeg",
  "jfif",
  "pjpeg",
  "webp",
  "gif",
  "bmp",
  "avif",
  "svg",
  "ico",
  "tif",
  "tiff",
  "heic",
  "heif",
] as const;

export type PcImageExt = (typeof PC_IMAGE_EXTENSIONS)[number];

const PC_IMAGE_EXT_SET = new Set<string>(PC_IMAGE_EXTENSIONS);

/** Regex para nombres de archivo (sin query). `apng` antes de `png` para no acoplar mal. */
export const PC_IMAGE_FILENAME_EXT_RE =
  /\.(apng|png|jpe?g|jfif|pjpeg|webp|gif|bmp|avif|svg|ico|tiff?|hei[cf])(?:$|\?)/i;

export function isPcImageExtension(extWithoutDot: string): boolean {
  return PC_IMAGE_EXT_SET.has(extWithoutDot.toLowerCase());
}

/** Bajo mock-pcs o /albums/: aceptar otra extensión corta como “imagen” para el fallback. */
const ASSET_PATH_IMAGE_EXT = /^[a-z0-9]{1,10}$/;

export function splitPcImageStemExt(url: string): { stem: string; extLower: string } | null {
  const q = (url.split("?")[0] ?? url).trim();
  const i = q.lastIndexOf(".");
  if (i <= 0) return null;
  const extLower = q.slice(i + 1).toLowerCase();
  const stem = q.slice(0, i);
  if (PC_IMAGE_EXT_SET.has(extLower)) return { stem, extLower };
  if ((/mock-pcs/i.test(q) || /\/albums\//i.test(q)) && ASSET_PATH_IMAGE_EXT.test(extLower)) {
    return { stem, extLower };
  }
  return null;
}
