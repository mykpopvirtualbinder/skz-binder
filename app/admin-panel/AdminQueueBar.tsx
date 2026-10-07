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

export type UserHistoryRow = {
  id: string;
  when: string;
  title: string;
  status: string;
  gestor: string;
  read: string;
  actions: string;
};

export function UserCaseHistory({ noun, name, rows }: { noun: string; name: string; rows: UserHistoryRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ ...chip, cursor: "pointer" }}>
        {open ? "Ocultar historial" : `Historial de ${noun} de ${name}`}
      </button>
      {open && (
        <div style={{ marginTop: 8, background: "var(--bg-main)", border: "1px dashed var(--color-border)", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((row) => (
            <div key={row.id} style={{ borderTop: "1px solid var(--color-border)", paddingTop: 8 }}>
              <div style={{ fontWeight: 900, color: "var(--text-main)", fontSize: 13 }}>{row.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, marginTop: 2 }}>{row.when}</div>
              <div style={{ fontSize: 13, color: "var(--text-main)", fontWeight: 700, marginTop: 4 }}>
                Estado: {row.status} · Gestiona: {row.gestor} · {row.read}
              </div>
              <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", fontSize: 12, color: "var(--text-main)", fontWeight: 650 }}>{row.actions}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminQueueFilters({
  queue,
  status,
  gestor,
  userQuery,
  onStatus,
  onGestor,
  onUserQuery,
}: {
  queue: QueueKind;
  status: string;
  gestor: string;
  userQuery: string;
  onStatus: (value: string) => void;
  onGestor: (value: string) => void;
  onUserQuery: (value: string) => void;
}) {
  const statuses = queue === "denuncia" ? DENUNCIA_STATUSES : CORE_STATUSES;

  return (
    <div className="aq-filters" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="aq-filter-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
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
      </div>
      <style jsx>{`
        @media (max-width: 860px) {
          .aq-filter-row { flex-direction: column; align-items: stretch; }
          .aq-filter-row > :global(label),
          .aq-filter-row > :global(input),
          .aq-filter-row > :global(button) { width: 100%; box-sizing: border-box; justify-content: space-between; }
          :global(.aq-bar) { flex-direction: column; align-items: stretch; }
          :global(.aq-bar) > :global(*) { width: 100%; box-sizing: border-box; justify-content: space-between; }
          :global(.aq-hist) { grid-template-columns: 1fr !important; }
        }
      `}</style>
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
    <div className="aq-bar" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
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
