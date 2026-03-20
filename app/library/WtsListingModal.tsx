"use client";

import React, { useEffect, useMemo, useState } from "react";

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
  height: 36,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #FFD9E6",
  background: "#FFF5FA",
  fontSize: 13,
  color: "#8C659C",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#8C659C",
  fontWeight: 900,
};

const softPinkBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #F7A8D8",
  background: "#FFF5FA",
  color: "#8C659C",
  cursor: "pointer",
  fontWeight: 900,
};

const whitePinkBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #F7A8D8",
  background: "white",
  color: "#8C659C",
  cursor: "pointer",
  fontWeight: 900,
};

/* ---------- MONEDAS ---------- */

const currencyOptions = [
  { code: "EUR", label: "€ Euro - EUR" },
  { code: "USD", label: "$ US Dollar - USD" },
  { code: "GBP", label: "£ British Pound - GBP" },
  { code: "JPY", label: "¥ Japanese Yen - JPY" },
  { code: "KRW", label: "₩ Korean Won - KRW" },
  { code: "CNY", label: "¥ Chinese Yuan - CNY" },
  { code: "AUD", label: "$ Australian Dollar - AUD" },
  { code: "CAD", label: "$ Canadian Dollar - CAD" },
  { code: "CHF", label: "CHF Swiss Franc - CHF" },
  { code: "SEK", label: "kr Swedish Krona - SEK" },
  { code: "NOK", label: "kr Norwegian Krone - NOK" },
  { code: "DKK", label: "kr Danish Krone - DKK" },
  { code: "SGD", label: "$ Singapore Dollar - SGD" },
  { code: "HKD", label: "$ Hong Kong Dollar - HKD" },
  { code: "NZD", label: "$ New Zealand Dollar - NZD" },
  { code: "BRL", label: "R$ Brazilian Real - BRL" },
  { code: "MXN", label: "$ Mexican Peso - MXN" },
  { code: "INR", label: "₹ Indian Rupee - INR" },
  { code: "THB", label: "฿ Thai Baht - THB" },
  { code: "VND", label: "₫ Vietnamese Dong - VND" },
  { code: "IDR", label: "Rp Indonesian Rupiah - IDR" },
  { code: "MYR", label: "RM Malaysian Ringgit - MYR" },
  { code: "PHP", label: "₱ Philippine Peso - PHP" },
  { code: "TRY", label: "₺ Turkish Lira - TRY" },
  { code: "ZAR", label: "R South African Rand - ZAR" },
];

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
  const [price, setPrice] = useState("");
  const [currencyCode, setCurrencyCode] = useState("EUR");
  const [currencyInput, setCurrencyInput] = useState("€ Euro - EUR");
  const [originCountry, setOriginCountry] = useState("");

  useEffect(() => {
    if (!open || itemId == null) return;

    const p = localStorage.getItem(`binder:price:${itemId}`) ?? "";
    const savedCode = localStorage.getItem(`binder:wtsCurrency:${itemId}`) ?? "EUR";
    const o = localStorage.getItem(`binder:wtsOrigin:${itemId}`) ?? "";

    setPrice(p);
    setCurrencyCode(savedCode);

    const prettyCurrency =
      currencyOptions.find((c) => c.code === savedCode)?.label ?? "€ Euro - EUR";
    setCurrencyInput(prettyCurrency);

    setOriginCountry(o);
  }, [open, itemId]);

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

    // ✅ TU PRECIO
    localStorage.setItem(`binder:price:${itemId}`, price.trim());
    localStorage.setItem(`binder:wtsCurrency:${itemId}`, currencyCode);

    // ✅ PAÍS DE ENVÍO
    localStorage.setItem(`binder:wtsOrigin:${itemId}`, originCountry);

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

      if (e.key === "Enter") {
        e.preventDefault();
        save();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, canSave, price, currencyCode, originCountry, itemId, onClose, onSaved]);

  if (!open) return null;

  function setShipFrom(value: string): void {
    setOriginCountry(value);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 420,
          borderRadius: 18,
          overflow: "hidden",
          background: "#F7F4EE",
          border: "1px solid #F3DCE7",
        }}
      >
        <div
          style={{
            background: "#FFD9E6",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <img src="/branding/logo.png" alt="" style={{ height: 26 }} />
            <div style={{ fontWeight: 950, color: "#8C659C" }}>
              Publicar venta (WTS)
            </div>
          </div>

          <button style={whitePinkBtnStyle} onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          style={{
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div>
            <div style={labelStyle}>Precio</div>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={inputStyle}
              placeholder="Ej: 8"
            />
          </div>

          <div>
            <div style={labelStyle}>Moneda</div>
            <input
              list="binder-currency-list"
              value={currencyInput}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              style={inputStyle}
              placeholder="€ Euro - EUR"
            />
            <datalist id="binder-currency-list">
              {currencyOptions.map((c) => (
                <option key={c.code} value={c.label} />
              ))}
            </datalist>
          </div>

          <div>
            <div style={labelStyle}>País de origen del envío</div>
            <input
              list="binder-country-list"
              value={originCountry}
              onChange={(e) => setShipFrom(e.target.value)}
              placeholder="Spain 🇪🇸"
              style={inputStyle}
            />
            <datalist id="binder-country-list">
              {countryOptions.map((c) => (
                <option key={c.code} value={c.label} />
              ))}
            </datalist>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: 12,
            borderTop: "1px solid #F3DCE7",
          }}
        >
          <button style={whitePinkBtnStyle} onClick={onClose}>
            Cancelar
          </button>

          <button
            style={{
              ...softPinkBtnStyle,
              opacity: canSave ? 1 : 0.6,
              cursor: canSave ? "pointer" : "not-allowed",
            }}
            onClick={save}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}