import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { removalsForUser } from "@/lib/catalog-removal-schedule";
import { createServiceRoleClient } from "@/lib/supabase-admin";

async function requireUser(req: Request) {
  const token = req.headers.get("authorization")?.startsWith("Bearer ")
    ? req.headers.get("authorization")!.slice(7).trim()
    : "";
  if (!token) return { error: NextResponse.json({ error: "Authorization required" }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { error: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }) };
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user?.id) return { error: NextResponse.json({ error: "Invalid session" }, { status: 401 }) };
  return { userId: data.user.id };
}

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await removalsForUser(createServiceRoleClient(), auth.userId));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudieron cargar los avisos.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
