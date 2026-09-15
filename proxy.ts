import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function remapLegacyAlbumTreePath(pathname: string): string | null {
  let next = pathname
    .replace(/^(.*\/groups\/[^/]+)\/album\//i, "$1/albums/")
    .replace(/^(.*\/groups\/[^/]+)\/otros\//i, "$1/others/")
    .replace(/^(.*\/groups\/[^/]+)\/eventos\//i, "$1/events/");

  const albumPc = next.match(
    /^(.*\/groups\/[^/]+)\/photocards\/(korean|japanese|taiwanese)-albums?\/([^/]+)\/(.*)$/i,
  );
  if (albumPc) {
    next = `${albumPc[1]}/albums/${albumPc[2].toLowerCase()}/${albumPc[3]}/photocards/${albumPc[4]}`;
  } else {
    const albumInc = next.match(
      /^(.*\/groups\/[^/]+)\/inclusions\/(korean|japanese|taiwanese)-albums?\/([^/]+)\/(.*)$/i,
    );
    if (albumInc) {
      next = `${albumInc[1]}/albums/${albumInc[2].toLowerCase()}/${albumInc[3]}/inclusions/${albumInc[4]}`;
    }
  }
  const sg = next.match(
    /^(.*\/groups\/[^/]+)\/photocards\/seasons-greetings\/(korean|japanese|taiwanese)\/([^/]+)\/(.*)$/i,
  );
  if (sg && !/\/others\/seasons-greetings\//i.test(next)) {
    const rest = sg[4];
    const alreadyBucket = /^(photocards|inclusions|pobs?|pop-ups?)\//i.test(rest);
    const first = rest.split("/")[0] || "";
    const isPob =
      /^pob/i.test(first) || /polaroid-pob/i.test(first) || /^photo-card-fanclub/i.test(first);
    const suffix = alreadyBucket ? rest : isPob ? `pobs/${rest}` : `photocards/${rest}`;
    next = `${sg[1]}/others/seasons-greetings/${sg[2]}/${sg[3]}/${suffix}`;
  }

  let aliased = next
    .replace(/\/seasons-greetings\/korean\/2022\//gi, "/seasons-greetings/korean/2022-room-mates/")
    .replace(/\/seasons-greetings\/korean\/2024\//gi, "/seasons-greetings/korean/2024-perfect-day/")
    .replace(/\/seasons-greetings\/korean\/2025\//gi, "/seasons-greetings/korean/2025-the-street-kids/")
    .replace(/\/seasons-greetings\/korean\/2026\//gi, "/seasons-greetings/korean/2026-starlight-super-club/")
    .replace(
      /\/seasons-greetings\/korean\/2023-szks-mini-world\//gi,
      "/seasons-greetings/korean/2023-szks-mini-world%20/",
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
