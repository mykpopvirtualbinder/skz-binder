import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_ADMIN_USER_ID } from "@/lib/site-admin-stock";
import { normalizeSiteLanguage } from "@/lib/site-language";

export const DEFAULT_INVITE_REFERRER_KOINS = 100;
export const DEFAULT_INVITE_FRIEND_KOINS = 100;
export const INVITE_USE_LIMIT = 10;
const MAX_INVITE_KOINS = 500;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

function inviteUses(meta: Record<string, unknown>): number {
  return Math.max(0, Number(meta.invite_signups) || 0);
}

function randomInviteCode(): string {
  const bytes = randomBytes(6);
  let body = "";
  for (let i = 0; i < bytes.length; i += 1) body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `MKB-${body}`;
}

/** Crea el código de esta cuenta si aún no tiene. Nunca repite uno que ya exista. */
export async function ensureOwnInviteCode(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  const prev = asRecord(data.user.app_metadata);
  const existing = normalizeInviteCode(prev.invite_code);
  if (existing) return existing;

  const taken = new Set(
    (await listAuthUsers(admin))
      .map((user) => normalizeInviteCode(asRecord(user.app_metadata).invite_code))
      .filter((code): code is string => Boolean(code)),
  );
  let code: string | null = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = randomInviteCode();
    if (!taken.has(candidate)) {
      code = candidate;
      break;
    }
  }
  if (!code) return null;

  const saved = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...prev,
      invite_code: code,
      invite_referrer_koins: metaNumber(prev, "invite_referrer_koins", DEFAULT_INVITE_REFERRER_KOINS),
      invite_friend_koins: metaNumber(prev, "invite_friend_koins", DEFAULT_INVITE_FRIEND_KOINS),
      invite_signups: inviteUses(prev),
      invite_welcome: true,
    },
  });
  if (saved.error) return null;
  return code;
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

const GIFT_COPY: Record<string, { friend: string; referrer: string; full: string; welcome: string }> = {
  es: {
    friend: "Tu código {code} está aplicado. Has recibido {n} K-oins de bienvenida.",
    referrer: "Alguien se ha dado de alta con tu código {code}. Has recibido {n} K-oins.",
    full: "El código {code} ya se ha usado 10 veces, así que esta alta no suma K-oins.",
    welcome: "Gracias por darte de alta. Tu código es {code}. Es único y se puede usar 10 veces como máximo. Quien se registre con él recibe {friend} K-oins, y tú recibes {referrer} K-oins por cada persona.",
  },
  en: {
    friend: "Your code {code} is applied. You received {n} welcome K-oins.",
    referrer: "Someone signed up with your code {code}. You received {n} K-oins.",
    full: "The code {code} has already been used 10 times, so this signup does not add K-oins.",
    welcome: "Thanks for signing up. Your code is {code}. It is unique and can be used 10 times at most. Each person who registers with it receives {friend} K-oins, and you receive {referrer} K-oins per person.",
  },
  fr: {
    friend: "Ton code {code} est appliqué. Tu as reçu {n} K-oins de bienvenue.",
    referrer: "Quelqu'un s'est inscrit avec ton code {code}. Tu as reçu {n} K-oins.",
    full: "Le code {code} a déjà été utilisé 10 fois, donc cette inscription n'ajoute pas de K-oins.",
    welcome: "Merci pour ton inscription. Ton code est {code}. Il est unique et peut servir 10 fois au maximum. Chaque personne qui s'inscrit avec reçoit {friend} K-oins, et toi {referrer} K-oins par personne.",
  },
  de: {
    friend: "Dein Code {code} ist aktiv. Du hast {n} Willkommens-K-oins erhalten.",
    referrer: "Jemand hat sich mit deinem Code {code} angemeldet. Du hast {n} K-oins erhalten.",
    full: "Der Code {code} wurde schon 10-mal benutzt, deshalb gibt es für diese Anmeldung keine K-oins.",
    welcome: "Danke für deine Anmeldung. Dein Code ist {code}. Er ist einzigartig und gilt höchstens 10-mal. Wer sich damit anmeldet, erhält {friend} K-oins, und du erhältst {referrer} K-oins pro Person.",
  },
  it: {
    friend: "Il tuo codice {code} è attivo. Hai ricevuto {n} K-oins di benvenuto.",
    referrer: "Qualcuno si è iscritto con il tuo codice {code}. Hai ricevuto {n} K-oins.",
    full: "Il codice {code} è già stato usato 10 volte, quindi questa iscrizione non aggiunge K-oins.",
    welcome: "Grazie per l'iscrizione. Il tuo codice è {code}. È unico e si può usare al massimo 10 volte. Chi si registra con esso riceve {friend} K-oins, e tu ricevi {referrer} K-oins per persona.",
  },
  pt: {
    friend: "O teu código {code} ficou ativo. Recebeste {n} K-oins de boas-vindas.",
    referrer: "Alguém criou conta com o teu código {code}. Recebeste {n} K-oins.",
    full: "O código {code} já foi usado 10 vezes, por isso esta alta não soma K-oins.",
    welcome: "Obrigado por te registares. O teu código é {code}. É único e pode ser usado no máximo 10 vezes. Quem se registar com ele recebe {friend} K-oins, e tu recebes {referrer} K-oins por pessoa.",
  },
  id: {
    friend: "Kode {code} sudah dipakai. Kamu menerima {n} K-oins selamat datang.",
    referrer: "Seseorang mendaftar dengan kodemu {code}. Kamu menerima {n} K-oins.",
    full: "Kode {code} sudah dipakai 10 kali, jadi pendaftaran ini tidak menambah K-oins.",
    welcome: "Terima kasih sudah mendaftar. Kodemu adalah {code}. Kode ini unik dan paling banyak dipakai 10 kali. Setiap orang yang mendaftar dengannya menerima {friend} K-oins, dan kamu menerima {referrer} K-oins per orang.",
  },
  th: {
    friend: "ใช้รหัส {code} แล้ว คุณได้รับ {n} K-oins ต้อนรับ",
    referrer: "มีคนสมัครด้วยรหัส {code} ของคุณ คุณได้รับ {n} K-oins",
    full: "รหัส {code} ถูกใช้ครบ 10 ครั้งแล้ว การสมัครนี้จึงไม่ได้ K-oins",
    welcome: "ขอบคุณที่สมัคร รหัสของคุณคือ {code} ไม่ซ้ำกับใคร และใช้ได้สูงสุด 10 ครั้ง คนที่สมัครด้วยรหัสนี้ได้ {friend} K-oins และคุณได้ {referrer} K-oins ต่อคน",
  },
  ko: {
    friend: "코드 {code}가 적용되었습니다. 환영 {n} K-oins를 받았어요.",
    referrer: "누군가 코드 {code}로 가입했습니다. {n} K-oins를 받았어요.",
    full: "코드 {code}는 이미 10번 사용되어 이번 가입에는 K-oins가 없습니다.",
    welcome: "가입해 주셔서 감사합니다. 코드는 {code}입니다. 고유하며 최대 10번 사용할 수 있습니다. 이 코드로 가입한 사람은 {friend} K-oins를, 당신은 한 명당 {referrer} K-oins를 받습니다.",
  },
  zh: {
    friend: "邀请码 {code} 已生效。你收到了 {n} 个欢迎 K-oins。",
    referrer: "有人用你的邀请码 {code} 注册了。你收到了 {n} 个 K-oins。",
    full: "邀请码 {code} 已用满 10 次，所以这次注册不加 K-oins。",
    welcome: "感谢注册。你的邀请码是 {code}。它不会重复，最多使用 10 次。用它注册的人获得 {friend} 个 K-oins，你每带来一人获得 {referrer} 个 K-oins。",
  },
  ja: {
    friend: "コード {code} を適用しました。ウェルカムの {n} K-oins を受け取りました。",
    referrer: "誰かがあなたのコード {code} で登録しました。{n} K-oins を受け取りました。",
    full: "コード {code} はすでに 10 回使われたので、この登録では K-oins は付きません。",
    welcome: "登録ありがとうございます。あなたのコードは {code} です。重複せず、最大 10 回まで使えます。このコードで登録した人は {friend} K-oins、あなたは 1 人につき {referrer} K-oins を受け取ります。",
  },
};

function giftText(
  language: string,
  kind: "friend" | "referrer" | "full" | "welcome",
  code: string,
  amount: number,
  extra?: { friend?: number; referrer?: number },
): string {
  const copy = GIFT_COPY[normalizeSiteLanguage(language)] || GIFT_COPY.es;
  return copy[kind]
    .replace("{code}", code)
    .replace("{n}", String(amount))
    .replace("{friend}", String(extra?.friend ?? amount))
    .replace("{referrer}", String(extra?.referrer ?? amount));
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

  const fresh = await admin.auth.admin.getUserById(inviter.id);
  const inviterMeta = asRecord(fresh.data?.user?.app_metadata ?? inviter.app_metadata);
  if (inviteUses(inviterMeta) >= INVITE_USE_LIMIT) {
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...prev, invite_pending_code: null, invite_redeemed_code: pending },
    });
    const friendLang = await addKoins(admin, userId, 0);
    await notifyGift(admin, userId, giftText(friendLang, "full", pending, 0));
    return;
  }

  const friendKoins = metaNumber(inviterMeta, "invite_friend_koins", DEFAULT_INVITE_FRIEND_KOINS);
  const referrerKoins = metaNumber(inviterMeta, "invite_referrer_koins", DEFAULT_INVITE_REFERRER_KOINS);

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...prev, invite_pending_code: null, invite_redeemed_code: pending },
  });

  const friendLang = await addKoins(admin, userId, friendKoins);
  const referrerLang = await addKoins(admin, inviter.id, referrerKoins);
  if (friendKoins > 0) await notifyGift(admin, userId, giftText(friendLang, "friend", pending, friendKoins));
  if (referrerKoins > 0) await notifyGift(admin, inviter.id, giftText(referrerLang, "referrer", pending, referrerKoins));

  const signups = inviteUses(inviterMeta) + 1;
  await admin.auth.admin.updateUserById(inviter.id, {
    app_metadata: { ...inviterMeta, invite_signups: signups },
  });
}

/** La primera vez que entra, deja el código en sus avisos por si cerró el mensaje del alta. */
export async function announceOwnInviteCode(admin: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email_confirmed_at) return;
  const prev = asRecord(data.user.app_metadata);
  if (!prev.invite_welcome || prev.invite_code_announced) return;
  const code = normalizeInviteCode(prev.invite_code);
  if (!code) return;
  const friend = metaNumber(prev, "invite_friend_koins", DEFAULT_INVITE_FRIEND_KOINS);
  const referrer = metaNumber(prev, "invite_referrer_koins", DEFAULT_INVITE_REFERRER_KOINS);
  const language = await addKoins(admin, userId, 0);
  await notifyGift(admin, userId, giftText(language, "welcome", code, 0, { friend, referrer }));
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...prev, invite_code_announced: true },
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
