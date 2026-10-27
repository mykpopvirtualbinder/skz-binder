"use client";

import { useState, type CSSProperties } from "react";
import { Mail, MailOpen, Trash2 } from "lucide-react";
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

export function UnreadDot({ unread }: { unread: boolean }) {
  useAdminLang();
  if (!unread) return null;
  return (
    <span
      title={tr("No leída")}
      aria-label={tr("No leída")}
      style={{ width: 8, height: 8, borderRadius: 99, background: "var(--color-primary)", flexShrink: 0, display: "inline-block" }}
    />
  );
}

export function QueueTrashButton({ onClick }: { onClick: () => void }) {
  useAdminLang();
  return (
    <button
      type="button"
      title={tr("Eliminar")}
      aria-label={tr("Eliminar")}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: 10,
        border: "1px solid var(--color-border)",
        background: "var(--bg-card)",
        color: "var(--text-main)",
        cursor: "pointer",
      }}
    >
      <Trash2 size={16} strokeWidth={1.7} />
    </button>
  );
}

export function ReadSelectionBar({
  ids,
  selected,
  onChange,
  onMark,
  onDelete,
  tour,
}: {
  ids: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  onMark: (ids: string[], leido: boolean) => void;
  onDelete: (ids: string[]) => void;
  tour?: string;
}) {
  useAdminLang();
  const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
  const picked = ids.filter((id) => selected.has(id));
  const ready = picked.length > 0;
  const btn: CSSProperties = {
    ...chip,
    cursor: ready ? "pointer" : "default",
    background: "var(--bg-card)",
    opacity: ready ? 1 : 0.4,
  };
  return (
    <div className="aq-readbar" data-tour={tour} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <label style={{ ...chip, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={allOn}
          onChange={(e) => onChange(e.target.checked ? new Set(ids) : new Set())}
          style={{ accentColor: "var(--color-primary)" }}
        />
        {tr("Todas")}
        {picked.length > 0 ? <span style={{ color: "var(--text-muted)", fontWeight: 800 }}>{picked.length}</span> : null}
      </label>
      <button type="button" disabled={!ready} title={tr("Marcar como leída")} onClick={() => onMark(picked, true)} style={btn}>
        <MailOpen size={14} />
        <span className="aq-long">{tr("Marcar leídas")}</span>
      </button>
      <button type="button" disabled={!ready} title={tr("Marcar como no leída")} onClick={() => onMark(picked, false)} style={btn}>
        <Mail size={14} />
        <span className="aq-long">{tr("Marcar no leídas")}</span>
      </button>
      <button type="button" disabled={!ready} title={tr("Eliminar")} aria-label={tr("Eliminar")} onClick={() => onDelete(picked)} style={btn}>
        <Trash2 size={14} />
        <span className="aq-long">{tr("Eliminar")}</span>
      </button>
      <style jsx>{`
        .aq-long { display: inline; }
        @media (max-width: 860px) {
          .aq-readbar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
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
        title={state.leido ? tr("Marcar como no leída") : tr("Marcar como leída")}
        aria-label={state.leido ? tr("Marcar como no leída") : tr("Marcar como leída")}
        onClick={() => onPatch({ leido: !state.leido }, "lectura", state.leido ? "Marcada como no leída" : "Marcada como leída")}
        style={{
          ...chip,
          cursor: busy ? "wait" : "pointer",
          background: state.leido ? "var(--bg-soft)" : "color-mix(in srgb, var(--color-primary) 14%, var(--bg-card))",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 99, background: state.leido ? "var(--text-muted)" : "var(--color-primary)" }} />
        {state.leido ? <MailOpen size={14} /> : <Mail size={14} />}
        {state.leido ? tr("Leída") : tr("No leída")}
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
