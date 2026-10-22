import { pageMeta } from "@/lib/site-seo";

export const metadata = pageMeta(
  "/shop",
  "Shop VIP para tu binder",
  "Pasa a VIP y amplía tu binder digital: páginas, separadores y extras para la colección de photocards.",
);
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
