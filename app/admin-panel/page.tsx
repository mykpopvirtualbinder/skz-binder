import { Suspense } from "react";
import AdminPanelClient from "./AdminPanelClient";
import PageLoading from "../components/PageLoading";

export const dynamic = "force-dynamic";

export default function AdminPanelPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminPanelClient />
    </Suspense>
  );
}
