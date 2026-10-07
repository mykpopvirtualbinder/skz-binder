import { supabase } from "@/lib/supabase";
import { ADMIN_QUEUE_SUBJECT } from "@/lib/admin-queue";

const OPEN_STATUS = "status.is.null,status.eq.pendiente,status.eq.gestionando";

function countOf(res: { count: number | null; error: unknown }) {
  if (res.error) return 0;
  return res.count ?? 0;
}

/** Solicitudes, denuncias, buzón y aportaciones que siguen abiertas. */
export async function fetchAdminPendingCount() {
  const [buzon, aportaciones, denuncias, solicitudes] = await Promise.all([
    supabase
      .from("buzon_colaboraciones")
      .select("id", { count: "exact", head: true })
      .neq("asunto", ADMIN_QUEUE_SUBJECT)
      .or(OPEN_STATUS),
    supabase.from("aportaciones_pcs").select("id", { count: "exact", head: true }).or(OPEN_STATUS),
    supabase.from("denuncias").select("id", { count: "exact", head: true }).or("estado.is.null,estado.neq.completada"),
    supabase.from("solicitudes_artistas").select("id", { count: "exact", head: true }),
  ]);

  return countOf(buzon) + countOf(aportaciones) + countOf(denuncias) + countOf(solicitudes);
}
