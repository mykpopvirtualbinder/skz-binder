import { pageMeta } from "@/lib/site-seo";

export const metadata = pageMeta(
  "/library",
  "Biblioteca de photocards K-pop",
  "Explora el catálogo de photocards, filtra por grupo, álbum y miembro, y marca lo que tienes, lo que buscas y lo que te falta.",
);
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
