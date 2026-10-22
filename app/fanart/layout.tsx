import { pageMeta } from "@/lib/site-seo";

export const metadata = pageMeta(
  "/fanart",
  "Fanart de la comunidad K-pop",
  "Mira y comparte fanart de la comunidad. Un rincón de fans para fans, junto a tu colección de photocards.",
);
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
