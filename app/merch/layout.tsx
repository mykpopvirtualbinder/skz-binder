import { pageMeta } from "@/lib/site-seo";

export const metadata = pageMeta(
  "/merch",
  "Merch K-pop para tu colección",
  "Catálogo de merch K-pop: polaroids, playing cards y piezas de álbum para organizar junto a tus photocards.",
);
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
