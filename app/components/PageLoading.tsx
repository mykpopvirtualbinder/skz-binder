"use client";

import CatalogLoadingFun from "./CatalogLoadingFun";

export default function PageLoading({ title }: { title?: string }) {
  return <CatalogLoadingFun title={title} fullPage />;
}
