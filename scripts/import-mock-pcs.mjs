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

async function upsertItemByImageUrl(payload) {
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
    return;
  }

  const { error: insErr } = await supabase.from("items").insert(payload);
  if (insErr) throw insErr;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error("No encuentro items_import.csv en la raíz del proyecto.");
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseTSVOrCSV(raw);
  console.log("Filas CSV:", rows.length);
console.log("Filas CSV:", rows.length);
  let processed = 0;
const groupsTouched = new Set();
const albumsTouched = new Set();
  for (const r of rows) {
    const name = r.name || "";
    const image_url = r.image_url || "";
    const back_image_url = r.back_image_url || "";
    const group_name = r.group_name || "";
    const album_name = r.album_name || "";
    const version = r.version || "";
    const member = r.member || "";

    if (!image_url) continue;

    const group_id = await ensureGroup(group_name);
    const album_id = await ensureAlbum(album_name, group_id);
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

    await upsertItemByImageUrl(payload);
    processed++;
    if (processed % 50 === 0) console.log("Procesados:", processed);
    if (processed % 100 === 0) console.log("Procesados:", processed);
  }

  console.log("OK ✅ Import terminado");
  console.log(`- Items procesados: ${processed}`);
console.log(`- Groups: ${groupsTouched.size}`);
console.log(`- Albums mapeados: ${albumsTouched.size}`);
}

main().catch((e) => {
  console.error("Error import:", e?.message || e);
  process.exit(1);
});