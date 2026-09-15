import { NextResponse } from "next/server";
import type { AvatarPublicCatalog } from "@/lib/avatarPublicCatalog.types";

export const dynamic = "force-dynamic";

/** Si falla disco/manifiesto, respuesta mínima para no dejar el modal vacío */
function minimalFallback(): AvatarPublicCatalog {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    basic: ["/basic/basic-rosa.svg", "/basic/basic-azul.svg", "/basic/basic-lila.svg"],
    lightstick: [],
    kawaiiPremium: [],
    vipBadges: { groups: [], members: [], skzoo: [] },
  };
}

export async function GET(req: Request) {
  try {
    // IMPORTANT:
    // En Vercel no podemos hacer fs-walk de /public desde una Function:
    // el bundler traza un árbol enorme de assets y rompe el límite (300MB).
    //
    // Solución: usar un manifiesto estático generado en build:
    // `public/avatar-assets-manifest.json`
    //
    // En desarrollo se puede regenerar el manifiesto (script) y el endpoint lo servirá.
    const url = new URL(req.url);
    const manifestUrl = `${url.origin}/avatar-assets-manifest.json`;
    const res = await fetch(manifestUrl, { cache: "no-store" });
    if (res && res.ok) {
      const data = (await res.json()) as AvatarPublicCatalog;
      return NextResponse.json(data, {
        headers:
          process.env.NODE_ENV === "development"
            ? { "Cache-Control": "no-store, must-revalidate" }
            : { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" },
      });
    }
    return NextResponse.json(minimalFallback(), { status: 200 });
  } catch {
    return NextResponse.json(minimalFallback(), { status: 200 });
  }
}
