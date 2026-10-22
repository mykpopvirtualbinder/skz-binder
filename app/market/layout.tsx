import { pageMeta } from "@/lib/site-seo";

export const metadata = pageMeta(
  "/market",
  "Market de photocards K-pop",
  "Compra, vende e intercambia photocards. Publica WTS y WTT y encuentra a quien tiene la carta que te falta.",
);
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
