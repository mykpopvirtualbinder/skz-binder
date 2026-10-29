import { createClient } from "@supabase/supabase-js";
import { GOM_SOCIALS, type GomSocialKey } from "@/lib/gom";

export async function userFromBearer(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await client.auth.getUser(token);
  return data.user ?? null;
}

export function clip(value: unknown, max: number) {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, max);
}

export function socialsFromRow(row: Record<string, unknown>) {
  const socials = {} as Record<GomSocialKey, string>;
  for (const field of GOM_SOCIALS) socials[field.key] = clip(row[field.key], 160);
  return socials;
}
