import { pageMeta } from "@/lib/site-seo";

export const metadata = pageMeta(
  "/guia",
  "Guía para usar My K-pop Binder",
  "Aprende a organizar photocards, usar el market, crear grupos propios y sacar partido a todo lo que ya está en la web.",
);
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
