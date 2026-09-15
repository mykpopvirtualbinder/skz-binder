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

const MAX_CANDIDATES = 14;
const ALT_EXTS = ["jpg", "png", "JPG", "PNG", "JPEG", "jpeg"] as const;

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
  for (const ext of ALT_EXTS) {
    push(ext);
  }
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

function remapLegacyMockPcDiskPath(pathname: string): string {
  let p = String(pathname || "");
  if (!p) return p;

  // Supabase still stores the pre-reorg roots (`/album/`, `/otros/`, `/eventos/`).
  // Only rewrite the segment right after the group so nested folders like
  // `albums/japanese/circus/album/a/` stay intact.
  p = p
    .replace(/^(.*\/groups\/[^/]+)\/album\//i, "$1/albums/")
    .replace(/^(.*\/groups\/[^/]+)\/otros\//i, "$1/others/")
    .replace(/^(.*\/groups\/[^/]+)\/eventos\//i, "$1/events/");

  const albumPc = p.match(
    /^(.*\/groups\/[^/]+)\/photocards\/(korean|japanese|taiwanese)-albums?\/([^/]+)\/(.*)$/i,
  );
  if (albumPc) {
    return `${albumPc[1]}/albums/${albumPc[2].toLowerCase()}/${albumPc[3]}/photocards/${albumPc[4]}`;
  }

  const albumInc = p.match(
    /^(.*\/groups\/[^/]+)\/inclusions\/(korean|japanese|taiwanese)-albums?\/([^/]+)\/(.*)$/i,
  );
  if (albumInc) {
    return `${albumInc[1]}/albums/${albumInc[2].toLowerCase()}/${albumInc[3]}/inclusions/${albumInc[4]}`;
  }

  const sg = p.match(
    /^(.*\/groups\/[^/]+)\/photocards\/seasons-greetings\/(korean|japanese|taiwanese)\/([^/]+)\/(.*)$/i,
  );
  if (sg && !/\/others\/seasons-greetings\//i.test(p)) {
    p = `${sg[1]}/others/seasons-greetings/${sg[2]}/${sg[3]}/${seasonsGreetingsRestSuffix(sg[4])}`;
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

  const remapped = remapLegacyMockPcDiskPath(v);
  if (remapped !== v) push(remapped);

  const seeds = remapped !== v ? [remapped, v] : [v];
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

  for (const seed of [...out, v]) {
    for (const [from, to] of aliasPairs) {
      if (seed.includes(from)) push(seed.replace(from, to));
    }
  }

  applyYearAwarePobFolderAliases(v, push);
  for (const candidate of [...out]) {
    applyYearAwarePobFolderAliases(candidate, push);
  }

  push(v);

  if (v.includes("/korean-albums/")) push(v.replace("/korean-albums/", "/korean-album/"));
  if (v.includes("/korean-album/")) push(v.replace("/korean-album/", "/korean-albums/"));
  if (v.includes("/japanese-albums/")) push(v.replace("/japanese-albums/", "/japanese-album/"));
  if (v.includes("/japanese-album/")) push(v.replace("/japanese-album/", "/japanese-albums/"));
  if (/\/photocards\/photocard-set\//i.test(v)) {
    push(v.replace(/\/photocards\/photocard-set\//i, "/photocards/photo-card-set/"));
  }
  if (/\/photocards\/photo-card-set\//i.test(v)) {
    push(v.replace(/\/photocards\/photo-card-set\//i, "/photocards/photocard-set/"));
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

  const base = encodeMockPcPathUrl(decodeMockPcInput(raw));
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

  pushStemVariants(canonical);
  if (resolved !== canonical) pushStemVariants(resolved);

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
