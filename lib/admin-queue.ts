export const ADMIN_QUEUE_SUBJECT = "admin-queue";

export type QueueKind = "solicitud" | "denuncia" | "aportacion";

export type QueueStatus =
  | "pendiente"
  | "en_proceso"
  | "aprobada"
  | "denegada"
  | "en_investigacion"
  | "revisar_reactivacion"
  | "completada";

export type GestorId = "ana" | "paula" | "silvia";

export type QueueEvent = {
  at: string;
  actor: string;
  action: string;
  detail: string;
};

export type QueueCase = {
  rowId?: string;
  leido: boolean;
  status: QueueStatus;
  gestor: GestorId | null;
  historial: QueueEvent[];
};

export const GESTORES: { id: GestorId; label: string }[] = [
  { id: "ana", label: "Ana" },
  { id: "paula", label: "Paula" },
  { id: "silvia", label: "Silvia" },
];

export const CORE_STATUSES: { id: QueueStatus; label: string }[] = [
  { id: "pendiente", label: "Pendiente" },
  { id: "en_proceso", label: "En proceso" },
  { id: "aprobada", label: "Aprobada" },
  { id: "denegada", label: "Denegada" },
];

export const DENUNCIA_STATUSES: { id: QueueStatus; label: string }[] = [
  ...CORE_STATUSES,
  { id: "en_investigacion", label: "En investigación" },
  { id: "revisar_reactivacion", label: "Revisar reactivación" },
  { id: "completada", label: "Completada" },
];

export function statusesFor(queue: QueueKind) {
  return queue === "denuncia" ? DENUNCIA_STATUSES : CORE_STATUSES;
}

export function statusLabel(status: string) {
  return DENUNCIA_STATUSES.find((s) => s.id === status)?.label || status;
}

export function gestorLabel(id: string | null | undefined) {
  return GESTORES.find((g) => g.id === id)?.label || "Sin asignar";
}

export function queueKey(queue: QueueKind, caseId: string) {
  return `${queue}:${caseId}`;
}

export function actorFromEmail(email: string | null | undefined) {
  const n = (email || "").trim().toLowerCase();
  if (n.includes("paula.azules")) return "Paula";
  if (n.includes("mysafekspace")) return "Silvia";
  if (n.includes("jimena")) return "Jimena";
  if (n.includes("anabmtnez") || n === "info@mykpopbinder.com") return "Ana";
  return "Equipo";
}

export function normalizeStatus(raw: string | null | undefined): QueueStatus {
  const value = (raw || "pendiente").toLowerCase();
  if (value === "rechazada") return "denegada";
  if (value === "gestionando") return "en_proceso";
  if (DENUNCIA_STATUSES.some((s) => s.id === value)) return value as QueueStatus;
  return "pendiente";
}

export function emptyCase(nativeStatus?: string | null): QueueCase {
  return {
    leido: false,
    status: normalizeStatus(nativeStatus),
    gestor: null,
    historial: [],
  };
}

export function parseQueueMessage(raw: string | null | undefined): Omit<QueueCase, "rowId"> | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return {
      leido: Boolean(data.leido),
      status: normalizeStatus(data.status),
      gestor: GESTORES.some((g) => g.id === data.gestor) ? data.gestor : null,
      historial: Array.isArray(data.historial)
        ? data.historial.filter((ev: QueueEvent) => ev && ev.at && ev.action)
        : [],
    };
  } catch {
    return null;
  }
}

export function aportacionNativeStatus(status: QueueStatus) {
  if (status === "aprobada") return "aprobada";
  if (status === "denegada") return "rechazada";
  return "pendiente";
}
