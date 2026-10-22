import { pageMeta } from "@/lib/site-seo";

export const metadata = pageMeta(
  "/albums",
  "Álbumes e inclusiones K-pop",
  "Ediciones, versiones e inclusiones de álbumes K-pop. Mira qué photocard trae cada versión y completa la tuya.",
);
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
