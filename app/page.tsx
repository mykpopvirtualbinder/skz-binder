"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import HomeClient from "./HomeClient";

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
            transition: "background-color 0.3s ease" // 👈 Transición suave para el tema
          }}
        >
          <Loader2
            size={40}
            color="var(--color-primary)"
            style={{ animation: "spin 1s linear infinite" }}
          />
          <style jsx>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}