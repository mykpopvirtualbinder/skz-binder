"use client";

import { Suspense } from "react";
import PageLoading from "./components/PageLoading";
import HomeClient from "./HomeClient";

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <HomeClient />
    </Suspense>
  );
}
