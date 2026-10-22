import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin-panel", "/me", "/api/", "/login", "/register", "/update-password", "/studio", "/user/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
