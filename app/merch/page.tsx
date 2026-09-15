"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import MerchClient from "./MerchClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "var(--bg-main)", // 👈 Antes var(--bg-main)
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background-color 0.3s ease" // 👈 Suavizamos el cambio de tema
          }}
        >
          <Loader2
            size={40}
            color="var(--color-primary)" // 👈 Antes var(--color-primary)
            style={{ animation: "spin 1s linear infinite" }}
          />
        </div>
      }
    >
      <MerchClient />
    </Suspense>
  );
}