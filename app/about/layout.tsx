import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About us · My K-pop Binder",
  description: "The story behind MyKpopBinder, written by the three fans who built it.",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
