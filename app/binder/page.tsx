import { Suspense } from "react";
import BinderClient from "./BinderClient";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Cargando binder…</div>}>
      <BinderClient />
    </Suspense>
  );
}