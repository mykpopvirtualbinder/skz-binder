import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { SITE_ADMIN_USER_ID } from "@/lib/site-admin-stock";
import { deleteGomProfiles, listGomProfiles, setGomRead, setGomStatus, type GomRecord } from "@/lib/gom-store";

function isGate(value: NextResponse | { email: string }): value is NextResponse {
  return value instanceof NextResponse;
}

function card(row: GomRecord) {
  return {
    id: row.id,
    userId: row.userId,
    displayName: row.displayName,
    photoUrl: row.photoUrl,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    url: row.url,
    socials: row.socials,
    goTypes: row.goTypes,
    requirements: row.requirements,
    howItWorks: row.howItWorks,
    areas: row.areas,
    groups: row.groups,
    siteUserId: row.siteUserId,
    siteName: row.siteName,
    read: row.read,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (isGate(gate)) return gate;
  const admin = createServiceRoleClient();
  const url = new URL(req.url);
  try {
    const rows = await listGomProfiles(admin);
    const missing = [...new Set(rows.filter((row) => !row.siteName).map((row) => row.siteUserId).filter(Boolean))];
    if (missing.length) {
      const { data: accounts } = await admin.from("profiles").select("user_id, display_name").in("user_id", missing);
      const names = new Map((accounts || []).map((account) => [account.user_id, String(account.display_name || "")]));
      for (const row of rows) if (!row.siteName) row.siteName = names.get(row.siteUserId) || "";
    }
    if (url.searchParams.get("count") === "1") {
      return NextResponse.json({ pending: rows.filter((row) => row.status === "pending").length });
    }
    return NextResponse.json({ rows: rows.map(card) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "save";
    if (url.searchParams.get("count") === "1") return NextResponse.json({ pending: 0 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (isGate(gate)) return gate;
  const body = (await req.json().catch(() => null)) as { id?: string; status?: string; action?: string; ids?: string[]; read?: boolean } | null;
  const admin = createServiceRoleClient();
  if (body?.action === "read" || body?.action === "delete") {
    const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id || "")).filter(Boolean) : [];
    if (!ids.length) return NextResponse.json({ error: "missing" }, { status: 400 });
    try {
      if (body.action === "delete") await deleteGomProfiles(admin, ids);
      else await setGomRead(admin, ids, body.read === true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "save";
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  const id = String(body?.id || "");
  const status = body?.status === "approved" || body?.status === "rejected" ? body.status : "";
  if (!id || !status) return NextResponse.json({ error: "missing" }, { status: 400 });
  const saved = await setGomStatus(admin, id, status);
  if (!saved) return NextResponse.json({ error: "missing" }, { status: 404 });
  let displayName = "";
  try {
    displayName = String((JSON.parse(saved.mensaje || "{}") as { displayName?: string }).displayName || "");
  } catch {
    displayName = "";
  }
  const content = status === "approved"
    ? `Tu perfil de GOM «${displayName}» ya está publicado en el market.`
    : `Tu solicitud de GOM «${displayName}» no se ha aprobado. Puedes revisarla y enviarla otra vez desde el market.`;
  await admin.from("notifications").insert({
    user_id: saved.user_id,
    sender_id: SITE_ADMIN_USER_ID,
    type: "admin_message",
    content,
    read: false,
    is_read: false,
  });
  return NextResponse.json({ ok: true });
}
