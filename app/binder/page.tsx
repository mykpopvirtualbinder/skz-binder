import { Suspense } from "react";
import BinderClient from "./BinderClient";
import { supabase } from "@/lib/supabase";
export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Cargando binder…</div>}>
      <BinderClient />
    </Suspense>
  );
}