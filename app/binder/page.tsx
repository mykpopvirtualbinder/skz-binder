import { Suspense } from "react";
import BinderClient from "./BinderClient";

export const dynamic = "force-dynamic";

export default function BinderPage() {
  return (
    <Suspense
      fallback={
        <div
          className="binder-page-shell"
          style={{
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-primary)",
            fontWeight: 900,
            gap: "10px",
          }}
        >
  {/* Texto bilingüe rápido para que nadie se sienta excluido durante la carga */}
  <span>CARGANDO BINDER...</span>
  <span style={{ fontSize: "12px", opacity: 0.7 }}>LOADING BINDER...</span>
</div>
      }
    >
      <BinderClient />
    </Suspense>
  );
}