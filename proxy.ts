import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function regionProdFolder(region: string): string {
  const r = region.toLowerCase();
  if (r === "korean") return "korean-album";
  return `${r}-albums`;
}

function remapLegacyAlbumTreePath(pathname: string): string | null {
  // Production files live under /photocards and /inclusions. Never move those
  // away to /albums or the deployed site 404s.
  if (/\/groups\/[^/]+\/(photocards|inclusions)\//i.test(pathname)) {
    const collapsed = pathname.replace(/\/events\/events\//gi, "/events/");
    return collapsed !== pathname ? collapsed : null;
  }

  let next = pathname.replace(/\/events\/events\//gi, "/events/");

  const sgLegacy = next.match(
    /^(.*\/groups\/[^/]+)\/(?:otros|others)\/seasons-greetings\/(korean|japanese|taiwanese)\/([^/]+)\/(.*)$/i,
  );
  if (sgLegacy) {
    const rest = sgLegacy[4];
    const first = (rest.split("/")[0] || "").toLowerCase();
    const tail = rest.split("/").slice(1).join("/");
    const region = sgLegacy[2];
    let year = sgLegacy[3];
    try {
      year = decodeURIComponent(year.replace(/\+/g, "%20"));
    } catch {
      /* keep */
    }
    const yearTrimmed = year.replace(/\s+$/g, "");
    const yearPhotocards =
      /2023-szks-mini-world/i.test(yearTrimmed) && !/\s$/.test(year)
        ? `${yearTrimmed}%20`
        : year;
    if (first === "inclusions") {
      next = `${sgLegacy[1]}/inclusions/seasons-greetings/${region}/${yearTrimmed}/${tail}`;
    } else if (/pop.*up.*force.*2026.*items/i.test(first)) {
      next = `${sgLegacy[1]}/photocards/japanese-md/2026-force/${tail}`;
    } else if (first === "photocards" || first === "pobs" || first === "pob") {
      const polaroid = /polaroid/i.test(tail.split("/")[0] || "");
      if (polaroid) {
        next = `${sgLegacy[1]}/inclusions/seasons-greetings/${region}/${yearTrimmed}/${tail}`;
      } else if (first === "photocards" && !tail.includes("/")) {
        next = `${sgLegacy[1]}/photocards/seasons-greetings/${region}/${yearPhotocards}/set/${tail}`;
      } else {
        next = `${sgLegacy[1]}/photocards/seasons-greetings/${region}/${yearPhotocards}/${tail}`;
      }
    } else {
      next = `${sgLegacy[1]}/photocards/seasons-greetings/${region}/${yearPhotocards}/${rest}`;
    }
  }

  const albumTree = next.match(
    /^(.*\/groups\/[^/]+)\/albums?\/(korean|japanese|taiwanese)\/([^/]+)\/(.*)$/i,
  );
  if (albumTree) {
    const root = albumTree[1];
    const region = albumTree[2].toLowerCase();
    const album = albumTree[3];
    const rest = albumTree[4];
    const first = (rest.split("/")[0] || "").toLowerCase();
    const tail = rest.split("/").slice(1).join("/");
    const folder = regionProdFolder(region);
    if (first === "photocards") {
      next =
        region === "korean"
          ? `${root}/photocards/${folder}/${album}/${tail}`
          : `${root}/photocards/${folder}/${album}/album/${tail}`;
    } else if (first === "album") {
      next = `${root}/photocards/${folder}/${album}/album/${tail}`;
    } else if (first === "merch" || first === "pop-ups" || first === "pop-up") {
      next = `${root}/photocards/${folder}/${album}/${first}/${tail}`;
    } else if (first === "pob" || first === "pobs") {
      next = `${root}/photocards/${folder}/${album}/pob/${tail}`;
    } else if (first === "inclusions") {
      next = `${root}/inclusions/${folder}/${album}/${tail}`;
    }
  }

  next = next
    .replace(/^(.*\/groups\/[^/]+)\/eventos\//i, "$1/photocards/events/")
    .replace(
      /\/photocards\/events\/tour\/run-it\/stray-kids-world-tour-run-it-in-(seoul|japan)\//gi,
      "/photocards/events/tours/stray-kids-world-tour-run-it-in/$1/",
    )
    .replace(/\/japan-fan-club-online-lottery\//gi, "/online-lottery/")
    .replace(/\/tower-record-lucky-draw\//gi, "/Tower-record-lucky-draw/");

  let aliased = next
    .replace(/\/seasons-greetings\/korean\/2022\//gi, "/seasons-greetings/korean/2022-room-mates/")
    .replace(/\/seasons-greetings\/korean\/2024\//gi, "/seasons-greetings/korean/2024-perfect-day/")
    .replace(/\/seasons-greetings\/korean\/2025\//gi, "/seasons-greetings/korean/2025-the-street-kids/")
    .replace(/\/seasons-greetings\/korean\/2026\//gi, "/seasons-greetings/korean/2026-starlight-super-club/")
    .replace(
      /\/photocards\/seasons-greetings\/korean\/2023-szks-mini-world\//gi,
      "/photocards/seasons-greetings/korean/2023-szks-mini-world%20/",
    )
    .replace(
      /\/inclusions\/seasons-greetings\/korean\/2023-szks-mini-world(?:%20| )\//gi,
      "/inclusions/seasons-greetings/korean/2023-szks-mini-world/",
    )
    .replace(
      /\/2024-perfect-day\/photocards\/polaroid\//gi,
      "/2024-perfect-day/photocards/polaroid%20/",
    )
    .replace(/\/2024-perfect-day\/polaroid\//gi, "/2024-perfect-day/photocards/polaroid%20/")
    .replace(/\/photocards\/photocard-set\//gi, "/photocards/photo-card-set/")
    .replace(/\/pob-polaroid-unit\//gi, "/pob-polaroids-unit/");

  return aliased !== pathname ? aliased : null;
}

/** Reescribe rutas /mock-pcs/... incorrectas en Supabase hacia la carpeta real en disco. */
function rewriteMockPcPathname(pathname: string): string | null {
  let p = pathname;
  let changed = false;

  const rep = (from: string, to: string) => {
    if (!p.includes(from)) return;
    p = p.split(from).join(to);
    changed = true;
  };

  rep("/seasons-greetings/korean/2024/", "/seasons-greetings/korean/2024-perfect-day/");
  rep("/seasons-greetings/korean/2025/", "/seasons-greetings/korean/2025-the-street-kids/");
  rep("/seasons-greetings/korean/2026/", "/seasons-greetings/korean/2026-starlight-super-club/");

  const y2024 = p.includes("/2024-perfect-day/");
  const y2025 = p.includes("/2025-the-street-kids/");
  const y2026 = p.includes("/2026-starlight-super-club/");

  if (y2024 || y2026) rep("/pob-apple-music/", "/pob-applemusic/");
  if (y2025) {
    rep("/pob-applemusic/", "/pob-apple-music/");
    rep("/pob-musickorea/", "/pob-music-korea/");
  }
  if (y2026) {
    rep("/pob-music-korea/", "/pob-musickorea/");
    rep("/pob-kpop-together/", "/pob-kpop-toguether/");
    // Solo estos POB de SG2026 usan `00-front-` en disco; el resto (photocards, inclusions, etc.) usa `001-front-`.
    const sg2026Uses00Front =
      /\/2026-starlight-super-club\/pobs\/(?:pob-applemusic|pob-ktown4u|pob-with-mu-u|pob-yes24)\//i.test(
        p,
      );
    if (sg2026Uses00Front) {
      const next = p.replace(/\/001-front-/gi, "/00-front-");
      if (next !== p) {
        p = next;
        changed = true;
      }
    }
  }

  if (y2024 && p.includes("/polaroid/") && !p.includes("/polaroid%20/")) {
    rep("/2024-perfect-day/photocards/polaroid/", "/2024-perfect-day/photocards/polaroid%20/");
    rep("/2024-perfect-day/polaroid/", "/2024-perfect-day/photocards/polaroid%20/");
  }

  const remappedAlbum = remapLegacyAlbumTreePath(p);
  if (remappedAlbum && remappedAlbum !== p) {
    p = remappedAlbum;
    changed = true;
  }

  return changed ? p : null;
}

/**
 * Las unit de 2022 SG están en `pob-polaroids-unit/` pero Supabase a veces apunta a
 * `pob-polaroids/` con `+` en el nombre del archivo.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/mock-pcs/")) {
    return NextResponse.next();
  }

  let nextPathname = pathname;

  if (
    nextPathname.includes("/pob-polaroids/") &&
    !nextPathname.includes("/pob-polaroids-unit/") &&
    (nextPathname.includes("+") ||
      nextPathname.includes("_") ||
      nextPathname.toLowerCase().includes("%2b") ||
      /-(?:front|back)-[^/]*(?:\+|%2b|_)/i.test(nextPathname))
  ) {
    nextPathname = nextPathname.replace("/pob-polaroids/", "/pob-polaroids-unit/");
  }

  const unitUnderscore = nextPathname.match(/^(.*-(?:front|back)-)([^/]+?)(\.[^./]+)$/i);
  if (
    unitUnderscore &&
    unitUnderscore[2].includes("_") &&
    !unitUnderscore[2].includes("+")
  ) {
    nextPathname = `${unitUnderscore[1]}${unitUnderscore[2].replace(/_/g, "+")}${unitUnderscore[3]}`;
  }

  const rewritten = rewriteMockPcPathname(nextPathname);
  if (rewritten) nextPathname = rewritten;

  if (nextPathname !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = nextPathname;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/mock-pcs/:path*",
};
