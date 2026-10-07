import { supabase } from "@/lib/supabase";
import { ADMIN_QUEUE_SUBJECT } from "@/lib/admin-queue";

const OPEN_STATUS = "status.is.null,status.eq.pendiente,status.eq.gestionando";

function countOf(res: { count: number | null; error: unknown }) {
  if (res.error) return 0;
  return res.count ?? 0;
}

export type AdminPendingByArea = {
  solicitudes: number;
  denuncias: number;
  buzon: number;
  aportaciones: number;
};

/** Los mismos criterios que el sobre del header, partido por área. */
export async function fetchAdminPendingByArea(): Promise<AdminPendingByArea> {
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

  return {
    solicitudes: countOf(solicitudes),
    denuncias: countOf(denuncias),
    buzon: countOf(buzon),
    aportaciones: countOf(aportaciones),
  };
}

/** Solicitudes, denuncias, buzón y aportaciones que siguen abiertas. */
export async function fetchAdminPendingCount() {
  const areas = await fetchAdminPendingByArea();
  return areas.solicitudes + areas.denuncias + areas.buzon + areas.aportaciones;
}
