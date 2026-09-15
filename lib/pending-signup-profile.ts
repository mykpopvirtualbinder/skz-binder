import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { syncProfileBiasesAfterSignup } from "@/lib/onboarding-profile-biases";
import { DEFAULT_SITE_PROFILE_AVATAR_URL } from "@/lib/default-profile-avatar";

export const PENDING_SIGNUP_PROFILE_KEY = "mkpb:pendingSignupProfileV1";

export type PendingSignupProfilePayload = {
  v: 1;
  userId?: string | null;
  emailLower: string;
  displayName: string;
  fullName: string;
  phone: string;
  address: string;
  birthdate: string;
  isAdult: boolean;
  legalConsent: boolean;
  language?: string;
  biasesIds: number[];
  selectedGroupIds: number[];
};

export function savePendingSignupProfile(payload: PendingSignupProfilePayload) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_SIGNUP_PROFILE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearPendingSignupProfile() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING_SIGNUP_PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Tras confirmar el email e iniciar sesión, aplica datos del onboarding guardados en localStorage.
 */
export async function applyPendingSignupProfileIfAny(
  supabase: SupabaseClient,
  user: User,
): Promise<{ applied: boolean; error?: string }> {
  if (typeof window === "undefined") return { applied: false };
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_SIGNUP_PROFILE_KEY);
  } catch {
    return { applied: false };
  }
  if (!raw) return { applied: false };

  let pending: PendingSignupProfilePayload;
  try {
    pending = JSON.parse(raw) as PendingSignupProfilePayload;
  } catch {
    clearPendingSignupProfile();
    return { applied: false };
  }
  if (!pending || pending.v !== 1) {
    clearPendingSignupProfile();
    return { applied: false };
  }

  const sessionEmail = (user.email || "").trim().toLowerCase();
  if (pending.emailLower !== sessionEmail) {
    return { applied: false };
  }
  if (pending.userId && pending.userId !== user.id) {
    return { applied: false };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: pending.displayName,
      full_name: pending.fullName,
      phone: pending.phone,
      address: pending.address,
      birthdate: pending.birthdate,
      is_adult: pending.isAdult,
      legal_consent: pending.legalConsent,
      avatar_url: DEFAULT_SITE_PROFILE_AVATAR_URL,
      ...(pending.language ? { language: pending.language } : {}),
    })
    .eq("user_id", user.id);

  if (profileError) {
    return { applied: false, error: profileError.message };
  }

  if (pending.biasesIds.length > 0) {
    const biasRows = pending.biasesIds.map((id) => ({ user_id: user.id, member_id: id }));
    const { error: ubErr } = await supabase.from("user_biases").insert(biasRows);
    if (ubErr) {
      console.error("user_biases insert (pending signup):", ubErr);
    }
  }

  await syncProfileBiasesAfterSignup(
    supabase,
    user.id,
    pending.biasesIds,
    pending.selectedGroupIds ?? [],
  );

  clearPendingSignupProfile();
  return { applied: true };
}
