import { NextResponse } from "next/server";
import { pairCatalogSet } from "@/lib/catalog-set-files";
import { requireAdminFromRequest } from "@/lib/admin-bearer-auth";
import { createServiceRoleClient } from "@/lib/supabase-admin";

const BUCKET = (process.env.SUPABASE_CATALOG_STORAGE_BUCKET || "catalog").trim() || "catalog";
const allowedTypes = new Set(["photocards", "pobs", "inclusions"]);
const MAX_FILES = 80;

function slugify(raw: string): string {
  const s = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s || "";
}

function tokenKey(token: string): string {
  return String(token ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

function readableMember(member: string, matchedName: string | null): string {
  if (matchedName) return matchedName;
  return member
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split("-")
        .filter(Boolean)
        .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" "),
    )
    .join(" + ");
}

function isOwnCatalogUrl(url: string): boolean {
  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  if (!base) return false;
  return url.startsWith(`${base}/storage/v1/object/public/${BUCKET}/`);
}

type AlbumRow = { id: number; group_id: number | string | null; name: string | null; slug: string | null; release_date?: string | null };

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  const albumId = Number(new URL(req.url).searchParams.get("album_id"));
  if (!Number.isFinite(albumId) || albumId <= 0) {
    return NextResponse.json({ error: "Elige un álbum." }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const versions = new Set<string>();
    let from = 0;
    while (from < 20000) {
      const { data, error } = await admin
        .from("items")
        .select("version")
        .eq("album_id", albumId)
        .range(from, from + 999);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      for (const row of data ?? []) {
        const version = String(row.version ?? "").trim();
        if (version) versions.add(version);
      }
      if (!data || data.length < 1000) break;
      from += 1000;
    }
    const list = [...versions].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true }));
    return NextResponse.json({ versions: list });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudieron leer las carpetas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (gate instanceof NextResponse) return gate;

  let body: {
    album_slug?: string;
    version_name?: string;
    group_id?: number | string;
    album_id?: number | string | null;
    album_name?: string | null;
    version?: string;
    type?: string;
    files?: { name?: string; url?: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "El formulario no es válido." }, { status: 400 });
  }

  const groupId = Number(body.group_id);
  const albumIdRaw = Number(body.album_id);
  const albumName = String(body.album_name || "").trim();
  const albumSlug = slugify(String(body.album_slug || ""));
  const version = slugify(String(body.version || ""));
  const versionName = String(body.version_name || "").trim();
  const type = String(body.type || "photocards");
  const files = Array.isArray(body.files) ? body.files : [];

  if (!Number.isFinite(groupId) || groupId <= 0) {
    return NextResponse.json({ error: "Elige un grupo." }, { status: 400 });
  }
  if (!version) {
    return NextResponse.json({ error: "Escribe el nombre de la carpeta." }, { status: 400 });
  }
  if (!allowedTypes.has(type)) {
    return NextResponse.json({ error: "El tipo no es válido." }, { status: 400 });
  }
  if (!files.length) {
    return NextResponse.json({ error: "Elige los archivos del set." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Máximo ${MAX_FILES} archivos por set.` }, { status: 400 });
  }

  const incoming = files.map((file) => ({
    name: String(file?.name || ""),
    url: String(file?.url || ""),
  }));
  if (incoming.some((file) => file.url && !isOwnCatalogUrl(file.url))) {
    return NextResponse.json({ error: "Hay un archivo que no está en el almacenamiento del catálogo." }, { status: 400 });
  }

  const { cards, orphanBacks } = pairCatalogSet(incoming);
  if (!cards.length) {
    return NextResponse.json(
      {
        error:
          "No hay caras delanteras. Nombra los archivos como 001-front-bang-chan.png y 009-back-bang-chan.png, o sube imágenes que no sean solo el back.",
      },
      { status: 400 },
    );
  }

  try {
    const admin = createServiceRoleClient();
    const { data: group } = await admin.from("groups").select("id, name, slug").eq("id", groupId).maybeSingle();
    if (!group) return NextResponse.json({ error: "Ese grupo no existe." }, { status: 400 });

    const { data: members } = await admin
      .from("members")
      .select("member_id, name, slug, group_id")
      .eq("group_id", groupId);

    const album = await resolveAlbum(admin, groupId, albumIdRaw, albumName, albumSlug);
    if ("error" in album) return NextResponse.json({ error: album.error }, { status: 400 });

    const versionPretty = versionName || version.split("-").filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
    const versionRow = await admin.from("versions").select("id, name").eq("album_id", album.id).eq("slug", version).maybeSingle();
    let versionId = versionRow.data?.id != null ? Number(versionRow.data.id) : null;
    if (versionId && versionName && versionRow.data?.name !== versionName) {
      await admin.from("versions").update({ name: versionName }).eq("id", versionId);
    }
    if (!versionId) {
      const createdVersion = await admin
        .from("versions")
        .insert({ album_id: album.id, slug: version, name: versionPretty })
        .select("id")
        .maybeSingle();
      if (createdVersion.data?.id != null) versionId = Number(createdVersion.data.id);
    }

    const memberRows = members ?? [];
    const created: { id: number; member: string }[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];

    for (const card of cards) {
      const tokens = card.member.split(/\s+/).filter(Boolean);
      const match =
        tokens.length === 1
          ? memberRows.find((row) => {
              if (Number(row.group_id) !== groupId) return false;
              const key = tokenKey(tokens[0]);
              return tokenKey(String(row.slug || "")) === key || tokenKey(String(row.name || "")) === key;
            })
          : undefined;
      const memberId = match?.member_id != null ? Number(match.member_id) : null;
      const name = readableMember(card.member, match?.name ? String(match.name) : null);

      const { data: existing } = await admin
        .from("items")
        .select("id")
        .eq("group_id", groupId)
        .eq("album_id", album.id)
        .eq("version", version)
        .eq("member", card.member)
        .eq("type", type)
        .maybeSingle();
      if (existing?.id) {
        skipped.push(name);
        continue;
      }

      const { data: row, error } = await admin
        .from("items")
        .insert({
          group_id: groupId,
          album_id: album.id,
          type,
          member: card.member,
          member_id: memberId,
          version,
          version_name: versionPretty,
          version_id: versionId,
          album_name: album.name,
          group_name: group.name,
          name,
          image_url: card.frontUrl,
          back_image_url: card.backUrl,
        })
        .select("id, member")
        .maybeSingle();
      if (error || !row) {
        failed.push(name);
        continue;
      }
      created.push({ id: Number(row.id), member: name });
    }

    if (!created.length && failed.length) {
      return NextResponse.json({ error: "No se pudo crear ninguna ficha.", failed }, { status: 500 });
    }

    return NextResponse.json({
      album: { id: album.id, group_id: groupId, name: album.name, slug: album.slug, release_date: album.release_date ?? null },
      version,
      created: created.length,
      skipped: skipped.length,
      failed: failed.length,
      orphanBacks: orphanBacks.length,
      members: created.map((row) => row.member),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo crear el set.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function resolveAlbum(
  admin: ReturnType<typeof createServiceRoleClient>,
  groupId: number,
  albumIdRaw: number,
  albumName: string,
  albumSlug: string,
): Promise<AlbumRow | { error: string }> {
  if (Number.isFinite(albumIdRaw) && albumIdRaw > 0) {
    const { data: album } = await admin
      .from("albums")
      .select("id, name, slug, group_id, release_date")
      .eq("id", albumIdRaw)
      .maybeSingle();
    if (!album || Number(album.group_id) !== groupId) return { error: "Ese álbum no es de ese grupo." };
    return album as AlbumRow;
  }

  if (!albumName) return { error: "Elige un álbum o escribe el nombre de uno nuevo." };
  const slug = albumSlug || slugify(albumName);
  if (!slug) return { error: "El nombre del álbum no es válido." };

  const { data: existing, error } = await admin
    .from("albums")
    .select("id, name, slug, group_id, release_date")
    .eq("group_id", groupId);
  if (error) return { error: error.message };

  const wanted = albumName.trim().toLowerCase();
  const hit = (existing ?? []).find((row) => {
    const name = String(row.name || "").trim().toLowerCase();
    return name === wanted || slugify(String(row.slug || "")) === slug || slugify(String(row.name || "")) === slug;
  });
  if (hit) return hit as AlbumRow;

  const { data: created, error: insErr } = await admin
    .from("albums")
    .insert({ group_id: groupId, name: albumName.trim(), slug })
    .select("id, name, slug, group_id, release_date")
    .maybeSingle();
  if (insErr || !created) return { error: insErr?.message || "No se pudo crear el álbum." };
  return created as AlbumRow;
}
