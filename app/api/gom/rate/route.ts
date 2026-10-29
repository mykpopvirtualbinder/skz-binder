import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { userFromBearer } from "@/lib/gom-server";

export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { gomId?: string; score?: number } | null;
  const gomId = String(body?.gomId || "");
  const score = Number(body?.score);
  if (!gomId || !Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }
  const admin = createServiceRoleClient();
  const { data: gom } = await admin.from("gom_profiles").select("id, user_id, status").eq("id", gomId).maybeSingle();
  if (!gom || gom.status !== "approved") return NextResponse.json({ error: "missing" }, { status: 404 });
  if (gom.user_id === user.id) return NextResponse.json({ error: "own" }, { status: 400 });
  const { error } = await admin.from("gom_ratings").upsert(
    { gom_id: gomId, user_id: user.id, score },
    { onConflict: "gom_id,user_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
