import type { AvatarPublicCatalog } from "@/lib/avatarPublicCatalog.types";

export type VipGroupAssetsRow = {
  key: string;
  label: string;
  logo: string | null;
  members: string[];
  mascotas: string[];
};

const SLUG_TO_LABEL: Record<string, string> = {
  "stray-kids": "Stray Kids",
  bts: "BTS",
  "black-pink": "BlackPink",
  ateez: "ATEEZ",
};

function inferLogoGroupLabel(path: string): string {
  const f = (path.split("/").pop() || "").toLowerCase();
  if (f.includes("straykids") || f.includes("stray-kids")) return "Stray Kids";
  if (f.includes("blackpink")) return "BlackPink";
  if (f.includes("bts")) return "BTS";
  if (f.includes("ateez")) return "ATEEZ";
  const base = f.replace(/\.[a-z0-9]+$/i, "").replace(/-logo$/, "");
  return base.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Unifica carpetas de miembros con nombres de archivo de logo (p.ej. blackpink-logo → mismo grupo que /members/black-pink/). */
const CANONICAL_GROUP_SLUG: Record<string, string> = {
  blackpink: "black-pink",
};

function normalizeGroupSlug(slug: string): string {
  return CANONICAL_GROUP_SLUG[slug] ?? slug;
}

/** Orden por edad (oficial lineup) — nombres de archivo suelen ser slug o nombre en minúsculas. */
const MEMBER_ORDER_BY_SLUG: Record<string, string[]> = {
  "stray-kids": ["bang chan", "lee know", "changbin", "hyunjin", "han", "felix", "seungmin", "i.n"],
  bts: ["jin", "suga", "j-hope", "rm", "jimin", "v", "jungkook"],
  "black-pink": ["jisoo", "jennie", "rosé", "lisa"],
  ateez: ["hongjoong", "seonghwa", "yunho", "yeosang", "san", "mingi", "wooyoung", "jongho"],
};

/**
 * Mascotas SKZOO en el mismo orden que los miembros (edad): Bang Chan → … → I.N
 * wolfchan, leebit, dwaekki, jiniret, hanquokka, bbokari, puppym, foxiny
 */
const SKZOO_DISPLAY_ORDER = [
  "wolfchan",
  "leebit",
  "dwaekki",
  "jiniret",
  "hanquokka",
  "bbokari",
  "puppym",
  "foxiny",
];

function stemFilename(path: string): string {
  return (path.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
}

/** Normaliza nombre de archivo para comparar con tokens de orden (ej. bang-chan → bang chan). */
function normalizedStemForSort(path: string): string {
  let s = stemFilename(path).toLowerCase().replace(/-/g, " ").trim();
  if (s === "in" || s === "i n") return "i.n";
  return s;
}

/** Unifica nombres de archivo con el token del orden (edad). */
function normalizeMemberStemForOrder(slug: string, stem: string): string {
  let s = stem;
  if (slug === "stray-kids") {
    if (s === "bangchan" || s === "bang chan") return "bang chan";
    if (s === "leeknow" || s === "lee know") return "lee know";
  }
  if (slug === "black-pink") {
    if (s === "rose") return "rosé";
  }
  if (slug === "bts") {
    if (s === "j hope" || s === "jhope") return "j-hope";
    if (s === "rap monster" || s === "rapmonster") return "rm";
  }
  return s;
}

function memberSortRank(slug: string, path: string): number {
  let stem = normalizeMemberStemForOrder(slug, normalizedStemForSort(path));
  const order = MEMBER_ORDER_BY_SLUG[slug];
  if (!order) return 1000 + stem.localeCompare("", "en", { numeric: true, sensitivity: "base" });
  for (let i = 0; i < order.length; i++) {
    const token = order[i].toLowerCase().normalize("NFD").replace(/\u0300-\u036f/g, "");
    const stemN = stem.normalize("NFD").replace(/\u0300-\u036f/g, "");
    const tokenCmp = token.replace(/-/g, " ");
    const stemCmp = stemN.replace(/-/g, " ");
    if (
      stemCmp === tokenCmp ||
      stemCmp.includes(tokenCmp) ||
      tokenCmp.includes(stemCmp) ||
      stemN === token ||
      stemN.includes(token) ||
      token.includes(stemN)
    ) {
      return i;
    }
  }
  return 800 + stem.localeCompare("", "en", { numeric: true, sensitivity: "base" });
}

function mascotVariantOrder(path: string): number {
  if (path.includes("/regular/")) return 0;
  if (path.includes("/evil/")) return 1;
  return 2;
}

/** Archivo real FoxI.Ny suele ser `foxi.ny`; legacy `foxiny`. */
function skzooCanonicalStem(path: string): string {
  const stem = stemFilename(path).toLowerCase().replace(/-/g, "");
  if (stem === "foxi.ny" || stem === "foxiny") return "foxiny";
  return stem;
}

function mascotSortRank(path: string): number {
  const stem = skzooCanonicalStem(path);
  const i = SKZOO_DISPLAY_ORDER.indexOf(stem);
  if (i >= 0) return i;
  return 80 + stem.localeCompare("", "en", { numeric: true, sensitivity: "base" });
}

/** Archivos sueltos en /members/ (p.ej. seungmin.png) → Stray Kids por defecto si coincide */
function orphanMemberPathToGroup(path: string): { slug: string; label: string } | null {
  const base = (path.split("/").pop() || "").toLowerCase().replace(/\.[a-z0-9]+$/i, "");
  if (!base) return null;
  if (base.includes("seungmin")) return { slug: "stray-kids", label: "Stray Kids" };
  return { slug: "other", label: "Otros" };
}

/**
 * Agrupa logos, rutas bajo /members/{slug}/ y mascotas SKZOO por etiqueta de grupo, orden alfabético por label.
 */
export function buildVipGroupAssetsRows(catalog: AvatarPublicCatalog | null): VipGroupAssetsRow[] {
  const map = new Map<string, VipGroupAssetsRow>();

  const touch = (slug: string, label: string) => {
    const key = slug || "other";
    let row = map.get(key);
    if (!row) {
      row = { key, label, logo: null, members: [], mascotas: [] };
      map.set(key, row);
    }
    row.label = label;
    return row;
  };

  for (const p of catalog?.vipBadges?.groups ?? []) {
    const label = inferLogoGroupLabel(p);
    const slug = normalizeGroupSlug(slugFromLabel(label));
    const row = touch(slug, label);
    if (!row.logo) row.logo = p;
  }

  for (const p of catalog?.vipBadges?.members ?? []) {
    const m = p.match(/^\/(?:kawaii\/)?members\/([^/]+)\//);
    if (m?.[1]) {
      const slug = normalizeGroupSlug(m[1]);
      const label = SLUG_TO_LABEL[slug] ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      touch(slug, label).members.push(p);
      continue;
    }
    const orphan = orphanMemberPathToGroup(p);
    if (orphan) touch(normalizeGroupSlug(orphan.slug), orphan.label).members.push(p);
  }

  for (const p of catalog?.vipBadges?.skzoo ?? []) {
    touch("stray-kids", "Stray Kids").mascotas.push(p);
  }

  const rows = Array.from(map.values());
  rows.sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  for (const r of rows) {
    r.members.sort((x, y) => {
      const rx = memberSortRank(r.key, x);
      const ry = memberSortRank(r.key, y);
      if (rx !== ry) return rx - ry;
      return x.localeCompare(y, "en", { numeric: true, sensitivity: "base" });
    });
    r.mascotas.sort((x, y) => {
      const rx = mascotSortRank(x);
      const ry = mascotSortRank(y);
      if (rx !== ry) return rx - ry;
      const vx = mascotVariantOrder(x) - mascotVariantOrder(y);
      if (vx !== 0) return vx;
      return x.localeCompare(y, "en", { numeric: true, sensitivity: "base" });
    });
  }
  return rows;
}
