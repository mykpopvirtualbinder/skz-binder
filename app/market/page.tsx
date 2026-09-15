"use client";

import React, { Suspense } from "react"; // 👈 Añadido React y Suspense
import { Loader2 } from "lucide-react";    // 👈 Añadido Loader2
import MarketClient from "./MarketClient";  // 👈 Añadido MarketClient

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "var(--bg-main)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background-color 0.3s ease"
          }}
        >
          <Loader2
            size={40}
            color="var(--color-primary)"
            style={{ animation: "spin 1s linear infinite" }}
          />
        </div>
      }
    >
      <MarketClient />
    </Suspense>
  );
}