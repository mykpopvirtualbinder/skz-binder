import { canonicalMerchGroupDisplayName } from "@/lib/merch-group-display";
import { createServiceRoleClient } from "@/lib/supabase-admin";

const BUCKET = (process.env.SUPABASE_CATALOG_STORAGE_BUCKET || "catalog").trim() || "catalog";

export type RemovalTarget = "group" | "member" | "album" | "folder" | "item" | "merch";

export type RemovalPlan = {
  label: string;
  itemIds: number[];
  albumIds: number[];
  memberIds: number[];
  merchIds: string[];
  versionIds: number[];
  groupId: number | null;
  storagePaths: string[];
};

export type AlbumFolder = {
  id: string;
  slug: string;
  name: string;
  items: number;
};

type Admin = ReturnType<typeof createServiceRoleClient>;

function tokenKey(value: string): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

function compactName(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function catalogObjectPath(url: string | null | undefined): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const prefix = `${base}/storage/v1/object/public/${BUCKET}/`;
  if (!base || !raw.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(raw.slice(prefix.length).split("?")[0]);
  } catch {
    return raw.slice(prefix.length).split("?")[0];
  }
}

function pushPath(paths: string[], url: string | null | undefined) {
  const path = catalogObjectPath(url);
  if (path && !paths.includes(path)) paths.push(path);
}

function imageContentType(ext: string) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

function imageExt(url: string) {
  const clean = url.split("?")[0];
  const name = clean.slice(clean.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  const ext = (dot >= 0 ? name.slice(dot + 1) : "").toLowerCase();
  if (ext === "png" || ext === "webp" || ext === "gif") return ext;
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  return "jpg";
}

function siteOrigin() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || "https://www.mykpopbinder.com").replace(/\/$/, "");
}

function mockPcFile(url: string) {
  const pathOnly = url.split("?")[0];
  if (pathOnly.startsWith("/mock-pcs/")) return pathOnly.slice(1);
  try {
    const parsed = new URL(pathOnly);
    if (parsed.pathname.startsWith("/mock-pcs/")) return decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    return "";
  }
  return "";
}

/** Copia la foto a `personal/…` para que el borrado del catálogo no se la lleve. */
export async function copyImageToPersonal(
  admin: Admin,
  url: string | null | undefined,
  token: string,
  side: "front" | "back",
): Promise<string | null> {
  const value = String(url || "").trim();
  if (!value) return null;
  const current = catalogObjectPath(value);
  if (current?.startsWith("personal/")) {
    return admin.storage.from(BUCKET).getPublicUrl(current).data.publicUrl || value.split("?")[0];
  }

  if (current) {
    const dest = `personal/${token}/${side}.${imageExt(value)}`;
    const copied = await admin.storage.from(BUCKET).copy(current, dest);
    if (!copied.error) {
      const publicUrl = admin.storage.from(BUCKET).getPublicUrl(dest).data.publicUrl;
      if (publicUrl) return publicUrl;
    }
  }

  let bytes: Buffer | null = null;
  let contentType = imageContentType(imageExt(value));
  if (current) {
    const downloaded = await admin.storage.from(BUCKET).download(current);
    if (!downloaded.error && downloaded.data) {
      bytes = Buffer.from(await downloaded.data.arrayBuffer());
      if (downloaded.data.type && downloaded.data.type !== "application/octet-stream") contentType = downloaded.data.type;
    }
  } else {
    const rel = mockPcFile(value);
    if (rel) {
      const target = `${siteOrigin()}/${rel.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
      const res = await fetch(target);
      if (res.ok) {
        bytes = Buffer.from(await res.arrayBuffer());
        const type = res.headers.get("content-type") || "";
        if (type.startsWith("image/")) contentType = type;
      }
    }
  }
  if (!bytes?.length) return value;

  const path = `personal/${token}/${side}.${imageExt(value)}`;
  const uploaded = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (uploaded.error) throw new Error(uploaded.error.message);
  const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  if (!publicUrl) throw new Error("No se pudo guardar la foto personalizada.");
  return publicUrl;
}

async function personalStoragePaths(admin: Admin) {
  const paths = new Set<string>();
  await eachPage<{ image_url: string | null; back_image_url: string | null }>(
    admin,
    "items",
    "image_url, back_image_url",
    (query) => query.eq("version", "personal"),
    (row) => {
      const front = catalogObjectPath(row.image_url);
      const back = catalogObjectPath(row.back_image_url);
      if (front) paths.add(front);
      if (back) paths.add(back);
    },
  );
  await eachPage<{ image_url: string | null }>(
    admin,
    "merch_items",
    "image_url",
    (query) => query.eq("album_version", "personal"),
    (row) => {
      const path = catalogObjectPath(row.image_url);
      if (path) paths.add(path);
    },
  );
  return paths;
}

export async function repairPersonalImages(admin: Admin) {
  let copied = 0;
  let missing = 0;
  const items: { id: number; name: string | null; image_url: string | null; back_image_url: string | null }[] = [];
  await eachPage<{ id: number; name: string | null; image_url: string | null; back_image_url: string | null }>(
    admin,
    "items",
    "id, name, image_url, back_image_url",
    (query) => query.eq("version", "personal"),
    (row) => items.push(row),
  );
  for (const row of items) {
    const token = `items/${row.id}`;
    const frontPath = catalogObjectPath(row.image_url);
    const backPath = catalogObjectPath(row.back_image_url);
    const nextFront = frontPath?.startsWith("personal/")
      ? row.image_url
      : await copyImageToPersonal(admin, row.image_url, token, "front");
    const nextBack = !row.back_image_url || backPath?.startsWith("personal/")
      ? row.back_image_url
      : await copyImageToPersonal(admin, row.back_image_url, token, "back");
    if (row.image_url && nextFront === row.image_url && !frontPath?.startsWith("personal/")) missing += 1;
    if (row.back_image_url && nextBack === row.back_image_url && !backPath?.startsWith("personal/")) missing += 1;
    if (nextFront === row.image_url && nextBack === row.back_image_url) continue;
    const updated = await admin.from("items").update({ image_url: nextFront, back_image_url: nextBack }).eq("id", row.id);
    if (updated.error) throw new Error(updated.error.message);
    if (row.image_url && nextFront && nextFront !== row.image_url) {
      await admin.from("page_slots").update({ custom_image_url: nextFront }).eq("custom_image_url", row.image_url);
      await admin.from("page_slots").update({ custom_back_image_url: nextFront }).eq("custom_back_image_url", row.image_url);
    }
    if (row.back_image_url && nextBack && nextBack !== row.back_image_url) {
      await admin.from("page_slots").update({ custom_back_image_url: nextBack }).eq("custom_back_image_url", row.back_image_url);
      await admin.from("page_slots").update({ custom_image_url: nextBack }).eq("custom_image_url", row.back_image_url);
    }
    copied += 1;
  }
  const merch: { id: string; image_url: string | null }[] = [];
  await eachPage<{ id: string; image_url: string | null }>(
    admin,
    "merch_items",
    "id, image_url",
    (query) => query.eq("album_version", "personal"),
    (row) => merch.push(row),
  );
  for (const row of merch) {
    const path = catalogObjectPath(row.image_url);
    if (!row.image_url || path?.startsWith("personal/")) continue;
    const next = await copyImageToPersonal(admin, row.image_url, `merch/${row.id}`, "front");
    if (next === row.image_url) {
      missing += 1;
      continue;
    }
    const updated = await admin.from("merch_items").update({ image_url: next }).eq("id", row.id);
    if (updated.error) throw new Error(updated.error.message);
    copied += 1;
  }
  return { copied, missing };
}

async function eachPage<T extends Record<string, unknown>>(
  admin: Admin,
  table: string,
  columns: string,
  filter: (query: any) => any,
  onRow: (row: T) => void,
) {
  let from = 0;
  while (from < 50000) {
    const query = filter(admin.from(table).select(columns)).range(from, from + 999);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    for (const row of rows) onRow(row);
    if (rows.length < 1000) break;
    from += 1000;
  }
}

function sameMerchGroup(groupName: string | null | undefined, group: { name?: string | null; slug?: string | null }) {
  const row = canonicalMerchGroupDisplayName(groupName);
  const named = canonicalMerchGroupDisplayName(group.name);
  if (row && named && row === named) return true;
  const slug = compactName(String(group.slug || group.name || ""));
  return Boolean(slug) && compactName(String(groupName || "")) === slug;
}

export async function planCatalogRemoval(admin: Admin, target: RemovalTarget, id: string): Promise<RemovalPlan> {
  const plan: RemovalPlan = {
    label: "",
    itemIds: [],
    albumIds: [],
    memberIds: [],
    merchIds: [],
    versionIds: [],
    groupId: null,
    storagePaths: [],
  };

  if (target === "item") {
    const itemId = Number(id);
    if (!Number.isFinite(itemId) || itemId <= 0) throw new Error("Elige una ficha.");
    const { data, error } = await admin.from("items").select("id, name, member, version, image_url, back_image_url").eq("id", itemId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Esa ficha no está en el catálogo.");
    plan.label = String(data.name || data.member || `Ficha ${itemId}`);
    plan.itemIds = [itemId];
    pushPath(plan.storagePaths, data.image_url);
    pushPath(plan.storagePaths, data.back_image_url);
    return plan;
  }

  if (target === "merch") {
    const merchId = String(id || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(merchId)) throw new Error("Elige una pieza de merch.");
    const { data, error } = await admin.from("merch_items").select("id, name, image_url").eq("id", merchId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Esa pieza de merch no está en el catálogo.");
    plan.label = String(data.name || "Merch");
    plan.merchIds = [merchId];
    pushPath(plan.storagePaths, data.image_url);
    return plan;
  }

  if (target === "folder") {
    const split = id.indexOf(":");
    const albumId = Number(split > 0 ? id.slice(0, split) : "");
    let slug = "";
    try {
      slug = decodeURIComponent(split > 0 ? id.slice(split + 1) : "").trim();
    } catch {
      slug = "";
    }
    if (!Number.isFinite(albumId) || albumId <= 0 || !slug || slug === "personal") throw new Error("Elige una carpeta.");
    const { data: album, error: albumError } = await admin.from("albums").select("id, name").eq("id", albumId).maybeSingle();
    if (albumError) throw new Error(albumError.message);
    if (!album) throw new Error("Ese álbum no está en el catálogo.");
    const { data: versionRow, error: versionError } = await admin
      .from("versions")
      .select("id, name, slug")
      .eq("album_id", albumId)
      .eq("slug", slug)
      .maybeSingle();
    if (versionError) throw new Error(versionError.message);
    await eachPage<{ id: number; version: string | null; image_url: string | null; back_image_url: string | null }>(
      admin,
      "items",
      "id, version, image_url, back_image_url",
      (query) => query.eq("album_id", albumId).eq("version", slug),
      (row) => {
        if (String(row.version || "") === "personal") return;
        plan.itemIds.push(Number(row.id));
        pushPath(plan.storagePaths, row.image_url);
        pushPath(plan.storagePaths, row.back_image_url);
      },
    );
    if (!versionRow && !plan.itemIds.length) throw new Error("Esa carpeta no está en el catálogo.");
    const pretty = String(versionRow?.name || "").trim();
    plan.label = pretty || slug.split("-").filter(Boolean).map((word) => word.slice(0, 1).toUpperCase() + word.slice(1)).join(" ");
    if (versionRow?.id != null) plan.versionIds = [Number(versionRow.id)];
    return plan;
  }

  if (target === "album") {
    const albumId = Number(id);
    if (!Number.isFinite(albumId) || albumId <= 0) throw new Error("Elige un álbum.");
    const { data: album, error } = await admin.from("albums").select("id, name, slug, group_id").eq("id", albumId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!album) throw new Error("Ese álbum no está en el catálogo.");
    const { data: group } = await admin.from("groups").select("id, name, slug").eq("id", album.group_id).maybeSingle();
    plan.label = String(album.name || album.slug || `Álbum ${albumId}`);
    plan.albumIds = [albumId];
    await eachPage<{ id: number; image_url: string | null; back_image_url: string | null }>(
      admin,
      "items",
      "id, image_url, back_image_url",
      (query) => query.eq("album_id", albumId),
      (row) => {
        plan.itemIds.push(Number(row.id));
        pushPath(plan.storagePaths, row.image_url);
        pushPath(plan.storagePaths, row.back_image_url);
      },
    );
    const titleKeys = new Set([compactName(String(album.name || "")), compactName(String(album.slug || ""))].filter(Boolean));
    await eachPage<{ id: string; group_name: string | null; album_title: string | null; image_url: string | null }>(
      admin,
      "merch_items",
      "id, group_name, album_title, image_url",
      (query) => query.eq("category", "Álbumes"),
      (row) => {
        if (!group || !sameMerchGroup(row.group_name, group)) return;
        if (!titleKeys.has(compactName(String(row.album_title || "")))) return;
        plan.merchIds.push(String(row.id));
        pushPath(plan.storagePaths, row.image_url);
      },
    );
    return plan;
  }

  if (target === "member") {
    const memberId = Number(id);
    if (!Number.isFinite(memberId) || memberId <= 0) throw new Error("Elige un miembro.");
    const { data: member, error } = await admin.from("members").select("member_id, name, slug, group_id").eq("member_id", memberId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Ese miembro no está en el catálogo.");
    plan.label = String(member.name || member.slug || `Miembro ${memberId}`);
    plan.memberIds = [memberId];
    const keys = new Set([tokenKey(String(member.slug || "")), tokenKey(String(member.name || ""))].filter(Boolean));
    await eachPage<{ id: number; member: string | null; member_id: number | null; image_url: string | null; back_image_url: string | null }>(
      admin,
      "items",
      "id, member, member_id, image_url, back_image_url",
      (query) => query.eq("group_id", member.group_id),
      (row) => {
        const byId = Number(row.member_id) === memberId;
        const tokens = String(row.member || "").split(/\s+/).filter(Boolean);
        const byName = tokens.some((token) => keys.has(tokenKey(token)));
        if (!byId && !byName) return;
        plan.itemIds.push(Number(row.id));
        pushPath(plan.storagePaths, row.image_url);
        pushPath(plan.storagePaths, row.back_image_url);
      },
    );
    return plan;
  }

  const groupId = Number(id);
  if (!Number.isFinite(groupId) || groupId <= 0) throw new Error("Elige un grupo.");
  const { data: group, error } = await admin.from("groups").select("id, name, slug").eq("id", groupId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!group) throw new Error("Ese grupo no está en el catálogo.");
  plan.label = String(group.name || group.slug || `Grupo ${groupId}`);
  plan.groupId = groupId;
  await eachPage<{ id: number; image_url: string | null; back_image_url: string | null }>(
    admin,
    "items",
    "id, image_url, back_image_url",
    (query) => query.eq("group_id", groupId),
    (row) => {
      plan.itemIds.push(Number(row.id));
      pushPath(plan.storagePaths, row.image_url);
      pushPath(plan.storagePaths, row.back_image_url);
    },
  );
  await eachPage<{ id: number }>(admin, "albums", "id", (query) => query.eq("group_id", groupId), (row) => {
    plan.albumIds.push(Number(row.id));
  });
  await eachPage<{ member_id: number }>(admin, "members", "member_id", (query) => query.eq("group_id", groupId), (row) => {
    plan.memberIds.push(Number(row.member_id));
  });
  await eachPage<{ id: string; group_name: string | null; image_url: string | null }>(
    admin,
    "merch_items",
    "id, group_name, image_url",
    (query) => query,
    (row) => {
      if (!sameMerchGroup(row.group_name, group)) return;
      plan.merchIds.push(String(row.id));
      pushPath(plan.storagePaths, row.image_url);
    },
  );
  return plan;
}

async function deleteIn(admin: Admin, table: string, column: string, ids: Array<number | string>) {
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { error } = await admin.from(table).delete().in(column, chunk);
    if (error) throw new Error(error.message);
  }
}

export async function applyCatalogRemoval(admin: Admin, plan: RemovalPlan) {
  if (plan.itemIds.length) {
    await deleteIn(admin, "page_slots", "item_id", plan.itemIds);
    await deleteIn(admin, "user_item_statuses", "item_id", plan.itemIds);
    await deleteIn(admin, "items", "id", plan.itemIds);
  }
  if (plan.memberIds.length) {
    await deleteIn(admin, "page_slots", "member_id", plan.memberIds);
    await deleteIn(admin, "user_biases", "member_id", plan.memberIds);
  }
  if (plan.merchIds.length) {
    await deleteIn(admin, "user_merch_statuses", "merch_id", plan.merchIds);
    await deleteIn(admin, "merch_items", "id", plan.merchIds);
  }
  if (plan.versionIds?.length) {
    for (const versionId of plan.versionIds) {
      const cleared = await admin.from("items").update({ version_id: null }).eq("version_id", versionId);
      if (cleared.error) throw new Error(cleared.error.message);
    }
    await deleteIn(admin, "versions", "id", plan.versionIds);
  }
  if (plan.albumIds.length) await deleteIn(admin, "albums", "id", plan.albumIds);
  if (plan.memberIds.length) await deleteIn(admin, "members", "member_id", plan.memberIds);
  if (plan.groupId) {
    const { error } = await admin.from("groups").delete().eq("id", plan.groupId);
    if (error) throw new Error(error.message);
  }
  const held = await personalStoragePaths(admin);
  const removable = plan.storagePaths.filter((path) => !held.has(path));
  for (let i = 0; i < removable.length; i += 50) {
    const chunk = removable.slice(i, i + 50);
    const removed = await admin.storage.from(BUCKET).remove(chunk);
    if (removed.error) return;
  }
}

function folderLabel(slug: string, name?: string | null) {
  const pretty = String(name || "").trim();
  if (pretty) return pretty;
  return slug.split("-").filter(Boolean).map((word) => word.slice(0, 1).toUpperCase() + word.slice(1)).join(" ");
}

export async function listAlbumFolders(admin: Admin, albumId: number): Promise<AlbumFolder[]> {
  const buckets = new Map<string, { name: string; items: number }>();
  const { data: versionRows, error } = await admin.from("versions").select("slug, name").eq("album_id", albumId);
  if (error) throw new Error(error.message);
  for (const row of versionRows ?? []) {
    const slug = String(row.slug || "").trim();
    if (!slug || slug === "personal") continue;
    buckets.set(slug, { name: folderLabel(slug, row.name), items: 0 });
  }
  await eachPage<{ version: string | null; version_name: string | null }>(
    admin,
    "items",
    "version, version_name",
    (query) => query.eq("album_id", albumId),
    (row) => {
      const slug = String(row.version || "").trim();
      if (!slug || slug === "personal") return;
      const current = buckets.get(slug);
      if (current) {
        current.items += 1;
        if (!current.name) current.name = folderLabel(slug, row.version_name);
        return;
      }
      buckets.set(slug, { name: folderLabel(slug, row.version_name), items: 1 });
    },
  );
  return [...buckets.entries()]
    .map(([slug, bucket]) => ({
      id: `${albumId}:${encodeURIComponent(slug)}`,
      slug,
      name: bucket.name || slug,
      items: bucket.items,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true }));
}

export function removalCounts(plan: RemovalPlan) {
  return {
    label: plan.label,
    items: plan.itemIds.length,
    albums: plan.albumIds.length,
    members: plan.memberIds.length,
    merch: plan.merchIds.length,
  };
}
