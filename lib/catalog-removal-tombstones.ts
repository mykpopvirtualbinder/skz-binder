import { createServiceRoleClient } from "@/lib/supabase-admin";
import { compactFolderKey, type FolderTreeAlbum, type FolderTreeCatalog } from "@/lib/folder-tree-catalog-shared";
import type { CatalogTombstone } from "@/lib/catalog-removal";

const BUCKET = "catalog-private";
const PATH = "admin/catalog-removals.json";

type Admin = ReturnType<typeof createServiceRoleClient>;

type StoredJob = {
  status?: string;
  target?: string;
  targetId?: string;
  label?: string;
  plan?: { tombstone?: CatalogTombstone | null };
};

type StoredQueue = {
  jobs: StoredJob[];
  tombstones: CatalogTombstone[];
};

function sameTombstone(a: CatalogTombstone, b: CatalogTombstone) {
  const key = (stone: CatalogTombstone) =>
    [
      stone.kind,
      compactFolderKey(stone.albumTitle || ""),
      compactFolderKey(stone.albumSlug || ""),
      compactFolderKey(stone.versionSlug || ""),
      compactFolderKey(stone.groupName || ""),
      compactFolderKey(stone.groupSlug || ""),
    ].join("|");
  return key(a) === key(b);
}

export function appendTombstone(list: CatalogTombstone[], stone: CatalogTombstone | null | undefined) {
  if (!stone?.kind) return list;
  if (list.some((row) => sameTombstone(row, stone))) return list;
  return [...list, stone];
}

async function readStored(admin: Admin): Promise<StoredQueue> {
  const { data, error } = await admin.storage.from(BUCKET).download(PATH);
  if (error || !data) return { jobs: [], tombstones: [] };
  try {
    const parsed = JSON.parse(await data.text()) as { jobs?: StoredJob[]; tombstones?: CatalogTombstone[] };
    return {
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      tombstones: Array.isArray(parsed.tombstones) ? parsed.tombstones : [],
    };
  } catch {
    return { jobs: [], tombstones: [] };
  }
}

export async function recordCatalogTombstone(admin: Admin, stone: CatalogTombstone | null | undefined) {
  if (!stone?.kind) return;
  const queue = await readStored(admin);
  const tombstones = appendTombstone(queue.tombstones, stone);
  if (tombstones.length === queue.tombstones.length) return;
  const body = Buffer.from(JSON.stringify({ jobs: queue.jobs, tombstones }));
  const { error } = await admin.storage.from(BUCKET).upload(PATH, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

function keysOf(value?: string) {
  const key = compactFolderKey(value || "");
  return key ? [key] : [];
}

export async function readCatalogTombstones(admin: Admin): Promise<CatalogTombstone[]> {
  const queue = await readStored(admin);
  let stones = [...queue.tombstones];
  for (const job of queue.jobs) {
    if (job.status !== "done") continue;
    if (job.plan?.tombstone?.kind) {
      stones = appendTombstone(stones, job.plan.tombstone);
      continue;
    }
    if (job.target === "album") stones = appendTombstone(stones, { kind: "album", albumTitle: job.label || "" });
    if (job.target === "group") stones = appendTombstone(stones, { kind: "group", groupName: job.label || "" });
    if (job.target === "folder") {
      const raw = String(job.targetId || "");
      const split = raw.indexOf(":");
      const albumId = Number(split > 0 ? raw.slice(0, split) : "");
      let slug = "";
      try {
        slug = decodeURIComponent(split > 0 ? raw.slice(split + 1) : "");
      } catch {
        slug = "";
      }
      let albumTitle = "";
      let albumSlug = "";
      if (Number.isFinite(albumId) && albumId > 0) {
        const { data } = await admin.from("albums").select("name, slug").eq("id", albumId).maybeSingle();
        albumTitle = String(data?.name || "");
        albumSlug = String(data?.slug || "");
      }
      if (slug) stones = appendTombstone(stones, { kind: "folder", albumTitle, albumSlug, versionSlug: slug });
    }
  }
  return stones;
}

export function hideRemovedFolders(tree: FolderTreeCatalog, stones: CatalogTombstone[]): FolderTreeCatalog {
  const albums = new Set<string>();
  const groups = new Set<string>();
  const versions = new Set<string>();
  for (const stone of stones) {
    if (stone.kind === "album") {
      for (const key of [...keysOf(stone.albumTitle), ...keysOf(stone.albumSlug)]) albums.add(key);
    } else if (stone.kind === "group") {
      for (const key of [...keysOf(stone.groupName), ...keysOf(stone.groupSlug)]) groups.add(key);
    } else if (stone.kind === "folder") {
      const versionKey = compactFolderKey(stone.versionSlug || "");
      if (!versionKey) continue;
      for (const albumKey of [...keysOf(stone.albumTitle), ...keysOf(stone.albumSlug)]) versions.add(`${albumKey}:${versionKey}`);
    }
  }

  const removedAlbumKeys = new Set<string>(albums);
  const next: FolderTreeAlbum[] = [];
  for (const folder of tree.albums || []) {
    const titleKey = compactFolderKey(folder.album_title);
    const slugKey = compactFolderKey(folder.album_slug);
    const groupKey = compactFolderKey(folder.group_slug);
    if ((titleKey && albums.has(titleKey)) || (slugKey && albums.has(slugKey))) continue;
    if (groupKey && groups.has(groupKey)) continue;
    const strip = (list: string[]) =>
      list.filter((version) => {
        const versionKey = compactFolderKey(version);
        if (!versionKey) return true;
        if (titleKey && versions.has(`${titleKey}:${versionKey}`)) return false;
        if (slugKey && versions.has(`${slugKey}:${versionKey}`)) return false;
        return true;
      });
    const photocardsVersions = strip(folder.photocardsVersions);
    const pobVersions = strip(folder.pobVersions);
    const inclusionVersions = strip(folder.inclusionVersions);
    const before = folder.photocardsVersions.length + folder.pobVersions.length + folder.inclusionVersions.length;
    const left = photocardsVersions.length + pobVersions.length + inclusionVersions.length;
    if (before > 0 && left === 0) {
      if (titleKey) removedAlbumKeys.add(titleKey);
      if (slugKey) removedAlbumKeys.add(slugKey);
      continue;
    }
    next.push({ ...folder, photocardsVersions, pobVersions, inclusionVersions });
  }
  return { albums: next, removedAlbumKeys: [...removedAlbumKeys] };
}
