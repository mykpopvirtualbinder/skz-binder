import { NextResponse } from "next/server";
import { scanMerchProductsFromMockPcs } from "@/lib/merch-albums-catalog-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(scanMerchProductsFromMockPcs(process.cwd()));
  } catch {
    return NextResponse.json([]);
  }
}
