import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { SITE_ADMIN_USER_ID } from "@/lib/site-admin-stock";
import { GOM_SOCIALS } from "@/lib/gom";
import { socialsFromRow } from "@/lib/gom-server";

function isGate(value: NextResponse | { email: string }): value is NextResponse {
  return value instanceof NextResponse;
}

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (isGate(gate)) return gate;
  const admin = createServiceRoleClient();
  const url = new URL(req.url);
  if (url.searchParams.get("count") === "1") {
    const { count, error } = await admin
      .from("gom_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (error) return NextResponse.json({ pending: 0 });
    return NextResponse.json({ pending: count || 0 });
  }
  const { data, error } = await admin.from("gom_profiles").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data || []).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    displayName: row.display_name as string,
    photoUrl: (row.photo_url as string) || "",
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    phone: row.phone as string,
    socials: socialsFromRow(row as Record<string, unknown>),
    goTypes: row.go_types as string,
    requirements: row.requirements as string,
    howItWorks: row.how_it_works as string,
    status: row.status as string,
    createdAt: row.created_at as string,
  }));
  return NextResponse.json({ rows, socials: GOM_SOCIALS });
}

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (isGate(gate)) return gate;
  const body = (await req.json().catch(() => null)) as { id?: string; status?: string } | null;
  const id = String(body?.id || "");
  const status = body?.status === "approved" || body?.status === "rejected" ? body.status : "";
  if (!id || !status) return NextResponse.json({ error: "missing" }, { status: 400 });
  const admin = createServiceRoleClient();
  const { data: row, error: readError } = await admin
    .from("gom_profiles")
    .select("id, user_id, display_name")
    .eq("id", id)
    .maybeSingle();
  if (readError || !row) return NextResponse.json({ error: "missing" }, { status: 404 });
  const { error } = await admin
    .from("gom_profiles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const content = status === "approved"
    ? `Tu perfil de GOM «${row.display_name}» ya está publicado en el market.`
    : `Tu solicitud de GOM «${row.display_name}» no se ha aprobado. Puedes revisarla y enviarla otra vez desde el market.`;
  await admin.from("notifications").insert({
    user_id: row.user_id,
    sender_id: SITE_ADMIN_USER_ID,
    type: "admin_message",
    content,
    read: false,
    is_read: false,
  });
  return NextResponse.json({ ok: true });
}
