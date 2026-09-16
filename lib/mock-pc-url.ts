import { splitPcImageStemExt } from "@/lib/pc-image-extensions";

/**
 * Codifica segmentos de rutas bajo `/mock-pcs/` para que el navegador cargue bien
 * nombres con espacios, tildes, etc. (p. ej. capturas de pantalla en `public/`).
 */
export function encodeMockPcPathUrl(url: string): string {
  const s = String(url ?? "").trim();
  if (!s) return s;
  if (!/^\/mock-pcs\//i.test(s)) return s;

  const q = s.indexOf("?");
  const pathPart = q >= 0 ? s.slice(0, q) : s;
  const query = q >= 0 ? s.slice(q) : "";

  const segments = pathPart.split("/");
  const encoded = segments.map((seg) => {
    if (seg === "") return "";
    try {
      return encodeURIComponent(decodeURIComponent(seg));
    } catch {
      return encodeURIComponent(seg);
    }
  });
  return encoded.join("/") + query;
}

// --- Resolución de URLs mock-pcs (Season's Greetings, POB por año, etc.) ---

const MAX_CANDIDATES = 12;

function memberTailFromStem(stem: string): string | null {
  const m = stem.match(/-(?:front|back)-(.+)$/i);
  return m ? m[1] : null;
}

function isUnitMemberTail(tail: string): boolean {
  return tail.includes("+") || /%2B/i.test(tail) || /_/i.test(tail);
}

function applyPobPolaroidsUnitFolder(file: string): string | null {
  if (!file.includes("/pob-polaroids/") || file.includes("/pob-polaroids-unit/")) {
    return null;
  }
  const se = splitPcImageStemExt(file);
  if (!se) return null;
  const tail = memberTailFromStem(se.stem);
  if (!tail || !isUnitMemberTail(tail)) return null;
  return file.replace("/pob-polaroids/", "/pob-polaroids-unit/");
}

function replaceMemberToken(tail: string, from: RegExp, to: string): string | null {
  if (!from.test(tail)) return null;
  from.lastIndex = 0;
  const next = tail.replace(from, to);
  return next !== tail ? next : null;
}

function decodeMockPcInput(url: string): string {
  const s = String(url ?? "").trim();
  if (!s) return s;
  const q = s.indexOf("?");
  const pathPart = q >= 0 ? s.slice(0, q) : s;
  const query = q >= 0 ? s.slice(q) : "";
  const segments = pathPart.split("/").map((seg) => {
    if (seg === "") return seg;
    try {
      return decodeURIComponent(seg.replace(/\+/g, "%2B"));
    } catch {
      return seg;
    }
  });
  return segments.join("/") + query;
}

function normalizeMemberTail(tail: string, _url: string): string {
  const fixPart = (part: string): string => {
    let s = part;
    const rules: Array<(x: string) => string | null> = [
      (x) => replaceMemberToken(x, /bangchan/gi, "bang-chan"),
      (x) => replaceMemberToken(x, /\bleeknow\b/gi, "lee-know"),
      (x) => replaceMemberToken(x, /\bseung-min\b/gi, "seungmin"),
      (x) => replaceMemberToken(x, /\bhyun-jin\b/gi, "hyunjin"),
    ];
    for (const rule of rules) {
      const next = rule(s);
      if (next) s = next;
    }
    return s;
  };

  let t = tail;
  if (/%2B/i.test(t) || /%20/i.test(t)) {
    try {
      t = decodeURIComponent(t.replace(/\+/g, "%2B"));
    } catch {
      /* keep */
    }
  }

  if (/\s/.test(t)) {
    return t
      .trim()
      .split(/\s+/)
      .map((p) => fixPart(p))
      .join("+");
  }

  if (t.includes("+")) {
    return t
      .split("+")
      .map((p) => fixPart(p.trim()))
      .join("+");
  }
  if (t.includes("_")) {
    const parts = t.split("_").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((p) => fixPart(p)).join("+");
    }
  }
  return fixPart(t);
}

function extensionVariants(stem: string, extLower: string, rawUrl: string): string[] {
  const out: string[] = [];
  const push = (ext: string) => {
    const e = String(ext || "").trim();
    if (!e) return;
    const file = `${stem}.${e}`;
    if (!out.includes(file)) out.push(file);
  };

  const rawPath = rawUrl.split("?")[0] ?? rawUrl;
  const dot = rawPath.lastIndexOf(".");
  const extRaw = dot > 0 ? rawPath.slice(dot + 1) : extLower;

  // Prefer the extension stored in the URL / on disk. Forcing .jpg first
  // hid thousands of real .png files after the folder reorg.
  if (/^hei[cf]$/i.test(extLower) || /^hei[cf]$/i.test(extRaw)) {
    push("jpg");
    push("png");
    push("JPG");
    push("PNG");
  }
  push(extRaw);
  push(extLower);
  if (extRaw && extRaw.toLowerCase() !== extRaw.toUpperCase()) push(extRaw.toUpperCase());
  if (extLower !== "png") push("png");
  if (extLower !== "jpg" && extLower !== "jpeg") push("jpg");
  return out;
}

/** Old SG trees dumped POB folders under photocards/; disk uses pobs/. */
function seasonsGreetingsRestSuffix(rest: string): string {
  const r = String(rest || "");
  if (/^(photocards|inclusions|pobs?|pop-ups?|pop[\s_%-]*ups?)\//i.test(r)) return r;
  const first = r.split("/")[0] || "";
  if (
    /^pob/i.test(first) ||
    /polaroid-pob/i.test(first) ||
    /^photo-card-fanclub/i.test(first)
  ) {
    return `pobs/${r}`;
  }
  return `photocards/${r}`;
}

/** Year folders, trailing spaces, photocard-set, polaroid — apply after otros→others. */
function applySeasonsGreetingsDiskAliases(pathname: string): string {
  let p = String(pathname || "");
  if (!/seasons-greetings/i.test(p)) return p;

  p = p.replace(/\/seasons-greetings\/korean\/2022\//gi, "/seasons-greetings/korean/2022-room-mates/");
  p = p.replace(/\/seasons-greetings\/korean\/2024\//gi, "/seasons-greetings/korean/2024-perfect-day/");
  p = p.replace(/\/seasons-greetings\/korean\/2025\//gi, "/seasons-greetings/korean/2025-the-street-kids/");
  p = p.replace(/\/seasons-greetings\/korean\/2026\//gi, "/seasons-greetings/korean/2026-starlight-super-club/");
  p = p.replace(
    /\/seasons-greetings\/korean\/2023-szks-mini-world\//gi,
    "/seasons-greetings/korean/2023-szks-mini-world%20/",
  );

  p = p.replace(
    /\/2024-perfect-day\/photocards\/polaroid\//gi,
    "/2024-perfect-day/photocards/polaroid%20/",
  );
  p = p.replace(
    /\/2024-perfect-day\/polaroid\//gi,
    "/2024-perfect-day/photocards/polaroid%20/",
  );

  p = p.replace(/\/photocards\/photocard-set\//gi, "/photocards/photo-card-set/");
  p = p.replace(/\/pob-polaroid-unit\//gi, "/pob-polaroids-unit/");

  p = p.replace(
    /\/seasons-greetings\/korean\/2021\/(?:photocards\/)?polaroid\//gi,
    "/seasons-greetings/korean/2021/pobs/polaroid-pob/",
  );
  p = p.replace(
    /\/seasons-greetings\/korean\/2021\/(?:photocards\/)?set\//gi,
    "/seasons-greetings/korean/2021/photocards/",
  );

  return p;
}

function applyYearAwarePobFolderAliases(v: string, push: (s: string) => void): void {
  const y2024 = v.includes("/seasons-greetings/korean/2024-perfect-day/");
  const y2025 = v.includes("/seasons-greetings/korean/2025-the-street-kids/");
  const y2026 = v.includes("/seasons-greetings/korean/2026-starlight-super-club/");

  if (y2024 || y2026) {
    if (v.includes("/pob-apple-music/")) {
      push(v.replace(/\/pob-apple-music\//g, "/pob-applemusic/"));
    }
  }
  if (y2025) {
    if (v.includes("/pob-applemusic/")) {
      push(v.replace(/\/pob-applemusic\//g, "/pob-apple-music/"));
    }
    if (v.includes("/pob-musickorea/")) {
      push(v.replace(/\/pob-musickorea\//g, "/pob-music-korea/"));
    }
  }
  if (y2026) {
    if (v.includes("/pob-music-korea/")) {
      push(v.replace(/\/pob-music-korea\//g, "/pob-musickorea/"));
    }
    if (v.includes("/pob-kpop-together/")) {
      push(v.replace(/\/pob-kpop-together\//g, "/pob-kpop-toguether/"));
    }
  }
}

function regionAlbumFolders(region: string): string[] {
  const r = region.toLowerCase();
  return [`${r}-album`, `${r}-albums`];
}

/** Collapse `/events/events/` from double eventos→events rewrites. */
function collapseDuplicateEventSegments(pathname: string): string {
  return String(pathname || "").replace(/\/events\/events\//gi, "/events/");
}

/**
 * Production still serves `photocards/korean-album/…`.
 * Local disk after the reorg uses `albums/korean/…/photocards/…`.
 * Always offer both so images work on the deployed site and on localhost.
 */
function layoutAliases(pathname: string): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = collapseDuplicateEventSegments(s);
    if (t && !out.includes(t)) out.push(t);
  };
  const p = collapseDuplicateEventSegments(pathname);
  if (!p) return out;
  push(p);

  const albumsPc = p.match(
    /^(.*\/groups\/[^/]+)\/albums\/(korean|japanese|taiwanese)\/([^/]+)\/photocards\/(.*)$/i,
  );
  if (albumsPc) {
    for (const folder of regionAlbumFolders(albumsPc[2])) {
      push(`${albumsPc[1]}/photocards/${folder}/${albumsPc[3]}/${albumsPc[4]}`);
    }
  }

  const pcAlbum = p.match(
    /^(.*\/groups\/[^/]+)\/photocards\/(korean|japanese|taiwanese)-albums?\/([^/]+)\/(.*)$/i,
  );
  if (pcAlbum) {
    push(`${pcAlbum[1]}/albums/${pcAlbum[2].toLowerCase()}/${pcAlbum[3]}/photocards/${pcAlbum[4]}`);
  }

  const albumsInc = p.match(
    /^(.*\/groups\/[^/]+)\/albums\/(korean|japanese|taiwanese)\/([^/]+)\/inclusions\/(.*)$/i,
  );
  if (albumsInc) {
    for (const folder of regionAlbumFolders(albumsInc[2])) {
      push(`${albumsInc[1]}/inclusions/${folder}/${albumsInc[3]}/${albumsInc[4]}`);
    }
  }

  const incAlbum = p.match(
    /^(.*\/groups\/[^/]+)\/inclusions\/(korean|japanese|taiwanese)-albums?\/([^/]+)\/(.*)$/i,
  );
  if (incAlbum) {
    push(`${incAlbum[1]}/albums/${incAlbum[2].toLowerCase()}/${incAlbum[3]}/inclusions/${incAlbum[4]}`);
  }

  const pcEvents = p.match(/^(.*\/groups\/[^/]+)\/photocards\/events\/(.*)$/i);
  if (pcEvents) {
    push(`${pcEvents[1]}/events/${pcEvents[2]}`);
    push(`${pcEvents[1]}/eventos/${pcEvents[2]}`);
  }

  const groupEvents = p.match(/^(.*\/groups\/[^/]+)\/events\/(.*)$/i);
  if (groupEvents && !/\/photocards\/events\//i.test(p)) {
    const rest = groupEvents[2].replace(/^events\//i, "");
    push(`${groupEvents[1]}/photocards/events/${rest}`);
    push(`${groupEvents[1]}/eventos/${rest}`);
  }

  const eventos = p.match(/^(.*\/groups\/[^/]+)\/eventos\/(.*)$/i);
  if (eventos) {
    const rest = eventos[2].replace(/^events\//i, "");
    push(`${eventos[1]}/photocards/events/${rest}`);
    push(`${eventos[1]}/events/${rest}`);
  }

  const pcSg = p.match(/^(.*\/groups\/[^/]+)\/photocards\/seasons-greetings\/(.*)$/i);
  if (pcSg) {
    push(`${pcSg[1]}/others/seasons-greetings/${pcSg[2]}`);
    push(`${pcSg[1]}/otros/seasons-greetings/${pcSg[2]}`);
  }

  const othersSg = p.match(/^(.*\/groups\/[^/]+)\/others\/seasons-greetings\/(.*)$/i);
  if (othersSg) {
    push(`${othersSg[1]}/photocards/seasons-greetings/${othersSg[2]}`);
  }

  const otrosSg = p.match(/^(.*\/groups\/[^/]+)\/otros\/seasons-greetings\/(.*)$/i);
  if (otrosSg) {
    push(`${otrosSg[1]}/photocards/seasons-greetings/${otrosSg[2]}`);
    push(`${otrosSg[1]}/others/seasons-greetings/${otrosSg[2]}`);
  }

  const groupAlbum = p.match(/^(.*\/groups\/[^/]+)\/album\/(.*)$/i);
  if (groupAlbum && !/\/albums\//i.test(p)) {
    push(`${groupAlbum[1]}/albums/${groupAlbum[2]}`);
  }

  return out;
}

function remapLegacyMockPcDiskPath(pathname: string): string {
  let p = collapseDuplicateEventSegments(pathname);
  if (!p) return p;

  // Only rewrite the segment right after the group so nested folders like
  // `albums/japanese/circus/album/a/` stay intact.
  // Do NOT move `photocards/korean-album/…` — that is the tree deployed on production.
  p = p
    .replace(/^(.*\/groups\/[^/]+)\/album\//i, "$1/albums/")
    .replace(/^(.*\/groups\/[^/]+)\/otros\//i, "$1/others/")
    .replace(/^(.*\/groups\/[^/]+)\/eventos\//i, "$1/photocards/events/")
    .replace(/^(.*\/groups\/[^/]+)\/events\/events\//i, "$1/photocards/events/");

  const sg = p.match(
    /^(.*\/groups\/[^/]+)\/photocards\/seasons-greetings\/(korean|japanese|taiwanese)\/([^/]+)\/(.*)$/i,
  );
  if (sg) {
    p = `${sg[1]}/photocards/seasons-greetings/${sg[2]}/${sg[3]}/${seasonsGreetingsRestSuffix(sg[4])}`;
  }

  let decoded = p;
  try {
    decoded = decodeURIComponent(p.replace(/\+/g, " "));
  } catch {
    decoded = p;
  }
  const portadas = decoded.match(
    /^(.*\/groups\/[^/]+)\/portadas(?:[- ]+(?:de[- ]+)?)albums?\/(korean|japanese|taiwanese|taiwan)\/([^/]+)\/(.*)$/i,
  );
  if (portadas) {
    const rest = portadas[4] ?? "";
    const pack = (rest.split("/")[0] || "").toLowerCase();
    const kindFolders = new Set(["regular", "vinyl", "skzoo", "platform", "accordion"]);
    const accordionPack = new Set(["digipack", "jewel-case", "paper-case", "postcard", "fan-club", "compact"]);
    let inner = rest;
    if (!kindFolders.has(pack)) {
      if (accordionPack.has(pack) && rest.includes("/")) inner = `accordion/${rest}`;
      else inner = `regular/${rest}`;
    }
    const region = portadas[2].toLowerCase() === "taiwan" ? "taiwanese" : portadas[2].toLowerCase();
    return applySeasonsGreetingsDiskAliases(
      `${portadas[1]}/albums/${region}/${portadas[3]}/portadas-album/${inner}`,
    );
  }

  return applySeasonsGreetingsDiskAliases(p);
}

function pathVariants(v: string): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    if (s && !out.includes(s)) out.push(s);
  };

  const cleaned = collapseDuplicateEventSegments(v);
  push(cleaned);
  for (const alias of layoutAliases(cleaned)) push(alias);

  const remapped = remapLegacyMockPcDiskPath(cleaned);
  if (remapped !== cleaned) push(remapped);
  for (const alias of layoutAliases(remapped)) push(alias);

  const seeds = remapped !== cleaned ? [cleaned, remapped] : [cleaned];
  for (const seed of seeds) {
    const unitFixed = applyPobPolaroidsUnitFolder(seed);
    if (unitFixed) push(unitFixed);
  }

  const aliasPairs: [string, string][] = [
    ["/seasons-greetings/korean/2021/polaroid/", "/seasons-greetings/korean/2021/pobs/polaroid-pob/"],
    ["/seasons-greetings/korean/2021/set/", "/seasons-greetings/korean/2021/photocards/"],
    ["/seasons-greetings/korean/2022/", "/seasons-greetings/korean/2022-room-mates/"],
    ["/seasons-greetings/korean/2024/", "/seasons-greetings/korean/2024-perfect-day/"],
    ["/seasons-greetings/korean/2025/", "/seasons-greetings/korean/2025-the-street-kids/"],
    ["/seasons-greetings/korean/2026/", "/seasons-greetings/korean/2026-starlight-super-club/"],
    ["/seasons-greetings/korean/2023-szks-mini-world/", "/seasons-greetings/korean/2023-szks-mini-world%20/"],
    ["/2024-perfect-day/photocards/polaroid/", "/2024-perfect-day/photocards/polaroid%20/"],
    ["/2024-perfect-day/polaroid/", "/2024-perfect-day/photocards/polaroid%20/"],
    ["/pob-polaroid-unit/", "/pob-polaroids-unit/"],
  ];

  for (const seed of [...out, cleaned]) {
    for (const [from, to] of aliasPairs) {
      if (seed.includes(from)) push(seed.replace(from, to));
    }
  }

  applyYearAwarePobFolderAliases(cleaned, push);
  for (const candidate of [...out]) {
    applyYearAwarePobFolderAliases(candidate, push);
  }

  if (cleaned.includes("/korean-albums/")) push(cleaned.replace("/korean-albums/", "/korean-album/"));
  if (cleaned.includes("/korean-album/")) push(cleaned.replace("/korean-album/", "/korean-albums/"));
  if (cleaned.includes("/japanese-albums/")) push(cleaned.replace("/japanese-albums/", "/japanese-album/"));
  if (cleaned.includes("/japanese-album/")) push(cleaned.replace("/japanese-album/", "/japanese-albums/"));
  if (/\/photocards\/photocard-set\//i.test(cleaned)) {
    push(cleaned.replace(/\/photocards\/photocard-set\//i, "/photocards/photo-card-set/"));
  }
  if (/\/photocards\/photo-card-set\//i.test(cleaned)) {
    push(cleaned.replace(/\/photocards\/photo-card-set\//i, "/photocards/photocard-set/"));
  }

  for (const candidate of [...out]) {
    const remappedLater = remapLegacyMockPcDiskPath(candidate);
    if (remappedLater !== candidate) push(remappedLater);
  }

  return out;
}

function stemPrefixVariants(stem: string, url: string): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    if (s && !out.includes(s)) out.push(s);
  };

  const tail = memberTailFromStem(stem);
  const changbinStems: string[] = [stem];
  if (tail) {
    if (/\bchang-bin\b/i.test(tail)) {
      changbinStems.push(stem.replace(/\bchang-bin\b/gi, "changbin"));
    } else if (/\bchangbin\b/i.test(tail)) {
      changbinStems.push(stem.replace(/\bchangbin\b/gi, "chang-bin"));
    }
  }

  if (tail && isUnitMemberTail(tail)) {
    for (const s of changbinStems) {
      push(s);
      if (s.includes("+")) push(s.replace(/\+/g, "_"));
      if (s.includes("_")) push(s.replace(/_/g, "+"));
    }
    return out;
  }

  const prefer00 =
    /\/2026-starlight-super-club\/pobs\/(?:pob-applemusic|pob-ktown4u|pob-with-mu-u|pob-yes24)\//i.test(
      url,
    );

  for (const baseStem of changbinStems) {
    const alt001 = /\/001-front-/i.test(baseStem)
      ? baseStem.replace(/\/001-front-/gi, "/00-front-")
      : null;
    const alt00 = /\/00-front-/i.test(baseStem)
      ? baseStem.replace(/\/00-front-/gi, "/001-front-")
      : null;

    if (prefer00 && alt001) {
      push(alt001);
      push(baseStem);
    } else {
      push(baseStem);
      if (alt001) push(alt001);
    }
    if (alt00) push(alt00);
  }
  return out;
}

function pathContext(url: string): string {
  const variants = pathVariants(url);
  return (
    variants.find((p) => p.includes("/pob-polaroids-unit/")) ??
    variants.find((p) => /\/groups\/[^/]+\/photocards\//i.test(p) && !/\/events\/events\//i.test(p)) ??
    variants.find((p) => !/\/events\/events\//i.test(p)) ??
    applyPobPolaroidsUnitFolder(url) ??
    variants[0] ??
    url
  );
}

function normalizeStemAndTail(encoded: string, rawUrl: string): string {
  const ctx = pathContext(encoded);
  const se = splitPcImageStemExt(ctx);
  if (!se) return ctx;

  const m = se.stem.match(/^(.*-(?:front|back)-)(.+)$/i);
  if (!m) return `${se.stem}.${se.extLower}`;

  const normalizedTail = normalizeMemberTail(m[2], ctx);
  let file = `${m[1]}${normalizedTail}.${se.extLower}`;
  const unitFixed = applyPobPolaroidsUnitFolder(file);
  if (unitFixed) file = unitFixed;

  const paths = pathVariants(file);
  const best =
    paths.find((p) => p.includes("/pob-polaroids-unit/")) ??
    applyPobPolaroidsUnitFolder(file) ??
    paths[0] ??
    file;

  const bestSe = splitPcImageStemExt(best);
  if (!bestSe) return best;
  const exts = extensionVariants(bestSe.stem, bestSe.extLower, rawUrl);
  const originalExt = (rawUrl.split("?")[0] ?? rawUrl).split(".").pop() || bestSe.extLower;
  const preferOriginal = exts.find((e) =>
    e.toLowerCase().endsWith(`.${String(originalExt).toLowerCase()}`),
  );
  return encodeMockPcPathUrl(
    preferOriginal ?? exts.find((e) => /\.(jpe?g|png|webp)$/i.test(e)) ?? exts[0] ?? best,
  );
}

function normalizeMockPcUrl(url: string): string {
  const decoded = decodeMockPcInput(url);
  const encoded = encodeMockPcPathUrl(decoded);
  return normalizeStemAndTail(encoded, url);
}

export function resolveMockPcImageUrl(src: string | null | undefined): string {
  const raw = String(src ?? "").trim();
  if (!raw || !/^\/mock-pcs\//i.test(raw)) return raw;
  return normalizeMockPcUrl(raw);
}

export function buildMockPcImageCandidates(
  src: string | null | undefined,
  fallbackSrc?: string,
): string[] {
  const out: string[] = [];
  const push = (v: string) => {
    const t = String(v || "").trim();
    if (!t || out.includes(t) || out.length >= MAX_CANDIDATES) return;
    out.push(t);
  };

  const raw = String(src ?? "").trim();
  const fallback = fallbackSrc
    ? encodeMockPcPathUrl(String(fallbackSrc).trim()) || String(fallbackSrc).trim()
    : "";

  if (!raw) return fallback ? [fallback] : [];

  if (!/^\/mock-pcs\//i.test(raw)) {
    push(raw);
    if (fallback) push(fallback);
    return out;
  }

  const decoded = decodeMockPcInput(raw);
  const base = encodeMockPcPathUrl(decoded);
  push(base);
  for (const alias of layoutAliases(decoded)) {
    push(encodeMockPcPathUrl(alias));
  }

  const resolved = normalizeMockPcUrl(base);
  const canonical = normalizeStemAndTail(base, raw);

  const pushStemVariants = (file: string) => {
    const se = splitPcImageStemExt(file);
    if (!se) {
      push(file);
      return;
    }
    for (const stem of stemPrefixVariants(se.stem, file)) {
      for (const variant of extensionVariants(stem, se.extLower, raw)) {
        if (out.length >= MAX_CANDIDATES) return;
        push(variant);
      }
    }
  };

  if (canonical !== base) pushStemVariants(canonical);
  if (resolved !== canonical && resolved !== base) pushStemVariants(resolved);

  const unitFromBase = applyPobPolaroidsUnitFolder(base);
  if (unitFromBase && unitFromBase !== canonical) pushStemVariants(unitFromBase);

  for (const file of [canonical, resolved, base]) {
    if (!file) continue;
    if (/%2B/i.test(file)) push(file.replace(/%2B/gi, "+"));
    if (file.includes("+")) push(file.replace(/\+/g, "%2B"));
    if (file.includes("+") || /%2B/i.test(file)) {
      push(file.replace(/\+/g, "_").replace(/%2B/gi, "_"));
    }
    const slash = file.lastIndexOf("/");
    const name = slash >= 0 ? file.slice(slash + 1) : file;
    const dir = slash >= 0 ? file.slice(0, slash + 1) : "";
    if (name.includes("_")) {
      push(dir + name.replace(/_/g, "+"));
      push(dir + name.replace(/_/g, "%2B"));
    }
  }

  if (base !== canonical) push(base);
  if (fallback && out.length < MAX_CANDIDATES) push(fallback);
  return out;
}
