import { Suspense } from "react";
import AdminPanelClient from "./AdminPanelClient";

export const dynamic = "force-dynamic";

export default function AdminPanelPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-primary)",
            fontWeight: 900,
          }}
        >
          Cargando panel de administración...
        </div>
      }
    >
      <AdminPanelClient />
    </Suspense>
  );
}