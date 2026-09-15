/** Catálogo de la tienda (servidor + cliente). Precios en EUR tal como en la UI. */

export type ShopProductId =
  | "vip_month"
  | "vip_year"
  | "k_500"
  | "k_1200"
  | "k_3000"
  | "b_1"
  | "b_3"
  | "b_6"
  | "p_3"
  | "p_6"
  | "p_9"
  | "p_12"
  | "s_5"
  | "s_10"
  | "s_15"
  | "s_20";

export type ShopProductRow = {
  id: ShopProductId;
  name: string;
  baseEur: number;
  vipEur?: number;
  isSub: boolean;
  koinsAmount?: number;
};

export const SHOP_PRODUCTS: ShopProductRow[] = [
  { id: "vip_month", name: "Suscripción Mensual", baseEur: 2.99, isSub: true },
  { id: "vip_year", name: "Suscripción Anual", baseEur: 29.9, isSub: true },
  { id: "b_1", name: "+1 Binder Extra", baseEur: 1.99, vipEur: 0.99, isSub: false },
  { id: "b_3", name: "Pack 3 Binders", baseEur: 4.99, vipEur: 2.49, isSub: false },
  { id: "b_6", name: "Pack 6 Binders", baseEur: 8.99, vipEur: 4.49, isSub: false },
  { id: "p_3", name: "Pack 3 Páginas", baseEur: 0.99, vipEur: 0.49, isSub: false },
  { id: "p_6", name: "Pack 6 Páginas", baseEur: 1.49, vipEur: 0.79, isSub: false },
  { id: "p_9", name: "Pack 9 Páginas", baseEur: 1.99, vipEur: 0.99, isSub: false },
  { id: "p_12", name: "Pack 12 Páginas", baseEur: 2.49, vipEur: 1.25, isSub: false },
  { id: "s_5", name: "Pack 5 Separadores", baseEur: 0.99, vipEur: 0.49, isSub: false },
  { id: "s_10", name: "Pack 10 Separadores", baseEur: 1.49, vipEur: 0.79, isSub: false },
  { id: "s_15", name: "Pack 15 Separadores", baseEur: 1.99, vipEur: 0.99, isSub: false },
  { id: "s_20", name: "Pack 20 Separadores", baseEur: 2.49, vipEur: 1.25, isSub: false },
  { id: "k_500", name: "Pack 500 K-oins", baseEur: 4.99, isSub: false, koinsAmount: 500 },
  { id: "k_1200", name: "Pack 1,200 K-oins", baseEur: 9.99, isSub: false, koinsAmount: 1200 },
  { id: "k_3000", name: "Pack 3,000 K-oins", baseEur: 24.99, isSub: false, koinsAmount: 3000 },
];

const BY_ID = Object.fromEntries(SHOP_PRODUCTS.map((p) => [p.id, p])) as Record<
  ShopProductId,
  ShopProductRow
>;

export function getShopProduct(id: string): ShopProductRow | null {
  return BY_ID[id as ShopProductId] ?? null;
}

const LIMITS = {
  free: { binders: 3, pages: 30, separators: 5 },
  mensual: { binders: 15, pages: 60, separators: 15 },
  anual: { binders: 50, pages: 90, separators: 30 },
} as const;

export type UsageCounts = { binders: number; pages: number; separators: number };

export type ProfileForPricing = {
  plan_type?: string | null;
};

function packSizeFromProductId(id: ShopProductId): number {
  const m = id.match(/^(?:b|p|s)_(\d+)$/);
  if (m) return parseInt(m[1], 10);
  return 1;
}

function fitsFreePlan(
  id: ShopProductId,
  used: UsageCounts,
  userBase: (typeof LIMITS)[keyof typeof LIMITS]
): boolean {
  const n = packSizeFromProductId(id);
  if (id.startsWith("b_")) return used.binders + n <= userBase.binders;
  if (id.startsWith("p_")) return used.pages + n <= userBase.pages;
  if (id.startsWith("s_")) return used.separators + n <= userBase.separators;
  return false;
}

/**
 * Precio EUR efectivo para Stripe (misma lógica que ShopClient).
 * `isUserVip` debe reflejar premium en DB o equipo VIP por email.
 * Devuelve null si no aplica cobro (gratis VIP dentro del plan).
 */
export function getShopEuroPriceForCheckout(
  product: ShopProductRow,
  profile: ProfileForPricing,
  used: UsageCounts,
  flags: { isUserVip: boolean; isAdmin: boolean }
): number | null {
  const { isUserVip, isAdmin } = flags;
  const rawPlan = (profile.plan_type || "free").toLowerCase().trim();
  const effectivePlan =
    isUserVip && rawPlan === "free" ? "mensual" : rawPlan in LIMITS
      ? (rawPlan as keyof typeof LIMITS)
      : "free";
  const userBaseLimit = LIMITS[effectivePlan];

  const cabeEnPlanGratis =
    (isAdmin || isUserVip) &&
    !product.isSub &&
    !product.id.startsWith("k_") &&
    fitsFreePlan(product.id, used, userBaseLimit);

  if (cabeEnPlanGratis) return null;

  if (product.id.startsWith("k_")) return product.baseEur;
  if (isUserVip && product.vipEur != null) return product.vipEur;
  return product.baseEur;
}

export function applyDiscountPercent(euro: number, percent: number): number {
  const p = Math.min(100, Math.max(0, percent));
  return Math.round(euro * (1 - p / 100) * 100) / 100;
}

export function parseDiscountPercent(code: string | undefined | null): number {
  const c = (code || "").toUpperCase().trim();
  if (c === "CUMPLE100") return 100;
  if (c === "MKB50") return 50;
  return 0;
}
