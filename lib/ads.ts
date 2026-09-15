import { supabase } from "@/lib/supabase";

export type AdPlacement =
  | "sidebar_left"
  | "sidebar_right"
  | "tablet_sidebar"
  | "mobile_inline_top"
  | "mobile_inline_bottom";

export type AdDevice = "desktop" | "tablet" | "mobile";

export type AdCampaign = {
  id: string;
  title: string;
  subtitle?: string | null;
  image_url?: string | null;
  target_url: string;
  placement: AdPlacement;
  device: AdDevice;
  section?: string | null;
  priority?: number | null;
};

const FALLBACK_ADS: AdCampaign[] = [
  {
    id: "fallback-desktop-left",
    title: "Tu tienda K-pop aqui",
    subtitle: "Promociona albums, merch y eventos",
    image_url: null,
    target_url: "/report",
    placement: "sidebar_left",
    device: "desktop",
    section: "all",
    priority: 1,
  },
  {
    id: "fallback-desktop-right",
    title: "Espacio para artistas",
    subtitle: "Comisiones, prints y fanart patrocinado",
    image_url: null,
    target_url: "/studio",
    placement: "sidebar_right",
    device: "desktop",
    section: "all",
    priority: 1,
  },
  {
    id: "fallback-desktop-left-2",
    title: "Eventos y cupsleeves",
    subtitle: "Promociona tu evento K-pop local",
    image_url: null,
    target_url: "/fanzone",
    placement: "sidebar_left",
    device: "desktop",
    section: "all",
    priority: 1,
  },
  {
    id: "fallback-desktop-right-2",
    title: "Tiendas recomendadas",
    subtitle: "Merch oficial y fanmade de confianza",
    image_url: null,
    target_url: "/merch",
    placement: "sidebar_right",
    device: "desktop",
    section: "all",
    priority: 1,
  },
  {
    id: "fallback-tablet",
    title: "Anunciate en MyKpopBinder",
    subtitle: "Llega a una comunidad kpop real",
    image_url: null,
    target_url: "/report",
    placement: "tablet_sidebar",
    device: "tablet",
    section: "all",
    priority: 1,
  },
  {
    id: "fallback-mobile-top",
    title: "Patrocinado",
    subtitle: "Comercios amigos y artistas",
    image_url: null,
    target_url: "/report",
    placement: "mobile_inline_top",
    device: "mobile",
    section: "all",
    priority: 1,
  },
  {
    id: "fallback-mobile-bottom",
    title: "Reserva tu espacio",
    subtitle: "Publicidad para empresas K-pop",
    image_url: null,
    target_url: "/report",
    placement: "mobile_inline_bottom",
    device: "mobile",
    section: "all",
    priority: 1,
  },
];

const cache = new Map<string, AdCampaign[]>();

function cacheKey(placement: AdPlacement, device: AdDevice, section: string) {
  return `${placement}:${device}:${section}`;
}

function fallbackFor(placement: AdPlacement, device: AdDevice, section: string) {
  return FALLBACK_ADS.filter(
    (ad) =>
      ad.placement === placement &&
      ad.device === device &&
      (ad.section === "all" || ad.section === section)
  );
}

export async function loadAdsForSlot(
  placement: AdPlacement,
  device: AdDevice,
  section = "all"
): Promise<AdCampaign[]> {
  const key = cacheKey(placement, device, section);
  if (cache.has(key)) return cache.get(key)!;

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("ad_campaigns")
      .select("id,title,subtitle,image_url,target_url,placement,device,section,priority")
      .eq("active", true)
      .eq("placement", placement)
      .eq("device", device)
      .lte("start_at", nowIso)
      .gte("end_at", nowIso)
      .order("priority", { ascending: false })
      .limit(6);

    if (error || !Array.isArray(data) || data.length === 0) {
      const fallback = fallbackFor(placement, device, section);
      cache.set(key, fallback);
      return fallback;
    }

    const scoped = data.filter((ad: any) => !ad.section || ad.section === "all" || ad.section === section);
    const result = scoped.length ? scoped : fallbackFor(placement, device, section);
    cache.set(key, result);
    return result as AdCampaign[];
  } catch {
    const fallback = fallbackFor(placement, device, section);
    cache.set(key, fallback);
    return fallback;
  }
}
