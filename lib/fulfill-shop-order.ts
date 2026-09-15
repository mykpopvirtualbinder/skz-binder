import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShopProductId } from "@/lib/shop-catalog";

function bindersToInsertCount(productId: ShopProductId): number {
  if (productId === "b_1") return 1;
  if (productId === "b_3") return 3;
  if (productId === "b_6") return 6;
  return 0;
}

function pagesPack(productId: ShopProductId): number {
  const m = productId.match(/^p_(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function separatorsPack(productId: ShopProductId): number {
  const m = productId.match(/^s_(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function koinsPack(productId: ShopProductId): number {
  if (productId === "k_500") return 500;
  if (productId === "k_1200") return 1200;
  if (productId === "k_3000") return 3000;
  return 0;
}

const VIP_WELCOME_KOINS = {
  monthly: 300,
  yearly: 1800,
} as const;

/**
 * Aplica la compra en Supabase (llamar solo tras pago verificado, p. ej. webhook Stripe).
 */
export async function fulfillShopProduct(
  admin: SupabaseClient,
  userId: string,
  productId: ShopProductId
): Promise<void> {
  const { data: profile, error: readErr } = await admin
    .from("profiles")
    .select("puntos, extra_binders, extra_pages, extra_separators, is_premium")
    .eq("user_id", userId)
    .single();

  if (readErr || !profile) {
    throw new Error(readErr?.message || "Profile not found");
  }

  if (productId.startsWith("k_")) {
    const add = koinsPack(productId);
    if (add <= 0) throw new Error("Invalid koins product");
    const next = (Number(profile.puntos) || 0) + add;
    const { error } = await admin.from("profiles").update({ puntos: next }).eq("user_id", userId);
    if (error) throw error;
    return;
  }

  if (productId.startsWith("b_")) {
    const n = bindersToInsertCount(productId);
    if (n <= 0) throw new Error("Invalid binders product");
    const rows = Array.from({ length: n }).map(() => ({
      user_id: userId,
      title: "NUEVO BINDER",
      color: "var(--color-border)",
      public_customization: true,
    }));
    const { error: insErr } = await admin.from("binders").insert(rows);
    if (insErr) throw insErr;
    const extra = (Number(profile.extra_binders) || 0) + n;
    const { error } = await admin.from("profiles").update({ extra_binders: extra }).eq("user_id", userId);
    if (error) throw error;
    return;
  }

  if (productId.startsWith("p_")) {
    const add = pagesPack(productId);
    if (add <= 0) throw new Error("Invalid pages product");
    const extra = (Number(profile.extra_pages) || 0) + add;
    const { error } = await admin.from("profiles").update({ extra_pages: extra }).eq("user_id", userId);
    if (error) throw error;
    return;
  }

  if (productId.startsWith("s_")) {
    const add = separatorsPack(productId);
    if (add <= 0) throw new Error("Invalid separators product");
    const extra = (Number(profile.extra_separators) || 0) + add;
    const { error } = await admin.from("profiles").update({ extra_separators: extra }).eq("user_id", userId);
    if (error) throw error;
    return;
  }

  if (productId === "vip_month") {
    const bonus = !profile.is_premium ? VIP_WELCOME_KOINS.monthly : 0;
    const { error } = await admin
      .from("profiles")
      .update({
        is_premium: true,
        plan_type: "mensual",
        puntos: (Number(profile.puntos) || 0) + bonus,
      })
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  if (productId === "vip_year") {
    const bonus = !profile.is_premium ? VIP_WELCOME_KOINS.yearly : 0;
    const { error } = await admin
      .from("profiles")
      .update({
        is_premium: true,
        plan_type: "anual",
        puntos: (Number(profile.puntos) || 0) + bonus,
      })
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  throw new Error(`Unknown product: ${productId}`);
}
