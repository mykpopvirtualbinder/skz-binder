import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
  if ("error" in auth && auth.error) return auth.error;
  const userId = new URL(req.url).searchParams.get("userId") || "";
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  try {
    const admin = createServiceRoleClient();
    const { data: pcs } = await admin
      .from("user_item_statuses")
      .select("status, item_id, item:items(*)")
      .eq("user_id", userId)
      .in("status", ["have", "wtt", "wts"]);
    const { data: merch } = await admin
      .from("user_merch_statuses")
      .select("status, merch_id, merch_item:merch_items(*)")
      .eq("user_id", userId)
      .in("status", ["have", "wtt", "wts"]);

    const items = [
      ...(pcs || []).map((p: any) => {
        const item = Array.isArray(p.item) ? p.item[0] : p.item;
        return {
          id: p.item_id,
          type: "pc",
          itemType: "pc",
          image_url: item?.image_url,
          member: item?.member,
          version: item?.version,
          name: item?.name,
        };
      }),
      ...(merch || []).map((m: any) => {
        const merchItem = Array.isArray(m.merch_item) ? m.merch_item[0] : m.merch_item;
        return {
          id: m.merch_id,
          type: "merch",
          itemType: "merch",
          image_url: merchItem?.image_url,
          name: merchItem?.name,
        };
      }),
    ].filter((i) => i.image_url);

    const unique = items.reduce((acc: typeof items, cur) => {
      if (!acc.find((x) => String(x.id) === String(cur.id) && x.type === cur.type)) acc.push(cur);
      return acc;
    }, []);

    return NextResponse.json({ items: unique });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}
