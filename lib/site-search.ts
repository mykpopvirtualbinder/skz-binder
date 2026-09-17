export type SiteSearchType =
  | "photocard"
  | "merch"
  | "fanart"
  | "user"
  | "album"
  | "group"
  | "shop";

export type SiteSearchHit = {
  type: SiteSearchType;
  id: string;
  title: string;
  subtitle: string | null;
  image: string | null;
  href: string;
};

export function sanitizeSearchQuery(raw: string): string {
  return String(raw || "")
    .replace(/[%(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}

export const SITE_SEARCH_SHOP: Array<{
  id: string;
  title: string;
  subtitle: string;
  href: string;
}> = [
  { id: "vip_month", title: "Suscripción Mensual", subtitle: "Shop", href: "/shop" },
  { id: "vip_year", title: "Suscripción Anual", subtitle: "Shop", href: "/shop" },
  { id: "b_1", title: "+1 Binder Extra", subtitle: "Shop", href: "/shop" },
  { id: "b_3", title: "Pack 3 Binders", subtitle: "Shop", href: "/shop" },
  { id: "b_6", title: "Pack 6 Binders", subtitle: "Shop", href: "/shop" },
  { id: "p_3", title: "Pack 3 Páginas", subtitle: "Shop", href: "/shop" },
  { id: "p_6", title: "Pack 6 Páginas", subtitle: "Shop", href: "/shop" },
  { id: "p_9", title: "Pack 9 Páginas", subtitle: "Shop", href: "/shop" },
  { id: "p_12", title: "Pack 12 Páginas", subtitle: "Shop", href: "/shop" },
  { id: "s_5", title: "Pack 5 Separadores", subtitle: "Shop", href: "/shop" },
  { id: "s_10", title: "Pack 10 Separadores", subtitle: "Shop", href: "/shop" },
  { id: "k_500", title: "Pack 500 K-oins", subtitle: "Shop", href: "/shop" },
  { id: "k_1200", title: "Pack 1,200 K-oins", subtitle: "Shop", href: "/shop" },
  { id: "k_3000", title: "Pack 3,000 K-oins", subtitle: "Shop", href: "/shop" },
];
