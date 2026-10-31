import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { isUsernameShapeOk } from "@/lib/username";
import { usernameOwnerId } from "@/lib/username-availability";

export async function POST(req: Request) {
  let body: { username?: string };
  try {
    body = (await req.json()) as { username?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  if (!isUsernameShapeOk(username)) {
    return NextResponse.json({ code: "username_invalid" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  let exceptUserId: string | undefined;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token) {
    const { data } = await admin.auth.getUser(token);
    if (data.user?.id) exceptUserId = data.user.id;
  }

  try {
    const owner = await usernameOwnerId(admin, username, exceptUserId);
    if (owner) return NextResponse.json({ code: "username_taken" }, { status: 409 });
    return NextResponse.json({ available: true });
  } catch {
    return NextResponse.json({ error: "No se pudo comprobar el nombre." }, { status: 500 });
  }
}
