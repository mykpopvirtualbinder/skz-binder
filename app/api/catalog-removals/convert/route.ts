import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { convertHeldPiece } from "@/lib/catalog-removal-schedule";
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

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  let body: { kind?: string; id?: string | number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "El formulario no es válido." }, { status: 400 });
  }
  const kind = body.kind === "merch" ? "merch" : body.kind === "item" ? "item" : null;
  if (!kind || body.id == null || String(body.id).trim() === "") {
    return NextResponse.json({ error: "Elige la pieza." }, { status: 400 });
  }
  try {
    const result = await convertHeldPiece(createServiceRoleClient(), auth.userId, kind, String(body.id));
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo convertir.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
