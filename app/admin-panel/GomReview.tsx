"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { tr } from "@/lib/admin-i18n";
import { useGlobal } from "../context/GlobalContext";
import { GOM_SOCIALS, socialHref, websiteHref, type GomSocials } from "@/lib/gom";
import { QueueTrashButton, ReadSelectionBar, UnreadDot } from "./AdminQueueBar";

type Row = {
  id: string;
  displayName: string;
  photoUrl: string;
  firstName: string;
  lastName: string;
  phone: string;
  url: string;
  socials: GomSocials;
  goTypes: string;
  requirements: string;
  howItWorks: string;
  siteUserId: string;
  siteName: string;
  read: boolean;
  status: string;
  createdAt: string;
};

export default function GomReview() {
  const { showConfirm } = useGlobal();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [readFilter, setReadFilter] = useState<"todos" | "no_leidas" | "leidas">("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/admin/gom", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error || tr("No se han podido cargar las solicitudes de GOM."));
      return;
    }
    setError("");
    setRows(Array.isArray(json?.rows) ? json.rows : []);
  };

  useEffect(() => {
    void load();
  }, []);

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    setBusyId(id);
    const res = await fetch("/api/admin/gom", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBusyId("");
    if (!res.ok) {
      setError(tr("No se ha podido guardar la revisión."));
      return;
    }
    window.dispatchEvent(new Event("admin-pending-refresh"));
    await load();
  };

  const label = (status: string) => status === "approved" ? tr("Aprobada") : status === "rejected" ? tr("Rechazada") : tr("Pendiente");

  const visible = rows.filter((row) => {
    if (readFilter === "leidas") return row.read;
    if (readFilter === "no_leidas") return !row.read;
    return true;
  });

  const authToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  };

  const markRead = async (ids: string[], read: boolean) => {
    const token = await authToken();
    if (!token || !ids.length) return;
    const res = await fetch("/api/admin/gom", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", ids, read }),
    });
    if (!res.ok) {
      setError(tr("No se ha podido completar la acción."));
      return;
    }
    setError("");
    await load();
  };

  const remove = async (ids: string[]) => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return;
    const what = unique.length === 1 ? tr("esta solicitud") : tr("{n} elementos", { n: unique.length });
    const ok = await showConfirm(tr("Eliminar"), tr("¿Seguro que quieres eliminar {what}? No se puede deshacer.", { what }));
    if (!ok) return;
    const token = await authToken();
    if (!token) return;
    const res = await fetch("/api/admin/gom", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: unique }),
    });
    if (!res.ok) {
      setError(tr("No se ha podido completar la acción."));
      return;
    }
    setSelected(new Set());
    setError("");
    window.dispatchEvent(new Event("admin-pending-refresh"));
    await load();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ color: "var(--color-primary)", margin: 0, fontSize: 20, fontWeight: 900 }}>{tr("Solicitudes de GOM")}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["todos", "no_leidas", "leidas"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setReadFilter(id)} style={{ padding: "6px 12px", borderRadius: 99, border: "1px solid var(--color-border)", fontSize: 11, fontWeight: 800, cursor: "pointer", background: readFilter === id ? "var(--color-primary)" : "var(--bg-card)", color: readFilter === id ? "var(--bg-card)" : "var(--color-primary)" }}>
              {id === "todos" ? tr("Todas") : id === "no_leidas" ? tr("No leídas") : tr("Leídas")}
            </button>
          ))}
        </div>
      </div>
      <p style={{ margin: 0, fontWeight: 700, color: "var(--text-muted)" }}>{tr("El nombre, los apellidos y el teléfono solo se ven aquí. En el market sale el nombre público.")}</p>
      {error ? <p style={{ fontWeight: 800, color: "#9b3b55" }}>{error}</p> : null}
      {rows.length === 0 ? <p style={{ fontWeight: 800, color: "var(--text-muted)" }}>{tr("No hay solicitudes de GOM.")}</p> : null}
      {rows.length > 0 ? (
        <ReadSelectionBar
          ids={visible.map((row) => row.id)}
          selected={selected}
          onChange={setSelected}
          onMark={(ids, read) => void markRead(ids, read)}
          onDelete={(ids) => void remove(ids)}
        />
      ) : null}
      {rows.length > 0 && visible.length === 0 ? <p style={{ fontWeight: 800, color: "var(--text-muted)" }}>{tr("Bandeja limpia.")}</p> : null}
      {visible.map((row) => (
        <article key={row.id} style={{ background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: 18, padding: 16, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="checkbox"
              checked={selected.has(row.id)}
              aria-label={tr("Seleccionar")}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(row.id);
                else next.delete(row.id);
                setSelected(next);
              }}
              style={{ accentColor: "var(--color-primary)", width: 16, height: 16, cursor: "pointer" }}
            />
            {row.photoUrl ? <img src={row.photoUrl} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 14 }} /> : null}
            <div style={{ flex: 1 }}>
              <strong style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: row.read ? 700 : 900 }}>
                <UnreadDot unread={!row.read} />
                {row.displayName}
              </strong>
              {row.siteName ? <div style={{ fontSize: 13, fontWeight: 800 }}><a href={`/user/${row.siteUserId}`} style={{ color: "#8C659C" }}>{row.siteName}</a></div> : null}
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)" }}>{label(row.status)} · {new Date(row.createdAt).toLocaleString()}</div>
            </div>
            {row.status === "pending" ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" data-kbd="confirm" disabled={busyId === row.id} onClick={() => void decide(row.id, "approved")} style={{ border: "none", background: "#8C659C", color: "#fff", borderRadius: 999, padding: "8px 12px", fontWeight: 900, cursor: "pointer" }}>{tr("Aprobar")}</button>
                <button type="button" data-kbd="cancel" disabled={busyId === row.id} onClick={() => void decide(row.id, "rejected")} style={{ border: "1px solid var(--color-border)", background: "transparent", borderRadius: 999, padding: "8px 12px", fontWeight: 900, cursor: "pointer" }}>{tr("Rechazar")}</button>
              </div>
            ) : (
              <button type="button" disabled={busyId === row.id} onClick={() => void decide(row.id, row.status === "approved" ? "rejected" : "approved")} style={{ border: "1px solid var(--color-border)", background: "transparent", borderRadius: 999, padding: "8px 12px", fontWeight: 900, cursor: "pointer" }}>
                {row.status === "approved" ? tr("Ocultar") : tr("Aprobar")}
              </button>
            )}
            <QueueTrashButton onClick={() => void remove([row.id])} />
          </div>
          <div style={{ fontWeight: 700 }}>{row.firstName} {row.lastName} · {row.phone}</div>
          {row.url ? (
            <div style={{ fontWeight: 700 }}>
              {tr("URL")}: {websiteHref(row.url) ? <a href={websiteHref(row.url)} target="_blank" rel="noreferrer" style={{ color: "#8C659C" }}>{row.url}</a> : row.url}
            </div>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13, fontWeight: 700 }}>
            {GOM_SOCIALS.filter((field) => row.socials[field.key]).map((field) => {
              const href = socialHref(field.key, row.socials[field.key]);
              const label = `${field.label}: ${row.socials[field.key]}`;
              return href ? (
                <a key={field.key} href={href} target="_blank" rel="noreferrer" style={{ color: "#8C659C" }}>{label}</a>
              ) : (
                <span key={field.key}>{label}</span>
              );
            })}
          </div>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>{tr("Tipo de GO")}:</b> {row.goTypes}</p>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>{tr("Requisitos")}:</b> {row.requirements}</p>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>{tr("Funcionamiento")}:</b> {row.howItWorks}</p>
        </article>
      ))}
    </div>
  );
}
