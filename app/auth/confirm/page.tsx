import type { Metadata } from "next";
import { Suspense } from "react";
import ConfirmClient from "./ConfirmClient";

export const metadata: Metadata = {
  title: "Confirmar cuenta",
  robots: { index: false, follow: false },
};

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmClient />
    </Suspense>
  );
}
