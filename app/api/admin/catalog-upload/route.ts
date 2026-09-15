import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { createServiceRoleClient } from "@/lib/supabase-admin";

/** Bucket dedicado (créalo en Supabase; ver scripts/create-catalog-storage-bucket.sql). Opcional: SUPABASE_CATALOG_STORAGE_BUCKET */
const BUCKET = (process.env.SUPABASE_CATALOG_STORAGE_BUCKET || "catalog").trim() || "catalog";
const MAX_BYTES = 8 * 1024 * 1024;

const allowedMime = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 8MB)" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!allowedMime.has(mime)) {
    return NextResponse.json({ error: "unsupported image type" }, { status: 400 });
  }

  const kindRaw = form.get("kind");
  const kind = kindRaw === "member" ? "members" : "groups";

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = extFromMime(mime);
  const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  try {
    const admin = createServiceRoleClient();
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: true,
    });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) return NextResponse.json({ error: "no public URL" }, { status: 500 });
    return NextResponse.json({ publicUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
