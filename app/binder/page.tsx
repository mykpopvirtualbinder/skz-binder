import { Suspense } from "react";
import BinderClient from "./BinderClient";
import PageLoading from "../components/PageLoading";

export const dynamic = "force-dynamic";

export default function BinderPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <BinderClient />
    </Suspense>
  );
}
