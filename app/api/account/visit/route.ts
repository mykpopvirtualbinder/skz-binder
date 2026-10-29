import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rememberAccountCountry } from "@/lib/account-country";
import { announceOwnInviteCode, redeemInviteIfReady } from "@/lib/invite-code";
import { countryFromRequest } from "@/lib/request-country";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.startsWith("Bearer ")
    ? req.headers.get("authorization")!.slice(7).trim()
    : "";
  if (!token) return NextResponse.json({ error: "Authorization required" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const admin = createServiceRoleClient();
  const country = countryFromRequest(req);
  try {
    if (country) await rememberAccountCountry(admin, data.user.id, country, "visit");
    await redeemInviteIfReady(admin, data.user.id);
    await announceOwnInviteCode(admin, data.user.id);
  } catch {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: true });
}
