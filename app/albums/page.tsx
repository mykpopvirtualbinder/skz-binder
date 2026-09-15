"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import AlbumsPageClient from "./AlbumsPageClient";

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
          }}
        >
          <Loader2 size={40} color="var(--color-primary)" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      }
    >
      <AlbumsPageClient />
    </Suspense>
  );
}
