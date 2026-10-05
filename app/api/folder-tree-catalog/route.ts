import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { scanFolderTreeCatalog, type FolderTreeCatalog } from "@/lib/folder-tree-catalog";
import { CATALOG_HTTP_CACHE, peekScanCache, setScanCache } from "@/lib/server-catalog-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCommitted(cwd: string): FolderTreeCatalog {
  try {
    const p = path.join(cwd, "public", "folder-tree-catalog.json");
    if (!fs.existsSync(p)) return { albums: [] };
    const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as FolderTreeCatalog).albums)) {
      return parsed as FolderTreeCatalog;
    }
  } catch {
    /* ignore */
  }
  return { albums: [] };
}

function refreshInBackground(cwd: string) {
  queueMicrotask(() => {
    try {
      const scanned = scanFolderTreeCatalog(cwd);
      if (scanned.albums.length > 0) setScanCache("folder-tree-catalog", scanned);
    } catch {
      /* ignore */
    }
  });
}

export async function GET() {
  try {
    const cached = peekScanCache<FolderTreeCatalog>("folder-tree-catalog");
    if (cached) return NextResponse.json(cached, { headers: { "Cache-Control": CATALOG_HTTP_CACHE } });

    const cwd = process.cwd();
    const committed = readCommitted(cwd);
    if (committed.albums.length > 0) {
      setScanCache("folder-tree-catalog", committed);
      refreshInBackground(cwd);
      return NextResponse.json(committed, { headers: { "Cache-Control": CATALOG_HTTP_CACHE } });
    }

    const scanned = scanFolderTreeCatalog(cwd);
    const catalog = scanned.albums.length > 0 ? scanned : committed;
    setScanCache("folder-tree-catalog", catalog);
    return NextResponse.json(catalog, { headers: { "Cache-Control": CATALOG_HTTP_CACHE } });
  } catch {
    return NextResponse.json({ albums: [] });
  }
}
