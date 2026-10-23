"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Archive, Check, Forward, Mail, MailOpen, Paperclip, PenLine, Reply, ReplyAll, Send, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "../context/GlobalContext";
import { bindAdminLang, tr } from "@/lib/admin-i18n";

type MailSummary = {
  uid: string;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  seen: boolean;
  files: number;
};

type MailFile = { id: string; filename: string; contentType: string; size: number };

type MailMessage = MailSummary & {
  text: string;
  html: string;
  messageId: string;
  attachments: MailFile[];
};

type MailFolder = {
  path: string;
  name: string;
  parentPath: string;
  specialUse: string;
  delimiter: string;
  selectable: boolean;
};

type ComposeDraft = { to: string; subject: string; text: string; inReplyTo: string; files: File[] };

const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 3_500_000;
const OWN = "info@mykpopbinder.com";
const SYSTEM = [
  { id: "inbox", label: "Entrada", icon: "inbox" },
  { id: "sent", label: "Enviados", icon: "sent" },
  { id: "archive", label: "Archivo", icon: "archive" },
  { id: "trash", label: "Papelera", icon: "trash" },
] as const;

const ink = "#1a1613";
const ash = "#8a8178";
const porcelain = "#f4f1ea";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error(tr("Sesión no válida. Vuelve a iniciar sesión."));
  return { Authorization: `Bearer ${token}` };
}

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function addresses(value: string) {
  return Array.from(value.matchAll(/[^\s<>,;"]+@[^\s<>,;"]+/g)).map((match) => match[0]);
}

function displayName(value: string) {
  const name = value.replace(/<[^>]*>/g, "").replace(/"/g, "").trim();
  return name || value || tr("(sin remitente)");
}

function plainBody(message: MailMessage) {
  if (message.text.trim()) return message.text;
  return message.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isSystem(path: string) {
  return SYSTEM.some((folder) => folder.id === path);
}

function refreshBadges() {
  window.dispatchEvent(new Event("admin-pending-refresh"));
}

function Tool({ label, onClick, disabled, active, tour, children }: { label: string; onClick?: () => void; disabled?: boolean; active?: boolean; tour?: string; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} data-tour={tour} style={toolStyle(Boolean(active), Boolean(disabled))}>
      {children}
    </button>
  );
}

export default function AdminMailbox() {
  const { uiLanguage } = useGlobal();
  bindAdminLang(uiLanguage);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [box, setBox] = useState("inbox");
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [messages, setMessages] = useState<MailSummary[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [compose, setCompose] = useState<ComposeDraft | null>(null);
  const [sending, setSending] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [error, setError] = useState("");
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const boxRef = useRef(box);

  useEffect(() => {
    boxRef.current = box;
  }, [box]);

  const loadList = useCallback(async (nextBox = box, quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/mailbox?${new URLSearchParams({ box: nextBox })}`, { headers, cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as {
        configured?: boolean;
        box?: string;
        folders?: MailFolder[];
        messages?: MailSummary[];
        error?: string;
      };
      if (json.configured === false) {
        setConfigured(false);
        setMessages([]);
        return;
      }
      setConfigured(true);
      if (!res.ok) throw new Error(json.error || tr("No se ha podido abrir la carpeta."));
      if (json.folders) setFolders(json.folders);
      if (json.box) setBox(json.box);
      setMessages(json.messages || []);
      refreshBadges();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("No se ha podido abrir la carpeta."));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [box]);

  useEffect(() => {
    void loadList("inbox");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let dead = false;
    const known = { ids: null as Set<string> | null };
    async function poll() {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/admin/mailbox?unseen=1", { headers, cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as { unseen?: number; items?: Array<{ id: string }> };
        if (dead || !res.ok) return;
        setUnseen(json.unseen || 0);
        refreshBadges();
        const ids = new Set((json.items || []).map((item) => item.id));
        const arrived = known.ids ? [...ids].some((id) => !known.ids?.has(id)) : false;
        const here = boxRef.current;
        if (known.ids && arrived && (here === "inbox" || here.toUpperCase() === "INBOX")) {
          const headers2 = await authHeaders();
          const list = await fetch(`/api/admin/mailbox?${new URLSearchParams({ box: "inbox" })}`, { headers: headers2, cache: "no-store" });
          const body = (await list.json().catch(() => ({}))) as { messages?: MailSummary[] };
          if (!dead && list.ok) setMessages(body.messages || []);
        }
        known.ids = ids;
      } catch {
        /* el siguiente pase lo reintenta */
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 20000);
    return () => {
      dead = true;
      window.clearInterval(timer);
    };
  }, []);

  function openFolder(path: string) {
    setSelected(null);
    setCompose(null);
    setPicked([]);
    setSelecting(false);
    void loadList(path);
  }

  async function openMessage(uid: string) {
    setError("");
    setCompose(null);
    const wasUnseen = messages.some((item) => item.uid === uid && !item.seen);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/mailbox?${new URLSearchParams({ uid, box })}`, { headers, cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { message?: MailMessage; error?: string };
      if (!res.ok || !json.message) throw new Error(json.error || tr("No se ha podido abrir el mensaje."));
      setSelected(json.message);
      setMessages((prev) => prev.map((item) => (item.uid === uid ? { ...item, seen: true } : item)));
      if (wasUnseen && (box === "inbox" || box.toUpperCase() === "INBOX")) setUnseen((count) => Math.max(0, count - 1));
      refreshBadges();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("No se ha podido abrir el mensaje."));
    }
  }

  async function postAction(payload: Record<string, unknown>) {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/mailbox", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, box }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(json.error || tr("No se ha podido completar la acción."));
  }

  async function actOn(ids: string[], action: "delete" | "archive" | "seen" | "move", extra?: { seen?: boolean; destination?: string }) {
    if (!ids.length) return;
    setError("");
    try {
      if (action === "seen") await postAction({ action: "seen", uids: ids, seen: extra?.seen });
      else if (action === "delete") await postAction({ action: "delete-many", uids: ids });
      else {
        for (const uid of ids) {
          await postAction({ action, uid, destination: extra?.destination || (action === "archive" ? "archive" : "") });
        }
      }
      refreshBadges();
      if (action === "seen") {
        const seen = Boolean(extra?.seen);
        if (box === "inbox") {
          const delta = seen
            ? -messages.filter((item) => ids.includes(item.uid) && !item.seen).length
            : messages.filter((item) => ids.includes(item.uid) && item.seen).length;
          setUnseen((count) => Math.max(0, count + delta));
        }
        setMessages((prev) => prev.map((item) => (ids.includes(item.uid) ? { ...item, seen } : item)));
        setSelected((current) => (current && ids.includes(current.uid) ? { ...current, seen } : current));
        return;
      }
      setPicked([]);
      setSelected((current) => (current && ids.includes(current.uid) ? null : current));
      await loadList(box, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("No se ha podido completar la acción."));
    }
  }

  function startCompose(kind: "new" | "reply" | "reply-all" | "forward") {
    if (kind === "new" || !selected) {
      setSelected(null);
      setCompose({ to: "", subject: "", text: "", inReplyTo: "", files: [] });
      return;
    }
    if (kind === "forward") {
      const subject = /^(fwd|rv):/i.test(selected.subject) ? selected.subject : `Fwd: ${selected.subject}`;
      const quoted = ["", "", tr("---------- Mensaje reenviado ----------"), `De: ${selected.from}`, `Fecha: ${formatWhen(selected.date)}`, `Asunto: ${selected.subject}`, "", plainBody(selected)].join("\n");
      setCompose({ to: "", subject, text: quoted, inReplyTo: "", files: [] });
      return;
    }
    const replyTo = box === "sent" ? addresses(selected.to)[0] || selected.to : addresses(selected.from)[0] || selected.from;
    const everyone = [...new Set([...addresses(selected.from), ...addresses(selected.to)].map((item) => item.toLowerCase()))].filter((item) => item !== OWN);
    const subject = /^re:/i.test(selected.subject) ? selected.subject : `Re: ${selected.subject}`;
    setCompose({
      to: kind === "reply-all" && everyone.length ? everyone.join(", ") : replyTo,
      subject,
      text: "",
      inReplyTo: selected.messageId,
      files: [],
    });
  }

  async function submitCompose() {
    if (!compose || sending) return;
    const total = compose.files.reduce((sum, file) => sum + file.size, 0);
    if (compose.files.length > MAX_ATTACHMENTS) {
      setError(tr("Puedes adjuntar hasta 8 archivos."));
      return;
    }
    if (total > MAX_ATTACHMENT_BYTES) {
      setError(tr("Los adjuntos pesan demasiado. El máximo es 3 MB."));
      return;
    }
    setSending(true);
    setError("");
    try {
      const headers = await authHeaders();
      const form = new FormData();
      form.set("action", "send");
      form.set("to", compose.to);
      form.set("subject", compose.subject);
      form.set("text", compose.text);
      form.set("inReplyTo", compose.inReplyTo);
      compose.files.forEach((file) => form.append("file", file, file.name));
      const res = await fetch("/api/admin/mailbox", { method: "POST", headers, body: form });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || tr("No se ha podido enviar."));
      setCompose(null);
      setSelected(null);
      openFolder("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("No se ha podido enviar."));
    } finally {
      setSending(false);
    }
  }

  async function createFolder(atRoot: boolean) {
    const name = folderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    setError("");
    try {
      await postAction({ action: "create-folder", parent: atRoot ? "" : box, name });
      setFolderName("");
      await loadList(box, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("No se ha podido crear la carpeta."));
    } finally {
      setCreatingFolder(false);
    }
  }

  async function removeFolder(path: string) {
    setError("");
    try {
      await postAction({ action: "delete-folder", path });
      openFolder("inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("No se ha podido eliminar la carpeta."));
    }
  }

  if (!configured) {
    return (
      <div style={{ padding: 8 }}>
        <h2 style={{ marginTop: 0 }}>{tr("Correo")}</h2>
        <p style={{ color: ash, maxWidth: 560, lineHeight: 1.5 }}>{tr("La bandeja de {account} está lista, pero el servidor todavía no tiene la contraseña del buzón. Añade ARSYS_MAIL_PASSWORD en Vercel, en los ajustes del proyecto, y vuelve a desplegar.", { account: OWN })}</p>
      </div>
    );
  }

  const custom = folders.filter((folder) => folder.selectable && !isSystem(folder.path) && folder.path.toUpperCase() !== "INBOX");
  const reading = Boolean(selected || compose);
  const markAsRead = messages.some((item) => picked.includes(item.uid) && !item.seen);
  const allPicked = messages.length > 0 && messages.every((item) => picked.includes(item.uid));
  const sentView = box === "sent";

  return (
    <div className={reading ? "mkb-mail mkb-reading" : "mkb-mail"}>
      <aside className="mkb-folders" data-tour="mail-folders">
        <div style={{ display: "flex", gap: 4, padding: "12px 12px 4px" }}>
          <Tool label={tr("Mensaje nuevo")} tour="mail-new" onClick={() => startCompose("new")}><PenLine size={18} strokeWidth={1.6} /></Tool>
        </div>
        <div style={{ display: "grid", padding: "4px 8px 16px" }}>
          <p style={kicker}>STAFF My K-Pop Binder</p>
          {SYSTEM.map((folder) => {
            const active = box === folder.id && !compose;
            const count = folder.id === "inbox" ? unseen : 0;
            return (
              <button key={folder.id} type="button" onClick={() => openFolder(folder.id)} style={folderBtn(active)}>
                <FolderIcon name={folder.icon} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: count ? 650 : 500 }}>{tr(folder.label)}</span>
                {count ? <span style={{ fontWeight: 750 }}>{count}</span> : null}
              </button>
            );
          })}
          {custom.map((folder) => (
            <button key={folder.path} type="button" onClick={() => openFolder(folder.path)} style={folderBtn(box === folder.path)}>
              <FolderIcon name="folder" />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
            </button>
          ))}
          <div style={{ display: "grid", gap: 6, padding: "14px 8px 0" }}>
            <input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder={tr("Nombre de la carpeta")} aria-label={tr("Nombre de la carpeta")} style={fieldStyle} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" disabled={creatingFolder || !folderName.trim()} onClick={() => void createFolder(true)} style={tinyBtn}>{tr("Carpeta en la raíz")}</button>
              <button type="button" disabled={creatingFolder || !folderName.trim()} onClick={() => void createFolder(false)} style={tinyBtn}>{tr("Subcarpeta")}</button>
              {!isSystem(box) ? <button type="button" onClick={() => void removeFolder(box)} style={tinyBtn}>{tr("Eliminar carpeta")}</button> : null}
            </div>
          </div>
        </div>
      </aside>

      <section className="mkb-main">
        <div className="mkb-list" data-tour="mail-list">
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px", borderBottom: "1px solid rgba(26,22,19,.1)" }}>
            <Tool label={selecting ? tr("Quitar selección") : tr("Seleccionar")} tour="mail-select" active={selecting} onClick={() => { setSelecting((value) => !value); setPicked([]); }}>
              <Check size={18} strokeWidth={1.6} />
            </Tool>
            {selecting ? <input type="checkbox" checked={allPicked} aria-label={tr("Seleccionar todo")} onChange={() => setPicked(allPicked ? [] : messages.map((item) => item.uid))} style={{ width: 16, height: 16 }} /> : null}
            <Tool label={box === "archive" ? tr("Mover a entrada") : tr("Archivar")} disabled={!picked.length} onClick={() => void actOn(picked, "move", { destination: box === "archive" ? "inbox" : "archive" })}>
              {box === "archive" ? <Mail size={18} strokeWidth={1.6} /> : <Archive size={18} strokeWidth={1.6} />}
            </Tool>
            <Tool label={box === "trash" ? tr("Borrar") : tr("Papelera")} disabled={!picked.length} onClick={() => void actOn(picked, "delete")}>
              <Trash2 size={18} strokeWidth={1.6} />
            </Tool>
            <Tool label={markAsRead ? tr("Marcar como leído") : tr("Marcar como no leído")} disabled={!picked.length} onClick={() => void actOn(picked, "seen", { seen: markAsRead })}>
              {markAsRead ? <MailOpen size={18} strokeWidth={1.6} /> : <Mail size={18} strokeWidth={1.6} />}
            </Tool>
          </div>
          {error ? <p style={{ margin: 0, padding: "8px 16px", color: ash, fontSize: 14 }}>{error}</p> : null}
          <div style={{ overflow: "auto", minHeight: 0, flex: 1 }}>
            {loading && !messages.length ? <p style={emptyStyle}>{tr("Abriendo…")}</p> : null}
            {!loading && !messages.length ? <p style={emptyStyle}>{tr("Esta carpeta está vacía.")}</p> : null}
            {messages.map((item, index) => (
              <div key={item.uid} style={{ display: "flex", gap: 8, padding: "10px 12px", borderBottom: "1px solid rgba(26,22,19,.06)", background: selected?.uid === item.uid ? "rgba(26,22,19,.04)" : "transparent" }}>
                {selecting ? (
                  <input type="checkbox" checked={picked.includes(item.uid)} aria-label={tr("Seleccionar")} onChange={() => setPicked((prev) => prev.includes(item.uid) ? prev.filter((id) => id !== item.uid) : [...prev, item.uid])} style={{ marginTop: 4, width: 16, height: 16 }} />
                ) : (
                  <span style={{ width: 8, height: 8, marginTop: 8, borderRadius: 99, background: item.seen ? "transparent" : ink, flex: "0 0 auto" }} />
                )}
                <button type="button" data-tour={index === 0 ? "mail-row" : undefined} onClick={() => void openMessage(item.uid)} style={rowBtn}>
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: item.seen ? 500 : 700 }}>{sentView ? displayName(item.to) : displayName(item.from)}</span>
                    <span style={{ color: ash, fontSize: 11, flex: "0 0 auto" }}>{formatWhen(item.date)}</span>
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: item.seen ? ash : ink, fontSize: 14 }}>{item.subject || tr("(sin asunto)")}{item.files > 0 ? " · ✎" : ""}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mkb-read" data-tour="mail-modal" style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          {compose ? (
            <ComposePane compose={compose} setCompose={setCompose} sending={sending} onSend={() => void submitCompose()} onClose={() => setCompose(null)} />
          ) : selected ? (
            <article style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
              <div style={{ display: "flex", gap: 4, padding: 8, borderBottom: "1px solid rgba(26,22,19,.1)", flexWrap: "wrap" }}>
                <span className="mkb-back"><Tool label={tr("Volver")} onClick={() => setSelected(null)}><X size={18} strokeWidth={1.6} /></Tool></span>
                <Tool label={tr("Responder")} tour="mail-reply" onClick={() => startCompose("reply")}><Reply size={18} strokeWidth={1.6} /></Tool>
                <Tool label={tr("Responder a todos")} onClick={() => startCompose("reply-all")}><ReplyAll size={18} strokeWidth={1.6} /></Tool>
                <Tool label={tr("Reenviar")} onClick={() => startCompose("forward")}><Forward size={18} strokeWidth={1.6} /></Tool>
                <Tool label={box === "archive" ? tr("Mover a entrada") : tr("Archivar")} onClick={() => void actOn([selected.uid], "move", { destination: box === "archive" ? "inbox" : "archive" })}>
                  {box === "archive" ? <Mail size={18} strokeWidth={1.6} /> : <Archive size={18} strokeWidth={1.6} />}
                </Tool>
                <Tool label={box === "trash" ? tr("Borrar") : tr("Papelera")} onClick={() => void actOn([selected.uid], "delete")}><Trash2 size={18} strokeWidth={1.6} /></Tool>
                <Tool label={selected.seen ? tr("Marcar como no leído") : tr("Marcar como leído")} onClick={() => void actOn([selected.uid], "seen", { seen: !selected.seen })}>
                  {selected.seen ? <Mail size={18} strokeWidth={1.6} /> : <MailOpen size={18} strokeWidth={1.6} />}
                </Tool>
              </div>
              <div style={{ overflow: "auto", padding: "20px 28px", minHeight: 0, flex: 1 }}>
                <p style={{ ...kicker, color: ink }}>{tr("STAFF My K-Pop Binder")}</p>
                <h2 style={{ margin: "8px 0 0", fontFamily: "Georgia, serif", fontWeight: 500, fontSize: 30, lineHeight: 1.15 }}>{selected.subject || tr("(sin asunto)")}</h2>
                <p style={{ margin: "16px 0 0", fontWeight: 650 }}>{displayName(sentView ? selected.to : selected.from)}</p>
                <p style={{ margin: 0, color: ash, fontSize: 14 }}>{sentView ? selected.to : selected.from}</p>
                <p style={{ margin: "4px 0 0", color: ash, fontSize: 12 }}>{tr("Para")} {selected.to} · {formatWhen(selected.date)}</p>
                {selected.html ? (
                  <div className="mail-html" style={{ marginTop: 24, fontSize: 14, lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: selected.html }} />
                ) : (
                  <pre style={{ marginTop: 24, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, lineHeight: 1.55 }}>{selected.text || tr("(sin texto)")}</pre>
                )}
                {selected.attachments?.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(26,22,19,.1)" }}>
                    {selected.attachments.map((file) => <MailAttachment key={file.id} file={file} onError={setError} />)}
                  </div>
                ) : null}
              </div>
            </article>
          ) : (
            <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: ash, fontSize: 14 }}>{OWN}</div>
          )}
        </div>
      </section>
      <style>{`
        .mkb-mail { display: grid; grid-template-columns: 16rem minmax(0, 1fr); height: min(78vh, 860px); min-height: 520px; background: ${porcelain}; color: ${ink}; border: 1px solid rgba(26,22,19,.1); overflow: hidden; }
        .mkb-folders, .mkb-list, .mkb-read { min-height: 0; min-width: 0; }
        .mkb-folders { overflow: auto; border-right: 1px solid rgba(26,22,19,.1); }
        .mkb-main { display: grid; grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr); min-width: 0; min-height: 0; }
        .mkb-list { display: flex; flex-direction: column; border-right: 1px solid rgba(26,22,19,.1); min-height: 0; }
        .mkb-back { display: none; }
        .mail-html img, .mail-html table { max-width: 100%; }
        @media (max-width: 860px) {
          .mkb-mail { grid-template-columns: 1fr; height: auto; min-height: 70vh; }
          .mkb-main { grid-template-columns: 1fr; }
          .mkb-mail.mkb-reading .mkb-folders, .mkb-mail.mkb-reading .mkb-list { display: none; }
          .mkb-mail:not(.mkb-reading) .mkb-read { display: none; }
          .mkb-back { display: inline-flex; }
        }
      `}</style>
    </div>
  );
}

function FolderIcon({ name }: { name: string }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: ash, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "inbox") return <svg {...common}><path d="M3 12h5l2 3h4l2-3h5" /><path d="M5 6h14l2 6v7H3v-7Z" /></svg>;
  if (name === "sent") return <svg {...common}><path d="m4 12 16-8-6 16-2.5-6.5Z" /></svg>;
  if (name === "archive") return <svg {...common}><path d="M3 6h18v4H3z" /><path d="M5 10v8h14v-8" /><path d="M10 14h4" /></svg>;
  if (name === "trash") return <svg {...common}><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M7 7l1 13h8l1-13" /></svg>;
  return <svg {...common}><path d="M3 7h6l2 2h10v10H3z" /></svg>;
}

function ComposePane({ compose, setCompose, sending, onSend, onClose }: { compose: ComposeDraft; setCompose: (next: ComposeDraft) => void; sending: boolean; onSend: () => void; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <form style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }} onSubmit={(event) => { event.preventDefault(); onSend(); }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center", padding: 8, borderBottom: "1px solid rgba(26,22,19,.1)" }}>
        <Tool label={tr("Cerrar")} onClick={onClose}><X size={18} strokeWidth={1.6} /></Tool>
        <Tool label={tr("Adjuntar")} onClick={() => fileRef.current?.click()}><Paperclip size={18} strokeWidth={1.6} /></Tool>
        <button type="submit" aria-label={tr("Enviar")} title={tr("Enviar")} disabled={sending} style={{ ...toolStyle(false, sending), marginLeft: "auto" }}><Send size={18} strokeWidth={1.6} /></button>
      </div>
      <div style={{ overflow: "auto", padding: "16px 24px", flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 650 }}>STAFF My K-Pop Binder</p>
        <p style={{ margin: "2px 0 0", color: ash, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>{OWN}</p>
        <label style={labelStyle}>{tr("Para")}<input required value={compose.to} onChange={(event) => setCompose({ ...compose, to: event.target.value })} style={fieldStyle} /></label>
        <label style={labelStyle}>{tr("Asunto")}<input value={compose.subject} onChange={(event) => setCompose({ ...compose, subject: event.target.value })} style={fieldStyle} /></label>
        <textarea aria-label={tr("Mensaje")} value={compose.text} onChange={(event) => setCompose({ ...compose, text: event.target.value })} style={{ ...fieldStyle, minHeight: 180, resize: "vertical" }} />
        <input ref={fileRef} hidden type="file" multiple onChange={(event) => {
          const next = [...compose.files, ...Array.from(event.target.files || [])].slice(0, MAX_ATTACHMENTS);
          setCompose({ ...compose, files: next });
          event.target.value = "";
        }} />
        {compose.files.length ? (
          <ul style={{ display: "grid", gap: 4, margin: "12px 0 0", padding: 0, listStyle: "none" }}>
            {compose.files.map((file, index) => (
              <li key={`${file.name}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                <button type="button" aria-label={tr("Quitar {name}", { name: file.name })} onClick={() => setCompose({ ...compose, files: compose.files.filter((_, item) => item !== index) })} style={{ border: "none", background: "transparent", color: ash, cursor: "pointer" }}><X size={14} /></button>
              </li>
            ))}
          </ul>
        ) : null}
        <p style={{ color: ash, fontSize: 11 }}>{tr("Sale como STAFF My K-Pop Binder. Hasta 8 archivos y 3 MB.")}</p>
      </div>
    </form>
  );
}

function MailAttachment({ file, onError }: { file: MailFile; onError: (message: string) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const image = file.contentType.startsWith("image/");
  useEffect(() => {
    if (!image) return;
    let dead = false;
    let url = "";
    void (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/admin/mailbox?file=${encodeURIComponent(file.id)}`, { headers, cache: "no-store" });
        if (!res.ok || dead) return;
        url = URL.createObjectURL(await res.blob());
        if (!dead) setSrc(url);
      } catch {
        /* la descarga sigue disponible */
      }
    })();
    return () => {
      dead = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, image]);
  return (
    <button type="button" onClick={() => void downloadFile(file).catch((err) => onError(err instanceof Error ? err.message : tr("No se ha podido descargar el archivo.")))} style={{ width: 144, border: "1px solid rgba(26,22,19,.1)", background: "transparent", color: ink, textAlign: "left", padding: 10, cursor: "pointer" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: 80, objectFit: "cover", marginBottom: 8 }} /> : null}
      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14 }}>{file.filename}</span>
      <span style={{ display: "block", marginTop: 4, color: ash, fontSize: 11 }}>{formatSize(file.size)}</span>
    </button>
  );
}

async function downloadFile(file: MailFile) {
  const headers = await authHeaders();
  const res = await fetch(`/api/admin/mailbox?file=${encodeURIComponent(file.id)}`, { headers, cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || tr("No se ha podido descargar el archivo."));
  }
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename || "adjunto";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function toolStyle(active: boolean, disabled: boolean): CSSProperties {
  return {
    width: 32,
    height: 32,
    display: "grid",
    placeItems: "center",
    border: "none",
    borderRadius: 999,
    background: active ? ink : "transparent",
    color: active ? porcelain : ink,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.3 : 1,
  };
}

function folderBtn(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    textAlign: "left",
    border: "none",
    borderRadius: 8,
    padding: "6px 8px",
    background: active ? "rgba(26,22,19,.1)" : "transparent",
    color: ink,
    cursor: "pointer",
    font: "inherit",
    fontSize: 14,
  };
}

const kicker: CSSProperties = { margin: "8px 8px 4px", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: ash };
const emptyStyle: CSSProperties = { padding: "24px 16px", color: ash, fontSize: 14 };
const rowBtn: CSSProperties = { flex: 1, minWidth: 0, display: "grid", gap: 2, border: "none", background: "transparent", color: ink, textAlign: "left", cursor: "pointer", font: "inherit", padding: 0 };
const labelStyle: CSSProperties = { display: "grid", gap: 4, marginTop: 14, fontSize: 12, color: ash };
const fieldStyle: CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid rgba(26,22,19,.15)", background: porcelain, color: ink, padding: "8px 10px", font: "inherit" };
const tinyBtn: CSSProperties = { border: "1px solid rgba(26,22,19,.15)", background: "transparent", color: ink, borderRadius: 999, padding: "4px 8px", fontSize: 11, cursor: "pointer" };
