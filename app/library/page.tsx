"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import LibraryClient from "./LibraryPageClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "var(--bg-main)", // 👈 Camaleón activado
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background-color 0.3s ease"
          }}
        >
          <Loader2
            size={40}
            color="var(--color-primary)" // 👈 Icono con el color del tema
            style={{ animation: "spin 1s linear infinite" }}
          />
        </div>
      }
    >
      <LibraryClient />
    </Suspense>
  );
}