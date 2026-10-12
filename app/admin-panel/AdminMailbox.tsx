"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Archive, Forward, Loader2, Mail, RefreshCw, Reply, Send, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "../context/GlobalContext";

type MailSummary = {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  seen: boolean;
};

type MailMessage = MailSummary & {
  text: string;
  html: string;
  messageId: string;
};

type ComposeDraft = { to: string; subject: string; text: string; inReplyTo: string };

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
  return { Authorization: `Bearer ${token}` };
}

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function addressOnly(value: string) {
  return value.match(/<([^>]+)>/)?.[1] || value;
}

function plainBody(message: MailMessage) {
  if (message.text.trim()) return message.text;
  return message.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function refreshBadges() {
  window.dispatchEvent(new Event("admin-pending-refresh"));
}

export default function AdminMailbox() {
  const { showAlert, showConfirm } = useGlobal();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [account, setAccount] = useState("info@mykpopbinder.com");
  const [messages, setMessages] = useState<MailSummary[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [compose, setCompose] = useState<ComposeDraft | null>(null);
  const [sending, setSending] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/mailbox", { headers });
      const json = (await res.json().catch(() => ({}))) as {
        configured?: boolean;
        account?: string;
        messages?: MailSummary[];
        error?: string;
      };
      if (json.account) setAccount(json.account);
      if (json.configured === false) {
        setConfigured(false);
        setMessages([]);
        return;
      }
      setConfigured(true);
      if (!res.ok) throw new Error(json.error || "No se ha podido abrir la bandeja.");
      setMessages(json.messages || []);
      refreshBadges();
    } catch (err) {
      showAlert("Correo", err instanceof Error ? err.message : "No se ha podido abrir la bandeja.");
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const closeViewer = () => {
    setViewerOpen(false);
    setSelected(null);
    setCompose(null);
    setReading(false);
  };

  const openMessage = async (uid: number) => {
    setViewerOpen(true);
    setReading(true);
    setCompose(null);
    setSelected(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/mailbox?uid=${uid}`, { headers });
      const json = (await res.json().catch(() => ({}))) as { message?: MailMessage; error?: string };
      if (!res.ok || !json.message) throw new Error(json.error || "No se ha podido abrir el mensaje.");
      setSelected(json.message);
      setMessages((prev) => prev.map((item) => (item.uid === uid ? { ...item, seen: true } : item)));
      refreshBadges();
    } catch (err) {
      closeViewer();
      showAlert("Correo", err instanceof Error ? err.message : "No se ha podido abrir el mensaje.");
    } finally {
      setReading(false);
    }
  };

  const moveMessage = async (uid: number, action: "delete" | "archive") => {
    const ok = await showConfirm(
      action === "archive" ? "Archivar mensaje" : "Borrar mensaje",
      action === "archive" ? "Saldrá de la bandeja y pasará a Archivo." : "Se moverá a la papelera de Arsys.",
    );
    if (!ok) return;
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/mailbox", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action, uid }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "No se ha podido mover el mensaje.");
      setMessages((prev) => prev.filter((item) => item.uid !== uid));
      closeViewer();
      refreshBadges();
    } catch (err) {
      showAlert("Correo", err instanceof Error ? err.message : "No se ha podido mover el mensaje.");
    }
  };

  const submitCompose = async () => {
    if (!compose) return;
    setSending(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/mailbox", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", ...compose }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "No se ha podido enviar.");
      setCompose(null);
      if (!viewerOpen) closeViewer();
      showAlert("Correo", "Mensaje enviado.");
    } catch (err) {
      showAlert("Correo", err instanceof Error ? err.message : "No se ha podido enviar.");
    } finally {
      setSending(false);
    }
  };

  const startReply = () => {
    if (!selected) return;
    const subject = /^re:/i.test(selected.subject) ? selected.subject : `Re: ${selected.subject}`;
    const quoted = plainBody(selected)
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    setCompose({
      to: addressOnly(selected.from),
      subject,
      text: `\n\n${quoted}`,
      inReplyTo: selected.messageId,
    });
  };

  const startForward = () => {
    if (!selected) return;
    const subject = /^(fwd|rv):/i.test(selected.subject) ? selected.subject : `Fwd: ${selected.subject}`;
    const quoted = [
      "",
      "",
      "---------- Mensaje reenviado ----------",
      `De: ${selected.from}`,
      `Fecha: ${formatWhen(selected.date)}`,
      `Asunto: ${selected.subject}`,
      "",
      plainBody(selected),
    ].join("\n");
    setCompose({ to: "", subject, text: quoted, inReplyTo: "" });
  };

  if (!configured) {
    return (
      <div style={{ padding: 8 }}>
        <h2 style={{ marginTop: 0 }}>Correo</h2>
        <p style={{ color: "var(--text-muted)", maxWidth: 560, lineHeight: 1.5 }}>
          La bandeja de {account} está lista, pero el servidor todavía no tiene la contraseña del buzón.
          Añade <b>ARSYS_MAIL_PASSWORD</b> en Vercel, en los ajustes del proyecto, y vuelve a desplegar.
        </p>
      </div>
    );
  }

  const unseen = messages.filter((item) => !item.seen).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <style>{`
        @keyframes mail-modal-in {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
      <div data-tour="mail-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
            Correo
            {unseen > 0 && (
              <span style={countStyle} title="Sin leer">{unseen > 99 ? "99+" : unseen}</span>
            )}
          </h2>
          <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 700 }}>{account}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => void loadList()} style={btnStyle}>
            <RefreshCw size={14} /> Actualizar
          </button>
          <button
            type="button"
            data-tour="mail-new"
            onClick={() => {
              closeViewer();
              setCompose({ to: "", subject: "", text: "", inReplyTo: "" });
            }}
            style={{ ...btnStyle, background: "var(--color-primary)", color: "#111", borderColor: "transparent" }}
          >
            <Mail size={14} /> Nuevo
          </button>
        </div>
      </div>

      <div data-tour="mail-list" style={{ ...cardStyle, padding: 0, maxHeight: 640, overflow: "auto" }}>
        {loading ? (
          <p style={{ padding: 16, color: "var(--text-muted)" }}>Abriendo la bandeja…</p>
        ) : messages.length === 0 ? (
          <p style={{ padding: 16, color: "var(--text-muted)" }}>La bandeja de entrada está vacía.</p>
        ) : (
          messages.map((item, index) => (
            <button
              key={item.uid}
              type="button"
              data-tour={index === 0 ? "mail-row" : undefined}
              onClick={() => void openMessage(item.uid)}
              style={{
                display: "grid",
                gridTemplateColumns: "14px minmax(0, 1fr) auto",
                gap: 10,
                alignItems: "center",
                width: "100%",
                textAlign: "left",
                padding: "12px 14px",
                border: "none",
                borderBottom: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--text-main)",
                cursor: "pointer",
                fontWeight: item.seen ? 600 : 900,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: item.seen ? "transparent" : "var(--accent-vibe-pink)",
                }}
              />
              <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.from || account}</span>
                <span style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subject}</span>
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{formatWhen(item.date)}</span>
            </button>
          ))
        )}
      </div>

      {viewerOpen && (
        <div
          role="presentation"
          onClick={closeViewer}
          style={overlayStyle}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selected?.subject || "Mensaje"}
            data-tour="mail-modal"
            onClick={(event) => event.stopPropagation()}
            style={dialogStyle}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: "0 0 6px" }}>{reading ? "Abriendo…" : selected?.subject || "(sin asunto)"}</h3>
                {selected && (
                  <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 700, lineHeight: 1.45 }}>
                    {selected.from}
                    {selected.to ? ` → ${selected.to}` : ""}
                    {" · "}
                    {formatWhen(selected.date)}
                  </p>
                )}
              </div>
              <button type="button" onClick={closeViewer} style={btnStyle} aria-label="Cerrar">
                <X size={14} />
              </button>
            </div>

            {selected && (
              <div data-tour="mail-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" data-tour="mail-reply" onClick={startReply} style={btnStyle}><Reply size={14} /> Responder</button>
                <button type="button" data-tour="mail-forward" onClick={startForward} style={btnStyle}><Forward size={14} /> Reenviar</button>
                <button type="button" data-tour="mail-archive" onClick={() => void moveMessage(selected.uid, "archive")} style={btnStyle}><Archive size={14} /> Archivar</button>
                <button type="button" data-tour="mail-delete" onClick={() => void moveMessage(selected.uid, "delete")} style={btnStyle}><Trash2 size={14} /> Eliminar</button>
              </div>
            )}

            {reading ? (
              <p style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                <Loader2 size={16} className="spinner" /> Leyendo el mensaje…
              </p>
            ) : selected?.html ? (
              <iframe
                title={selected.subject}
                sandbox=""
                srcDoc={selected.html}
                style={{ width: "100%", minHeight: 320, border: "1px solid var(--color-border)", borderRadius: 12, background: "white" }}
              />
            ) : (
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, lineHeight: 1.5 }}>{selected?.text || "(sin texto)"}</pre>
            )}

            {compose && <ComposeBox compose={compose} setCompose={setCompose} sending={sending} onSend={() => void submitCompose()} onCancel={() => setCompose(null)} />}
          </div>
        </div>
      )}

      {compose && !viewerOpen && (
        <div role="presentation" onClick={() => setCompose(null)} style={overlayStyle}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo mensaje"
            data-tour="mail-compose"
            onClick={(event) => event.stopPropagation()}
            style={dialogStyle}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Nuevo mensaje</h3>
              <button type="button" onClick={() => setCompose(null)} style={btnStyle} aria-label="Cerrar"><X size={14} /></button>
            </div>
            <ComposeBox compose={compose} setCompose={setCompose} sending={sending} onSend={() => void submitCompose()} onCancel={() => setCompose(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ComposeBox({
  compose,
  setCompose,
  sending,
  onSend,
  onCancel,
}: {
  compose: ComposeDraft;
  setCompose: (next: ComposeDraft) => void;
  sending: boolean;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={labelStyle}>
        Para
        <input value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} style={inputStyle} />
      </label>
      <label style={labelStyle}>
        Asunto
        <input value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} style={inputStyle} />
      </label>
      <textarea
        value={compose.text}
        onChange={(e) => setCompose({ ...compose, text: e.target.value })}
        rows={8}
        style={{ ...inputStyle, resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={sending} onClick={onSend} style={{ ...btnStyle, background: "var(--color-primary)", color: "#111", borderColor: "transparent" }}>
          {sending ? <Loader2 size={14} className="spinner" /> : <Send size={14} />} Enviar
        </button>
        <button type="button" onClick={onCancel} style={btnStyle}>Cancelar</button>
      </div>
    </div>
  );
}

const btnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  fontWeight: 800,
  padding: "8px 12px",
  cursor: "pointer",
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 16,
  border: "1px solid var(--color-border)",
  background: "var(--bg-card)",
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 12,
  fontWeight: 800,
  color: "var(--text-muted)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--bg-main)",
  color: "var(--text-main)",
  padding: "10px 12px",
  font: "inherit",
};

const countStyle: CSSProperties = {
  minWidth: 18,
  height: 18,
  padding: "0 5px",
  boxSizing: "border-box",
  borderRadius: 999,
  background: "var(--accent-vibe-pink)",
  color: "var(--modal-cta-fg)",
  fontSize: 11,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100000,
  background: "var(--overlay-medium)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const dialogStyle: CSSProperties = {
  width: "min(760px, 100%)",
  maxHeight: "min(88vh, 900px)",
  overflow: "auto",
  display: "grid",
  gap: 14,
  padding: 18,
  borderRadius: 20,
  border: "1px solid var(--color-border)",
  background: "var(--bg-card)",
  boxShadow: "0 24px 60px var(--shadow-card)",
  animation: "mail-modal-in 180ms ease-out",
};
