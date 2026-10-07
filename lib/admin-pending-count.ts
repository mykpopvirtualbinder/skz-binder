import { supabase } from "@/lib/supabase";
import { ADMIN_QUEUE_SUBJECT, parseQueueMessage } from "@/lib/admin-queue";

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

/** Hilos abiertos que nadie del equipo ha abierto todavía. */
async function countUnreadBuzon() {
  const [{ data: openRows, error: openError }, { data: reads, error: readError }] = await Promise.all([
    supabase
      .from("buzon_colaboraciones")
      .select("id")
      .neq("asunto", ADMIN_QUEUE_SUBJECT)
      .or(OPEN_STATUS)
      .limit(1000),
    supabase
      .from("buzon_colaboraciones")
      .select("email,mensaje")
      .eq("asunto", ADMIN_QUEUE_SUBJECT)
      .like("email", "buzon:%")
      .limit(1000),
  ]);
  if (openError || !openRows) return 0;
  const readIds = new Set<string>();
  if (!readError && reads) {
    for (const row of reads) {
      const parsed = parseQueueMessage(row.mensaje);
      if (!parsed?.leido || !row.email) continue;
      const prefix = "buzon:";
      if (row.email.startsWith(prefix)) readIds.add(row.email.slice(prefix.length));
    }
  }
  return openRows.filter((row) => !readIds.has(String(row.id))).length;
}

/** Los mismos criterios que el sobre del header, partido por área. El buzón cuenta solo lo no leído. */
export async function fetchAdminPendingByArea(): Promise<AdminPendingByArea> {
  const [buzon, aportaciones, denuncias, solicitudes] = await Promise.all([
    countUnreadBuzon(),
    supabase.from("aportaciones_pcs").select("id", { count: "exact", head: true }).or(OPEN_STATUS),
    supabase.from("denuncias").select("id", { count: "exact", head: true }).or("estado.is.null,estado.neq.completada"),
    supabase.from("solicitudes_artistas").select("id", { count: "exact", head: true }),
  ]);

  return {
    solicitudes: countOf(solicitudes),
    denuncias: countOf(denuncias),
    buzon,
    aportaciones: countOf(aportaciones),
  };
}

/** Solicitudes, denuncias, buzón y aportaciones que siguen abiertas. */
export async function fetchAdminPendingCount() {
  const areas = await fetchAdminPendingByArea();
  return areas.solicitudes + areas.denuncias + areas.buzon + areas.aportaciones;
}
