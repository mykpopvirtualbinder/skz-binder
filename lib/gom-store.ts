import type { SupabaseClient } from "@supabase/supabase-js";
import { GOM_SOCIALS, emptyGomSocials, type GomSocials } from "@/lib/gom";
import { clip } from "@/lib/gom-server";

const PROFILE = "gom-profile";
const RATING = "gom-rating";
const COMMENT = "gom-comment";

type Box = {
  id: string;
  user_id: string | null;
  asunto: string;
  email: string | null;
  mensaje: string | null;
  adjuntos: string | null;
  status: string | null;
  created_at: string;
};

export type GomRecord = {
  id: string;
  userId: string;
  displayName: string;
  photoUrl: string;
  firstName: string;
  lastName: string;
  phone: string;
  url: string;
  socials: GomSocials;
  goTypes: string;
  requirements: string;
  howItWorks: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

function asStatus(review: unknown): GomRecord["status"] {
  if (review === "approved" || review === "rejected") return review;
  return "pending";
}

function readSocials(value: unknown): GomSocials {
  const socials = emptyGomSocials();
  if (!value || typeof value !== "object") return socials;
  const record = value as Record<string, unknown>;
  for (const field of GOM_SOCIALS) socials[field.key] = clip(record[field.key], 160);
  return socials;
}

function readRecord(row: Box): GomRecord | null {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(row.mensaje || "{}") as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!row.user_id) return null;
  return {
    id: row.id,
    userId: row.user_id,
    displayName: clip(parsed.displayName, 40),
    photoUrl: clip(parsed.photoUrl, 500) || clip(row.adjuntos, 500),
    firstName: clip(parsed.firstName, 80),
    lastName: clip(parsed.lastName, 80),
    phone: clip(parsed.phone, 40),
    url: clip(parsed.url, 300),
    socials: readSocials(parsed.socials),
    goTypes: clip(parsed.goTypes, 2000),
    requirements: clip(parsed.requirements, 2000),
    howItWorks: clip(parsed.howItWorks, 2000),
    status: asStatus(parsed.review),
    createdAt: row.created_at,
  };
}

async function rows(admin: SupabaseClient, asunto: string) {
  const { data, error } = await admin
    .from("buzon_colaboraciones")
    .select("id, user_id, asunto, email, mensaje, adjuntos, status, created_at")
    .eq("asunto", asunto)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Box[];
}

export async function listGomProfiles(admin: SupabaseClient) {
  const list = await rows(admin, PROFILE);
  return list.map(readRecord).filter((row): row is GomRecord => Boolean(row));
}

export async function saveGomProfile(admin: SupabaseClient, userId: string, input: Omit<GomRecord, "id" | "userId" | "status" | "createdAt">) {
  const mensaje = JSON.stringify({
    displayName: input.displayName,
    photoUrl: input.photoUrl,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    url: input.url,
    socials: input.socials,
    goTypes: input.goTypes,
    requirements: input.requirements,
    howItWorks: input.howItWorks,
    review: "pending",
  });
  const email = `gom:${userId}`;
  const { data: existing, error: readError } = await admin
    .from("buzon_colaboraciones")
    .select("id")
    .eq("asunto", PROFILE)
    .eq("email", email)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing?.id) {
    const { error } = await admin
      .from("buzon_colaboraciones")
      .update({ mensaje, adjuntos: input.photoUrl, status: "pendiente", user_id: userId })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await admin.from("buzon_colaboraciones").insert({
    user_id: userId,
    asunto: PROFILE,
    email,
    mensaje,
    adjuntos: input.photoUrl,
    status: "pendiente",
  });
  if (error) throw new Error(error.message);
}

export async function setGomStatus(admin: SupabaseClient, id: string, status: GomRecord["status"]) {
  const { data: current, error: readError } = await admin
    .from("buzon_colaboraciones")
    .select("id, user_id, mensaje")
    .eq("id", id)
    .eq("asunto", PROFILE)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) return null;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(current.mensaje || "{}") as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  parsed.review = status;
  const { error } = await admin
    .from("buzon_colaboraciones")
    .update({ mensaje: JSON.stringify(parsed), status: "pendiente" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { id: current.id as string, user_id: current.user_id as string, mensaje: JSON.stringify(parsed) };
}

export async function rateGom(admin: SupabaseClient, gomId: string, userId: string, score: number) {
  const email = `rate:${gomId}:${userId}`;
  const { data: existing, error: readError } = await admin
    .from("buzon_colaboraciones")
    .select("id")
    .eq("asunto", RATING)
    .eq("email", email)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing?.id) {
    const { error } = await admin.from("buzon_colaboraciones").update({ mensaje: String(score) }).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await admin.from("buzon_colaboraciones").insert({
    user_id: userId,
    asunto: RATING,
    email,
    mensaje: String(score),
    status: "pendiente",
  });
  if (error) throw new Error(error.message);
}

export async function commentGom(admin: SupabaseClient, gomId: string, userId: string, text: string) {
  const { error } = await admin.from("buzon_colaboraciones").insert({
    user_id: userId,
    asunto: COMMENT,
    email: gomId,
    mensaje: text,
    status: "pendiente",
  });
  if (error) throw new Error(error.message);
}

export async function listGomFeedback(admin: SupabaseClient) {
  const [ratingRows, commentRows] = await Promise.all([rows(admin, RATING), rows(admin, COMMENT)]);
  const ratings = ratingRows.flatMap((row) => {
    const parts = (row.email || "").split(":");
    const score = Number(row.mensaje);
    if (parts[0] !== "rate" || !parts[1] || !parts[2] || !Number.isInteger(score)) return [];
    return [{ gomId: parts[1], userId: parts[2], score }];
  });
  const comments = commentRows.flatMap((row) => {
    if (!row.email || !row.user_id || !row.mensaje) return [];
    return [{ id: row.id, gomId: row.email, userId: row.user_id, body: row.mensaje, createdAt: row.created_at }];
  });
  return { ratings, comments };
}
