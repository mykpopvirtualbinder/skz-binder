import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { canonicalMerchGroupDisplayName } from "@/lib/merch-group-display";
import { createServiceRoleClient } from "@/lib/supabase-admin";

const BUCKET = (process.env.SUPABASE_CATALOG_STORAGE_BUCKET || "catalog").trim() || "catalog";
const CATEGORIES = new Set(["Peluches", "Lightsticks", "Ropa", "Accesorios", "Tour Merch", "Álbumes"]);
const ALBUM_REGIONS = new Set(["korean", "japanese", "taiwan"]);
const ALBUM_KINDS = new Set([
  "regular",
  "limited",
  "digipack",
  "jewel-case",
  "paper-case",
  "postcard",
  "fan-club",
  "accordion",
  "vinyl",
  "platform",
  "skzoo",
]);
const MAX_PIECES = 40;

function isOwnCatalogUrl(url: string): boolean {
  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  if (!base) return false;
  return url.startsWith(`${base}/storage/v1/object/public/${BUCKET}/`);
}

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  let body: {
    group_id?: number | string;
    category?: string;
    rarity?: string;
    album_title?: string;
    album_region?: string;
    album_kind?: string;
    pieces?: { name?: string; url?: string; album_version?: string | null }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "El formulario no es válido." }, { status: 400 });
  }

  const groupId = Number(body.group_id);
  const category = String(body.category || "").trim();
  const rarity = String(body.rarity || "Común").trim().slice(0, 80) || "Común";
  const albumTitle = String(body.album_title || "").trim();
  const albumRegion = String(body.album_region || "").trim();
  const albumKind = String(body.album_kind || "").trim();
  const pieces = Array.isArray(body.pieces) ? body.pieces : [];

  if (!Number.isFinite(groupId) || groupId <= 0) {
    return NextResponse.json({ error: "Elige un grupo." }, { status: 400 });
  }
  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Elige una categoría de merch." }, { status: 400 });
  }
  if (category === "Álbumes" && !albumTitle) {
    return NextResponse.json({ error: "Escribe el álbum de esa pieza." }, { status: 400 });
  }
  if (category === "Álbumes" && !ALBUM_REGIONS.has(albumRegion)) {
    return NextResponse.json({ error: "Elige el país del álbum." }, { status: 400 });
  }
  if (category === "Álbumes" && !ALBUM_KINDS.has(albumKind)) {
    return NextResponse.json({ error: "Elige la edición del álbum." }, { status: 400 });
  }
  if (!pieces.length) return NextResponse.json({ error: "Elige las fotos del merch." }, { status: 400 });
  if (pieces.length > MAX_PIECES) {
    return NextResponse.json({ error: `Máximo ${MAX_PIECES} piezas por vez.` }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const { data: group } = await admin.from("groups").select("id, name").eq("id", groupId).maybeSingle();
    if (!group) return NextResponse.json({ error: "Ese grupo no existe." }, { status: 400 });

    const created: string[] = [];
    for (const piece of pieces) {
      const url = String(piece?.url || "");
      const name = String(piece?.name || "").trim().slice(0, 240);
      if (!name) return NextResponse.json({ error: "Cada pieza necesita un nombre." }, { status: 400 });
      if (!isOwnCatalogUrl(url)) {
        return NextResponse.json({ error: "Hay una foto que no está en el almacenamiento del catálogo." }, { status: 400 });
      }
      const row: Record<string, unknown> = {
        name,
        category,
        group_name: category === "Álbumes" ? canonicalMerchGroupDisplayName(group.name) : String(group.name || ""),
        image_url: url,
        rarity,
      };
      if (category === "Álbumes") {
        row.album_title = albumTitle;
        row.album_type = `${albumRegion}/${albumKind}`;
        row.album_version = String(piece?.album_version || "").trim() || null;
      }
      const { data, error } = await admin.from("merch_items").insert(row).select("id").maybeSingle();
      if (error || !data) return NextResponse.json({ error: error?.message || "No se pudo crear el merch.", created: created.length }, { status: 500 });
      created.push(String(data.id));
    }
    return NextResponse.json({ created: created.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo crear el merch.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
