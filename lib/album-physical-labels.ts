/**
 * Etiquetas de packaging / soporte físico para merch de álbumes.
 * Los valores en BD pueden ser slugs de carpeta (`paper-case`) o texto ya “purista” (`Paper case`);
 * si hay mapa, se muestra la forma preferida; si no, se devuelve el texto tal cual.
 *
 * Stray Kids — cómo comercializan el formato tipo “acordeón” / retail por era (cuando en BD
 * viene genérico `Accordion` o `acordeón`):
 *   5-STAR → Digipack · MAXIDENT → Paper case · NOEASY / ODDINARY → Jewel case · ROCK-STAR → Postcard
 */
const SLUG_TO_LABEL: Record<string, string> = {
  "paper-case": "Paper case",
  "jewel-case": "Jewel case",
  "jewelcase": "Jewel case",
  postcard: "Postcard",
  digipack: "Digipack",
  digi: "Digipack",
  "fan-club": "Fan club",
  fanclub: "Fan club",
  accordion: "Accordion",
  standard: "Standard",
  standart: "Standard",
  platform: "Platform",
  vinyl: "Vinyl",
  skzoo: "SKZOO",
  compact: "Compact",
  cassete: "Cassette",
  cassette: "Cassette",
  "limited": "Limited",
  "standard-edition": "Standard",
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

export function formatPhysicalMerchLabel(value: string | null | undefined): string {
  const t = String(value ?? "").trim();
  if (!t) return "";
  const key = normalizeKey(t);
  return SLUG_TO_LABEL[key] ?? t;
}

const ACCORDION_TYPE = /^(accordion|acordeon|acordeón)$/i;

/**
 * Nombre retail del “acordeón” según la era de Stray Kids (null si no aplica).
 */
export function strayKidsAccordionRetailLabelForAlbum(
  albumTitle: string | null | undefined,
): string | null {
  const n = stripDiacritics(String(albumTitle || "").trim());
  if (!n) return null;
  if (/\b5[\s.-]*star\b|no\.?\s*5\b/i.test(n)) return "Digipack";
  if (/\bmaxident\b/i.test(n)) return "Paper case";
  if (/\bnoeasy\b/i.test(n) || /\boddinary\b/i.test(n)) return "Jewel case";
  if (/\brock[\s.-]*star\b/i.test(n)) return "Postcard";
  return null;
}

/**
 * Etiqueta de `album_type` en UI: si es acordeón genérico y el título del álbum es SKZ,
 * muestra el nombre comercial de esa era (Digipack, Paper case, …).
 */
export function formatMerchAlbumTypeDisplay(
  albumTitle: string | null | undefined,
  albumType: string | null | undefined,
): string {
  const rawType = String(albumType ?? "").trim();
  if (!rawType) return "";
  const leaf = rawType.split("/").filter(Boolean).pop() || rawType;
  if (ACCORDION_TYPE.test(rawType) || ACCORDION_TYPE.test(leaf)) {
    const skz = strayKidsAccordionRetailLabelForAlbum(albumTitle);
    if (skz) return skz;
  }
  return formatPhysicalMerchLabel(leaf);
}
