"use client";

import { Suspense } from "react";
import PageLoading from "../components/PageLoading";
import MarketClient from "./MarketClient";

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MarketClient />
    </Suspense>
  );
}
