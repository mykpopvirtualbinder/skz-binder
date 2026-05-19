import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    if (!p.includes("/pob-musickorea/")) {
      const next = p.replace(/\/001-front-/gi, "/00-front-");
      if (next !== p) {
        p = next;
        changed = true;
      }
    }
  }

  if (y2024 && p.includes("/polaroid/") && !p.includes("/polaroid%20/")) {
    rep("/2024-perfect-day/polaroid/", "/2024-perfect-day/polaroid%20/");
  }

  return changed ? p : null;
}

/**
 * Las unit de 2022 SG están en `pob-polaroids-unit/` pero Supabase a veces apunta a
 * `pob-polaroids/` con `+` en el nombre del archivo.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/mock-pcs/")) {
    return NextResponse.next();
  }

  let nextPathname = pathname;

  if (
    nextPathname.includes("/pob-polaroids/") &&
    !nextPathname.includes("/pob-polaroids-unit/") &&
    (nextPathname.includes("+") ||
      nextPathname.toLowerCase().includes("%2b") ||
      /-(?:front|back)-[^/]*(?:\+|%2b)/i.test(nextPathname))
  ) {
    nextPathname = nextPathname.replace("/pob-polaroids/", "/pob-polaroids-unit/");
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
