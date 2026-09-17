import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { itemIsMerchNotPhotocard } from "@/lib/folder-tree-catalog-shared";
import { isMockPcBackPath } from "@/lib/mock-pc-url";
import { scanMerchProductsFromMockPcs } from "@/lib/merch-albums-catalog-scan";
import { merchRowMatchesQuery } from "@/lib/merch-item-search";
import {
  memberIsIn,
  memberSearchAliases,
  prettyMemberLabel,
  prettyVersionLabel,
  queryLooksLikeIn,
} from "@/lib/member-labels";
import {
  sanitizeSearchQuery,
  SITE_SEARCH_SHOP,
  type SiteSearchHit,
} from "@/lib/site-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let merchCache: { at: number; rows: ReturnType<typeof scanMerchProductsFromMockPcs> } | null = null;

function merchRows() {
  if (merchCache && Date.now() - merchCache.at < 60_000) return merchCache.rows;
  const rows = scanMerchProductsFromMockPcs(process.cwd());
  merchCache = { at: Date.now(), rows };
  return rows;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function haystack(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) =>
      String(p || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    )
    .join(" ");
}

function textMatches(q: string, ...parts: Array<string | null | undefined>): boolean {
  const nq = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const tokens = nq.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const hay = haystack(...parts);
  return tokens.every((t) => hay.includes(t));
}

function itemsOrFilter(q: string): string {
  const aliases = memberSearchAliases(q);
  const values = Array.from(new Set([q, ...aliases].map((v) => v.trim()).filter(Boolean)));
  const parts: string[] = [];
  for (const field of ["name", "member", "version"]) {
    for (const v of values) {
      if (queryLooksLikeIn(q) && (v === "in" || v.toLowerCase() === "in")) {
        parts.push(`${field}.eq.in`);
        parts.push(`${field}.eq.I.N`);
        parts.push(`${field}.eq.i.n`);
        parts.push(`${field}.eq.i-n`);
        continue;
      }
      parts.push(`${field}.ilike.%${v}%`);
    }
  }
  if (queryLooksLikeIn(q)) {
    parts.push("member.ilike.jeongin", "name.ilike.jeongin");
  }
  return parts.slice(0, 20).join(",");
}

function photocardTitle(name: string | null, member: string | null): string {
  const memberLabel = prettyMemberLabel(member);
  const nameLabel = prettyMemberLabel(name);
  if (memberLabel && nameLabel && nameLabel !== memberLabel) return `${memberLabel} · ${nameLabel}`;
  return memberLabel || nameLabel || name || "Photocard";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = sanitizeSearchQuery(url.searchParams.get("q") || "");
  if (q.length < 2) {
    return NextResponse.json({ results: [] as SiteSearchHit[] });
  }

  const like = `%${q}%`;
  const buckets: Record<SiteSearchHit["type"], SiteSearchHit[]> = {
    user: [],
    photocard: [],
    merch: [],
    fanart: [],
    album: [],
    group: [],
    shop: [],
  };

  try {
    const admin = createServiceRoleClient();
    const [itemsRes, fanartRes, usersRes, albumsRes, groupsRes] = await Promise.all([
      admin
        .from("items")
        .select("id, name, image_url, member, version, type")
        .or(itemsOrFilter(q))
        .limit(40),
      admin
        .from("fanarts")
        .select("id, title, artist_name, image_url, thumbnail_url, category")
        .eq("active", true)
        .or(`title.ilike.${like},artist_name.ilike.${like}`)
        .limit(8),
      admin.from("profiles").select("user_id, display_name, avatar_url").ilike("display_name", like).limit(8),
      admin.from("albums").select("id, name").ilike("name", like).limit(6),
      admin.from("groups").select("id, name").ilike("name", like).limit(4),
    ]);

    for (const row of itemsRes.data || []) {
      if (isMockPcBackPath(asString(row.image_url))) continue;
      if (itemIsMerchNotPhotocard(row)) continue;
      const member = asString(row.member);
      const name = asString(row.name);
      if (queryLooksLikeIn(q) && !memberIsIn(member) && !memberIsIn(name)) continue;
      const version = prettyVersionLabel(asString(row.version));
      buckets.photocard.push({
        type: "photocard",
        id: String(row.id),
        title: photocardTitle(name, member),
        subtitle: version || "Photocard",
        image: asString(row.image_url),
        href: `/library?q=${encodeURIComponent(String(row.id))}`,
      });
      if (buckets.photocard.length >= 8) break;
    }

    try {
      const merchHits = merchRows()
        .filter((row) => merchRowMatchesQuery(row, q))
        .filter((row) => !queryLooksLikeIn(q) || memberIsIn(row.name) || memberIsIn(row.image_url))
        .slice(0, 6);
      for (const row of merchHits) {
        buckets.merch.push({
          type: "merch",
          id: row.id,
          title: row.name,
          subtitle: [row.group_name, row.album_title, row.category].filter(Boolean).join(" · ") || "Merch",
          image: row.image_url,
          href: `/merch?q=${encodeURIComponent(q)}`,
        });
      }
    } catch {
      /* merch scan is optional if the tree is missing */
    }

    for (const row of fanartRes.data || []) {
      buckets.fanart.push({
        type: "fanart",
        id: String(row.id),
        title: asString(row.title) || "Fanart",
        subtitle: asString(row.artist_name) || asString(row.category) || "Fanart",
        image: asString(row.thumbnail_url) || asString(row.image_url),
        href: `/fanart?highlight=${encodeURIComponent(String(row.id))}`,
      });
    }

    for (const row of albumsRes.data || []) {
      const name = asString(row.name) || `Álbum ${row.id}`;
      buckets.album.push({
        type: "album",
        id: String(row.id),
        title: name,
        subtitle: "Álbum",
        image: null,
        href: `/library?album=${encodeURIComponent(String(row.id))}`,
      });
    }

    for (const row of groupsRes.data || []) {
      const name = asString(row.name) || `Grupo ${row.id}`;
      buckets.group.push({
        type: "group",
        id: String(row.id),
        title: name,
        subtitle: "Grupo",
        image: null,
        href: `/library?group=${encodeURIComponent(String(row.id))}`,
      });
    }

    for (const row of usersRes.data || []) {
      buckets.user.push({
        type: "user",
        id: String(row.user_id),
        title: asString(row.display_name) || "Usuario",
        subtitle: "Usuario",
        image: asString(row.avatar_url),
        href: `/user/${encodeURIComponent(String(row.user_id))}`,
      });
    }

    for (const shop of SITE_SEARCH_SHOP) {
      if (!textMatches(q, shop.title, shop.subtitle, "shop", "tienda", "koins", "binder")) continue;
      buckets.shop.push({
        type: "shop",
        id: shop.id,
        title: shop.title,
        subtitle: shop.subtitle,
        image: null,
        href: shop.href,
      });
    }

    const results = [
      ...buckets.user.slice(0, 6),
      ...buckets.photocard.slice(0, 8),
      ...buckets.merch.slice(0, 6),
      ...buckets.fanart.slice(0, 4),
      ...buckets.album.slice(0, 3),
      ...buckets.group.slice(0, 2),
      ...buckets.shop.slice(0, 2),
    ];

    return NextResponse.json({ results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
