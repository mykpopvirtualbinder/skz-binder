import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { runSignupConfirmSchedule } from "@/lib/signup-confirm-schedule";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export const maxDuration = 60;

function cronAllowed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!cronAllowed(req)) {
    const gate = await requireAdminFromRequest(req);
    if (gate instanceof NextResponse) return gate;
  }
  try {
    const result = await runSignupConfirmSchedule(createServiceRoleClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudieron revisar las confirmaciones.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
