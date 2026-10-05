"use client";

import { Suspense } from "react";
import PageLoading from "../components/PageLoading";
import ShopClient from "./ShopClient";

export default function ShopPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ShopClient />
    </Suspense>
  );
}
