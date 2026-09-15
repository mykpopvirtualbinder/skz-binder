"use client";

import { Handshake } from "lucide-react";
import { COLLAB_CATALOG_KOINS } from "@/lib/collab-reward";

export default function ContributeEmptyState({
  t,
  onOpenColab,
}: {
  t: (key: string) => string;
  onOpenColab: () => void;
}) {
  const body = t("common.contribute_empty_body").replace("{{amount}}", String(COLLAB_CATALOG_KOINS));
  return (
    <div
      style={{
        textAlign: "center",
        padding: "36px 20px 50px",
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      <h3
        className="tan-font"
        style={{ color: "var(--color-primary)", fontSize: 26, margin: "0 0 12px" }}
      >
        {t("common.contribute_empty_title")}
      </h3>
      <p
        style={{
          color: "var(--text-subheading)",
          fontWeight: 600,
          fontSize: 15,
          lineHeight: 1.6,
          margin: "0 0 22px",
        }}
      >
        {body}
      </p>
      <button
        type="button"
        onClick={onOpenColab}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 18px",
          borderRadius: 999,
          border: "1px solid var(--color-border)",
          background: "var(--bg-card)",
          color: "var(--color-primary)",
          fontWeight: 900,
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "0 4px 14px color-mix(in srgb, var(--color-primary) 18%, transparent)",
        }}
      >
        <Handshake size={18} strokeWidth={2.2} aria-hidden />
        {t("library.colab_button")}
      </button>
    </div>
  );
}
