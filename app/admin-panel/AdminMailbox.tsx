"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Loader2, Mail, RefreshCw, Reply, Send, Trash2 } from "lucide-react";
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

export default function AdminMailbox() {
  const { showAlert, showConfirm } = useGlobal();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [account, setAccount] = useState("info@mykpopbinder.com");
  const [messages, setMessages] = useState<MailSummary[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [reading, setReading] = useState(false);
  const [compose, setCompose] = useState<{ to: string; subject: string; text: string; inReplyTo: string } | null>(null);
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
    } catch (err) {
      showAlert("Correo", err instanceof Error ? err.message : "No se ha podido abrir la bandeja.");
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openMessage = async (uid: number) => {
    setReading(true);
    setCompose(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/mailbox?uid=${uid}`, { headers });
      const json = (await res.json().catch(() => ({}))) as { message?: MailMessage; error?: string };
      if (!res.ok || !json.message) throw new Error(json.error || "No se ha podido abrir el mensaje.");
      setSelected(json.message);
      setMessages((prev) => prev.map((item) => (item.uid === uid ? { ...item, seen: true } : item)));
    } catch (err) {
      showAlert("Correo", err instanceof Error ? err.message : "No se ha podido abrir el mensaje.");
    } finally {
      setReading(false);
    }
  };

  const removeMessage = async (uid: number) => {
    const ok = await showConfirm("Borrar mensaje", "Se moverá a la papelera de Arsys.");
    if (!ok) return;
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/mailbox", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", uid }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "No se ha podido borrar.");
      setMessages((prev) => prev.filter((item) => item.uid !== uid));
      setSelected((cur) => (cur?.uid === uid ? null : cur));
    } catch (err) {
      showAlert("Correo", err instanceof Error ? err.message : "No se ha podido borrar.");
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
    const quoted = selected.text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    setCompose({
      to: selected.from.match(/<([^>]+)>/)?.[1] || selected.from,
      subject,
      text: `\n\n${quoted}`,
      inReplyTo: selected.messageId,
    });
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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Correo</h2>
          <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 700 }}>{account}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => void loadList()} style={btnStyle}>
            <RefreshCw size={14} /> Actualizar
          </button>
          <button
            type="button"
            onClick={() => setCompose({ to: "", subject: "", text: "", inReplyTo: "" })}
            style={{ ...btnStyle, background: "var(--color-primary)", color: "#111", borderColor: "transparent" }}
          >
            <Mail size={14} /> Nuevo
          </button>
        </div>
      </div>

      {compose && (
        <div style={cardStyle}>
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
            <button type="button" disabled={sending} onClick={() => void submitCompose()} style={{ ...btnStyle, background: "var(--color-primary)", color: "#111", borderColor: "transparent" }}>
              {sending ? <Loader2 size={14} className="spinner" /> : <Send size={14} />} Enviar
            </button>
            <button type="button" onClick={() => setCompose(null)} style={btnStyle}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 340px) minmax(0, 1fr)", gap: 12, alignItems: "start" }}>
        <div style={{ ...cardStyle, padding: 0, maxHeight: 640, overflow: "auto" }}>
          {loading ? (
            <p style={{ padding: 16, color: "var(--text-muted)" }}>Abriendo la bandeja…</p>
          ) : messages.length === 0 ? (
            <p style={{ padding: 16, color: "var(--text-muted)" }}>La bandeja de entrada está vacía.</p>
          ) : (
            messages.map((item) => (
              <button
                key={item.uid}
                type="button"
                onClick={() => void openMessage(item.uid)}
                style={{
                  display: "grid",
                  gap: 2,
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  border: "none",
                  borderBottom: "1px solid var(--color-border)",
                  background: selected?.uid === item.uid ? "var(--bg-soft)" : "transparent",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  fontWeight: item.seen ? 600 : 900,
                }}
              >
                <span style={{ fontSize: 13 }}>{item.from || account}</span>
                <span style={{ fontSize: 14 }}>{item.subject}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{formatWhen(item.date)}</span>
              </button>
            ))
          )}
        </div>

        <div style={{ ...cardStyle, minHeight: 280 }}>
          {reading ? (
            <p style={{ color: "var(--text-muted)" }}>Leyendo el mensaje…</p>
          ) : !selected ? (
            <p style={{ color: "var(--text-muted)", margin: 0 }}>Elige un mensaje de la lista.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: "0 0 6px" }}>{selected.subject}</h3>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 700 }}>
                    {selected.from} · {formatWhen(selected.date)}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={startReply} style={btnStyle}><Reply size={14} /> Responder</button>
                  <button type="button" onClick={() => void removeMessage(selected.uid)} style={btnStyle}><Trash2 size={14} /> Borrar</button>
                </div>
              </div>
              {selected.html ? (
                <iframe
                  title={selected.subject}
                  sandbox=""
                  srcDoc={selected.html}
                  style={{ width: "100%", minHeight: 360, border: "1px solid var(--color-border)", borderRadius: 12, background: "white" }}
                />
              ) : (
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, lineHeight: 1.5 }}>{selected.text || "(sin texto)"}</pre>
              )}
            </div>
          )}
        </div>
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
