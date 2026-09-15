"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react"; // Importamos el icono para el comentario
import { useGlobal } from "../context/GlobalContext";
import { getCurrencyOptions } from "./currencyOptions";
type WtsListingModalProps = {
  open: boolean;
  itemId: number | null;
  onClose: () => void;
  onSaved?: () => void;
};

/* ---------- estilos corporativos ---------- */
const countryList = [
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
];
const inputStyle: React.CSSProperties = {
  height: 38,
  padding: "6px 12px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--bg-main)",
  fontSize: 13,
  color: "var(--text-main)",
  width: "100%",
  boxSizing: "border-box",
  outline: "none"
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--color-primary)",
  fontWeight: 900,
  marginBottom: 4,
  display: "block"
};

const softPinkBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--bg-soft)",
  color: "var(--color-primary)",
  cursor: "pointer",
  fontWeight: 900,
};

const whitePinkBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--bg-card)",
  color: "var(--color-primary)",
  cursor: "pointer",
  fontWeight: 900,
};

const countryOptions = countryList.map((c) => ({
  code: c.code,
  label: `${c.name} ${c.flag}`,
}));

/* ---------- COMPONENTE ---------- */

export default function WtsListingModal({
  open,
  itemId,
  onClose,
  onSaved,
}: WtsListingModalProps) {
  const { t, profile } = useGlobal();
  const currencyOptions = useMemo(
    () =>
      getCurrencyOptions(profile?.language ?? "es").map((currency) => ({
        code: currency.code,
        label: `${currency.symbol} ${currency.name} - ${currency.code}`,
      })),
    [profile?.language],
  );
  
  const [price, setPrice] = useState("");
  // ... el resto de tus estados e useEffects
  const [currencyCode, setCurrencyCode] = useState("EUR");
  const [currencyInput, setCurrencyInput] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  
  // NUEVOS CAMPOS
  const [shippingTo, setShippingTo] = useState("Worldwide");
  const [negotiable, setNegotiable] = useState(false);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open || itemId == null) return;

    const p = localStorage.getItem(`binder:price:${itemId}`) ?? "";
    const savedCode = localStorage.getItem(`binder:wtsCurrency:${itemId}`) ?? "EUR";
    const o = localStorage.getItem(`binder:wtsOrigin:${itemId}`) ?? "";
    
    // Cargar nuevos campos si existen
    const s = localStorage.getItem(`binder:shipping:${itemId}`) ?? "Worldwide";
    const n = localStorage.getItem(`binder:negotiable:${itemId}`) === "true";
    const c = localStorage.getItem(`binder:comment:${itemId}`) ?? "";

    setPrice(p);
    setCurrencyCode(savedCode);

    const prettyCurrency =
      currencyOptions.find((c) => c.code === savedCode)?.label ?? savedCode;
    setCurrencyInput(prettyCurrency);

    setOriginCountry(o);
    setShippingTo(s);
    setNegotiable(n);
    setComment(c);
  }, [open, itemId, currencyOptions]);

  const canSave = useMemo(() => {
    return itemId != null && price.trim() !== "";
  }, [itemId, price]);

  const handleCurrencyChange = (value: string) => {
    setCurrencyInput(value);

    const byLabel = currencyOptions.find(
      (c) => c.label.toLowerCase() === value.toLowerCase()
    );
    if (byLabel) {
      setCurrencyCode(byLabel.code);
      return;
    }

    const byCode = currencyOptions.find(
      (c) => c.code.toLowerCase() === value.trim().toLowerCase()
    );
    if (byCode) {
      setCurrencyCode(byCode.code);
      setCurrencyInput(byCode.label);
    }
  };

  const save = () => {
    if (!canSave || itemId == null) return;

    // ✅ GUARDAR DATOS ANTIGUOS
    localStorage.setItem(`binder:price:${itemId}`, price.trim());
    localStorage.setItem(`binder:wtsCurrency:${itemId}`, currencyCode);
    localStorage.setItem(`binder:wtsOrigin:${itemId}`, originCountry);
    
    // ✅ GUARDAR NUEVOS CAMPOS
    localStorage.setItem(`binder:shipping:${itemId}`, shippingTo);
    localStorage.setItem(`binder:negotiable:${itemId}`, String(negotiable));
    localStorage.setItem(`binder:comment:${itemId}`, comment.trim());

    // ❌ NO tocar binder:market:${itemId}
    onSaved?.();
  };

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }

      // Si el usuario está escribiendo en el textarea, no disparamos el enter
      const target = e.target as HTMLElement;
      if (e.key === "Enter" && target.tagName.toLowerCase() !== 'textarea') {
        e.preventDefault();
        save();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, canSave, price, currencyCode, originCountry, shippingTo, negotiable, comment, itemId, onClose, onSaved]);

  if (!open) return null;

  function setShipFrom(value: string): void {
    setOriginCountry(value);
  }

  return (
   <div
  className="wts-modal-overlay"
  style={{
    position: "fixed",
    inset: 0,
    background: "var(--overlay-strong)", // Un poco más oscuro para que resalte el modal
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999999,
    padding: "20px",
    backdropFilter: "blur(4px)" // Efecto desenfoque muy moderno
  }}
  onMouseDown={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <div
    className="wts-modal-shell"
    style={{
      width: "100%",
      maxWidth: 460,
      borderRadius: 24,
      overflow: "hidden",
      background: "var(--bg-card)",       // Fondo del modal dinámico
      border: "1px solid var(--color-border)",
      maxHeight: "90vh",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 20px 40px var(--shadow-card)"
    }}
  >
       <div
  className="wts-modal-header"
  style={{
    background: "var(--bg-soft)", // Antes var(--bg-soft)
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
    borderBottom: "1px solid var(--color-border)"
  }}
>
  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
    <img src="/branding/logo.png" alt="" style={{ height: 26 }} />
    <div style={{ fontWeight: 950, color: "var(--color-primary)", fontSize: "18px" }}>
      {t('wts_listing.header_title')}
    </div>
  </div>

          <button style={{...whitePinkBtnStyle, padding: "4px 8px"}} onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          className="wts-modal-body"
          style={{
            padding: "20px 20px",
            display: "grid",
            gap: 16,
            overflowY: "auto",
            flex: 1
          }}
        >
          {/* FILA 1: Precio y Moneda */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>{t("wts_listing.price_label")}</div>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={inputStyle}
                placeholder={t("wts_listing.price_placeholder")}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>{t("wts_listing.currency_label")}</div>
              <input
                list="binder-currency-list"
                value={currencyInput}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                style={inputStyle}
                placeholder={t("wts_listing.currency_placeholder")}
              />
              <datalist id="binder-currency-list">
                {currencyOptions.map((c) => (
                  <option key={c.code} value={c.label} />
                ))}
              </datalist>
            </div>
          </div>

          {/* FILA 2: Origen y Envío */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>{t("wts_listing.origin_country_label")}</div>
              <input
                list="binder-country-list"
                value={originCountry}
                onChange={(e) => setShipFrom(e.target.value)}
                placeholder={t("wts_listing.origin_country_placeholder")}
                style={inputStyle}
              />
              <datalist id="binder-country-list">
                {countryOptions.map((c) => (
                  <option key={c.code} value={c.label} />
                ))}
              </datalist>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>{t("wts_listing.shipping_to_label")}</div>
              <select 
                value={shippingTo} 
                onChange={(e) => setShippingTo(e.target.value)} 
                style={{...inputStyle, WebkitAppearance: "none"}}
              >
                <option value="Worldwide">{t("wts_listing.shipping_options.worldwide")}</option>
                <option value="EU">{t("wts_listing.shipping_options.eu")}</option>
                <option value="USA">{t("wts_listing.shipping_options.usa")}</option>
                <option value="National">{t("wts_listing.shipping_options.national")}</option>
              </select>
            </div>
          </div>

         {/* CHECKBOX NEGOCIABLE */}
<label style={{ 
  display: "flex", alignItems: "center", gap: "10px", 
  background: "var(--bg-main)", padding: "12px", borderRadius: "12px", 
  border: "1px solid var(--color-border)", cursor: "pointer" 
}}>
  <input 
    type="checkbox" 
    checked={negotiable} 
    onChange={(e) => setNegotiable(e.target.checked)} 
    style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }} 
  />
  <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--color-primary)" }}>
    {t("wts_listing.negotiable_label")}
  </span>
</label>

         {/* COMENTARIO */}
<div>
  <div style={{...labelStyle, display: "flex", alignItems: "center", gap: "6px"}}>
    <MessageSquare size={14} /> {t("wts_listing.comment_label")}
  </div>
  <textarea 
    placeholder={t("wts_listing.comment_placeholder")} 
    rows={3} 
    value={comment} 
    onChange={(e) => setComment(e.target.value)} 
    style={{ 
      ...inputStyle, 
      height: "auto", 
      resize: "none", 
      padding: "10px",
      fontFamily: "inherit"
    }} 
  />
  <div style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "right", marginTop: "4px", fontWeight: 700 }}>
    {t("wts_listing.comment_limit")}
  </div>
</div>
        </div>

       <div
  className="wts-modal-footer"
  style={{
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "14px 20px",
    borderTop: "1px solid var(--color-border)",
    background: "var(--bg-card)",
    flexShrink: 0
  }}
>
  <button style={{...whitePinkBtnStyle, padding: "10px 16px"}} onClick={onClose}>
    {t("wts_listing.btn_cancel")}
  </button>

  <button
    style={{
      ...softPinkBtnStyle,
      background: canSave ? "var(--color-primary)" : "var(--bg-soft)",
      color: canSave ? "white" : "var(--text-muted)",
      border: "none",
      padding: "10px 20px",
      opacity: canSave ? 1 : 0.6,
      cursor: canSave ? "pointer" : "not-allowed",
      boxShadow: canSave ? "0 4px 15px var(--shadow-card)" : "none"
    }}
    onClick={save}
  >
    {t("wts_listing.btn_submit")}
  </button>
</div>
      </div>
    </div>
  );
}