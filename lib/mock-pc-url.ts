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

const MAX_CANDIDATES = 32;

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
    /\/photocards\/seasons-greetings\/korean\/2023-szks-mini-world\//gi,
    "/photocards/seasons-greetings/korean/2023-szks-mini-world%20/",
  );
  p = p.replace(
    /\/inclusions\/seasons-greetings\/korean\/2023-szks-mini-world(?:%20| )\//gi,
    "/inclusions/seasons-greetings/korean/2023-szks-mini-world/",
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
  // Production: korean-album (singular), japanese-albums / taiwanese-albums (plural).
  if (r === "korean") return [`${r}-album`, `${r}-albums`];
  return [`${r}-albums`, `${r}-album`];
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
function firstPathSeg(rest: string): string {
  return (rest.split("/")[0] || "").toLowerCase();
}

function restAfterFirst(rest: string): string {
  return rest.split("/").slice(1).join("/");
}

const ALBUM_SIDECAR_FOLDERS = /^(merch|pobs?|pop-ups?|portadas-album|inclusions)$/i;

const POB_FOLDER_ALIASES: Array<[RegExp, string]> = [
  [/japan-fan-club-online-lottery/gi, "online-lottery"],
  [/tower-record-lucky-draw/gi, "Tower-record-lucky-draw"],
];

function applyPobFolderAliases(pathname: string, push: (s: string) => void) {
  for (const [from, to] of POB_FOLDER_ALIASES) {
    from.lastIndex = 0;
    if (from.test(pathname)) {
      from.lastIndex = 0;
      push(pathname.replace(from, to));
    }
    from.lastIndex = 0;
  }
}

function sgYearFolderVariants(year: string): string[] {
  const out: string[] = [];
  const push = (y: string) => {
    if (y && !out.includes(y)) out.push(y);
  };
  push(year);
  let decoded = year;
  try {
    decoded = decodeURIComponent(year.replace(/\+/g, "%20"));
  } catch {
    decoded = year;
  }
  const trimmed = decoded.replace(/\s+$/g, "");
  push(trimmed);
  if (/2023-szks-mini-world/i.test(trimmed)) {
    push(`${trimmed}%20`);
    push(`${trimmed} `);
  }
  return out;
}

function pushAlbumDiskAliases(
  push: (s: string) => void,
  root: string,
  region: string,
  album: string,
  rest: string,
) {
  const first = firstPathSeg(rest);
  const after = restAfterFirst(rest);
  const jp = /^(japanese|taiwanese)$/i.test(region);
  for (const folder of regionAlbumFolders(region)) {
    if (first === "photocards") {
      if (jp) push(`${root}/photocards/${folder}/${album}/album/${after}`);
      push(`${root}/photocards/${folder}/${album}/${after}`);
      push(`${root}/albums/${region}/${album}/photocards/${after}`);
      push(`${root}/album/${region}/${album}/photocards/${after}`);
    } else if (first === "album") {
      push(`${root}/photocards/${folder}/${album}/album/${after}`);
      push(`${root}/photocards/${folder}/${album}/${after}`);
      push(`${root}/albums/${region}/${album}/photocards/${after}`);
      push(`${root}/albums/${region}/${album}/album/${after}`);
    } else if (ALBUM_SIDECAR_FOLDERS.test(first)) {
      const kinds = /^pobs?$/i.test(first) ? ["pob", "pobs"] : [first];
      for (const k of kinds) {
        push(`${root}/photocards/${folder}/${album}/${k}/${after}`);
      }
      if (/^pobs?$/i.test(first)) {
        push(`${root}/photocards/${folder}/${album}/${after}`);
      }
      if (first === "inclusions") {
        push(`${root}/inclusions/${folder}/${album}/${after}`);
      }
      push(`${root}/albums/${region}/${album}/${first}/${after}`);
      push(`${root}/album/${region}/${album}/${first}/${after}`);
    } else {
      push(`${root}/photocards/${folder}/${album}/${rest}`);
      if (jp) push(`${root}/photocards/${folder}/${album}/album/${rest}`);
    }
  }
}

function pushSeasonsGreetingsAliases(push: (s: string) => void, root: string, rest: string) {
  push(`${root}/photocards/seasons-greetings/${rest}`);
  push(`${root}/others/seasons-greetings/${rest}`);
  push(`${root}/otros/seasons-greetings/${rest}`);

  const m = rest.match(/^(korean|japanese|taiwanese)\/([^/]+)\/(.*)$/i);
  if (!m) return;
  const region = m[1];
  const year = m[2];
  const after = m[3];
  const first = firstPathSeg(after);
  const tail = restAfterFirst(after);

  if (/2026-force/i.test(year) && /pop.*up.*force.*2026.*items/i.test(first)) {
    push(`${root}/photocards/japanese-md/2026-force/${tail}`);
    push(`${root}/photocards/seasons-greetings/japanese/2026-force/${tail.replace(/^photocards?\//i, "")}`);
    push(`${root}/photocards/seasons-greetings/japanese/2026-force/photo-card-set/${restAfterFirst(tail)}`);
  }

  for (const y of sgYearFolderVariants(year)) {
    const yearBase = `${root}/photocards/seasons-greetings/${region}/${y}`;
    const yearOthers = `${root}/others/seasons-greetings/${region}/${y}`;
    const yearInc = `${root}/inclusions/seasons-greetings/${region}/${y}`;

    if (first === "photocards" || first === "pobs" || first === "pob") {
      push(`${yearBase}/${tail}`);
      push(`${yearInc}/${tail}`);
      push(`${yearOthers}/${tail}`);
      if (first === "photocards") {
        push(`${yearBase}/set/${tail}`);
        push(`${yearBase}/photocard-set/${tail}`);
        push(`${yearBase}/photo-card-set/${tail}`);
      }
    }
    if (first === "inclusions") {
      push(`${yearInc}/${tail}`);
      push(`${yearOthers}/inclusions/${tail}`);
    }
    if (!first) {
      push(`${yearBase}/${after}`);
      push(`${yearInc}/${after}`);
    }
  }
}

function layoutAliases(pathname: string): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = collapseDuplicateEventSegments(s);
    if (t && !out.includes(t)) out.push(t);
  };
  const p = collapseDuplicateEventSegments(pathname);
  if (!p) return out;
  push(p);

  const albumsAny = p.match(
    /^(.*\/groups\/[^/]+)\/albums?\/(korean|japanese|taiwanese)\/([^/]+)\/(.*)$/i,
  );
  if (albumsAny) {
    pushAlbumDiskAliases(push, albumsAny[1], albumsAny[2].toLowerCase(), albumsAny[3], albumsAny[4]);
  }

  const pcAlbum = p.match(
    /^(.*\/groups\/[^/]+)\/photocards\/(korean|japanese|taiwanese)-albums?\/([^/]+)\/(.*)$/i,
  );
  if (pcAlbum) {
    const rest = pcAlbum[4];
    const first = firstPathSeg(rest);
    const after = restAfterFirst(rest);
    const region = pcAlbum[2].toLowerCase();
    const root = pcAlbum[1];
    const album = pcAlbum[3];
    if (ALBUM_SIDECAR_FOLDERS.test(first)) {
      const kinds = /^pobs?$/i.test(first) ? ["pob", "pobs"] : [first];
      for (const k of kinds) {
        push(`${root}/albums/${region}/${album}/${k}/${after}`);
        push(`${root}/album/${region}/${album}/${k}/${after}`);
      }
    } else if (first === "album") {
      push(`${root}/albums/${region}/${album}/photocards/${after}`);
      push(`${root}/albums/${region}/${album}/album/${after}`);
      push(`${root}/album/${region}/${album}/album/${after}`);
    } else {
      push(`${root}/albums/${region}/${album}/photocards/${rest}`);
      push(`${root}/albums/${region}/${album}/${rest}`);
      push(`${root}/photocards/${pcAlbum[2]}/${album}/album/${rest}`);
    }
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

  const runIt = p.match(
    /^(.*\/groups\/[^/]+)\/(?:photocards\/events|events|eventos)\/tour\/run-it\/stray-kids-world-tour-run-it-in-(seoul|japan)\/(.*)$/i,
  );
  if (runIt) {
    push(
      `${runIt[1]}/photocards/events/tours/stray-kids-world-tour-run-it-in/${runIt[2].toLowerCase()}/${runIt[3]}`,
    );
    push(
      `${runIt[1]}/events/tours/stray-kids-world-tour-run-it-in/${runIt[2].toLowerCase()}/${runIt[3]}`,
    );
    push(
      `${runIt[1]}/photocards/events/tour/run-it/stray-kids-world-tour-run-it-in-${runIt[2].toLowerCase()}/${runIt[3]}`,
    );
  }

  const pcSg = p.match(/^(.*\/groups\/[^/]+)\/photocards\/seasons-greetings\/(.*)$/i);
  if (pcSg) {
    pushSeasonsGreetingsAliases(push, pcSg[1], pcSg[2]);
  }

  const othersSg = p.match(/^(.*\/groups\/[^/]+)\/others\/seasons-greetings\/(.*)$/i);
  if (othersSg) {
    pushSeasonsGreetingsAliases(push, othersSg[1], othersSg[2]);
  }

  const otrosSg = p.match(/^(.*\/groups\/[^/]+)\/otros\/seasons-greetings\/(.*)$/i);
  if (otrosSg) {
    pushSeasonsGreetingsAliases(push, otrosSg[1], otrosSg[2]);
  }

  const groupAlbum = p.match(/^(.*\/groups\/[^/]+)\/album\/(.*)$/i);
  if (groupAlbum && !/\/albums\//i.test(p)) {
    push(`${groupAlbum[1]}/albums/${groupAlbum[2]}`);
  }

  applyPobFolderAliases(p, push);
  for (const extra of [...out]) applyPobFolderAliases(extra, push);

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
    [
      "/photocards/seasons-greetings/korean/2023-szks-mini-world/",
      "/photocards/seasons-greetings/korean/2023-szks-mini-world%20/",
    ],
    [
      "/inclusions/seasons-greetings/korean/2023-szks-mini-world%20/",
      "/inclusions/seasons-greetings/korean/2023-szks-mini-world/",
    ],
    [
      "/inclusions/seasons-greetings/korean/2023-szks-mini-world /",
      "/inclusions/seasons-greetings/korean/2023-szks-mini-world/",
    ],
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

function productionLayoutScore(pathname: string): number {
  const p = String(pathname || "");
  let score = 0;
  if (/\/groups\/[^/]+\/photocards\/(korean-album|japanese-albums|taiwanese-albums|seasons-greetings|events|japanese-md)\//i.test(p)) {
    score += 20;
  }
  if (/\/groups\/[^/]+\/inclusions\/seasons-greetings\//i.test(p)) score += 22;
  if (/\/photocards\/seasons-greetings\/[^/]+\/[^/]+\/inclusions\//i.test(p)) score -= 16;
  if (/\/photocards\/(?:korean-album|japanese-albums|taiwanese-albums)\/[^/]+\/inclusions\//i.test(p)) score -= 16;
  if (/\/groups\/[^/]+\/inclusions\/(?:korean-album|japanese-albums|taiwanese-albums)\//i.test(p)) score += 22;
  if (/\/seasons-greetings\/[^/]+\/[^/]+\/photocards\//i.test(p)) score -= 8;
  if (/\/seasons-greetings\/[^/]+\/[^/]+\/pobs\//i.test(p)) score -= 4;
  if (/\/inclusions\/seasons-greetings\/.*polaroid/i.test(p)) score += 6;
  if (/\/inclusions\/seasons-greetings\/korean\/2023-szks-mini-world(?:%20| )/i.test(p)) score -= 12;
  if (/pop.*up.*force.*2026/i.test(p)) score -= 12;
  if (/\/photocards\/japanese-md\//i.test(p)) score += 8;
  if (/\/photocards\/japanese-albums\/[^/]+\/album\//i.test(p)) score += 6;
  if (/\/albums?\//i.test(p) && !/\/photocards\/(korean-album|japanese-albums)\//i.test(p)) score -= 5;
  return score;
}

function pathContext(url: string): string {
  const variants = pathVariants(url);
  const unit = variants.find((p) => p.includes("/pob-polaroids-unit/"));
  if (unit) return unit;
  let best = variants[0] ?? url;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const p of variants) {
    if (/\/events\/events\//i.test(p)) continue;
    const score = productionLayoutScore(p);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return applyPobPolaroidsUnitFolder(best) ?? best;
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

  const best = pathContext(file);

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

const DEFAULT_PC_BACK = "/mock-pcs/groups/default-back.png";

/** True when the filename is a PC back (`…-back-ot8`, `…-back-bang-chan`), not a front. */
export function isMockPcBackPath(url: string | null | undefined): boolean {
  const raw = String(url ?? "").split("?")[0];
  const file = (raw.split("/").pop() || "").trim();
  if (!file) return false;
  let decoded = file;
  try {
    decoded = decodeURIComponent(file);
  } catch {
    /* keep */
  }
  const base = decoded.replace(/\.[^.]+$/, "").toLowerCase();
  if (/-front-/.test(base)) return false;
  return /(?:^|[-_ ])back(?:[-_ ]|$)/.test(base);
}

function mockPcDir(url: string): string {
  const pathOnly = String(url || "").split("?")[0];
  const slash = pathOnly.lastIndexOf("/");
  return slash >= 0 ? pathOnly.slice(0, slash + 1) : "";
}

/**
 * Backs live next to fronts in the same folder:
 * - `001-back-bang-chan` → that member
 * - `009-back-ot8` / `back-ot8` → common back for the folder
 */
export function buildMockPcBackCandidates(
  frontSrc: string | null | undefined,
  storedBack?: string | null,
  fallbackSrc: string = DEFAULT_PC_BACK,
): string[] {
  const out: string[] = [];
  const push = (v: string) => {
    const t = String(v || "").trim();
    if (!t || out.includes(t) || out.length >= MAX_CANDIDATES) return;
    out.push(t);
  };
  const pushTree = (url: string) => {
    if (!url || !/^\/mock-pcs\//i.test(url)) {
      push(url);
      return;
    }
    push(encodeMockPcPathUrl(url));
    push(resolveMockPcImageUrl(url));
  };
  const pushAliased = (url: string) => {
    pushTree(url);
    if (!url || !/^\/mock-pcs\//i.test(url)) return;
    for (const alias of layoutAliases(decodeMockPcInput(url)).slice(0, 3)) {
      push(encodeMockPcPathUrl(alias));
    }
  };

  const stored = String(storedBack ?? "").trim();
  if (stored && !/default-back/i.test(stored) && isMockPcBackPath(stored)) {
    pushAliased(stored);
  }

  const front = String(frontSrc ?? "").trim();
  if (front && /^\/mock-pcs\//i.test(front)) {
    const resolvedFront = resolveMockPcImageUrl(front);
    const se = splitPcImageStemExt(resolvedFront);
    if (se && /-front-/i.test(se.stem)) {
      const backStem = se.stem.replace(/-front-/i, "-back-");
      const exts = [...new Set([se.extLower, "png", "jpg", "JPG"])];
      exts.forEach((ext, i) => {
        const next = `${backStem}.${ext}`;
        if (i === 0) pushAliased(next);
        else pushTree(next);
      });
    }
    const dir = mockPcDir(resolvedFront);
    const ot8Stems = ["009-back-ot8", "010-back-ot8", "back-ot8", "back ot8", "008-back-ot8", "016-back-ot8"];
    let firstOt8 = true;
    for (const stem of ot8Stems) {
      for (const ext of ["png", "jpg"]) {
        const next = `${dir}${stem}.${ext}`;
        if (firstOt8) {
          pushAliased(next);
          firstOt8 = false;
        } else {
          pushTree(next);
        }
      }
    }
  }

  if (fallbackSrc) push(encodeMockPcPathUrl(fallbackSrc) || fallbackSrc);
  return out;
}

export function resolveMockPcBackUrl(
  frontSrc: string | null | undefined,
  storedBack?: string | null,
): string {
  const cands = buildMockPcBackCandidates(frontSrc, storedBack, "");
  return cands[0] || String(storedBack ?? "").trim() || DEFAULT_PC_BACK;
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
  const resolved = normalizeMockPcUrl(base);
  const canonical = normalizeStemAndTail(base, raw);
  push(canonical);
  push(resolved);
  const scoredAliases = layoutAliases(decoded)
    .map((alias) => encodeMockPcPathUrl(alias))
    .sort((a, b) => productionLayoutScore(b) - productionLayoutScore(a));
  for (const alias of scoredAliases) push(alias);
  push(base);

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
