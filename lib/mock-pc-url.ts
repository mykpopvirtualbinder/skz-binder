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

const MAX_CANDIDATES = 8;
const ALT_EXTS = ["jpg", "png", "JPG", "PNG", "JPEG", "jpeg"] as const;

function isKoreanSeasonsGreetings(url: string): boolean {
  return /\/seasons-greetings\/korean\//i.test(url);
}

function useChangBinOnDisk(url: string): boolean {
  return /\/seasons-greetings\/korean\/2025-the-street-kids\/pob-/i.test(url);
}

function memberTailFromStem(stem: string): string | null {
  const m = stem.match(/-(?:front|back)-(.+)$/i);
  return m ? m[1] : null;
}

function isUnitMemberTail(tail: string): boolean {
  return tail.includes("+") || /%2B/i.test(tail);
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

function normalizeMemberTail(tail: string, url: string): string {
  const fixPart = (part: string): string => {
    let s = part;
    const rules: Array<(x: string) => string | null> = [
      (x) => replaceMemberToken(x, /bangchan/gi, "bang-chan"),
      (x) => replaceMemberToken(x, /\bleeknow\b/gi, "lee-know"),
      (x) => replaceMemberToken(x, /\bseung-min\b/gi, "seungmin"),
      (x) => replaceMemberToken(x, /\bhyun-jin\b/gi, "hyunjin"),
    ];
    if (useChangBinOnDisk(url)) {
      rules.push((x) => replaceMemberToken(x, /\bchangbin\b/gi, "chang-bin"));
    } else if (isKoreanSeasonsGreetings(url)) {
      rules.push((x) => replaceMemberToken(x, /\bchang-bin\b/gi, "changbin"));
    }
    for (const rule of rules) {
      const next = rule(s);
      if (next) s = next;
    }
    return s;
  };

  let t = tail;
  if (/%20/i.test(t)) {
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

  push("jpg");
  push("png");
  push("JPG");
  push("PNG");
  push(extRaw);
  push(extLower);
  if (extRaw.toLowerCase() !== extRaw.toUpperCase()) push(extRaw.toUpperCase());
  for (const ext of ALT_EXTS) {
    if (ext.toLowerCase() === extLower) push(ext);
  }
  return out;
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

function pathVariants(v: string): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    if (s && !out.includes(s)) out.push(s);
  };

  const unitFixed = applyPobPolaroidsUnitFolder(v);
  if (unitFixed) push(unitFixed);

  const aliasPairs: [string, string][] = [
    ["/seasons-greetings/korean/2021/polaroid/", "/seasons-greetings/korean/2021/polaroid-pob/"],
    ["/seasons-greetings/korean/2021/set/", "/seasons-greetings/korean/2021/photocard-set/"],
    ["/seasons-greetings/korean/2022/", "/seasons-greetings/korean/2022-room-mates/"],
    ["/seasons-greetings/korean/2024/", "/seasons-greetings/korean/2024-perfect-day/"],
    ["/seasons-greetings/korean/2025/", "/seasons-greetings/korean/2025-the-street-kids/"],
    ["/seasons-greetings/korean/2026/", "/seasons-greetings/korean/2026-starlight-super-club/"],
    ["/seasons-greetings/korean/2023-szks-mini-world/", "/seasons-greetings/korean/2023-szks-mini-world%20/"],
    ["/seasons-greetings/korean/2024-perfect-day/polaroid/", "/seasons-greetings/korean/2024-perfect-day/polaroid%20/"],
    ["/pob-polaroid-unit/", "/pob-polaroids-unit/"],
  ];

  for (const [from, to] of aliasPairs) {
    if (v.includes(from)) push(v.replace(from, to));
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
  if (/\/seasons-greetings\/[^/]+\/[^/]+\/photocard-set\//i.test(v)) {
    push(v.replace(/\/photocard-set\//i, "/photo-card-set/"));
  }
  if (/\/seasons-greetings\/[^/]+\/[^/]+\/photo-card-set\//i.test(v)) {
    push(v.replace(/\/photo-card-set\//i, "/photocard-set/"));
  }

  return out;
}

function stemPrefixVariants(stem: string, url: string): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    if (s && !out.includes(s)) out.push(s);
  };

  const tail = memberTailFromStem(stem);
  if (tail && isUnitMemberTail(tail)) {
    push(stem);
    return out;
  }

  const prefer00 =
    /\/2026-starlight-super-club\/pob-/i.test(url) && !/\/pob-musickorea\//i.test(url);
  const alt001 = /\/001-front-/i.test(stem) ? stem.replace(/\/001-front-/gi, "/00-front-") : null;
  const alt00 = /\/00-front-/i.test(stem) ? stem.replace(/\/00-front-/gi, "/001-front-") : null;

  if (prefer00 && alt001) {
    push(alt001);
    push(stem);
  } else {
    push(stem);
    if (alt001) push(alt001);
  }
  if (alt00) push(alt00);
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
  return exts.find((e) => /\.(jpe?g|png)$/i.test(e)) ?? exts[0] ?? best;
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

  if (!out.includes(base) && out.length < MAX_CANDIDATES) push(base);

  if (fallback && out.length < MAX_CANDIDATES) push(fallback);
  return out;
}
