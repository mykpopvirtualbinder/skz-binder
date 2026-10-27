import { NextResponse } from "next/server";
import { runDueCatalogRemovals } from "@/lib/catalog-removal-schedule";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export const maxDuration = 60;

function allowed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!allowed(req)) {
    const gate = await requireAdminFromRequest(req);
    if (gate instanceof NextResponse) return gate;
  }
  try {
    const pending = await runDueCatalogRemovals(createServiceRoleClient());
    return NextResponse.json({ ok: true, pending });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudieron revisar los borrados.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
