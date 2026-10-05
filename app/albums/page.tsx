"use client";

import { Suspense } from "react";
import PageLoading from "../components/PageLoading";
import AlbumsPageClient from "./AlbumsPageClient";

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AlbumsPageClient />
    </Suspense>
  );
}
