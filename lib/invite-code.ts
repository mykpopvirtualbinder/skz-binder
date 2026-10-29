import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_ADMIN_USER_ID } from "@/lib/site-admin-stock";
import { normalizeSiteLanguage } from "@/lib/site-language";

export const DEFAULT_INVITE_REFERRER_KOINS = 100;
export const DEFAULT_INVITE_FRIEND_KOINS = 100;
const MAX_INVITE_KOINS = 500;

const CODE_OK = /^[A-Z0-9][A-Z0-9-]{2,14}[A-Z0-9]$/;

type AuthUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  app_metadata?: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!code || !CODE_OK.test(code)) return null;
  return code;
}

export function clampInviteKoins(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(MAX_INVITE_KOINS, Math.round(n)));
}

function metaNumber(meta: Record<string, unknown>, key: string, fallback: number): number {
  return clampInviteKoins(meta[key], fallback);
}

async function listAuthUsers(admin: SupabaseClient): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const batch = (data?.users ?? []) as AuthUser[];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

export async function findInviterByCode(admin: SupabaseClient, code: string): Promise<AuthUser | null> {
  const users = await listAuthUsers(admin);
  return users.find((user) => normalizeInviteCode(asRecord(user.app_metadata).invite_code) === code) ?? null;
}

export async function attachPendingInvite(admin: SupabaseClient, userId: string, code: string): Promise<void> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return;
  const prev = asRecord(data.user.app_metadata);
  if (prev.invite_redeemed_code) return;
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...prev, invite_pending_code: code },
  });
}

async function addKoins(admin: SupabaseClient, userId: string, amount: number): Promise<string> {
  const { data } = await admin.from("profiles").select("puntos, language").eq("user_id", userId).maybeSingle();
  const row = asRecord(data);
  if (amount > 0) {
    const next = Math.max(0, Number(row.puntos) || 0) + amount;
    await admin.from("profiles").update({ puntos: next }).eq("user_id", userId);
  }
  return typeof row.language === "string" ? row.language : "es";
}

const GIFT_COPY: Record<string, { friend: string; referrer: string }> = {
  es: {
    friend: "Tu código {code} está aplicado. Has recibido {n} K-oins de bienvenida.",
    referrer: "Alguien se ha dado de alta con tu código {code}. Has recibido {n} K-oins.",
  },
  en: {
    friend: "Your code {code} is applied. You received {n} welcome K-oins.",
    referrer: "Someone signed up with your code {code}. You received {n} K-oins.",
  },
  fr: {
    friend: "Ton code {code} est appliqué. Tu as reçu {n} K-oins de bienvenue.",
    referrer: "Quelqu'un s'est inscrit avec ton code {code}. Tu as reçu {n} K-oins.",
  },
  de: {
    friend: "Dein Code {code} ist aktiv. Du hast {n} Willkommens-K-oins erhalten.",
    referrer: "Jemand hat sich mit deinem Code {code} angemeldet. Du hast {n} K-oins erhalten.",
  },
  it: {
    friend: "Il tuo codice {code} è attivo. Hai ricevuto {n} K-oins di benvenuto.",
    referrer: "Qualcuno si è iscritto con il tuo codice {code}. Hai ricevuto {n} K-oins.",
  },
  pt: {
    friend: "O teu código {code} ficou ativo. Recebeste {n} K-oins de boas-vindas.",
    referrer: "Alguém criou conta com o teu código {code}. Recebeste {n} K-oins.",
  },
  id: {
    friend: "Kode {code} sudah dipakai. Kamu menerima {n} K-oins selamat datang.",
    referrer: "Seseorang mendaftar dengan kodemu {code}. Kamu menerima {n} K-oins.",
  },
  th: {
    friend: "ใช้รหัส {code} แล้ว คุณได้รับ {n} K-oins ต้อนรับ",
    referrer: "มีคนสมัครด้วยรหัส {code} ของคุณ คุณได้รับ {n} K-oins",
  },
  ko: {
    friend: "코드 {code}가 적용되었습니다. 환영 {n} K-oins를 받았어요.",
    referrer: "누군가 코드 {code}로 가입했습니다. {n} K-oins를 받았어요.",
  },
  zh: {
    friend: "邀请码 {code} 已生效。你收到了 {n} 个欢迎 K-oins。",
    referrer: "有人用你的邀请码 {code} 注册了。你收到了 {n} 个 K-oins。",
  },
  ja: {
    friend: "コード {code} を適用しました。ウェルカムの {n} K-oins を受け取りました。",
    referrer: "誰かがあなたのコード {code} で登録しました。{n} K-oins を受け取りました。",
  },
};

function giftText(language: string, kind: "friend" | "referrer", code: string, amount: number): string {
  const copy = GIFT_COPY[normalizeSiteLanguage(language)] || GIFT_COPY.es;
  return copy[kind].replace("{code}", code).replace("{n}", String(amount));
}

async function notifyGift(admin: SupabaseClient, userId: string, content: string): Promise<void> {
  const payload = {
    user_id: userId,
    sender_id: SITE_ADMIN_USER_ID,
    type: "admin_message",
    content,
    read: false,
  };
  const note = await admin.from("notifications").insert(payload);
  if (!note.error) return;
  await admin.from("notifications").insert({ user_id: userId, type: "admin_message", content, read: false });
}

/** Cuando la cuenta ya confirmó el correo, entrega los K-oins del código y avisa a las dos personas. */
export async function redeemInviteIfReady(admin: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email_confirmed_at) return;
  const prev = asRecord(data.user.app_metadata);
  const pending = normalizeInviteCode(prev.invite_pending_code);
  if (!pending || prev.invite_redeemed_code) return;

  const inviter = await findInviterByCode(admin, pending);
  if (!inviter || inviter.id === userId) {
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...prev, invite_pending_code: null, invite_redeemed_code: pending },
    });
    return;
  }

  const inviterMeta = asRecord(inviter.app_metadata);
  const friendKoins = metaNumber(inviterMeta, "invite_friend_koins", DEFAULT_INVITE_FRIEND_KOINS);
  const referrerKoins = metaNumber(inviterMeta, "invite_referrer_koins", DEFAULT_INVITE_REFERRER_KOINS);

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...prev, invite_pending_code: null, invite_redeemed_code: pending },
  });

  const friendLang = await addKoins(admin, userId, friendKoins);
  const referrerLang = await addKoins(admin, inviter.id, referrerKoins);
  if (friendKoins > 0) await notifyGift(admin, userId, giftText(friendLang, "friend", pending, friendKoins));
  if (referrerKoins > 0) await notifyGift(admin, inviter.id, giftText(referrerLang, "referrer", pending, referrerKoins));

  const signups = Math.max(0, Number(inviterMeta.invite_signups) || 0) + 1;
  await admin.auth.admin.updateUserById(inviter.id, {
    app_metadata: { ...inviterMeta, invite_signups: signups },
  });
}

export async function saveUserInviteCode(
  admin: SupabaseClient,
  userId: string,
  rawCode: string,
  referrerKoins: unknown,
  friendKoins: unknown,
): Promise<{ code: string | null; referrerKoins: number; friendKoins: number; signups: number }> {
  const code = rawCode.trim() ? normalizeInviteCode(rawCode) : null;
  if (rawCode.trim() && !code) {
    throw new Error("Código no válido. Usa de 4 a 16 letras o números.");
  }
  if (code) {
    const owner = await findInviterByCode(admin, code);
    if (owner && owner.id !== userId) throw new Error("Ese código ya pertenece a otra cuenta.");
  }

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error(error?.message || "Usuario no encontrado.");
  const prev = asRecord(data.user.app_metadata);
  const next: Record<string, unknown> = { ...prev };
  const referrer = clampInviteKoins(referrerKoins, DEFAULT_INVITE_REFERRER_KOINS);
  const friend = clampInviteKoins(friendKoins, DEFAULT_INVITE_FRIEND_KOINS);
  if (!code) {
    delete next.invite_code;
  } else {
    next.invite_code = code;
    next.invite_referrer_koins = referrer;
    next.invite_friend_koins = friend;
  }
  const saved = await admin.auth.admin.updateUserById(userId, { app_metadata: next });
  if (saved.error) throw new Error(saved.error.message);
  return {
    code,
    referrerKoins: referrer,
    friendKoins: friend,
    signups: Math.max(0, Number(prev.invite_signups) || 0),
  };
}
