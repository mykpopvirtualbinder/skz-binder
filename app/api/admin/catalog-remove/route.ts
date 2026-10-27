import { NextResponse } from "next/server";
import { applyCatalogRemoval, planCatalogRemoval, removalCounts, type RemovalTarget } from "@/lib/catalog-removal";
import {
  cancelCatalogRemoval,
  listHolderIds,
  parseRemovalDate,
  scheduleCatalogRemoval,
  scheduledRemovalSummaries,
} from "@/lib/catalog-removal-schedule";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { canonicalMerchGroupDisplayName } from "@/lib/merch-group-display";

const targets = new Set<RemovalTarget>(["group", "member", "album", "item", "merch"]);

function asTarget(value: string | null): RemovalTarget | null {
  return value && targets.has(value as RemovalTarget) ? (value as RemovalTarget) : null;
}

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  const url = new URL(req.url);
  const mode = url.searchParams.get("target") || "";
  try {
    const admin = createServiceRoleClient();
    if (mode === "search-items") {
      const albumId = Number(url.searchParams.get("album_id"));
      const q = String(url.searchParams.get("q") || "").replace(/[%_,]/g, "").trim();
      if (!Number.isFinite(albumId) || albumId <= 0) {
        return NextResponse.json({ error: "Elige un álbum." }, { status: 400 });
      }
      if (q.length < 1) return NextResponse.json({ hits: [] });
      const { data, error } = await admin
        .from("items")
        .select("id, name, member, type, version")
        .eq("album_id", albumId)
        .or(`member.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(30);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ hits: (data ?? []).filter((row) => String(row.version || "") !== "personal") });
    }
    if (mode === "search-merch") {
      const groupId = Number(url.searchParams.get("group_id"));
      const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
      if (!Number.isFinite(groupId) || groupId <= 0) {
        return NextResponse.json({ error: "Elige un grupo." }, { status: 400 });
      }
      const { data: group, error: groupError } = await admin.from("groups").select("id, name, slug").eq("id", groupId).maybeSingle();
      if (groupError) return NextResponse.json({ error: groupError.message }, { status: 500 });
      if (!group) return NextResponse.json({ error: "Ese grupo no existe." }, { status: 400 });
      const wanted = canonicalMerchGroupDisplayName(group.name);
      const { data, error } = await admin.from("merch_items").select("id, name, category, group_name, album_title, album_version").limit(2000);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const hits = (data ?? [])
        .filter((row) => String(row.album_version || "") !== "personal")
        .filter((row) => canonicalMerchGroupDisplayName(row.group_name) === wanted)
        .filter((row) => {
          if (!q) return true;
          return `${row.name || ""} ${row.category || ""} ${row.album_title || ""}`.toLowerCase().includes(q);
        })
        .slice(0, 40);
      return NextResponse.json({ hits });
    }

    if (mode === "scheduled") {
      return NextResponse.json({ jobs: await scheduledRemovalSummaries(admin) });
    }

    const target = asTarget(mode);
    if (!target) return NextResponse.json({ error: "Elige qué quieres quitar." }, { status: 400 });
    const plan = await planCatalogRemoval(admin, target, String(url.searchParams.get("id") || ""));
    const holders = await listHolderIds(admin, plan);
    return NextResponse.json({ ...removalCounts(plan), holders: holders.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo preparar el borrado.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  let body: { target?: string; id?: string | number; executeAt?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "El formulario no es válido." }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    if (body.action === "cancel") {
      const result = await cancelCatalogRemoval(admin, String(body.id || ""));
      return NextResponse.json({ ok: true, ...result });
    }
    const target = asTarget(String(body.target || ""));
    if (!target) return NextResponse.json({ error: "Elige qué quieres quitar." }, { status: 400 });
    const when = String(body.executeAt || "").trim();
    if (when) {
      const result = await scheduleCatalogRemoval(admin, target, String(body.id ?? ""), parseRemovalDate(when));
      return NextResponse.json({ ok: true, ...result });
    }
    const plan = await planCatalogRemoval(admin, target, String(body.id ?? ""));
    const holders = await listHolderIds(admin, plan);
    if (holders.length) {
      return NextResponse.json({
        needsDate: true,
        holders: holders.length,
        ...removalCounts(plan),
      });
    }
    await applyCatalogRemoval(admin, plan);
    return NextResponse.json({ ok: true, scheduled: false, holders: 0, ...removalCounts(plan) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo quitar del catálogo.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
