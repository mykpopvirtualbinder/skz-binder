"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Archive, FolderPlus, Forward, Loader2, Mail, Paperclip, RefreshCw, Reply, Send, Trash2, X } from "lucide-react";
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

type MailMessage = MailSummary & {
  text: string;
  html: string;
  messageId: string;
  attachments: MailFile[];
};

type MailFile = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

type MailFolder = {
  path: string;
  name: string;
  parentPath: string;
  specialUse: string;
  delimiter: string;
  selectable: boolean;
};

type MailFolderNode = MailFolder & { children: MailFolderNode[] };

type ComposeDraft = { to: string; subject: string; text: string; inReplyTo: string; files: File[] };

const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 3_500_000;

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
  return date.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function addressOnly(value: string) {
  return value.match(/<([^>]+)>/)?.[1] || value;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function saveMailFile(file: MailFile) {
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

function MailAttachment({ file, onSave }: { file: MailFile; onSave: (file: MailFile) => void }) {
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
        /* el botón de descarga sigue disponible */
      }
    })();
    return () => {
      dead = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, image]);
  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "start", maxWidth: 240 }}>
      {src ? <img src={src} alt="" style={{ width: 72, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid var(--color-border)" }} /> : null}
      <button type="button" onClick={() => onSave(file)} style={{ ...btnStyle, maxWidth: "100%" }} title={tr("Descargar {name}", { name: file.filename })}>
        <Paperclip size={14} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{file.filename}</span>
        <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>{formatSize(file.size)}</span>
      </button>
    </div>
  );
}

function plainBody(message: MailMessage) {
  if (message.text.trim()) return message.text;
  return message.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const FOLDER_ES: Record<string, { es: string; rank: number }> = {
  inbox: { es: "Bandeja de entrada", rank: 0 },
  bandejadeentrada: { es: "Bandeja de entrada", rank: 0 },
  sent: { es: "Enviados", rank: 1 },
  sentitems: { es: "Enviados", rank: 1 },
  sentmessages: { es: "Enviados", rank: 1 },
  sentmail: { es: "Enviados", rank: 1 },
  outbox: { es: "Enviados", rank: 1 },
  enviados: { es: "Enviados", rank: 1 },
  drafts: { es: "Borradores", rank: 2 },
  draft: { es: "Borradores", rank: 2 },
  borradores: { es: "Borradores", rank: 2 },
  archive: { es: "Archivo", rank: 3 },
  archives: { es: "Archivo", rank: 3 },
  archivo: { es: "Archivo", rank: 3 },
  junk: { es: "No deseado", rank: 4 },
  spam: { es: "No deseado", rank: 4 },
  junkemail: { es: "No deseado", rank: 4 },
  bulkmail: { es: "No deseado", rank: 4 },
  nodeseado: { es: "No deseado", rank: 4 },
  correonodeseado: { es: "No deseado", rank: 4 },
  trash: { es: "Eliminados", rank: 5 },
  deleted: { es: "Eliminados", rank: 5 },
  deleteditems: { es: "Eliminados", rank: 5 },
  deletedmessages: { es: "Eliminados", rank: 5 },
  bin: { es: "Eliminados", rank: 5 },
  papelera: { es: "Eliminados", rank: 5 },
  eliminados: { es: "Eliminados", rank: 5 },
  notes: { es: "Notas", rank: 6 },
  notas: { es: "Notas", rank: 6 },
  templates: { es: "Plantillas", rank: 6 },
  plantillas: { es: "Plantillas", rank: 6 },
  important: { es: "Importantes", rank: 6 },
  importantes: { es: "Importantes", rank: 6 },
  flagged: { es: "Destacados", rank: 6 },
  starred: { es: "Destacados", rank: 6 },
  destacados: { es: "Destacados", rank: 6 },
};

function folderKey(folder: MailFolder) {
  const leaf = folder.name || folder.path.split(/[./\\]/).pop() || folder.path;
  return leaf.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function knownFolder(folder: MailFolder) {
  if (folder.path.toUpperCase() === "INBOX" || folder.specialUse === "\\Inbox") return FOLDER_ES.inbox;
  if (folder.specialUse === "\\Sent") return FOLDER_ES.sent;
  if (folder.specialUse === "\\Drafts") return FOLDER_ES.drafts;
  if (folder.specialUse === "\\Archive") return FOLDER_ES.archive;
  if (folder.specialUse === "\\Junk") return FOLDER_ES.junk;
  if (folder.specialUse === "\\Trash") return FOLDER_ES.trash;
  return FOLDER_ES[folderKey(folder)] || null;
}

function folderEsName(folder: MailFolder) {
  return knownFolder(folder)?.es || folder.name || folder.path;
}

function folderLabel(folder: MailFolder) {
  return tr(folderEsName(folder));
}

function folderRank(folder: MailFolder) {
  return knownFolder(folder)?.rank ?? 10;
}

function buildTree(folders: MailFolder[]): MailFolderNode[] {
  const nodes = new Map<string, MailFolderNode>();
  for (const folder of folders) nodes.set(folder.path, { ...folder, children: [] });
  const roots: MailFolderNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentPath ? nodes.get(node.parentPath) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortNodes = (list: MailFolderNode[]) => {
    list.sort((a, b) => folderRank(a) - folderRank(b) || folderLabel(a).localeCompare(folderLabel(b), "es"));
    list.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);
  return roots;
}

function protectedFolder(folder: MailFolder | undefined) {
  if (!folder) return true;
  return Boolean(knownFolder(folder)) || Boolean(folder.specialUse) || folder.path.toUpperCase() === "INBOX";
}

function refreshBadges() {
  window.dispatchEvent(new Event("admin-pending-refresh"));
}

export default function AdminMailbox() {
  const { showAlert, showConfirm, uiLanguage } = useGlobal();
  bindAdminLang(uiLanguage);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [account, setAccount] = useState("info@mykpopbinder.com");
  const [box, setBox] = useState("INBOX");
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [messages, setMessages] = useState<MailSummary[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [compose, setCompose] = useState<ComposeDraft | null>(null);
  const [sending, setSending] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const tree = useMemo(() => buildTree(folders), [folders]);
  const current = folders.find((folder) => folder.path === box);
  const unseen = box === "inbox" || box.toUpperCase() === "INBOX" ? messages.filter((item) => !item.seen).length : 0;

  const loadList = useCallback(async (nextBox = box, fresh = false) => {
    setLoading(true);
    if (nextBox !== box) {
      setMessages([]);
      setPicked([]);
    }
    try {
      const headers = await authHeaders();
      const params = new URLSearchParams({ box: nextBox });
      if (fresh) params.set("fresh", "1");
      const res = await fetch(`/api/admin/mailbox?${params}`, { headers });
      const json = (await res.json().catch(() => ({}))) as {
        configured?: boolean;
        account?: string;
        box?: string;
        folders?: MailFolder[];
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
      if (!res.ok) throw new Error(json.error || tr("No se ha podido abrir la carpeta."));
      if (json.folders) setFolders(json.folders);
      if (json.box) setBox(json.box);
      setMessages(json.messages || []);
      refreshBadges();
    } catch (err) {
      showAlert(tr("Correo"), err instanceof Error ? err.message : tr("No se ha podido abrir la carpeta."));
    } finally {
      setLoading(false);
    }
  }, [box, showAlert]);

  useEffect(() => {
    void loadList("INBOX", true);
    // La primera carga abre la bandeja. Cambiar de carpeta llama a loadList aparte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!viewerOpen && !compose) return;
    const html = document.documentElement;
    const prevBody = document.body.style.overflow;
    const prevHtml = html.style.overflow;
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, [viewerOpen, compose]);

  const closeViewer = () => {
    setViewerOpen(false);
    setSelected(null);
    setCompose(null);
    setReading(false);
    setMoveTo("");
  };

  const openMessage = async (uid: string) => {
    setViewerOpen(true);
    setReading(true);
    setCompose(null);
    setSelected(null);
    setMoveTo("");
    try {
      const headers = await authHeaders();
      const params = new URLSearchParams({ uid: String(uid), box });
      const res = await fetch(`/api/admin/mailbox?${params}`, { headers });
      const json = (await res.json().catch(() => ({}))) as { message?: MailMessage; error?: string };
      if (!res.ok || !json.message) throw new Error(json.error || tr("No se ha podido abrir el mensaje."));
      setSelected(json.message);
      setMessages((prev) => prev.map((item) => (item.uid === uid ? { ...item, seen: true } : item)));
      refreshBadges();
    } catch (err) {
      closeViewer();
      showAlert(tr("Correo"), err instanceof Error ? err.message : tr("No se ha podido abrir el mensaje."));
    } finally {
      setReading(false);
    }
  };

  const postAction = async (payload: Record<string, unknown>) => {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/mailbox", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(json.error || tr("No se ha podido completar la acción."));
  };

  const moveMessage = async (uid: string, action: "delete" | "archive" | "move", destination = "") => {
    const titles = { delete: tr("Eliminar mensaje"), archive: tr("Archivar mensaje"), move: tr("Mover mensaje") };
    const bodies = {
      delete: tr("Se moverá a Eliminados."),
      archive: tr("Se moverá a Archivo."),
      move: tr("Se moverá a la carpeta elegida."),
    };
    const ok = await showConfirm(titles[action], bodies[action]);
    if (!ok) {
      setMoveTo("");
      return;
    }
    try {
      await postAction({ action, uid, box, destination });
      setMessages((prev) => prev.filter((item) => item.uid !== uid));
      closeViewer();
      refreshBadges();
    } catch (err) {
      showAlert(tr("Correo"), err instanceof Error ? err.message : tr("No se ha podido mover el mensaje."));
      setMoveTo("");
    }
  };

  const submitCompose = async () => {
    if (!compose) return;
    const total = compose.files.reduce((sum, file) => sum + file.size, 0);
    if (compose.files.length > MAX_ATTACHMENTS) {
      showAlert(tr("Correo"), tr("Puedes adjuntar hasta 8 archivos."));
      return;
    }
    if (total > MAX_ATTACHMENT_BYTES) {
      showAlert(tr("Correo"), tr("Los adjuntos pesan demasiado. El máximo es 3 MB."));
      return;
    }
    setSending(true);
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
      showAlert(tr("Correo"), tr("Mensaje enviado."));
    } catch (err) {
      showAlert(tr("Correo"), err instanceof Error ? err.message : tr("No se ha podido enviar."));
    } finally {
      setSending(false);
    }
  };

  const deletePicked = async () => {
    if (!picked.length) {
      showAlert(tr("Correo"), tr("Selecciona al menos un correo."));
      return;
    }
    const ok = await showConfirm(
      tr("Eliminar mensajes"),
      box === "trash" ? tr("Se borrarán del todo.") : tr("Se moverán a Eliminados."),
    );
    if (!ok) return;
    const gone = new Set(picked);
    try {
      await postAction({ action: "delete-many", uids: picked, box });
      setMessages((prev) => prev.filter((item) => !gone.has(item.uid)));
      setPicked([]);
      if (selected && gone.has(selected.uid)) closeViewer();
      refreshBadges();
    } catch (err) {
      showAlert(tr("Correo"), err instanceof Error ? err.message : tr("No se ha podido mover el mensaje."));
    }
  };

  const startReply = () => {
    if (!selected) return;
    const subject = /^re:/i.test(selected.subject) ? selected.subject : `Re: ${selected.subject}`;
    const quoted = plainBody(selected).split("\n").map((line) => `> ${line}`).join("\n");
    setCompose({
      to: addressOnly(selected.from),
      subject,
      text: `\n\n${quoted}`,
      inReplyTo: selected.messageId,
      files: [],
    });
  };

  const startForward = () => {
    if (!selected) return;
    const subject = /^(fwd|rv):/i.test(selected.subject) ? selected.subject : `Fwd: ${selected.subject}`;
    const quoted = [
      "",
      "",
      tr("---------- Mensaje reenviado ----------"),
      `De: ${selected.from}`,
      `Fecha: ${formatWhen(selected.date)}`,
      `Asunto: ${selected.subject}`,
      "",
      plainBody(selected),
    ].join("\n");
    setCompose({ to: "", subject, text: quoted, inReplyTo: "", files: [] });
  };

  const createSubfolder = async (atRoot: boolean) => {
    const name = folderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    try {
      await postAction({ action: "create-folder", parent: atRoot ? "" : box, name });
      setFolderName("");
      await loadList(box, true);
    } catch (err) {
      showAlert(tr("Correo"), err instanceof Error ? err.message : tr("No se ha podido crear la carpeta."));
    } finally {
      setCreatingFolder(false);
    }
  };

  const removeFolder = async () => {
    if (!current || protectedFolder(current)) return;
    const ok = await showConfirm(tr("Eliminar carpeta"), `Se borrará «${folderLabel(current)}» y los mensajes que contenga.`);
    if (!ok) return;
    try {
      await postAction({ action: "delete-folder", path: current.path });
      await loadList("INBOX", true);
    } catch (err) {
      showAlert(tr("Correo"), err instanceof Error ? err.message : tr("No se ha podido eliminar la carpeta."));
    }
  };

  if (!configured) {
    return (
      <div style={{ padding: 8 }}>
        <h2 style={{ marginTop: 0 }}>{tr("Correo")}</h2>
        <p style={{ color: "var(--text-muted)", maxWidth: 560, lineHeight: 1.5 }}>
          {tr("La bandeja de {account} está lista, pero el servidor todavía no tiene la contraseña del buzón. Añade ARSYS_MAIL_PASSWORD en Vercel, en los ajustes del proyecto, y vuelve a desplegar.", { account })}
        </p>
      </div>
    );
  }

  const renderBranch = (nodes: MailFolderNode[], depth: number) =>
    nodes.map((node) => (
      <div key={node.path}>
        <button
          type="button"
          disabled={!node.selectable}
          onClick={() => {
            if (!node.selectable) return;
            void loadList(node.path, false);
          }}
          style={{
            ...folderBtn,
            paddingLeft: 10 + depth * 14,
            fontWeight: node.path === box ? 900 : 700,
            background: node.path === box ? "var(--bg-soft)" : "transparent",
            color: node.selectable ? "var(--text-main)" : "var(--text-muted)",
          }}
        >
          <span style={{ minWidth: 0 }}>{folderLabel(node)}</span>
        </button>
        {node.children.length > 0 ? renderBranch(node.children, depth + 1) : null}
      </div>
    ));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div data-tour="mail-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>{tr("Correo")}{unseen > 0 && <span style={countStyle} title={tr("Sin leer")}>{unseen > 99 ? "99+" : unseen}</span>}
          </h2>
          <p style={{ margin: 0, fontWeight: 700 }}>STAFF My K-Pop Binder</p>
          <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 700 }}>{account}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            data-tour="mail-select"
            onClick={() => {
              const all = messages.length > 0 && messages.every((item) => picked.includes(item.uid));
              setPicked(all ? [] : messages.map((item) => item.uid));
            }}
            style={btnStyle}
          >
            {messages.length > 0 && messages.every((item) => picked.includes(item.uid)) ? tr("Quitar selección") : tr("Seleccionar todo")}
          </button>
          <button type="button" disabled={!picked.length} onClick={() => void deletePicked()} style={btnStyle}>
            <Trash2 size={14} />{tr("Eliminar selección")}{picked.length > 0 ? ` (${picked.length})` : ""}
          </button>
          <button type="button" onClick={() => void loadList(box, true)} style={btnStyle}>
            <RefreshCw size={14} />{tr("Actualizar")}</button>
          <button
            type="button"
            data-tour="mail-new"
            onClick={() => {
              closeViewer();
              setCompose({ to: "", subject: "", text: "", inReplyTo: "", files: [] });
            }}
            style={{ ...btnStyle, background: "var(--color-primary)", color: "#111", borderColor: "transparent" }}
          >
            <Mail size={14} />{tr("Nuevo")}</button>
        </div>
      </div>

      <div className="mail-shell">
        <aside data-tour="mail-folders" style={folderPane}>
          <div style={{ overflow: "auto", minHeight: 0 }}>{renderBranch(tree, 0)}</div>
          <div style={{ display: "grid", gap: 8, paddingTop: 10, borderTop: "1px solid var(--color-border)" }}>
            <input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder={tr("Nombre de la carpeta")}
              aria-label={tr("Nombre de la carpeta")}
              style={inputStyle}
            />
            <button type="button" disabled={creatingFolder || !folderName.trim()} onClick={() => void createSubfolder(false)} style={btnStyle}>
              <FolderPlus size={14} /> {tr("Subcarpeta de {name}", { name: current ? folderLabel(current) : tr("esta carpeta") })}
            </button>
            <button type="button" disabled={creatingFolder || !folderName.trim()} onClick={() => void createSubfolder(true)} style={btnStyle}>
              <FolderPlus size={14} />{tr("Carpeta en la raíz")}</button>
            {!protectedFolder(current) && (
              <button type="button" onClick={() => void removeFolder()} style={btnStyle}>
                <Trash2 size={14} /> {tr("Eliminar {name}", { name: folderLabel(current as MailFolder) })}
              </button>
            )}
          </div>
        </aside>

        <div data-tour="mail-list" style={{ ...cardStyle, padding: 0, maxHeight: 640, overflow: "auto", minWidth: 0 }}>
          {loading && messages.length === 0 ? (
            <p style={{ padding: 16, color: "var(--text-muted)" }}>{tr("Abriendo la carpeta…")}</p>
          ) : messages.length === 0 ? (
            <p style={{ padding: 16, color: "var(--text-muted)" }}>{tr("Esta carpeta está vacía.")}</p>
          ) : (
            messages.map((item, index) => (
              <div key={item.uid} style={{ display: "grid", gridTemplateColumns: "36px minmax(0, 1fr)", alignItems: "center", borderBottom: "1px solid var(--color-border)" }}>
                <input
                  type="checkbox"
                  checked={picked.includes(item.uid)}
                  aria-label={tr("Seleccionar")}
                  onChange={() => setPicked((prev) => prev.includes(item.uid) ? prev.filter((id) => id !== item.uid) : [...prev, item.uid])}
                  style={{ justifySelf: "center", width: 16, height: 16 }}
                />
                <button
                  type="button"
                  data-tour={index === 0 ? "mail-row" : undefined}
                  onClick={() => void openMessage(item.uid)}
                  style={{ ...rowStyle(item.seen), borderBottom: "none" }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: item.seen ? "transparent" : "var(--accent-vibe-pink)" }} />
                  <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                    <span style={ellipsis}>{current?.specialUse === "\\Sent" ? item.to || item.from || account : item.from || account}</span>
                    <span style={{ ...ellipsis, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={ellipsis}>{item.subject}</span>
                    {item.files > 0 ? <Paperclip size={13} aria-label={tr("Adjuntos")} /> : null}
                  </span>
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{formatWhen(item.date)}</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .mail-shell { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 12px; align-items: start; }
        .mail-html img, .mail-html table { max-width: 100%; }
        @media (max-width: 860px) { .mail-shell { grid-template-columns: 1fr; } }
        @keyframes mail-modal-in { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }
      `}</style>

      {viewerOpen && (
        <div role="presentation" onClick={closeViewer} style={overlayStyle}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selected?.subject || tr("Mensaje")}
            data-tour="mail-modal"
            onClick={(event) => event.stopPropagation()}
            style={dialogStyle}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexShrink: 0 }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: "0 0 6px" }}>{reading ? tr("Abriendo…") : selected?.subject || tr("(sin asunto)")}</h3>
                {selected && (
                  <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 700, lineHeight: 1.45 }}>
                    {selected.from}
                    {selected.to ? ` → ${selected.to}` : ""}
                    {" · "}
                    {formatWhen(selected.date)}
                  </p>
                )}
              </div>
              <button type="button" onClick={closeViewer} style={btnStyle} aria-label={tr("Cerrar")}><X size={14} /></button>
            </div>

            <div data-tour="mail-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
              <button type="button" data-tour="mail-reply" disabled={!selected} onClick={startReply} style={btnStyle}><Reply size={14} />{tr("Responder")}</button>
              <button type="button" data-tour="mail-forward" disabled={!selected} onClick={startForward} style={btnStyle}><Forward size={14} />{tr("Reenviar")}</button>
              <button type="button" data-tour="mail-archive" disabled={!selected} onClick={() => selected && void moveMessage(selected.uid, "archive")} style={btnStyle}><Archive size={14} />{tr("Archivar")}</button>
              <button type="button" data-tour="mail-delete" disabled={!selected} onClick={() => selected && void moveMessage(selected.uid, "delete")} style={btnStyle}><Trash2 size={14} />{tr("Eliminar")}</button>
              <label style={{ ...btnStyle, padding: "4px 10px" }}>{tr("Mover a")}<select
                  value={moveTo}
                  disabled={!selected}
                  onChange={(event) => {
                    const destination = event.target.value;
                    setMoveTo(destination);
                    if (selected && destination) void moveMessage(selected.uid, "move", destination);
                  }}
                  style={{ border: "none", background: "transparent", color: "inherit", font: "inherit", fontWeight: 800 }}
                >
                  <option value="">{tr("Elegir carpeta")}</option>
                  {folders.filter((folder) => folder.selectable && folder.path !== box).map((folder) => (
                    <option key={folder.path} value={folder.path}>
                      {folderLabel(folder)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selected?.attachments?.length ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0, maxHeight: 168, overflow: "auto" }}>
                {selected.attachments.map((file) => (
                  <MailAttachment
                    key={file.id}
                    file={file}
                    onSave={(item) => {
                      void saveMailFile(item).catch((err) => {
                        showAlert(tr("Correo"), err instanceof Error ? err.message : tr("No se ha podido descargar el archivo."));
                      });
                    }}
                  />
                ))}
              </div>
            ) : null}

            <div data-mail-scroll style={messageScroll}>
              {reading ? (
                <p style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Loader2 size={16} className="spinner" /> {tr("Leyendo el mensaje…")}
                </p>
              ) : selected?.html ? (
                <div className="mail-html" dangerouslySetInnerHTML={{ __html: selected.html }} />
              ) : (
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, lineHeight: 1.5 }}>{selected?.text || tr("(sin texto)")}</pre>
              )}
            </div>

            {compose && (
              <div style={{ flexShrink: 0, maxHeight: 240, overflow: "auto" }}>
                <ComposeBox compose={compose} setCompose={setCompose} sending={sending} onSend={() => void submitCompose()} onCancel={() => setCompose(null)} onWarn={(message) => showAlert(tr("Correo"), message)} />
              </div>
            )}
          </div>
        </div>
      )}

      {compose && !viewerOpen && (
        <div role="presentation" onClick={() => setCompose(null)} style={overlayStyle}>
          <div role="dialog" aria-modal="true" aria-label={tr("Nuevo mensaje")} data-tour="mail-compose" onClick={(event) => event.stopPropagation()} style={{ ...dialogStyle, height: "auto", maxHeight: "min(88vh, 720px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <h3 style={{ margin: 0 }}>{tr("Nuevo mensaje")}</h3>
              <button type="button" onClick={() => setCompose(null)} style={btnStyle} aria-label={tr("Cerrar")}><X size={14} /></button>
            </div>
            <div data-mail-scroll style={{ ...messageScroll, flex: "0 1 auto" }}>
              <ComposeBox compose={compose} setCompose={setCompose} sending={sending} onSend={() => void submitCompose()} onCancel={() => setCompose(null)} onWarn={(message) => showAlert(tr("Correo"), message)} />
            </div>
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
  onWarn,
}: {
  compose: ComposeDraft;
  setCompose: (next: ComposeDraft) => void;
  sending: boolean;
  onSend: () => void;
  onCancel: () => void;
  onWarn: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...compose.files];
    for (const file of Array.from(list)) {
      if (!file.size) continue;
      if (next.some((item) => item.name === file.name && item.size === file.size)) continue;
      next.push(file);
    }
    const total = next.reduce((sum, file) => sum + file.size, 0);
    if (next.length > MAX_ATTACHMENTS) {
      onWarn(tr("Puedes adjuntar hasta 8 archivos."));
      return;
    }
    if (total > MAX_ATTACHMENT_BYTES) {
      onWarn(tr("Los adjuntos pesan demasiado. El máximo es 3 MB."));
      return;
    }
    setCompose({ ...compose, files: next });
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <p style={{ margin: "0 0 8px", fontWeight: 700 }}>STAFF My K-Pop Binder</p>
      <label style={labelStyle}>{tr("Para")}<input value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} style={inputStyle} />
      </label>
      <label style={labelStyle}>{tr("Asunto")}<input value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} style={inputStyle} />
      </label>
      <textarea value={compose.text} onChange={(e) => setCompose({ ...compose, text: e.target.value })} rows={8} style={{ ...inputStyle, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button type="button" disabled={sending} onClick={() => fileRef.current?.click()} style={btnStyle}>
          <Paperclip size={14} />{tr("Adjuntar")}
        </button>
        {compose.files.map((file) => (
          <span key={`${file.name}-${file.size}`} style={fileChip}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{file.name}</span>
            <button
              type="button"
              aria-label={tr("Quitar {name}", { name: file.name })}
              disabled={sending}
              onClick={() => setCompose({ ...compose, files: compose.files.filter((item) => item !== file) })}
              style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: 0, display: "inline-flex" }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={sending} onClick={onSend} style={{ ...btnStyle, background: "var(--color-primary)", color: "#111", borderColor: "transparent" }}>
          {sending ? <Loader2 size={14} className="spinner" /> : <Send size={14} />}{tr("Enviar")}</button>
        <button type="button" onClick={onCancel} style={btnStyle}>{tr("Cancelar")}</button>
      </div>
    </div>
  );
}

function rowStyle(seen: boolean): CSSProperties {
  return {
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
    fontWeight: seen ? 600 : 900,
  };
}

const ellipsis: CSSProperties = { fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const fileChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  maxWidth: "100%",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  background: "var(--bg-soft)",
  color: "var(--text-main)",
  fontSize: 12,
  fontWeight: 700,
  padding: "6px 10px",
};

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

const folderBtn: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  border: "none",
  borderRadius: 10,
  padding: "8px 10px",
  cursor: "pointer",
  fontSize: 13,
};

const folderPane: CSSProperties = {
  display: "grid",
  gridTemplateRows: "minmax(180px, 1fr) auto",
  gap: 8,
  maxHeight: 640,
  padding: 10,
  borderRadius: 16,
  border: "1px solid var(--color-border)",
  background: "var(--bg-card)",
  minWidth: 0,
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 16,
  border: "1px solid var(--color-border)",
  background: "var(--bg-card)",
};

const labelStyle: CSSProperties = { display: "grid", gap: 4, fontSize: 12, fontWeight: 800, color: "var(--text-muted)" };

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
  overflow: "hidden",
};

const dialogStyle: CSSProperties = {
  width: "min(760px, 100%)",
  height: "min(88vh, 860px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 18,
  borderRadius: 20,
  border: "1px solid var(--color-border)",
  background: "var(--bg-card)",
  boxShadow: "0 24px 60px var(--shadow-card)",
  animation: "mail-modal-in 180ms ease-out",
};

const messageScroll: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  overscrollBehavior: "contain",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  padding: 14,
  background: "var(--bg-main)",
};
