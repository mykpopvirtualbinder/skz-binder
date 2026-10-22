import { FaqJsonLd } from "../components/SiteJsonLd";
import { pageMeta } from "@/lib/site-seo";

export const metadata = pageMeta(
  "/faq",
  "Preguntas frecuentes de photocards",
  "Qué significan WTS, WTT y OTW, cómo añadir una photocard que no está en el catálogo y cómo funciona el market.",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FaqJsonLd />
      {children}
    </>
  );
}
