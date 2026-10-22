import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-seo";

const PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/library", priority: 0.9, changeFrequency: "daily" },
  { path: "/albums", priority: 0.9, changeFrequency: "daily" },
  { path: "/market", priority: 0.9, changeFrequency: "daily" },
  { path: "/merch", priority: 0.8, changeFrequency: "weekly" },
  { path: "/binders", priority: 0.8, changeFrequency: "weekly" },
  { path: "/shop", priority: 0.7, changeFrequency: "weekly" },
  { path: "/fanart", priority: 0.7, changeFrequency: "weekly" },
  { path: "/fanzone", priority: 0.7, changeFrequency: "daily" },
  { path: "/guia", priority: 0.6, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  { path: "/artista-del-mes", priority: 0.5, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/market-rules", priority: 0.3, changeFrequency: "yearly" },
  { path: "/community-rules", priority: 0.3, changeFrequency: "yearly" },
  { path: "/anti-scam", priority: 0.3, changeFrequency: "yearly" },
  { path: "/copyright", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map((page) => ({
    url: `${SITE_URL}${page.path === "/" ? "" : page.path}`,
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
