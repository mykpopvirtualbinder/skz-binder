import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { scanFolderTreeCatalog, type FolderTreeCatalog } from "@/lib/folder-tree-catalog";

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

export async function GET() {
  try {
    const cwd = process.cwd();
    const scanned = scanFolderTreeCatalog(cwd);
    const catalog = scanned.albums.length > 0 ? scanned : readCommitted(cwd);
    return NextResponse.json(catalog, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ albums: [] });
  }
}
