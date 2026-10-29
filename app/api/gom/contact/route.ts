import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { clip, userFromBearer } from "@/lib/gom-server";

export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { gomId?: string; text?: string } | null;
  const gomId = String(body?.gomId || "");
  const text = clip(body?.text, 2000);
  if (!gomId || text.length < 2) return NextResponse.json({ error: "missing" }, { status: 400 });
  const admin = createServiceRoleClient();
  const { data: gom } = await admin.from("gom_profiles").select("id, user_id, status, display_name").eq("id", gomId).maybeSingle();
  if (!gom || gom.status !== "approved") return NextResponse.json({ error: "missing" }, { status: 404 });
  if (gom.user_id === user.id) return NextResponse.json({ error: "own" }, { status: 400 });
  const { error } = await admin.from("notifications").insert({
    user_id: gom.user_id,
    sender_id: user.id,
    type: "gom_message",
    content: text,
    read: false,
    is_read: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
