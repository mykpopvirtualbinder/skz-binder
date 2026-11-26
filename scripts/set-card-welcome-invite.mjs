/**
 * Asigna MKB-CREW (usos ilimitados, 500 K-oins a quien se apunta) a info@mykpopbinder.com.
 * Uso: node scripts/set-card-welcome-invite.mjs
 */
import fs from "fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: fs.existsSync(".env.local") ? ".env.local" : ".env" });

const CODE = "MKB-CREW";
const FRIEND_KOINS = 500;
const REFERRER_KOINS = 0;
const SITE_ADMIN_USER_ID = "85b9ef79-4f84-4b9e-8f0a-1847bcb9770c";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function listUsers() {
  const users = [];
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...(data?.users ?? []));
    if ((data?.users ?? []).length < 200) break;
  }
  return users;
}

const users = await listUsers();
const owner = users.find((u) => {
  const meta = u.app_metadata || {};
  return String(meta.invite_code || "").toUpperCase() === CODE;
});
if (owner && owner.id !== SITE_ADMIN_USER_ID) {
  console.error(`El código ${CODE} ya pertenece a ${owner.email || owner.id}. Cámbialo antes.`);
  process.exit(1);
}

const { data, error } = await admin.auth.admin.getUserById(SITE_ADMIN_USER_ID);
if (error || !data.user) {
  console.error(error?.message || "No se encontró la cuenta admin del sitio.");
  process.exit(1);
}

const prev = data.user.app_metadata || {};
const { error: saveErr } = await admin.auth.admin.updateUserById(SITE_ADMIN_USER_ID, {
  app_metadata: {
    ...prev,
    invite_code: CODE,
    invite_unlimited: true,
    invite_referrer_koins: REFERRER_KOINS,
    invite_friend_koins: FRIEND_KOINS,
    invite_signups: Math.max(0, Number(prev.invite_signups) || 0),
  },
});
if (saveErr) {
  console.error(saveErr.message);
  process.exit(1);
}

console.log(`OK: ${CODE} → ${data.user.email || SITE_ADMIN_USER_ID} (ilimitado, ${FRIEND_KOINS} K-oins)`);
console.log(`QR: https://www.mykpopbinder.com/register?invite=${CODE}`);
