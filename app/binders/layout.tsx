import { pageMeta } from "@/lib/site-seo";

export const metadata = pageMeta(
  "/binders",
  "Crea tu binder digital de photocards",
  "Monta las páginas de tu binder, ordena tu colección de photocards y tenla siempre a mano para enseñarla o completarla.",
);
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
