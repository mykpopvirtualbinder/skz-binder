"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import ShopClient from "./ShopClient";

export default function ShopPage() {
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
      <ShopClient />
    </Suspense>
  );
}