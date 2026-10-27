import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { createServiceRoleClient } from "@/lib/supabase-admin";

const BUCKET = (process.env.SUPABASE_CATALOG_STORAGE_BUCKET || "catalog").trim() || "catalog";
const MAX_BYTES = 8 * 1024 * 1024;
const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const allowedTypes = new Set(["photocards", "pobs", "inclusions"]);

function slugify(raw: string): string {
  const s = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s || "item";
}

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

function asFile(value: FormDataEntryValue | null): Blob | null {
  if (!(value instanceof Blob) || value.size === 0) return null;
  return value;
}

async function uploadSide(
  admin: ReturnType<typeof createServiceRoleClient>,
  file: Blob,
  path: string,
): Promise<{ publicUrl: string } | { error: string }> {
  const mime = file.type || "application/octet-stream";
  if (!allowedMime.has(mime)) {
    return { error: "La imagen tiene que ser JPG, PNG, WEBP o GIF." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "La imagen pasa de 8 MB." };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: true });
  if (error) return { error: error.message };
  const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl || "";
  if (!publicUrl) return { error: "No se pudo crear el enlace de la imagen." };
  return { publicUrl };
}

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "El formulario no es válido." }, { status: 400 });
  }

  const groupId = Number(form.get("group_id"));
  const albumId = Number(form.get("album_id"));
  const memberId = Number(form.get("member_id"));
  const version = slugify(String(form.get("version") || ""));
  const type = String(form.get("type") || "photocards");
  const front = asFile(form.get("front"));
  const back = asFile(form.get("back"));

  if (!Number.isFinite(groupId) || groupId <= 0) {
    return NextResponse.json({ error: "Elige un grupo." }, { status: 400 });
  }
  if (!Number.isFinite(albumId) || albumId <= 0) {
    return NextResponse.json({ error: "Elige un álbum." }, { status: 400 });
  }
  if (!Number.isFinite(memberId) || memberId <= 0) {
    return NextResponse.json({ error: "Elige un miembro." }, { status: 400 });
  }
  if (!version || version === "item") {
    return NextResponse.json({ error: "Escribe la versión o carpeta." }, { status: 400 });
  }
  if (!allowedTypes.has(type)) {
    return NextResponse.json({ error: "El tipo no es válido." }, { status: 400 });
  }
  if (!front) return NextResponse.json({ error: "Falta la cara delantera." }, { status: 400 });

  try {
    const admin = createServiceRoleClient();
    const [{ data: group }, { data: album }, { data: member }] = await Promise.all([
      admin.from("groups").select("id, name, slug").eq("id", groupId).maybeSingle(),
      admin.from("albums").select("id, name, slug, group_id").eq("id", albumId).maybeSingle(),
      admin.from("members").select("member_id, name, slug, group_id").eq("member_id", memberId).maybeSingle(),
    ]);
    if (!group) return NextResponse.json({ error: "Ese grupo no existe." }, { status: 400 });
    if (!album || Number(album.group_id) !== groupId) {
      return NextResponse.json({ error: "Ese álbum no es de ese grupo." }, { status: 400 });
    }
    if (!member || Number(member.group_id) !== groupId) {
      return NextResponse.json({ error: "Ese miembro no es de ese grupo." }, { status: 400 });
    }

    const memberSlug = slugify(String(member.slug || member.name || "member"));
    const { data: existing } = await admin
      .from("items")
      .select("id")
      .eq("group_id", groupId)
      .eq("album_id", albumId)
      .eq("version", version)
      .eq("member", memberSlug)
      .eq("type", type)
      .maybeSingle();
    if (existing?.id) {
      return NextResponse.json(
        { error: "Esa pieza ya está en el stock. Elige otro miembro o otra versión." },
        { status: 409 },
      );
    }

    const folder = [
      "items",
      slugify(String(group.slug || group.name || groupId)),
      slugify(String(album.slug || album.name || albumId)),
      version,
    ].join("/");
    const frontExt = extFromMime(front.type || "image/jpeg");
    const frontUp = await uploadSide(admin, front, `${folder}/${memberSlug}-front.${frontExt}`);
    if ("error" in frontUp) {
      return NextResponse.json({ error: frontUp.error }, { status: 500 });
    }

    let backUrl: string | null = null;
    if (back) {
      const backExt = extFromMime(back.type || "image/jpeg");
      const backUp = await uploadSide(admin, back, `${folder}/${memberSlug}-back.${backExt}`);
      if ("error" in backUp) {
        return NextResponse.json({ error: backUp.error }, { status: 500 });
      }
      backUrl = backUp.publicUrl;
    }

    const { data: row, error } = await admin
      .from("items")
      .insert({
        group_id: groupId,
        album_id: albumId,
        type,
        member: memberSlug,
        member_id: memberId,
        version,
        name: String(member.name || memberSlug),
        image_url: frontUp.publicUrl,
        back_image_url: backUrl,
      })
      .select("id, version, member, image_url, back_image_url")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo crear la ficha.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
