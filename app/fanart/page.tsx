"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import FanArtClient from "./FanartClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "var(--bg-main)", // 👈 Fondo dinámico
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background-color 0.3s ease"
          }}
        >
          <Loader2
            size={40}
            color="var(--color-primary)" // 👈 Color dinámico para el icono
            style={{ animation: "spin 1s linear infinite" }}
          />
        </div>
      }
    >
      <FanArtClient />
    </Suspense>
  );
}