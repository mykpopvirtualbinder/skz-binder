import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase-admin";

async function requireUser(req: Request) {
  const token = req.headers.get("authorization")?.startsWith("Bearer ")
    ? req.headers.get("authorization")!.slice(7).trim()
    : "";
  if (!token) return { error: NextResponse.json({ error: "Authorization required" }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { error: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }) };
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user?.id) return { error: NextResponse.json({ error: "Invalid session" }, { status: 401 }) };
  return { userId: data.user.id };
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let body: { item?: Record<string, unknown> };
  try {
    body = (await req.json()) as { item?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const item = body?.item;
  const id = String(item?.id || "").trim();
  if (!id) return NextResponse.json({ error: "Missing item" }, { status: 400 });

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  const row: Record<string, unknown> = {
    id,
    name: String(item?.name || "Merch").slice(0, 240),
    category: String(item?.category || "Merch").slice(0, 80),
    group_name: String(item?.group_name || "").slice(0, 120),
    image_url: String(item?.image_url || ""),
    rarity: String(item?.rarity || "Común").slice(0, 80),
    album_title: item?.album_title != null ? String(item.album_title) : null,
    album_type: item?.album_type != null ? String(item.album_type) : null,
    album_version: item?.album_version != null ? String(item.album_version) : null,
  };

  try {
    let { error } = await admin.from("merch_items").upsert(row, { onConflict: "id" });
    if (error) {
      const slim = {
        id: row.id,
        name: row.name,
        category: row.category,
        group_name: row.group_name,
        image_url: row.image_url,
        rarity: row.rarity,
      };
      const retry = await admin.from("merch_items").upsert(slim, { onConflict: "id" });
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save item";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
