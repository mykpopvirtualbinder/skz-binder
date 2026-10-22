import { pageMeta } from "@/lib/site-seo";

export const metadata = pageMeta(
  "/fanzone",
  "Fanzone de coleccionistas K-pop",
  "Entra en la comunidad: publica, comenta y conecta con otros fans de photocards y álbumes K-pop.",
);
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
