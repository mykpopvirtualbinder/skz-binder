// scripts/import-mock-pcs.mjs
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Carga .env.local si existe, si no .env
dotenv.config({ path: fs.existsSync(".env.local") ? ".env.local" : ".env" });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan variables de entorno:");
  if (!SUPABASE_URL) console.error("- SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)");
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error("- SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const CSV_PATH = path.join(process.cwd(), "items_import.csv");

function parseTSVOrCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const sep = lines[0].includes("\t") ? "\t" : ",";
  const header = lines[0].split(sep).map((s) => s.trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? "").trim();
    });
    rows.push(obj);
  }
  return rows;
}

function isDuplicateKeyError(err) {
  return err && (err.code === "23505" || String(err.message || "").toLowerCase().includes("duplicate key"));
}

function slugify(input) {
  const s = String(input ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "unsorted";
}

async function ensureGroup(name) {
  const safeName = (name || "").trim() || "Unsorted";
  const baseSlug = slugify(safeName);

  // 1) leer por name
  {
    const { data, error } = await supabase.from("groups").select("id,name,slug").eq("name", safeName).limit(1);
    if (error) throw error;
    if (data && data[0]) return data[0].id;
  }

  // 2) leer por slug (por si ya existe con mismo slug)
  {
    const { data, error } = await supabase.from("groups").select("id,name,slug").eq("slug", baseSlug).limit(1);
    if (error) throw error;
    if (data && data[0]) return data[0].id;
  }

  // 3) crear (slug NOT NULL)
  {
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: safeName, slug: baseSlug })
      .select("id")
      .single();

    if (!error && data?.id) return data.id;
    if (error && !isDuplicateKeyError(error)) throw error;
  }

  // 4) re-leer tras duplicado
  {
    const { data, error } = await supabase.from("groups").select("id").or(`name.eq.${safeName},slug.eq.${baseSlug}`).limit(1);
    if (error) throw error;
    if (data && data[0]) return data[0].id;
  }

  throw new Error(`ensureGroup: no pude asegurar el grupo "${safeName}"`);
}

/**
 * OJO: tu constraint de error era "albums_name_uniq" (name único global).
 * Por tanto: buscamos/creamos por name, y ajustamos group_id si hace falta.
 */
async function ensureAlbum(name, group_id) {
  const safeName = (name || "").trim() || "Unsorted";
  if (!group_id) throw new Error("ensureAlbum: group_id es null pero albums exige group_id NOT NULL.");

  // 1) leer por name
  {
    const { data, error } = await supabase.from("albums").select("id,name,group_id").eq("name", safeName).limit(1);
    if (error) throw error;
    if (data && data[0]) {
      const existing = data[0];
      if (existing.group_id !== group_id) {
        const { error: upErr } = await supabase.from("albums").update({ group_id }).eq("id", existing.id);
        if (upErr) throw upErr;
      }
      return existing.id;
    }
  }

  // 2) crear
  {
    const { data, error } = await supabase
      .from("albums")
      .insert({ name: safeName, group_id })
      .select("id,group_id")
      .single();

    if (!error && data?.id) return data.id;
    if (error && !isDuplicateKeyError(error)) throw error;
  }

  // 3) re-leer tras duplicado + ajustar group_id
  {
    const { data, error } = await supabase.from("albums").select("id,name,group_id").eq("name", safeName).limit(1);
    if (error) throw error;
    if (data && data[0]) {
      const existing = data[0];
      if (existing.group_id !== group_id) {
        const { error: upErr } = await supabase.from("albums").update({ group_id }).eq("id", existing.id);
        if (upErr) throw upErr;
      }
      return existing.id;
    }
  }

  throw new Error(`ensureAlbum: no pude asegurar el álbum "${safeName}"`);
}

async function upsertItemByImageUrl(payload, idByDecodedUrl) {
  const decoded = decodeUrlPath(payload.image_url).toLowerCase();
  const existingId = idByDecodedUrl.get(decoded);
  if (existingId) {
    const { error: upErr } = await supabase.from("items").update(payload).eq("id", existingId);
    if (upErr) throw upErr;
    return "update";
  }

  const { data: existing, error: selErr } = await supabase
    .from("items")
    .select("id,image_url")
    .eq("image_url", payload.image_url)
    .limit(1);

  if (selErr) throw selErr;

  if (existing && existing[0]) {
    const id = existing[0].id;
    const { error: upErr } = await supabase.from("items").update(payload).eq("id", id);
    if (upErr) throw upErr;
    idByDecodedUrl.set(decoded, id);
    return "update";
  }

  const fileName = String(payload.image_url || "").split("/").pop() || "";
  if (fileName && payload.album_id) {
    const { data: byFile, error: fileErr } = await supabase
      .from("items")
      .select("id,image_url")
      .eq("album_id", payload.album_id)
      .ilike("image_url", `%/${fileName}`)
      .limit(5);
    if (fileErr) throw fileErr;
    // Only remap a dead old-path row onto the new file. Never merge two
    // live versions that share a filename (001-front-bang-chan in A vs B).
    const dead = (byFile || []).filter((row) => {
      const u = String(row.image_url || "");
      if (!u.startsWith("/")) return false;
      const rel = u
        .split("?")[0]
        .split("/")
        .map((seg) => {
          try {
            return decodeURIComponent(seg);
          } catch {
            return seg;
          }
        })
        .join("/");
      const abs = path.join(process.cwd(), "public", rel.replace(/^\/+/, ""));
      return !fs.existsSync(abs);
    });
    if (dead.length === 1) {
      const { error: upErr } = await supabase.from("items").update(payload).eq("id", dead[0].id);
      if (upErr) throw upErr;
      idByDecodedUrl.set(decoded, dead[0].id);
      return "remap";
    }
  }

  const { data: insertedRow, error: insErr } = await supabase.from("items").insert(payload).select("id").single();
  if (insErr) throw insErr;
  if (insertedRow?.id) idByDecodedUrl.set(decoded, insertedRow.id);
  return "insert";
}

function albumSlugFromImageUrl(imageUrl) {
  const u = String(imageUrl || "");
  const albumEra = u.match(/\/album\/(?:korean|japanese|taiwanese|taiwan)\/([^/]+)\//i);
  if (albumEra?.[1]) return albumEra[1];
  const sg = u.match(/\/seasons-greetings\/(?:korean|japanese|taiwanese)\/([^/]+)\//i);
  if (sg?.[1]) return `seasons-greetings-${sg[1]}`;
  const ev = u.match(/\/eventos\/(?:events|tour|pop-ups)\/([^/]+)\//i);
  if (ev?.[1]) return ev[1];
  return "";
}

function decodeUrlPath(u) {
  return String(u || "")
    .split("?")[0]
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    })
    .join("/");
}

function isSkippedImageUrl(imageUrl) {
  const u = decodeUrlPath(imageUrl).toLowerCase();
  return u.includes("/templates/") || /\/groups\/[^/]+\/other\//i.test(u);
}

async function fetchAllItems(cols) {
  const rows = [];
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabase.from("items").select(cols).range(from, from + page - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < page) break;
    from += page;
  }
  return rows;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error("No encuentro items_import.csv en la raíz del proyecto.");
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseTSVOrCSV(raw);
  console.log("Filas CSV:", rows.length);

  const existingItems = await fetchAllItems("id,album_id,image_url");
  const albumIdByDir = new Map();
  const idByDecodedUrl = new Map();
  for (const it of existingItems) {
    const decoded = decodeUrlPath(it.image_url);
    if (decoded) idByDecodedUrl.set(decoded.toLowerCase(), it.id);
    const dir = decoded.replace(/\/[^/]+$/, "");
    if (dir && it.album_id && !albumIdByDir.has(dir)) albumIdByDir.set(dir, it.album_id);
  }
  function albumIdFromSiblings(imageUrl) {
    let dir = decodeUrlPath(imageUrl).replace(/\/[^/]+$/, "");
    while (dir.includes("/mock-pcs/")) {
      if (albumIdByDir.has(dir)) return albumIdByDir.get(dir);
      const next = dir.replace(/\/[^/]+$/, "");
      if (next === dir) break;
      dir = next;
    }
    return 0;
  }

  let processed = 0;
  let remapped = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const groupsTouched = new Set();
  const albumsTouched = new Set();
  for (const r of rows) {
    const name = r.name || "";
    const image_url = r.image_url || "";
    const back_image_url = r.back_image_url || "";
    const version = r.version || "";
    const member = r.member || "";

    if (!image_url) continue;
    if (isSkippedImageUrl(image_url)) {
      skipped++;
      continue;
    }

    const group_id_num = Number(r.group_id);
    const group_id = Number.isFinite(group_id_num) && group_id_num > 0
      ? group_id_num
      : await ensureGroup(r.group_name || "Stray Kids");

    const album_id_num = Number(r.album_id);
    let album_id = albumIdFromSiblings(image_url) || (Number.isFinite(album_id_num) && album_id_num > 0 ? album_id_num : 0);
    if (!album_id) {
      const rawAlbumSlug = r.album_name || albumSlugFromImageUrl(image_url) || "Unsorted";
      let albumName;
      try { albumName = decodeURIComponent(rawAlbumSlug); } catch { albumName = rawAlbumSlug; }
      album_id = await ensureAlbum(albumName, group_id);
    }

    if (group_id) groupsTouched.add(group_id);
    if (album_id) albumsTouched.add(album_id);
    const payload = {
      name: name || null,
      image_url: image_url || null,
      back_image_url: back_image_url || null,
      group_id,
      album_id,
      version: version || null,
      member: member || null,
    };
    const action = await upsertItemByImageUrl(payload, idByDecodedUrl);
    if (action === "remap") remapped++;
    else if (action === "insert") {
      inserted++;
      const dir = decodeUrlPath(image_url).replace(/\/[^/]+$/, "");
      if (dir && album_id && !albumIdByDir.has(dir)) albumIdByDir.set(dir, album_id);
    } else updated++;
    processed++;
    if (processed % 100 === 0) console.log("Procesados:", processed, `(update ${updated} / remap ${remapped} / insert ${inserted})`);
  }

  console.log("OK ✅ Import terminado");
  console.log(`- Items procesados: ${processed}`);
  console.log(`- Update por URL exacta: ${updated}`);
  console.log(`- Remap (misma carta, ruta nueva): ${remapped}`);
  console.log(`- Insert nuevos: ${inserted}`);
  console.log(`- Omitidos (templates/other): ${skipped}`);
  console.log(`- Groups: ${groupsTouched.size}`);
  console.log(`- Albums mapeados: ${albumsTouched.size}`);
}

main().catch((e) => {
  console.error("Error import:", e?.message || e);
  process.exit(1);
});