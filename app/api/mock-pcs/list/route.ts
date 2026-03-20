import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "public", "mock-pcs");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = url.searchParams.get("base") || "";

  if (base.includes("..") || base.startsWith("/") || base.startsWith("\\")) {
    return NextResponse.json({ error: "Invalid base" }, { status: 400 });
  }

  const dir = path.join(ROOT, base);

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return NextResponse.json({ error: "Not found", base }, { status: 404 });
  }

  const files = fs.readdirSync(dir);

  const fronts = files
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .filter((f) => !/-back\.(png|jpe?g)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  const commonBack = files.find((f) => /-back\.(png|jpe?g)$/i.test(f)) || null;

  return NextResponse.json({ base, fronts, commonBack });
}