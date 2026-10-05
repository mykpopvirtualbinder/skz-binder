"use client";

import { Suspense } from "react";
import PageLoading from "../components/PageLoading";
import LibraryClient from "./LibraryPageClient";

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <LibraryClient />
    </Suspense>
  );
}
