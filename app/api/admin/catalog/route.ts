import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { createServiceRoleClient } from "@/lib/supabase-admin";

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

type PostBody = {
  action?: string;
  id?: number | string | null;
  member_id?: number | string | null;
  name?: string;
  logo_url?: string | null;
  image_url?: string | null;
  group_id?: number | string | null;
  slug?: string | null;
};

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  try {
    const admin = createServiceRoleClient();
    const [gRes, mRes] = await Promise.all([
      admin.from("groups").select("*").order("name", { ascending: true }),
      admin.from("members").select("*").order("group_id", { ascending: true }).order("name", { ascending: true }),
    ]);
    if (gRes.error) return NextResponse.json({ error: gRes.error.message }, { status: 500 });
    if (mRes.error) return NextResponse.json({ error: mRes.error.message }, { status: 500 });
    return NextResponse.json({ groups: gRes.data ?? [], members: mRes.data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();

    if (action === "upsert_group") {
      const name = String(body.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
      const logo_url =
        body.logo_url != null && String(body.logo_url).trim() !== "" ? String(body.logo_url).trim() : null;

      const payload: Record<string, unknown> = { name, logo_url };
      const slugIn = body.slug != null ? String(body.slug).trim() : "";
      if (slugIn) payload.slug = slugify(slugIn);

      const idRaw = body.id;
      const id =
        idRaw != null && idRaw !== ""
          ? typeof idRaw === "number"
            ? idRaw
            : parseInt(String(idRaw), 10)
          : NaN;

      if (Number.isFinite(id) && id > 0) {
        const { data, error } = await admin.from("groups").update(payload).eq("id", id).select().maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ row: data });
      }

      const { data, error } = await admin.from("groups").insert(payload).select().maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ row: data });
    }

    if (action === "upsert_member") {
      const name = String(body.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

      const gidRaw = body.group_id;
      const group_id =
        gidRaw != null && gidRaw !== ""
          ? typeof gidRaw === "number"
            ? gidRaw
            : parseInt(String(gidRaw), 10)
          : NaN;
      if (!Number.isFinite(group_id)) {
        return NextResponse.json({ error: "valid group_id required" }, { status: 400 });
      }

      const image_url =
        body.image_url != null && String(body.image_url).trim() !== ""
          ? String(body.image_url).trim()
          : null;

      const payload: Record<string, unknown> = {
        name,
        image_url,
        group_id,
      };
      const slugIn = body.slug != null ? String(body.slug).trim() : "";
      if (slugIn) payload.slug = slugify(slugIn);

      const pkRaw = body.id ?? body.member_id;
      const pk =
        pkRaw != null && pkRaw !== ""
          ? typeof pkRaw === "number"
            ? pkRaw
            : parseInt(String(pkRaw), 10)
          : NaN;

      if (Number.isFinite(pk) && pk > 0) {
        const { data, error } = await admin
          .from("members")
          .update(payload)
          .or(`id.eq.${pk},member_id.eq.${pk}`)
          .select()
          .maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ row: data });
      }

      const { data, error } = await admin.from("members").insert(payload).select().maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ row: data });
    }

    if (action === "delete_group") {
      const idRaw = body.id;
      const id =
        idRaw != null && idRaw !== ""
          ? typeof idRaw === "number"
            ? idRaw
            : parseInt(String(idRaw), 10)
          : NaN;
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: "valid id required" }, { status: 400 });
      }
      const { error: mErr } = await admin.from("members").delete().eq("group_id", id);
      if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
      const { error: gErr } = await admin.from("groups").delete().eq("id", id);
      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_member") {
      const idRaw = body.id ?? body.member_id;
      const id =
        idRaw != null && idRaw !== ""
          ? typeof idRaw === "number"
            ? idRaw
            : parseInt(String(idRaw), 10)
          : NaN;
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: "valid id required" }, { status: 400 });
      }
      const { error } = await admin.from("members").delete().or(`id.eq.${id},member_id.eq.${id}`);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
