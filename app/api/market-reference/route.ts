import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** Estimación local determinista hasta conectar fuentes reales (eBay, etc.). */
function stubUsdMedian(itemId: number): number {
  const n = 4 + ((itemId * 17) % 38);
  return Math.round(n * 100) / 100;
}

export async function POST(req: Request) {
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

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(token);
  if (authErr || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: { itemId?: number };
  try {
    body = (await req.json()) as { itemId?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const itemId = Number(body?.itemId);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid itemId" }, { status: 400 });
  }

  const usdMedian = stubUsdMedian(itemId);

  return NextResponse.json({
    usdMedian,
    source: "stub_v1",
    disclaimer:
      "Valor orientativo de demostración. Pronto podremos enlazar fuentes reales de mercado.",
  });
}
