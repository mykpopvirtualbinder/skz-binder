export type BinderPlanKind = "free" | "premium" | "admin";

export type BinderQuota = {
  kind: BinderPlanKind;
  maxPages: number;
  maxSeparators: number;
  maxBinders: number;
  pagesLabel: string;
  separatorsLabel: string;
  bindersLabel: string;
};

const FREE = { binders: 3, pages: 5, separators: 5 };
const PREMIUM = { binders: 50, pages: 100, separators: 100 };

export function isPremiumPlan(
  planType?: string | null,
  isPremiumFlag?: boolean | null
): boolean {
  const raw = String(planType || "free").toLowerCase().trim();
  return Boolean(isPremiumFlag) || raw === "mensual" || raw === "anual" || raw === "premium";
}

export function resolveBinderQuota(opts: {
  planType?: string | null;
  isPremium?: boolean | null;
  isAdmin?: boolean;
  extraPages?: number;
  extraSeparators?: number;
  extraBinders?: number;
}): BinderQuota {
  if (opts.isAdmin) {
    return {
      kind: "admin",
      maxPages: Number.POSITIVE_INFINITY,
      maxSeparators: Number.POSITIVE_INFINITY,
      maxBinders: Number.POSITIVE_INFINITY,
      pagesLabel: "∞",
      separatorsLabel: "∞",
      bindersLabel: "∞",
    };
  }
  const premium = isPremiumPlan(opts.planType, opts.isPremium);
  const base = premium ? PREMIUM : FREE;
  const maxPages = base.pages + (opts.extraPages || 0);
  const maxSeparators = base.separators + (opts.extraSeparators || 0);
  const maxBinders = base.binders + (opts.extraBinders || 0);
  return {
    kind: premium ? "premium" : "free",
    maxPages,
    maxSeparators,
    maxBinders,
    pagesLabel: String(maxPages),
    separatorsLabel: String(maxSeparators),
    bindersLabel: String(maxBinders),
  };
}

export function formatQuota(used: number, max: number): string {
  return Number.isFinite(max) ? `${used}/${max}` : `${used}/∞`;
}

export function unpackSeparatorColors(raw?: string | null): {
  fill: string | null;
  border: string | null;
} {
  if (!raw) return { fill: null, border: null };
  if (raw.includes("|")) {
    const [fill, border] = raw.split("|");
    return {
      fill: !fill || fill === "none" ? null : fill,
      border: !border || border === "none" ? null : border,
    };
  }
  return { fill: raw, border: raw };
}

export function packSeparatorColors(fill: string | null, border: string | null): string {
  return `${fill || "none"}|${border || "none"}`;
}
