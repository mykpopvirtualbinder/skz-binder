import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export type AccountBucket = "alta" | "baja" | "pendiente" | "restringido";

export type OverviewUser = {
  user_id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  is_banned: boolean;
  is_deleted: boolean;
  bucket: AccountBucket;
  is_restricted: boolean;
  is_premium: boolean;
  is_artist: boolean;
  is_featured_artist: boolean;
  has_profile: boolean;
  display_name: string | null;
  avatar_url: string | null;
  puntos: number;
  strikes: number;
  plan_type: string;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function getRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function asNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isBannedOrDeleted(authUser: Record<string, unknown>): { banned: boolean; deleted: boolean } {
  const deleted = Boolean(authUser.deleted_at);
  const bannedUntil = authUser.banned_until;
  if (!bannedUntil) return { banned: false, deleted };
  const d = new Date(String(bannedUntil));
  const banned = Number.isFinite(d.getTime()) && d.getTime() > Date.now();
  return { banned, deleted };
}

function bucketFor(opts: {
  banned: boolean;
  deleted: boolean;
  emailConfirmed: boolean;
  restricted: boolean;
}): AccountBucket {
  if (opts.banned || opts.deleted) return "baja";
  if (!opts.emailConfirmed) return "pendiente";
  if (opts.restricted) return "restringido";
  return "alta";
}

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  try {
    const admin = createServiceRoleClient();
    const users: Array<Record<string, unknown>> = [];
    const perPage = 200;
    let page = 1;

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const current = (data?.users ?? []).map((u) => getRecord(u));
      users.push(...current);
      if (current.length < perPage) break;
      page += 1;
      if (page > 25) break;
    }

    const ids = users.map((u) => String(u.id));
    const profileMap: Record<string, Record<string, unknown>> = {};
    for (const idChunk of chunk(ids, 200)) {
      if (idChunk.length === 0) continue;
      const { data: profs, error: pErr } = await admin
        .from("profiles")
        .select(
          "user_id,display_name,avatar_url,is_restricted,is_premium,is_artist,is_featured_artist,puntos,strikes,plan_type",
        )
        .in("user_id", idChunk);
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
      for (const p of profs ?? []) profileMap[String(p.user_id)] = getRecord(p);
    }

    const rows: OverviewUser[] = users.map((u) => {
      const userId = String(u.id);
      const p = profileMap[userId];
      const restricted = Boolean(p?.is_restricted);
      const { banned, deleted } = isBannedOrDeleted(u);
      const emailConfirmed = Boolean(asString(u.email_confirmed_at) || asString(u.confirmed_at));
      const bucket = bucketFor({
        banned,
        deleted,
        emailConfirmed,
        restricted,
      });
      return {
        user_id: userId,
        email: asString(u.email),
        created_at: asString(u.created_at),
        last_sign_in_at: asString(u.last_sign_in_at),
        email_confirmed: emailConfirmed,
        is_banned: banned,
        is_deleted: deleted,
        bucket,
        is_restricted: restricted,
        is_premium: Boolean(p?.is_premium),
        is_artist: Boolean(p?.is_artist),
        is_featured_artist: Boolean(p?.is_featured_artist),
        has_profile: Boolean(p),
        display_name: asString(p?.display_name),
        avatar_url: asString(p?.avatar_url),
        puntos: Math.max(0, asNumber(p?.puntos)),
        strikes: Math.min(99, Math.max(0, asNumber(p?.strikes))),
        plan_type: asString(p?.plan_type) || "free",
      };
    });

    rows.sort((a, b) => String(a.display_name || a.email || "").localeCompare(String(b.display_name || b.email || "")));

    const summary = {
      total: rows.length,
      alta: rows.filter((r) => r.bucket === "alta").length,
      baja: rows.filter((r) => r.bucket === "baja").length,
      pendiente: rows.filter((r) => r.bucket === "pendiente").length,
      restringido: rows.filter((r) => r.bucket === "restringido").length,
      sinPerfil: rows.filter((r) => !r.has_profile).length,
      premium: rows.filter((r) => r.is_premium).length,
      artistas: rows.filter((r) => r.is_artist).length,
    };

    return NextResponse.json({ summary, users: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
