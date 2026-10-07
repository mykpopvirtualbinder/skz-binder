"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { pingAdminInbox } from "@/lib/ping-admin-inbox";
import { useGlobal } from "../context/GlobalContext";
import { backdropPointerClose, useOverlayDismiss } from "@/lib/use-overlay-dismiss";

export type ColabOrigin = {
  originKind: string;
  originTitle: string;
  originGroup: string;
  originMember: string;
};

export type ColabForm = {
  asunto: string;
  email: string;
  mensaje: string;
  adjunto: string;
} & ColabOrigin;

const EMPTY_ORIGIN: ColabOrigin = {
  originKind: "albums",
  originTitle: "",
  originGroup: "",
  originMember: "",
};

const EMPTY: ColabForm = { asunto: "", email: "", mensaje: "", adjunto: "", ...EMPTY_ORIGIN };

export const COLAB_FILE_MAX_BYTES = 8 * 1024 * 1024;

export function colabFileError(file: File, t: (key: string) => string): string | null {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return t("library.colab_modal.file_type");
  if (file.size > COLAB_FILE_MAX_BYTES) return t("library.colab_modal.file_too_big");
  return null;
}

export async function uploadColabAttachment(file: File, userId: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const fileName = `${userId}-colab-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("colaboraciones").upload(fileName, file, { contentType: file.type || undefined });
  if (error) throw error;
  return supabase.storage.from("colaboraciones").getPublicUrl(fileName).data.publicUrl;
}

export function ColabContributeStage() {
  return (
    <div className="colab-stage" aria-hidden>
      <div className="colab-stage__binder">
        <span className="colab-stage__page" />
      </div>
      <div className="colab-stage__card">
        <span className="colab-stage__photo" />
      </div>
      <div className="colab-stage__badge">+</div>
    </div>
  );
}

export function ColabFileField({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  const { t, showAlert } = useGlobal();
  return (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "5px" }}>
        {t("library.colab_modal.label_file")}
      </label>
      <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "0 0 8px 0", fontWeight: 600 }}>
        {t("library.colab_modal.file_hint")}
      </p>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "12px", borderRadius: "12px", border: "1px dashed var(--color-border)", background: "var(--bg-soft)", color: "var(--color-primary)", fontWeight: 900, cursor: "pointer" }}>
        {file ? file.name : t("library.colab_modal.file_pick")}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            if (!next) {
              onFile(null);
              return;
            }
            const problem = colabFileError(next, t);
            if (problem) {
              showAlert(t("common.error"), problem);
              e.target.value = "";
              onFile(null);
              return;
            }
            onFile(next);
          }}
        />
      </label>
    </div>
  );
}

const ORIGIN_KINDS = [
  ["albums", "library.modal.origin_album"],
  ["tours", "library.modal.origin_tour"],
  ["events", "library.modal.origin_event"],
  ["seasons-greetings", "library.modal.origin_seasons"],
  ["merch", "library.modal.origin_merch"],
  ["pop-ups", "library.modal.origin_popup"],
  ["memberships", "library.modal.origin_membership"],
  ["collabs", "library.modal.origin_collab"],
  ["other", "library.modal.origin_other"],
] as const;

export function originKindLabel(kind: string, t: (key: string) => string) {
  const row = ORIGIN_KINDS.find(([value]) => value === kind);
  return t(row?.[1] ?? "library.modal.origin_other");
}

export function withOriginMessage(kindLabel: string, origin: ColabOrigin, message: string) {
  return [
    `Tipo: ${kindLabel}`,
    `Colección: ${origin.originTitle.trim()}`,
    `Grupo: ${origin.originGroup.trim()}`,
    `Miembro: ${origin.originMember.trim()}`,
    "",
    message.trim(),
  ].join("\n");
}

const fieldStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid var(--color-border)",
  outline: "none",
  color: "var(--text-main)",
  background: "var(--bg-main)",
  fontWeight: 800,
} as const;

export function ColabOriginFields({
  value,
  onChange,
}: {
  value: ColabOrigin;
  onChange: (next: ColabOrigin) => void;
}) {
  const { t } = useGlobal();
  return (
    <>
      <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 700, fontSize: 13, lineHeight: 1.4 }}>
        {t("library.colab_modal.origin_note")}
      </p>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "5px" }}>
          {t("library.modal.origin_kind")}
        </label>
        <select
          value={value.originKind}
          onChange={(e) => onChange({ ...value, originKind: e.target.value })}
          style={fieldStyle}
        >
          {ORIGIN_KINDS.map(([kind, label]) => (
            <option key={kind} value={kind}>{t(label)}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "5px" }}>
          {t("library.modal.origin_title")}
        </label>
        <input
          type="text"
          placeholder={t("library.colab_modal.placeholder_origin_title")}
          value={value.originTitle}
          onChange={(e) => onChange({ ...value, originTitle: e.target.value })}
          style={fieldStyle}
        />
      </div>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "5px" }}>
          {t("library.modal.origin_group")}
        </label>
        <input
          type="text"
          placeholder={t("library.colab_modal.placeholder_origin_group")}
          value={value.originGroup}
          onChange={(e) => onChange({ ...value, originGroup: e.target.value })}
          style={fieldStyle}
        />
      </div>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "5px" }}>
          {t("library.modal.origin_member")}
        </label>
        <input
          type="text"
          placeholder={t("library.colab_modal.placeholder_origin_member")}
          value={value.originMember}
          onChange={(e) => onChange({ ...value, originMember: e.target.value })}
          style={fieldStyle}
        />
      </div>
    </>
  );
}

export default function ContributeColabModal({
  open,
  onClose,
  initialEmail = "",
  initialAsunto = "",
  initialMensaje = "",
}: {
  open: boolean;
  onClose: () => void;
  initialEmail?: string;
  initialAsunto?: string;
  initialMensaje?: string;
}) {
  const { t, showAlert } = useGlobal();
  const [form, setForm] = useState<ColabForm>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const close = useCallback(() => onClose(), [onClose]);
  useOverlayDismiss(open, close);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setForm({
      asunto: initialAsunto,
      email: initialEmail,
      mensaje: initialMensaje,
      adjunto: "",
      ...EMPTY_ORIGIN,
    });
  }, [open, initialAsunto, initialEmail, initialMensaje]);

  if (!open) return null;

  const submit = async () => {
    if (!form.asunto || !form.mensaje || !form.email || !form.originTitle.trim() || !form.originGroup.trim() || !form.originMember.trim()) {
      showAlert(t("common.error"), t("library.colab_modal.error_fields"));
      return;
    }
    if (file) {
      const problem = colabFileError(file, t);
      if (problem) {
        showAlert(t("common.error"), problem);
        return;
      }
    }
    try {
      setSending(true);
      const { data: { user } } = await supabase.auth.getUser();
      let fileUrl = "";
      if (file) {
        if (!user?.id) {
          showAlert(t("common.error"), t("library.colab_modal.file_login"));
          return;
        }
        fileUrl = await uploadColabAttachment(file, user.id);
      }
      const adjuntos = [fileUrl, form.adjunto.trim()].filter(Boolean).join("\n");
      const { data: created, error } = await supabase.from("buzon_colaboraciones").insert({
        user_id: user?.id,
        asunto: form.asunto,
        email: form.email,
        mensaje: withOriginMessage(originKindLabel(form.originKind, t), form, form.mensaje),
        adjuntos,
        status: "pendiente",
      }).select("id").maybeSingle();
      if (error) throw error;
      if (created?.id) void pingAdminInbox("buzon", created.id);
      showAlert(t("library.colab_modal.success_title"), t("library.colab_modal.success_msg"));
      onClose();
      setFile(null);
      setForm(EMPTY);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showAlert(t("library.colab_modal.error_title"), t("library.colab_modal.error_msg") + msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="library-colab-overlay"
      onClick={backdropPointerClose(close)}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay-strong)",
        backdropFilter: "blur(4px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        className="library-colab-shell"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--color-border)",
          width: "100%",
          maxWidth: "min(560px, calc(100vw - 40px))",
          borderRadius: "32px",
          padding: "30px",
          position: "relative",
          boxShadow: "0 25px 50px var(--overlay-soft)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button type="button" className="library-colab-close" onClick={close} aria-label="Cerrar">
          <X size={18} />
        </button>

        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <div style={{ margin: "0 auto 15px" }}>
            <ColabContributeStage />
          </div>
          <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "28px", margin: 0 }}>
            {t("library.colab_modal.title")}
          </h2>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "14px" }}>
            {t("library.colab_modal.subtitle")}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <ColabOriginFields value={form} onChange={(origin) => setForm({ ...form, ...origin })} />
          <div>
            <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "5px" }}>
              {t("library.colab_modal.label_subject")}
            </label>
            <input
              type="text"
              placeholder={t("library.colab_modal.placeholder_subject")}
              value={form.asunto}
              onChange={(e) => setForm({ ...form, asunto: e.target.value })}
              style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", color: "var(--text-main)", background: "var(--bg-main)" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "5px" }}>
              {t("library.colab_modal.label_email")}
            </label>
            <input
              type="email"
              placeholder={t("library.colab_modal.placeholder_email")}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", color: "var(--text-main)", background: "var(--bg-main)" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "5px" }}>
              {t("library.colab_modal.label_message")}
            </label>
            <textarea
              rows={3}
              placeholder={t("library.colab_modal.placeholder_message")}
              value={form.mensaje}
              onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
              style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", resize: "none", color: "var(--text-main)", background: "var(--bg-main)" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "2px" }}>
              {t("library.colab_modal.label_link")}
            </label>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "0 0 8px 0", fontWeight: 600 }}>
              {t("library.colab_modal.link_hint")}
            </p>
            <input
              type="text"
              placeholder={t("library.colab_modal.placeholder_link")}
              value={form.adjunto}
              onChange={(e) => setForm({ ...form, adjunto: e.target.value })}
              style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", color: "var(--text-main)", background: "var(--bg-main)" }}
            />
          </div>
          <ColabFileField file={file} onFile={setFile} />
          <div style={{ border: "1px dashed var(--color-border)", borderRadius: 14, background: "var(--bg-soft)", padding: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Sparkles size={14} color="var(--color-primary)" />
              <span style={{ fontSize: 12, fontWeight: 900, color: "var(--color-primary)" }}>
                {t("library.colab_modal.structure_title")}
              </span>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px 0", fontWeight: 700, lineHeight: 1.35 }}>
              {t("library.colab_modal.structure_hint")}
            </p>
            <div
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                padding: "8px 10px",
                background: "var(--bg-card)",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-main)", wordBreak: "break-word" }}>
                {t("library.colab_modal.structure_example")}
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-main)", wordBreak: "break-word" }}>
                {t("library.colab_modal.structure_example_back")}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: "15px",
              border: "none",
              background: "var(--color-primary)",
              color: "white",
              fontWeight: 900,
              fontSize: "16px",
              cursor: "pointer",
              marginTop: "10px",
            }}
          >
            {sending ? t("library.colab_modal.btn_sending") : t("library.colab_modal.btn_send")}
          </button>
        </div>
      </div>
    </div>
  );
}
