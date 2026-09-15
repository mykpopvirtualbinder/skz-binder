"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "../context/GlobalContext";

export type ColabForm = {
  asunto: string;
  email: string;
  mensaje: string;
  adjunto: string;
};

const EMPTY: ColabForm = { asunto: "", email: "", mensaje: "", adjunto: "" };

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
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      asunto: initialAsunto,
      email: initialEmail,
      mensaje: initialMensaje,
      adjunto: "",
    });
  }, [open, initialAsunto, initialEmail, initialMensaje]);

  if (!open) return null;

  const submit = async () => {
    if (!form.asunto || !form.mensaje || !form.email) {
      showAlert(t("common.error"), t("library.colab_modal.error_fields"));
      return;
    }
    try {
      setSending(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("buzon_colaboraciones").insert({
        user_id: user?.id,
        asunto: form.asunto,
        email: form.email,
        mensaje: form.mensaje,
        adjuntos: form.adjunto,
        status: "pendiente",
      });
      if (error) throw error;
      showAlert(t("library.colab_modal.success_title"), t("library.colab_modal.success_msg"));
      onClose();
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
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "none",
            border: "none",
            color: "var(--color-primary)",
            cursor: "pointer",
          }}
        >
          <X size={24} />
        </button>

        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <div
            aria-hidden
            style={{
              margin: "0 auto 15px",
              width: "100%",
              maxWidth: "100%",
              aspectRatio: "1440 / 810",
              position: "relative",
              borderRadius: 20,
              overflow: "hidden",
              background: "var(--bg-soft)",
              boxShadow: "0 8px 24px color-mix(in srgb, var(--color-primary) 12%, transparent)",
            }}
          >
            <video
              src="/colab-modal-hero.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none",
                background: "var(--bg-soft)",
              }}
            />
          </div>
          <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "28px", margin: 0 }}>
            {t("library.colab_modal.title")}
          </h2>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "14px" }}>
            {t("library.colab_modal.subtitle")}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
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
