"use client";

import { STOCK_BUCKETS, type CollectionCounts } from "@/lib/collection-summary";
import { useGlobal } from "@/app/context/GlobalContext";

export default function CollectionSummary({ counts, wishlist }: { counts: CollectionCounts; wishlist?: number }) {
  const { t } = useGlobal();
  const rows = STOCK_BUCKETS.filter((key) => (counts[key] || 0) > 0);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "18px 22px" }}>
      {rows.map((key) => (
        <div key={key} style={{ minWidth: 88 }}>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "var(--color-primary)", lineHeight: 1 }}>{counts[key]}</div>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginTop: "6px" }}>
            {t(`collection.buckets.${key}`)}
          </div>
        </div>
      ))}
      {wishlist != null ? (
        <div style={{ minWidth: 88 }}>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "var(--state-warning-fg)", lineHeight: 1 }}>{wishlist}</div>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--state-warning-fg)", textTransform: "uppercase", marginTop: "6px" }}>
            {t("collection.buckets.wishlist")}
          </div>
        </div>
      ) : null}
    </div>
  );
}
