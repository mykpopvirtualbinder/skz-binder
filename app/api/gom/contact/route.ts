import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { clip, userFromBearer } from "@/lib/gom-server";
import { listGomProfiles } from "@/lib/gom-store";

export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { gomId?: string; text?: string } | null;
  const gomId = String(body?.gomId || "");
  const text = clip(body?.text, 2000);
  if (!gomId || text.length < 2) return NextResponse.json({ error: "missing" }, { status: 400 });
  const admin = createServiceRoleClient();
  let gom;
  try {
    const profiles = await listGomProfiles(admin);
    gom = profiles.find((row) => row.id === gomId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "save";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  if (!gom || gom.status !== "approved") return NextResponse.json({ error: "missing" }, { status: 404 });
  const recipient = gom.siteUserId || gom.userId;
  if (recipient === user.id) return NextResponse.json({ error: "own" }, { status: 400 });
  const { error } = await admin.from("notifications").insert({
    user_id: recipient,
    sender_id: user.id,
    type: "gom_message",
    content: text,
    read: false,
    is_read: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
