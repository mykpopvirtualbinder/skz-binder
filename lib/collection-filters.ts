type SortEntry = {
  name: string;
  releaseDate?: string | null;
};

/** Opciones para ordenar colecciones (p. ej. álbumes) según reglas de grupo */
export type SortCollectionOptions = {
  /** Nombre visible del grupo (ej. desde Supabase `groups.name`). Si es Stray Kids, se aplica orden fijo de eras. */
  groupName?: string | null;
};

const SG_REGEX = /season'?s?\s*greetings?|seasons?\s*greetings?|(?:^|\s)sg(?:\s|$)/i;
const YEAR_REGEX = /(19|20)\d{2}/;

/**
 * Orden fijo unificado discografía Stray Kids (KR + JP intercalados cronológicamente).
 * Mixtape → I am NOT → … → Do it → This & That
 */
// Korean discography (chronological)
const STRAY_KIDS_KR_ORDER: RegExp[] = [
  /(?:^|[\s/._-])mix[\s._-]*tape(?:[\s.:_-]|$)|^mixtape$/i,
  /i[\s._-]*am[\s._-]*not/i,
  /i[\s._-]*am[\s._-]*who/i,
  /i[\s._-]*am[\s._-]*you/i,
  /cl[eé][\s._-]*1|cl[eé][\s._-]*:[\s._-]*1|mirr?oh/i,
  /yellow[\s._-]*wood|cl[eé][\s._-]*2|cl[eé][\s._-]*:[\s._-]*2/i,
  /levanter|cl[eé][\s._-]*:?[\s._-]*levanter/i,
  /go[\s._-]*live/i,
  /in[\s._-]*life/i,
  /noeasy/i,
  /christmas[\s._-]*evel/i,
  /oddinary/i,
  /maxident/i,
  /^5[\s._-]*star$|no\.?\s*5/i,
  /rock[\s._-]*star/i,
  /^ate$/i,
  /^hop$/i,
  /karma/i,
  /do[\s._-]*it/i,
  /this[\s._&-]*(?:%26[\s._-]*)?that(?![\s._-]*pop)/i,
];

// Japanese discography (chronological, shown after Korean)
const STRAY_KIDS_JP_ORDER: RegExp[] = [
  /skz[\s._-]*2020|2020[\s._-]*skz/i,
  /^top$/i,
  /all[\s._-]*in/i,
  /scars?/i,
  /circus/i,
  /the[\s._-]*sound/i,
  /social[\s._-]*path|super[\s._-]*bowl/i,
  /hollow/i,
];

const STRAY_KIDS_ALBUM_ORDER_PATTERNS: RegExp[] = [
  ...STRAY_KIDS_KR_ORDER,
  ...STRAY_KIDS_JP_ORDER,
];

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Índice en la lista JP canónica, o null (kept for external callers) */
export function strayKidsJapaneseAlbumOrderIndex(name: string | null | undefined): number | null {
  return strayKidsAlbumOrderIndex(name);
}

function strayKidsCollectionUnifiedSortKey(title: string): readonly [number, number, string] {
  const n = normalizeCollectionName(title);
  const ki = strayKidsAlbumOrderIndex(n);
  if (ki !== null) return [0, ki, n] as const;
  return [1, 0, n] as const;
}

export function isStrayKidsGroupName(name: string | null | undefined): boolean {
  const raw = stripDiacritics(String(name || "").trim()).toLowerCase();
  if (!raw) return false;
  if (raw.includes("stray kids")) return true;
  /** Carpetas tipo `public/albums/stray-kids/…` → slug sin espacio */
  if (raw.replace(/[-_]+/g, " ").includes("stray kids")) return true;
  const compact = raw.replace(/[^a-z0-9]+/g, "");
  if (compact === "straykids" || /^straykids/.test(compact)) return true;
  if (raw.includes("스트레이 키즈") || raw.includes("스트레이키즈")) return true;
  if (/\bskz\b/i.test(raw)) return true;
  return false;
}

/** Índice 0..n-1 en la discografía canónica, o null si no coincide */
export function strayKidsAlbumOrderIndex(name: string | null | undefined): number | null {
  const n = stripDiacritics(String(name || "").trim());
  for (let i = 0; i < STRAY_KIDS_ALBUM_ORDER_PATTERNS.length; i++) {
    if (STRAY_KIDS_ALBUM_ORDER_PATTERNS[i].test(n)) return i;
  }
  return null;
}

export function isSeasonsGreetings(name: string | null | undefined): boolean {
  const raw = String(name || "").trim();
  if (!raw) return false;
  if (SG_REGEX.test(raw)) return true;
  // Slug patterns from SG folders: "2022-room-mates", "skz2020-seasons-greetings"
  if (/^(?:seasons?[- _]greetings?[- _])?\d{4}([- _].+)?$/i.test(raw)) return true;
  if (/^skz\d{4}[- _]seasons?[- _]greetings?$/i.test(raw)) return true;
  return false;
}

export function extractCollectionYear(
  name: string | null | undefined,
  releaseDate?: string | null,
): number | null {
  const fromName = String(name || "").match(YEAR_REGEX);
  if (fromName?.[0]) return Number(fromName[0]);
  if (!releaseDate) return null;
  const d = new Date(releaseDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

export function normalizeCollectionName(name: string | null | undefined): string {
  const raw = String(name || "").trim();
  if (!raw) return "";
  if (!isSeasonsGreetings(raw)) return raw;
  const y = extractCollectionYear(raw);
  if (!y) return raw;
  return `Season's Greetings ${y}`;
}

/** Nombres legibles para el desplegable de era / títulos derivados de slugs de carpeta (merch, etc.). */
const STRAY_KIDS_RELEASE_LABEL_PRETTIER: Array<[RegExp, string]> = [
  [/^5star$/i, "5-STAR"],
  [/^5\s*star$/i, "5-STAR"],
  [/^rockstar$/i, "ROCK-STAR"],
  [/^rock[\s.-]*star$/i, "ROCK-STAR"],
  [/^i\s*am\s*not$/i, "I am NOT"],
  [/^i\s*am\s*who$/i, "I am WHO"],
  [/^i\s*am\s*you$/i, "I am YOU"],
  [/^cle\s*1\s*mirroh$/i, "Clé 1 : MIROH"],
  [/^cle\s*1\s*miroh$/i, "Clé 1 : MIROH"],
  [/^cle\s*2\s*yellow\s*wood$/i, "Clé 2 : Yellow Wood"],
  [/^cle\s*2\s*yellowwood$/i, "Clé 2 : Yellow Wood"],
  [/^cle\s*levanter$/i, "Clé : LEVANTER"],
  [/^levanter$/i, "LEVANTER"],
  [/^in\s*life$/i, "IN LIFE"],
  [/^go\s*live$/i, "GO LIVE"],
  [/^noeasy$/i, "NOEASY"],
  [/^christmas\s*evel$/i, "Christmas EveL"],
  [/^oddinary$/i, "ODDINARY"],
  [/^maxident$/i, "MAXIDENT"],
  [/^stars\s*who\s*ate$/i, "ATE"],
  [/^ate$/i, "ATE"],
  [/^hop$/i, "HOP"],
  [/^karma$/i, "KARMA"],
  [/^do[\s._-]*it$/i, "DO IT"],
  [/^this[\s._&-]*(?:%26[\s._-]*)?that(?![\s._-]*pop)/i, "This & That"],
  [/^skz[\s._-]*2020$/i, "SKZ2020"],
  [/^top$/i, "TOP"],
  [/^go[\s._-]*live$/i, "GO LIVE"],
  [/^in[\s._-]*life$/i, "IN LIFE"],
  [/^all[\s._-]*in$/i, "All In"],
  [/^scars?$/i, "SCARS"],
  [/^circus$/i, "CIRCUS"],
  [/^the[\s._-]*sound$/i, "The Sound"],
  [/^social[\s._-]*path$/i, "Social Path / Super Bowl"],
  [/^super[\s._-]*bowl$/i, "Social Path / Super Bowl"],
  [/^hollow$/i, "Hollow"],
  [/^mixtape$/i, "Mixtape"],
  [/^mix\s*tape$/i, "Mixtape"],
];

export function formatCollectionOptionLabel(
  name: string | null | undefined,
  _releaseDate?: string | null,
): string {
  const base = normalizeCollectionName(name);
  const raw = String(base || "").trim();
  if (!raw) return "";
  const n = stripDiacritics(raw);
  for (const [re, label] of STRAY_KIDS_RELEASE_LABEL_PRETTIER) {
    if (re.test(n)) return label;
  }
  return raw;
}

/** Pop-ups, events and similar rows that should not appear as álbumes / eras. */
export function isNonAlbumCollectionTitle(name: string | null | undefined): boolean {
  const raw = String(name || "").trim();
  if (!raw) return false;
  if (/\brun[\s._-]*it\b/i.test(raw)) return true;
  if (/pop[\s._-]*ups?/i.test(raw)) return true;
  return false;
}

/** Same Season's Greetings year (KR/JP/slug) collapses to one filter option. */
export function collectionOptionDedupeKey(
  name: string | null | undefined,
  releaseDate?: string | null,
): string {
  const raw = String(name || "").trim();
  if (isSeasonsGreetings(raw)) {
    const y = extractCollectionYear(raw, releaseDate);
    if (y) return `sg:${y}`;
  }
  return formatCollectionOptionLabel(raw, releaseDate).trim().toLowerCase();
}

/** Reservado para filas demo que no deban mostrarse (p. ej. títulos de prueba). */
export function isStrayKidsPlaceholderMerchAlbumTitle(_albumTitle: string | null | undefined): boolean {
  return false;
}

export function isStrayKidsPlaceholderMerchAlbumRow(
  groupName: string | null | undefined,
  albumTitle: string | null | undefined,
): boolean {
  if (!isStrayKidsGroupName(groupName)) return false;
  return isStrayKidsPlaceholderMerchAlbumTitle(albumTitle);
}

export function sortCollectionEntries<T extends SortEntry>(
  entries: T[],
  options?: SortCollectionOptions,
): T[] {
  const skz = isStrayKidsGroupName(options?.groupName);

  return [...entries].sort((a, b) => {
    const aName = normalizeCollectionName(a.name);
    const bName = normalizeCollectionName(b.name);
    const aSG = isSeasonsGreetings(aName);
    const bSG = isSeasonsGreetings(bName);

    // Keep all Season's Greetings together at the end.
    if (aSG !== bSG) return aSG ? 1 : -1;

    if (aSG && bSG) {
      const ay = extractCollectionYear(aName, a.releaseDate);
      const by = extractCollectionYear(bName, b.releaseDate);
      if (ay != null && by != null && ay !== by) return ay - by;
      if (ay != null && by == null) return -1;
      if (ay == null && by != null) return 1;
      return aName.localeCompare(bName, "es", { sensitivity: "base", numeric: true });
    }

    if (skz) {
      const ka = strayKidsCollectionUnifiedSortKey(aName);
      const kb = strayKidsCollectionUnifiedSortKey(bName);
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      if (ka[1] !== kb[1]) return ka[1] - kb[1];
      const cmp = ka[2].localeCompare(kb[2], "es", { sensitivity: "base", numeric: true });
      if (cmp !== 0) return cmp;
    }

    const da = a.releaseDate ? new Date(a.releaseDate).getTime() : Number.POSITIVE_INFINITY;
    const db = b.releaseDate ? new Date(b.releaseDate).getTime() : Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return aName.localeCompare(bName, "es", { sensitivity: "base", numeric: true });
  });
}
