"use client";

import { Suspense } from "react";
import PageLoading from "../components/PageLoading";
import MerchClient from "./MerchClient";

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MerchClient />
    </Suspense>
  );
}
