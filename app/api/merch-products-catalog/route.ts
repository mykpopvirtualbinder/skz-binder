import { NextResponse } from "next/server";
import { scanMerchProductsFromMockPcs } from "@/lib/merch-albums-catalog-scan";
import { CATALOG_HTTP_CACHE, memoScan } from "@/lib/server-catalog-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = memoScan("merch-products-catalog", () => scanMerchProductsFromMockPcs(process.cwd()));
    return NextResponse.json(rows, { headers: { "Cache-Control": CATALOG_HTTP_CACHE } });
  } catch {
    return NextResponse.json([]);
  }
}
