/**
 * Deletes or remaps catalog items whose images are not on disk.
 * Old folder-layout URLs that still map to a real file are updated or
 * merged into the already-imported new-path row.
 *
 * Usage: node scripts/cleanup-ghost-items.mjs
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: fs.existsSync(".env.local") ? ".env.local" : ".env" });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const PUBLIC = path.join(process.cwd(), "public");
const EXTS = ["jpg", "jpeg", "png", "webp", "jfif", "JPG", "JPEG", "PNG", "WEBP", "PNG"];
const KEEP_IDS = new Set([999999]);

function decodeUrlPath(u) {
  const s = String(u || "").trim().split("?")[0];
  return s
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      try {
        return decodeURIComponent(seg.replace(/\+/g, "%2B"));
      } catch {
        return seg;
      }
    })
    .join("/");
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(full, out);
    else if (/\.(apng|png|jpe?g|jfif|pjpeg|webp|gif|bmp|avif|svg|ico|tiff?|hei[cf])$/i.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function toPublicUrl(abs) {
  const rel = path.relative(PUBLIC, abs).split(path.sep).join("/");
  const encoded = rel
    .split("/")
    .map((seg) => {
      if (/[^A-Za-z0-9._~-]+/.test(seg)) return encodeURIComponent(seg);
      return seg;
    })
    .join("/");
  return `/${encoded}`;
}

function extVariants(urlPath) {
  const decoded = decodeUrlPath(urlPath);
  const dot = decoded.lastIndexOf(".");
  const stem = dot > 0 ? decoded.slice(0, dot) : decoded;
  const orig = dot > 0 ? decoded.slice(dot + 1) : "";
  const out = [decoded];
  for (const ext of [orig, ...EXTS]) {
    if (!ext) continue;
    const p = `${stem}.${ext}`;
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

function addRestAliases(rest, bucket) {
  const out = new Set([rest]);
  const add = (v) => {
    if (v && !v.startsWith("/") && !v.includes("//")) out.add(v);
  };
  add(rest.replace(/(^|\/)pob(\/|$)/g, "$1pobs$2"));
  add(rest.replace(/(^|\/)pobs(\/|$)/g, "$1pob$2"));
  add(rest.replace(/(^|\/)polaroid-pob(\/|$)/g, "$1polaroid$2"));
  add(rest.replace(/(^|\/)polaroid(\/|$)/g, "$1polaroid-pob$2"));
  add(rest.replace(/(^|\/)photocard-set(\/|$)/g, "$1set$2"));
  add(rest.replace(/(^|\/)photo-card-set(\/|$)/g, "$1set$2"));
  const first = String(rest.split("/")[0] || "").toLowerCase();
  const alreadyTyped = ["photocards", "pobs", "pob", "inclusions", "merch", "pop-ups", "album"].includes(first);
  if (!alreadyTyped) {
    add(`photocards/${rest}`);
    add(`pobs/${rest}`);
    add(`inclusions/${rest}`);
    add(`merch/${rest}`);
  }
  if (bucket) {
    for (const r of out) bucket.add(r);
  }
  return out;
}

function rewriteCandidates(urlPath) {
  const u = decodeUrlPath(urlPath);
  const out = new Set([u]);
  const push = (p) => {
    if (p) out.add(p);
  };

  push(u.replace("/korean-albums/", "/korean-album/"));
  push(u.replace("/korean-album/", "/korean-albums/"));
  push(u.replace("/japanese-albums/", "/japanese-album/"));
  push(u.replace("/japanese-album/", "/japanese-albums/"));

  const albumRe =
    /^(.*\/groups\/[^/]+)\/photocards\/(korean|japanese|taiwanese)-albums?\/([^/]+)\/(.+)$/i;
  const am = u.match(albumRe);
  if (am) {
    const base = `${am[1]}/album/${am[2].toLowerCase()}/${am[3]}`;
    for (const rest of addRestAliases(am[4])) push(`${base}/${rest}`);
  }

  const sg = u.match(
    /^(.*\/groups\/[^/]+)\/photocards\/seasons-greetings\/([^/]+)\/([^/]+)\/(.+)$/i,
  );
  if (sg) {
    const albums = [sg[3], sg[3].replace(/\s+$/, ""), `${sg[3].replace(/\s+$/, "")} `];
    for (const album of albums) {
      const base = `${sg[1]}/otros/seasons-greetings/${sg[2]}/${album}`;
      for (const rest of addRestAliases(sg[4])) push(`${base}/${rest}`);
      push(`${sg[1]}/seasons-greetings/${sg[2]}/${album}/${sg[4]}`);
    }
  }

  const sg2 = u.match(/^(.*\/groups\/[^/]+)\/photocards\/seasons-greetings\/(.+)$/i);
  if (sg2) {
    push(`${sg2[1]}/otros/seasons-greetings/${sg2[2]}`);
    push(`${sg2[1]}/seasons-greetings/${sg2[2]}`);
  }

  const ev = u.match(/^(.*\/groups\/[^/]+)\/photocards\/(events|tour|pop-ups)\/(.+)$/i);
  if (ev) {
    const base = `${ev[1]}/eventos/${ev[2]}`;
    for (const rest of addRestAliases(ev[3])) push(`${base}/${rest}`);
    push(`${base}/${ev[3]}`);
  }

  for (const v of [...out]) {
    if (v.includes("/2023-szks-mini-world/") && !v.includes("/2023-szks-mini-world /")) {
      push(v.replace("/2023-szks-mini-world/", "/2023-szks-mini-world /"));
    }
  }

  return [...out];
}

function resolveOnDisk(url, byRelLower) {
  if (!url || !String(url).startsWith("/")) return null;
  for (const cand of rewriteCandidates(url)) {
    for (const v of extVariants(cand)) {
      const hit = byRelLower.get(v.toLowerCase());
      if (hit) return hit;
    }
  }
  return null;
}

function storedPathExists(url, byRelLower) {
  if (!url || !String(url).startsWith("/")) return false;
  for (const v of extVariants(url)) {
    if (byRelLower.has(v.toLowerCase())) return true;
  }
  return false;
}

function isCurrentLayout(url) {
  return /\/(album|otros|eventos)\//i.test(String(url || ""));
}

async function fetchAll(table, cols) {
  const rows = [];
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from + page - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < page) break;
    from += page;
  }
  return rows;
}

async function remapCol(table, col, fromId, toId) {
  const { data, error } = await supabase.from(table).select("id").eq(col, fromId);
  if (error) {
    if (/schema cache|does not exist|Could not find/i.test(error.message)) return 0;
    throw error;
  }
  let n = 0;
  for (const row of data || []) {
    const { error: upErr } = await supabase.from(table).update({ [col]: toId }).eq("id", row.id);
    if (upErr) {
      const { error: delErr } = await supabase.from(table).delete().eq("id", row.id);
      if (delErr) throw delErr;
    }
    n++;
  }
  return n;
}

async function deleteByIds(table, ids) {
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { error } = await supabase.from(table).delete().in("id", chunk);
    if (error) throw error;
  }
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    throw new Error("Missing Supabase URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const files = walkFiles(path.join(PUBLIC, "mock-pcs"));
  const byRelLower = new Map();
  for (const abs of files) {
    const rel = `/${path.relative(PUBLIC, abs).split(path.sep).join("/")}`;
    byRelLower.set(rel.toLowerCase(), abs);
  }
  console.log("disk images", files.length);

  const items = await fetchAll(
    "items",
    "id,album_id,version,member,image_url,back_image_url,type,name",
  );
  console.log("items", items.length);

  const resolved = new Map();
  const missing = [];
  for (const it of items) {
    if (KEEP_IDS.has(it.id)) continue;
    const abs = resolveOnDisk(it.image_url, byRelLower);
    if (abs) resolved.set(it.id, abs);
    else missing.push(it);
  }

  const groups = new Map();
  for (const it of items) {
    if (KEEP_IDS.has(it.id)) continue;
    const abs = resolved.get(it.id);
    if (!abs) continue;
    const key = abs.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }

  const remap = [];
  const updates = [];
  for (const group of groups.values()) {
    const byNewest = (a, b) => b.id - a.id;
    const exactCurrent = group
      .filter((it) => storedPathExists(it.image_url, byRelLower) && isCurrentLayout(it.image_url))
      .sort(byNewest);
    const exact = group.filter((it) => storedPathExists(it.image_url, byRelLower)).sort(byNewest);
    const keeper = exactCurrent[0] || exact[0] || [...group].sort(byNewest)[0];
    const keepAbs = resolved.get(keeper.id);
    const keepUrl = toPublicUrl(keepAbs);
    if (!storedPathExists(keeper.image_url, byRelLower) || decodeUrlPath(keeper.image_url).toLowerCase() !== decodeUrlPath(keepUrl).toLowerCase()) {
      const backAbs = resolveOnDisk(keeper.back_image_url, byRelLower);
      updates.push({
        id: keeper.id,
        image_url: keepUrl,
        back_image_url: backAbs ? toPublicUrl(backAbs) : keeper.back_image_url || "",
      });
    }
    for (const it of group) {
      if (it.id === keeper.id) continue;
      remap.push([it.id, keeper.id]);
    }
  }

  const deleteIds = [
    ...missing.filter((it) => !KEEP_IDS.has(it.id)).map((it) => it.id),
    ...remap.map(([from]) => from),
  ];
  const uniqueDelete = [...new Set(deleteIds)];

  console.log({
    missing: missing.length,
    duplicateOldRows: remap.length,
    urlUpdates: updates.length,
    willDelete: uniqueDelete.length,
  });
  if (missing.length) {
    const byPrefix = new Map();
    for (const it of missing) {
      const parts = decodeUrlPath(it.image_url || "(empty)").split("/").filter(Boolean);
      const idx = parts.indexOf("groups");
      const key = idx >= 0 ? parts.slice(idx, idx + 5).join("/") : it.image_url || "(empty)";
      byPrefix.set(key, (byPrefix.get(key) || 0) + 1);
    }
    console.log("deleting missing prefixes:");
    [...byPrefix.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, n]) => console.log(String(n).padStart(4), k));
  }

  for (const [fromId, toId] of remap) {
    await remapCol("user_item_statuses", "item_id", fromId, toId);
    await remapCol("page_slots", "item_id", fromId, toId);
  }

  for (const u of updates) {
    const { error } = await supabase
      .from("items")
      .update({ image_url: u.image_url, back_image_url: u.back_image_url })
      .eq("id", u.id);
    if (error) throw error;
  }
  console.log("updated urls", updates.length);

  if (uniqueDelete.length) {
    for (let i = 0; i < uniqueDelete.length; i += 100) {
      const chunk = uniqueDelete.slice(i, i + 100);
      const { error: stErr } = await supabase.from("user_item_statuses").delete().in("item_id", chunk);
      if (stErr && !/schema cache|does not exist/i.test(stErr.message)) throw stErr;
      const { error: slErr } = await supabase.from("page_slots").delete().in("item_id", chunk);
      if (slErr && !/schema cache|does not exist/i.test(slErr.message)) throw slErr;
    }
    await deleteByIds("items", uniqueDelete);
  }
  console.log("deleted items", uniqueDelete.length);

  const { data: merch, error: merchErr } = await supabase
    .from("merch_items")
    .select("id,name,category,image_url");
  if (merchErr) throw merchErr;
  const merchDelete = [];
  for (const row of merch || []) {
    const u = String(row.image_url || "");
    if (!u) {
      merchDelete.push(row);
      continue;
    }
    if (/^https?:\/\//i.test(u)) {
      if (/placehold\.co/i.test(u)) merchDelete.push(row);
      continue;
    }
    if (u.startsWith("/") && !resolveOnDisk(u, byRelLower) && !storedPathExists(u, byRelLower)) {
      merchDelete.push(row);
    }
  }
  if (merchDelete.length) {
    const ids = merchDelete.map((r) => r.id);
    console.log(
      "deleting merch_items",
      merchDelete.map((r) => `${r.id} ${r.name} ${r.image_url}`),
    );
    const { error } = await supabase.from("user_merch_statuses").delete().in("merch_id", ids);
    if (error && !/schema cache|does not exist/i.test(error.message)) throw error;
    const { error: dErr } = await supabase.from("merch_items").delete().in("id", ids);
    if (dErr) throw dErr;
  } else {
    console.log("merch_items: no local ghosts");
  }

  const left = await fetchAll("items", "id,image_url");
  let stillMissing = 0;
  for (const it of left) {
    if (KEEP_IDS.has(it.id)) continue;
    if (!it.image_url) continue;
    if (!String(it.image_url).startsWith("/")) continue;
    if (!resolveOnDisk(it.image_url, byRelLower)) stillMissing++;
  }
  console.log("items remaining", left.length, "still missing", stillMissing);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
