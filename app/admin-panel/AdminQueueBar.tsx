"use client";

import { useState, type CSSProperties } from "react";
import {
  CORE_STATUSES,
  DENUNCIA_STATUSES,
  GESTORES,
  gestorLabel,
  statusLabel,
  type GestorId,
  type QueueCase,
  type QueueEvent,
  type QueueKind,
  type QueueStatus,
} from "@/lib/admin-queue";

const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--bg-main)",
  border: "1px solid var(--color-border)",
  borderRadius: 999,
  padding: "6px 10px",
  color: "var(--color-primary)",
  fontSize: 12,
  fontWeight: 800,
};

export function AdminQueueFilters({
  queue,
  status,
  gestor,
  userQuery,
  onStatus,
  onGestor,
  onUserQuery,
  events,
}: {
  queue: QueueKind;
  status: string;
  gestor: string;
  userQuery: string;
  onStatus: (value: string) => void;
  onGestor: (value: string) => void;
  onUserQuery: (value: string) => void;
  events: { at: string; actor: string; action: string; detail: string; caseLabel: string }[];
}) {
  const [open, setOpen] = useState(false);
  const statuses = queue === "denuncia" ? DENUNCIA_STATUSES : CORE_STATUSES;
  const visible = events.filter((ev) => gestor === "todos" || ev.actor === gestorLabel(gestor));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <label style={chip}>
          Estado
          <select value={status} onChange={(e) => onStatus(e.target.value)} style={{ border: "none", background: "transparent", color: "var(--text-main)", fontWeight: 800, outline: "none" }}>
            <option value="todos">Todos</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <label style={chip}>
          Quién gestiona
          <select value={gestor} onChange={(e) => onGestor(e.target.value)} style={{ border: "none", background: "transparent", color: "var(--text-main)", fontWeight: 800, outline: "none" }}>
            <option value="todos">Todas</option>
            <option value="sin_asignar">Sin asignar</option>
            {GESTORES.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </label>
        <input
          value={userQuery}
          onChange={(e) => onUserQuery(e.target.value)}
          placeholder="Filtrar por usuario"
          style={{ ...chip, minWidth: 180, color: "var(--text-main)", outline: "none" }}
        />
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ ...chip, cursor: "pointer" }}>
          {open ? "Ocultar historial" : "Historial de acciones"}
        </button>
      </div>
      {open && (
        <div style={{ background: "var(--bg-main)", border: "1px dashed var(--color-border)", borderRadius: 14, padding: 12, maxHeight: 220, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
            {gestor === "todos" ? "Acciones del equipo" : `Acciones de ${gestorLabel(gestor)}`}
          </div>
          {visible.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 700, fontSize: 13 }}>Todavía no hay acciones con este filtro.</p>
          ) : (
            visible.map((ev, i) => (
              <div key={`${ev.at}-${i}`} style={{ display: "grid", gridTemplateColumns: "148px 72px 1fr", gap: 8, fontSize: 12, padding: "6px 0", borderTop: i ? "1px solid var(--color-border)" : "none" }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>{new Date(ev.at).toLocaleString()}</span>
                <span style={{ color: "var(--color-primary)", fontWeight: 900 }}>{ev.actor}</span>
                <span style={{ color: "var(--text-main)", fontWeight: 700 }}>{ev.caseLabel}: {ev.detail}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function AdminQueueBar({
  queue,
  state,
  busy,
  onPatch,
}: {
  queue: QueueKind;
  state: QueueCase;
  busy?: boolean;
  onPatch: (patch: Partial<Pick<QueueCase, "leido" | "status" | "gestor">>, action: string, detail: string) => void;
}) {
  const statuses = statusesOf(queue);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <button
        type="button"
        disabled={busy}
        onClick={() => onPatch({ leido: !state.leido }, "lectura", state.leido ? "Marcada como no leída" : "Marcada como leída")}
        style={{
          ...chip,
          cursor: busy ? "wait" : "pointer",
          background: state.leido ? "var(--bg-soft)" : "color-mix(in srgb, var(--color-primary) 14%, var(--bg-card))",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 99, background: state.leido ? "var(--text-muted)" : "var(--color-primary)" }} />
        {state.leido ? "Leída" : "No leída"}
      </button>
      <label style={chip}>
        Estado
        <select
          disabled={busy}
          value={state.status}
          onChange={(e) => {
            const next = e.target.value as QueueStatus;
            onPatch({ status: next }, "estado", statusLabel(next));
          }}
          style={{ border: "none", background: "transparent", color: "var(--text-main)", fontWeight: 800, outline: "none" }}
        >
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </label>
      <label style={chip}>
        Gestiona
        <select
          disabled={busy}
          value={state.gestor || ""}
          onChange={(e) => {
            const next = (e.target.value || null) as GestorId | null;
            onPatch({ gestor: next }, "gestor", next ? gestorLabel(next) : "Sin asignar");
          }}
          style={{ border: "none", background: "transparent", color: "var(--text-main)", fontWeight: 800, outline: "none" }}
        >
          <option value="">Sin asignar</option>
          {GESTORES.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
      </label>
      {state.historial.length > 0 && (
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)" }}>
          Última: {state.historial[state.historial.length - 1].actor} · {state.historial[state.historial.length - 1].detail}
        </span>
      )}
    </div>
  );
}

function statusesOf(queue: QueueKind) {
  return queue === "denuncia" ? DENUNCIA_STATUSES : CORE_STATUSES;
}

export function caseMatchesFilters(state: QueueCase, status: string, gestor: string, userQuery: string, userHaystack: string) {
  if (status !== "todos" && state.status !== status) return false;
  if (gestor === "sin_asignar" && state.gestor) return false;
  if (gestor !== "todos" && gestor !== "sin_asignar" && state.gestor !== gestor) return false;
  const q = userQuery.trim().toLowerCase();
  if (q && !userHaystack.toLowerCase().includes(q)) return false;
  return true;
}

export function historyOf(cases: { label: string; state: QueueCase }[]) {
  return cases
    .flatMap((item) => item.state.historial.map((ev: QueueEvent) => ({ ...ev, caseLabel: item.label })))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}
