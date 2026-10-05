"use client";

import { Suspense } from "react";
import PageLoading from "../components/PageLoading";
import FanArtClient from "./FanartClient";

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FanArtClient />
    </Suspense>
  );
}
