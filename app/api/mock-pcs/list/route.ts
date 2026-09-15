import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = url.searchParams.get("base") || "";

  if (base.includes("..") || base.startsWith("/") || base.startsWith("\\")) {
    return NextResponse.json({ error: "Invalid base" }, { status: 400 });
  }

  // IMPORTANT:
  // This endpoint intentionally avoids filesystem access in production.
  // Reading from /public/mock-pcs with fs causes Vercel to trace a huge asset tree
  // into this function bundle and exceed serverless limits.
  //
  // Optional production mode:
  // - Generate `/public/mock-pcs/manifest.json` at build time (or commit it).
  // - This route will read that static manifest and return real data.
  try {
    const manifestUrl = `${url.origin}/mock-pcs/manifest.json`;
    const res = await fetch(manifestUrl, { cache: "no-store" });
    if (res.ok) {
      const manifest = (await res.json()) as Record<
        string,
        { fronts?: string[]; commonBack?: string | null }
      >;
      const hit = manifest?.[base];
      if (hit) {
        return NextResponse.json({
          base,
          fronts: Array.isArray(hit.fronts) ? hit.fronts : [],
          commonBack: typeof hit.commonBack === "string" ? hit.commonBack : null,
        });
      }
      return NextResponse.json({ error: "Not found", base }, { status: 404 });
    }
  } catch {
    // Fall through to disabled response.
  }

  return NextResponse.json({
    base,
    fronts: [],
    commonBack: null,
    disabled: true,
    reason: "MOCK_PCS_LIST_DISABLED_ON_SERVERLESS",
  });
}