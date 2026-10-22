import type { Metadata } from "next";

export const SITE_URL = "https://www.mykpopbinder.com";
export const SITE_NAME = "My K-pop Binder";
export const SITE_TITLE = "My K-pop Binder · Collect · Trade · Connect";
export const SITE_DESCRIPTION =
  "Binder digital de photocards K-pop. Organiza tu colección, completa álbumes, intercambia WTS y WTT en el market y conecta con fans. Hecho de fans para fans.";

export const SITE_KEYWORDS = [
  "photocards kpop",
  "binder de photocards",
  "kpop photocard binder",
  "stray kids photocards",
  "comprar photocards",
  "vender photocards",
  "intercambiar photocards",
  "WTS WTT",
  "álbumes kpop",
  "inclusiones kpop",
  "merch kpop",
  "colección photocards",
  "market kpop",
  "My K-pop Binder",
];

export function pageMeta(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
    },
  };
}
