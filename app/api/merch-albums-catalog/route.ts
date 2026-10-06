import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { isStrayKidsPlaceholderMerchAlbumRow } from "@/lib/collection-filters";
import { scanMerchAlbumsFromPublicAlbums } from "@/lib/merch-albums-catalog-scan";
import { CATALOG_HTTP_CACHE, peekScanCache, setScanCache } from "@/lib/server-catalog-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCommittedCatalog(cwd: string): unknown[] {
  try {
    const p = path.join(cwd, "public", "merch-albums-catalog.json");
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function localPublicImageExists(cwd: string, imageUrl: string): boolean {
  const raw = String(imageUrl || "").trim().split("?")[0];
  if (!raw) return false;
  if (/^https?:\/\//i.test(raw)) return !/placehold\.co/i.test(raw);
  if (!raw.startsWith("/")) return false;
  const decoded = raw
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    })
    .join("/");
  const abs = path.join(cwd, "public", decoded.replace(/^\/+/, ""));
  if (fs.existsSync(abs)) return true;
  const dir = path.dirname(abs);
  const base = path.basename(abs);
  const stem = base.replace(/\.[^.]+$/, "");
  if (!fs.existsSync(dir)) return false;
  try {
    return fs.readdirSync(dir).some((name) => name.replace(/\.[^.]+$/, "").toLowerCase() === stem.toLowerCase());
  } catch {
    return false;
  }
}

function buildAlbumsCatalog(cwd: string) {
  const scanned = scanMerchAlbumsFromPublicAlbums(cwd);
  const seen = new Set(scanned.map((r) => r.id));
  const merged = [...scanned];
  if (scanned.length === 0) {
    for (const row of readCommittedCatalog(cwd)) {
      if (row && typeof row === "object" && "id" in row) {
        const id = String((row as { id?: unknown }).id ?? "");
        if (id && !seen.has(id)) {
          merged.push(row as (typeof scanned)[number]);
          seen.add(id);
        }
      }
    }
  }
  return merged.filter(
    (r) =>
      !isStrayKidsPlaceholderMerchAlbumRow(r.group_name, r.album_title) &&
      localPublicImageExists(cwd, String((r as { image_url?: unknown }).image_url ?? "")),
  );
}

export async function GET() {
  try {
    const cached = peekScanCache<unknown[]>("merch-albums-catalog-v2");
    if (cached) return NextResponse.json(cached, { headers: { "Cache-Control": CATALOG_HTTP_CACHE } });

    const cwd = process.cwd();
    const filtered = buildAlbumsCatalog(cwd);
    setScanCache("merch-albums-catalog-v2", filtered);
    return NextResponse.json(filtered, { headers: { "Cache-Control": CATALOG_HTTP_CACHE } });
  } catch {
    return NextResponse.json([]);
  }
}
