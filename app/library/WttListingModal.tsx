"use client";
import React, { useState, useEffect } from "react";
import { X, ArrowRightLeft, Send, CheckCircle2, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "../context/GlobalContext";

type Props = {
  open: boolean;
  itemId: number | null;
  initialPublicMessage: string;
  onSavePublicMessage: (itemId: number, value: string) => void;
  onClose: () => void;
  onSaved: () => void;
onOpenPicker?: () => void;
};

export default function WttListingModal({
  open,
  itemId,
  initialPublicMessage,
  onSavePublicMessage,
  onClose,
  onSaved,
  onOpenPicker,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [prefs, setPrefs] = useState<string[]>(["offers"]);
  const [comment, setComment] = useState("");
  const [country, setCountry] = useState("España");
const { t } = useGlobal();
  const togglePref = (id: string) => {
    setPrefs(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (open && itemId) {
      const loadAd = async () => {
        const { data } = await supabase
          .from("user_item_statuses")
          .select("origin_country")
          .eq("item_id", itemId)
          .eq("status", "wtt")
          .single();

        if (data) {
          setCountry(data.origin_country || "España");
        } else {
          setCountry("España");
        }
      };
      loadAd();
    }
  }, [open, itemId]);

  useEffect(() => {
    if (open) {
      setComment(initialPublicMessage || "");
    }
  }, [open, itemId, initialPublicMessage]);

  if (!open || !itemId) return null;

const handleSave = () => {
    let prefix = "";
    if (prefs.includes("offers")) prefix += "• Escucho ofertas de todo tipo. ";
    if (prefs.includes("member")) prefix += "• Cambio por cualquier otra del mismo miembro. ";
    if (prefs.includes("ot8")) prefix += "• Cambio por cualquier carta del grupo (OT8). ";
    if (prefs.length > 0) prefix += "\n";

    const publicMessage = comment.trim();
    const finalComment = (prefix + publicMessage).trim();

    onSavePublicMessage(itemId, finalComment);
    // 👇 ESTA ES LA LÍNEA NUEVA VITAL 👇
    localStorage.setItem(`binder:wttMessage:${itemId}`, finalComment); 
    localStorage.setItem(`binder:market:${itemId}`, country);

    onSaved();
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 900,
    color: "var(--text-muted)",
    marginBottom: "8px",
    display: "block",
    textTransform: "uppercase",
  };

  return (
   <div className="wtt-modal-overlay" style={{ position: "fixed", inset: 0, background: "var(--overlay-strong)", zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
      <div className="wtt-modal-shell" style={{ background: "var(--bg-card)", borderRadius: "24px", width: "100%", maxWidth: "450px", overflow: "hidden", border: "1px solid var(--color-border)", boxShadow: "0 20px 50px var(--shadow-card)" }}>

        {/* HEADER */}
        <div className="wtt-modal-header" style={{ padding: "18px 24px", background: "var(--bg-soft)", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-heading)" }}>
            <ArrowRightLeft size={20} strokeWidth={2.2} />
            <h2 className="tan-font" style={{ margin: 0, fontSize: "20px", color: "inherit" }}>
                {t('wtt.modal_title')}
            </h2>
          </div>
          <X onClick={onClose} style={{ cursor: "pointer", color: "var(--text-muted)" }} size={22} />
        </div>

        <div className="wtt-modal-body" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>

         {/* PAÍS */}
          <div>
            <label style={labelStyle}>{t('wtt.location')}</label>
            <input value={country} onChange={e => setCountry(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "var(--text-main)", fontWeight: 700, outline: "none" }} />
          </div>

         {/* OPCIONES DE CAMBIO (MULTISELECCIÓN) */}
<div>
  <label style={labelStyle}>{t('wtt.conditions_label')}</label>
  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
    {[
      { id: "offers", label: "Escucho cualquier oferta", icon: <MessageCircle size={14}/> },
      { id: "member", label: "Cualquiera del mismo miembro", icon: <CheckCircle2 size={14}/> },
      { id: "ot8", label: "Cualquiera del mismo grupo (OT8)", icon: <CheckCircle2 size={14}/> },
    ].map(opt => {
      const isSelected = prefs.includes(opt.id); // 👈 Aquí se definen para que no den error
      return (
        <button
          key={opt.id}
          type="button"
          onClick={() => togglePref(opt.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "12px",
            border: isSelected
              ? "2px solid color-mix(in srgb, var(--text-heading) 45%, var(--color-border))"
              : "1px solid var(--color-border)",
            background: isSelected
              ? "color-mix(in srgb, var(--text-heading) 14%, var(--bg-soft))"
              : "var(--bg-card)",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.2s"
          }}
        >
          <span style={{ color: isSelected ? "var(--text-heading)" : "var(--text-muted)" }}>{opt.icon}</span>
          <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-main)" }}>
            {t(`wtt.opt_${opt.id}`) || opt.label}
          </span>
        </button>
      );
    })}
  </div>
</div>

          {/* Nota pública: aviso visible + placeholder en naranja Monokai */}
          <div>
            <p className="wtt-modal-hint">{t("wtt.hint_note")}</p>
            <textarea
              className="wtt-modal-note"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("wtt.placeholder")}
              rows={4}
              maxLength={180}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid var(--color-border)",
                background: "var(--bg-main)",
                color: "var(--text-main)",
                fontWeight: 600,
                resize: "none",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            style={{
              width: "100%",
              background: "var(--color-primary)",
              color: "var(--modal-cta-fg)",
              border: "none",
              padding: "15px",
              borderRadius: "99px",
              fontWeight: 900,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              boxShadow: "var(--modal-cta-shadow)",
            }}
          >
            {loading ? t('common.saving') : <><Send size={18} strokeWidth={2.2} /> {t('wtt.btn_next')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}