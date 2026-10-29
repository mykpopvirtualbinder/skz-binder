import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { userFromBearer } from "@/lib/gom-server";
import { listGomProfiles, rateGom } from "@/lib/gom-store";

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
  const profiles = await listGomProfiles(admin);
  const gom = profiles.find((row) => row.id === gomId);
  if (!gom || gom.status !== "approved") return NextResponse.json({ error: "missing" }, { status: 404 });
  if (gom.userId === user.id) return NextResponse.json({ error: "own" }, { status: 400 });
  try {
    await rateGom(admin, gomId, user.id, score);
  } catch (err) {
    const message = err instanceof Error ? err.message : "save";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
