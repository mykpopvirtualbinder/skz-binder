import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { createServiceRoleClient } from "@/lib/supabase-admin";

type Body = {
  user_id?: string;
  is_premium?: boolean;
  is_artist?: boolean;
  is_featured_artist?: boolean;
  is_restricted?: boolean;
  plan_type?: string;
  puntos?: number;
  strikes?: number;
};

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = body.user_id;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const payload = {
    is_premium: Boolean(body.is_premium),
    is_artist: Boolean(body.is_artist),
    is_featured_artist: Boolean(body.is_featured_artist),
    is_restricted: Boolean(body.is_restricted),
    plan_type:
      typeof body.plan_type === "string" && body.plan_type.trim()
        ? body.plan_type.trim()
        : "free",
    puntos: Math.max(0, Math.floor(Number(body.puntos) || 0)),
    strikes: Math.min(99, Math.max(0, Math.floor(Number(body.strikes) || 0))),
  };

  try {
    const admin = createServiceRoleClient();
    const { error } = await admin.from("profiles").update(payload).eq("user_id", userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
