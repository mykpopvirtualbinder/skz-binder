import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminTeamEmail } from "@/lib/admin-emails";

/** Valida Bearer JWT y que el email esté en la lista de administración. */
export async function requireAdminFromRequest(req: Request): Promise<NextResponse | { email: string }> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabaseAuth = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(token);
  if (error || !user?.email) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
  if (!isAdminTeamEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { email: user.email };
}
