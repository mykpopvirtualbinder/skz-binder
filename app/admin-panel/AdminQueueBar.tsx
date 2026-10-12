"use client";

import { useState, type CSSProperties } from "react";
import { bindAdminLang, tr } from "@/lib/admin-i18n";
import { useGlobal } from "../context/GlobalContext";
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

function useAdminLang() {
  const { uiLanguage } = useGlobal();
  bindAdminLang(uiLanguage);
}

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

export function UserCaseHistory({ noun, name, rows, onOpen, tour }: { noun: string; name: string; rows: UserHistoryRow[]; onOpen?: (id: string) => void; tour?: string }) {
  useAdminLang();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button data-tour={tour} type="button" onClick={() => setOpen((v) => !v)} style={{ ...chip, cursor: "pointer" }}>
        {open ? tr("Ocultar historial") : tr("Historial de {noun} de {name}", { noun, name })}
      </button>
      {open && (
        <div data-tour={tour ? `${tour}-lista` : undefined} style={{ marginTop: 8, background: "var(--bg-main)", border: "1px dashed var(--color-border)", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onOpen?.(row.id)}
              style={{ textAlign: "left", cursor: onOpen ? "pointer" : "default", background: "transparent", border: "none", borderTop: "1px solid var(--color-border)", padding: "8px 0 0", color: "inherit" }}
            >
              <div style={{ fontWeight: 900, color: "var(--color-primary)", fontSize: 13, textDecoration: onOpen ? "underline" : "none" }}>{row.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, marginTop: 2 }}>{row.when}</div>
              <div style={{ fontSize: 13, color: "var(--text-main)", fontWeight: 700, marginTop: 4 }}>{tr("Estado:")} {tr(row.status)} · {tr("Gestiona:")} {tr(row.gestor)} · {tr(row.read)}
              </div>
              <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", fontSize: 12, color: "var(--text-main)", fontWeight: 650 }}>{row.actions}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReadSelectionBar({
  ids,
  selected,
  onChange,
  onMark,
  tour,
}: {
  ids: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  onMark: (ids: string[], leido: boolean) => void;
  tour?: string;
}) {
  useAdminLang();
  const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
  const btn: CSSProperties = { ...chip, cursor: "pointer", background: "var(--bg-card)" };
  const label = (full: string, short: string) => (
    <>
      <span className="aq-long">{full}</span>
      <span className="aq-short">{short}</span>
    </>
  );
  return (
    <div className="aq-readbar" data-tour={tour} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <label style={{ ...chip, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={allOn}
          onChange={(e) => onChange(e.target.checked ? new Set(ids) : new Set())}
          style={{ accentColor: "var(--color-primary)" }}
        />
        {label(tr("Seleccionar todas"), tr("Todas"))}
      </label>
      <button type="button" disabled={selected.size === 0} onClick={() => onMark(Array.from(selected), true)} style={{ ...btn, opacity: selected.size ? 1 : 0.5 }}>{label(tr("Marcar seleccionadas leídas"), tr("Sel. leídas"))}</button>
      <button type="button" disabled={selected.size === 0} onClick={() => onMark(Array.from(selected), false)} style={{ ...btn, opacity: selected.size ? 1 : 0.5 }}>{label(tr("Marcar seleccionadas no leídas"), tr("Sel. no leídas"))}</button>
      <button type="button" disabled={ids.length === 0} onClick={() => onMark(ids, true)} style={{ ...btn, opacity: ids.length ? 1 : 0.5 }}>{label(tr("Marcar todas leídas"), tr("Lista leída"))}</button>
      <button type="button" disabled={ids.length === 0} onClick={() => onMark(ids, false)} style={{ ...btn, opacity: ids.length ? 1 : 0.5 }}>{label(tr("Marcar todas no leídas"), tr("Lista no leída"))}</button>
      <style jsx>{`
        .aq-short { display: none; }
        @media (max-width: 860px) {
          .aq-readbar { display: grid; grid-template-columns: 1fr 1fr; }
          .aq-readbar > :global(label) { grid-column: 1 / -1; }
          .aq-readbar > :global(label),
          .aq-readbar > :global(button) {
            width: 100%;
            box-sizing: border-box;
            justify-content: center;
            border-radius: 12px;
            text-align: center;
          }
          .aq-long { display: none; }
          .aq-short { display: inline; }
        }
      `}</style>
    </div>
  );
}

export function AdminQueueFilters({
  queue,
  status,
  gestor,
  userQuery,
  read,
  onStatus,
  onGestor,
  onUserQuery,
  onRead,
  tour,
}: {
  queue: QueueKind;
  status: string;
  gestor: string;
  userQuery: string;
  read: string;
  onStatus: (value: string) => void;
  onGestor: (value: string) => void;
  onUserQuery: (value: string) => void;
  onRead: (value: string) => void;
  tour?: string;
}) {
  useAdminLang();
  const statuses = queue === "denuncia" ? DENUNCIA_STATUSES : CORE_STATUSES;

  return (
    <div className="aq-filters" data-tour={tour} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="aq-filter-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <label data-tour={tour ? `${tour}-estado` : undefined} style={chip}>{tr("Estado")}<select value={status} onChange={(e) => onStatus(e.target.value)} style={{ border: "none", background: "transparent", color: "var(--text-main)", fontWeight: 800, outline: "none" }}>
            <option value="todos">{tr("Todos")}</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{tr(s.label)}</option>
            ))}
          </select>
        </label>
        <label data-tour={tour ? `${tour}-gestor` : undefined} style={chip}>{tr("Quién gestiona")}<select value={gestor} onChange={(e) => onGestor(e.target.value)} style={{ border: "none", background: "transparent", color: "var(--text-main)", fontWeight: 800, outline: "none" }}>
            <option value="todos">{tr("Todas")}</option>
            <option value="sin_asignar">{tr("Sin asignar")}</option>
            {GESTORES.map((g) => (
              <option key={g.id} value={g.id}>{tr(g.label)}</option>
            ))}
          </select>
        </label>
        <input
          value={userQuery}
          onChange={(e) => onUserQuery(e.target.value)}
          placeholder={tr("Filtrar por usuario")}
          style={{ ...chip, minWidth: 180, color: "var(--text-main)", outline: "none" }}
        />
        <label data-tour={tour ? `${tour}-lectura` : undefined} style={chip}>{tr("Lectura")}<select value={read} onChange={(e) => onRead(e.target.value)} style={{ border: "none", background: "transparent", color: "var(--text-main)", fontWeight: 800, outline: "none" }}>
            <option value="todos">{tr("Todas")}</option>
            <option value="no_leidas">{tr("No leídas")}</option>
            <option value="leidas">{tr("Leídas")}</option>
          </select>
        </label>
      </div>
      <style jsx>{`
        @media (max-width: 860px) {
          .aq-filter-row { flex-direction: column; align-items: stretch; }
          .aq-filter-row > :global(label),
          .aq-filter-row > :global(input),
          .aq-filter-row > :global(button) { width: 100%; box-sizing: border-box; justify-content: space-between; }
          :global(.aq-bar) { display: grid !important; grid-template-columns: 1fr 1fr; }
          :global(.aq-bar) > :global(button),
          :global(.aq-bar) > :global(span) { grid-column: 1 / -1; }
          :global(.aq-bar) > :global(button) { justify-content: center; border-radius: 12px; }
          :global(.aq-bar) > :global(label),
          :global(.aq-bar) > :global(button) { width: 100%; box-sizing: border-box; justify-content: space-between; }
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
  mark,
}: {
  queue: QueueKind;
  state: QueueCase;
  busy?: boolean;
  onPatch: (patch: Partial<Pick<QueueCase, "leido" | "status" | "gestor">>, action: string, detail: string) => void;
  mark?: string;
}) {
  useAdminLang();
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
        <span className="aq-long">{state.leido ? tr("Marcar como no leída") : tr("Marcar como leída")}</span>
        <span className="aq-short">{state.leido ? tr("No leída") : tr("Leída")}</span>
      </button>
      <label data-tour={mark ? `${mark}-estado` : undefined} style={chip}>{tr("Estado")}<select
          disabled={busy}
          value={state.status}
          onChange={(e) => {
            const next = e.target.value as QueueStatus;
            onPatch({ status: next }, "estado", statusLabel(next));
          }}
          style={{ border: "none", background: "transparent", color: "var(--text-main)", fontWeight: 800, outline: "none" }}
        >
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{tr(s.label)}</option>
          ))}
        </select>
      </label>
      <label data-tour={mark ? `${mark}-gestor` : undefined} style={chip}>{tr("Gestiona")}<select
          disabled={busy}
          value={state.gestor || ""}
          onChange={(e) => {
            const next = (e.target.value || null) as GestorId | null;
            onPatch({ gestor: next }, "gestor", next ? gestorLabel(next) : "Sin asignar");
          }}
          style={{ border: "none", background: "transparent", color: "var(--text-main)", fontWeight: 800, outline: "none" }}
        >
          <option value="">{tr("Sin asignar")}</option>
          {GESTORES.map((g) => (
            <option key={g.id} value={g.id}>{tr(g.label)}</option>
          ))}
        </select>
      </label>
      {state.historial.length > 0 && (
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", overflowWrap: "anywhere" }}>{tr("Última:")} {state.historial[state.historial.length - 1].actor} · {tr(state.historial[state.historial.length - 1].detail)}
        </span>
      )}
      <style jsx>{`
        .aq-short { display: none; }
        @media (max-width: 860px) {
          .aq-long { display: none; }
          .aq-short { display: inline; }
        }
      `}</style>
    </div>
  );
}

function statusesOf(queue: QueueKind) {
  return queue === "denuncia" ? DENUNCIA_STATUSES : CORE_STATUSES;
}

export function caseMatchesFilters(state: QueueCase, status: string, gestor: string, userQuery: string, userHaystack: string, read = "todos") {
  if (status !== "todos" && state.status !== status) return false;
  if (gestor === "sin_asignar" && state.gestor) return false;
  if (gestor !== "todos" && gestor !== "sin_asignar" && state.gestor !== gestor) return false;
  if (read === "leidas" && !state.leido) return false;
  if (read === "no_leidas" && state.leido) return false;
  const q = userQuery.trim().toLowerCase();
  if (q && !userHaystack.toLowerCase().includes(q)) return false;
  return true;
}

export function historyOf(cases: { label: string; state: QueueCase }[]) {
  return cases
    .flatMap((item) => item.state.historial.map((ev: QueueEvent) => ({ ...ev, caseLabel: item.label })))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}
