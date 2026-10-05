"use client";

import { Bookmark } from "lucide-react";
import { BINDER_ACCENT_SWATCHES } from "@/lib/binder-color-swatches";
import type { CoverFaceKey, CoverFaceStyle } from "@/lib/binder-faces";

type Props = {
  faceKey: CoverFaceKey;
  title: string;
  style: CoverFaceStyle;
  binderColor: string;
  isVip: boolean;
  t: (key: string) => string;
  onPatch: (patch: CoverFaceStyle) => void;
  onPickImage: (file: File) => void;
  showVipAlert: () => void;
};

export default function BinderCoverFaceEditor({
  title,
  style,
  binderColor,
  isVip,
  t,
  onPatch,
  onPickImage,
  showVipAlert,
}: Props) {
  const fill = style.fill || null;
  const border = style.border || null;
  const imageUrl = style.imageUrl || null;
  const text = style.text || "";

  const swatchRow = (kind: "fill" | "border") => (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => onPatch(kind === "fill" ? { fill: null } : { border: null })}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "repeating-conic-gradient(#bbb 0% 25%, #fff 0% 50%) 50% / 10px 10px",
          border: !(kind === "fill" ? fill : border) ? "3px solid var(--text-main)" : "2px solid var(--color-border)",
          cursor: "pointer",
        }}
        title={t("binders.separator.no_color")}
      />
      {BINDER_ACCENT_SWATCHES.map((c) => {
        const current = kind === "fill" ? fill : border;
        const isSelected = current === c;
        return (
          <button
            key={`${kind}-${c}`}
            type="button"
            onClick={() => onPatch(kind === "fill" ? { fill: c } : { border: c })}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: c,
              border: isSelected ? "3px solid var(--text-main)" : "2px solid color-mix(in srgb, var(--color-border) 65%, transparent)",
              cursor: "pointer",
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        width: "320px",
        minHeight: "520px",
        padding: "30px",
        background: imageUrl ? "var(--bg-card)" : fill || "var(--bg-card)",
        borderRadius: "20px",
        boxShadow: "0 10px 30px var(--overlay-faint)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        border: border ? `4px solid ${border}` : "4px solid transparent",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35, zIndex: 0 }}
        />
      )}
      <div style={{ zIndex: 1, position: "relative", width: "100%" }}>
        <Bookmark size={50} color={fill || border || binderColor || "var(--color-primary)"} style={{ marginBottom: 15, margin: "0 auto" }} />
        <h3 className="tan-font" style={{ color: "var(--text-main)", fontWeight: 950, marginBottom: 15, fontSize: 18 }}>
          {title}
        </h3>
        <div style={{ width: "100%", marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 900, marginBottom: 8, textTransform: "uppercase" }}>
            {t("binders.cover_faces.title_field")}
          </p>
          <input
            type="text"
            placeholder={t("binders.cover_faces.title_placeholder")}
            style={{
              height: 40,
              padding: "8px 12px",
              borderRadius: 12,
              border: "2px solid var(--color-border)",
              width: "100%",
              textAlign: "center",
              fontSize: 16,
              fontWeight: 900,
              color: "var(--text-main)",
              outline: "none",
              boxSizing: "border-box",
            }}
            value={text}
            onChange={(e) => onPatch({ text: e.target.value })}
          />
        </div>
        <div style={{ width: "100%", marginBottom: 14 }}>
          <p style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 900, marginBottom: 8, textTransform: "uppercase" }}>
            {t("binders.separator.fill_color")}
          </p>
          {swatchRow("fill")}
        </div>
        <div style={{ width: "100%", marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 900, marginBottom: 8, textTransform: "uppercase" }}>
            {t("binders.separator.border_color")}
          </p>
          {swatchRow("border")}
        </div>
        <div style={{ width: "100%" }}>
          <p style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 900, marginBottom: 8, textTransform: "uppercase" }}>
            {t("binders.cover_faces.background")}
          </p>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg-soft)",
              border: "1px solid var(--color-primary)",
              color: "var(--color-primary)",
              padding: 10,
              borderRadius: 10,
              fontWeight: 900,
              cursor: "pointer",
              width: "100%",
              fontSize: 11,
              boxSizing: "border-box",
            }}
          >
            {imageUrl ? t("binders.cover_faces.change_image") : t("binders.cover_faces.upload_image")}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onClick={(e) => {
                if (!isVip) {
                  e.preventDefault();
                  showVipAlert();
                }
              }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPickImage(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
