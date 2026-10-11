"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { backdropPointerClose, useOverlayDismiss } from "@/lib/use-overlay-dismiss";
import { useGlobal } from "../context/GlobalContext";

type SeparatorLink = {
  pageIndex: number;
  name: string;
};

type InfoData = {
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  pcCount: number;
  separators: SeparatorLink[];
};

async function fetchBinderInfo(binderId: number): Promise<InfoData> {
  let title = "";
  let createdAt: string | null = null;
  let updatedAt: string | null = null;

  const full = await supabase
    .from("binders")
    .select("title, created_at, updated_at")
    .eq("id", binderId)
    .single();

  if (full.error) {
    const basic = await supabase.from("binders").select("title").eq("id", binderId).single();
    title = basic.data?.title || "";
  } else {
    const row = full.data as { title?: string | null; created_at?: string | null; updated_at?: string | null };
    title = row?.title || "";
    createdAt = row?.created_at ?? null;
    updatedAt = row?.updated_at ?? null;
  }

  const pagesRes = await supabase
    .from("binder_pages")
    .select("id, page_index, layout_type")
    .eq("binder_id", binderId)
    .order("page_index", { ascending: true });

  const pages = ((pagesRes.data ?? []) as Array<{ id: number; page_index: number | null; layout_type: string | null }>)
    .map((p) => ({
      id: Number(p.id),
      pageIndex: typeof p.page_index === "number" ? p.page_index : 0,
      layout: String(p.layout_type || ""),
    }))
    .sort((a, b) => a.pageIndex - b.pageIndex);

  const pageIds = pages.map((p) => p.id);
  const slots = pageIds.length
    ? (((
        await supabase
          .from("page_slots")
          .select("page_id, item_id, is_custom, custom_text, custom_image_url")
          .in("page_id", pageIds)
      ).data ?? []) as Array<{
        page_id: number;
        item_id: number | null;
        is_custom: boolean | null;
        custom_text: string | null;
        custom_image_url: string | null;
      }>)
    : [];

  const separatorIds = new Set(pages.filter((p) => p.layout === "separator").map((p) => p.id));
  const pcCount = slots.filter((slot) => {
    if (separatorIds.has(Number(slot.page_id))) return false;
    if (slot.item_id) return true;
    return Boolean(slot.is_custom && slot.custom_image_url);
  }).length;

  const separators = pages
    .map((page, sortedIndex) => ({ page, sortedIndex }))
    .filter(({ page }) => page.layout === "separator")
    .map(({ page, sortedIndex }) => {
      const text = slots.find((slot) => Number(slot.page_id) === page.id && String(slot.custom_text || "").trim())?.custom_text;
      return { pageIndex: sortedIndex, name: String(text || "").trim() };
    });

  return { title, createdAt, updatedAt, pcCount, separators };
}

function formatWhen(iso: string | null, lang: string) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });
}

export default function BinderInfoModal({
  open,
  binderId,
  onClose,
  onOpenPage,
}: {
  open: boolean;
  binderId: number | null;
  onClose: () => void;
  onOpenPage: (pageIndex: number) => void;
}) {
  const { t, uiLanguage } = useGlobal();
  const [info, setInfo] = useState<InfoData | null>(null);
  const [loading, setLoading] = useState(false);
  const close = useCallback(() => onClose(), [onClose]);
  useOverlayDismiss(open, close);

  useEffect(() => {
    if (!open || binderId == null) return;
    let cancelled = false;
    setLoading(true);
    setInfo(null);
    void fetchBinderInfo(binderId).then((next) => {
      if (cancelled) return;
      setInfo(next);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, binderId]);

  if (!open || typeof document === "undefined") return null;

  const lang = uiLanguage || "es";
  const created = formatWhen(info?.createdAt ?? null, lang);
  const updated = formatWhen(info?.updatedAt ?? null, lang);
  const rows = [
    { label: t("binders.info.name"), value: info?.title || "—" },
    { label: t("binders.info.created"), value: created || t("binders.info.unknown_date") },
    { label: t("binders.info.updated"), value: updated || t("binders.info.unknown_date") },
    { label: t("binders.info.pcs"), value: info ? String(info.pcCount) : "—" },
  ];

  return createPortal(
    <div
      onClick={backdropPointerClose(close)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 36000,
        background: "var(--overlay-medium)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        data-modal-scroll
        style={{
          width: "min(440px, 100%)",
          maxHeight: "min(82dvh, 640px)",
          overflow: "auto",
          background: "var(--bg-card)",
          color: "var(--text-main)",
          borderRadius: 20,
          border: "1px solid var(--color-border)",
          padding: 18,
          boxShadow: "0 18px 50px var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 950 }}>{t("binders.info.title")}</h3>
          <button
            type="button"
            onClick={close}
            aria-label={t("binders.actions.cancel")}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "1px solid var(--color-border)",
              background: "var(--bg-main)",
              color: "var(--text-main)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {loading || !info ? (
          <p style={{ margin: 0, fontWeight: 800, color: "var(--text-muted)" }}>{t("binders.info.loading")}</p>
        ) : (
          <>
            <dl style={{ margin: 0, display: "grid", gap: 10 }}>
              {rows.map((row) => (
                <div key={row.label}>
                  <dt style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {row.label}
                  </dt>
                  <dd style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 900 }}>{row.value}</dd>
                </div>
              ))}
            </dl>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                {t("binders.info.separators")}
              </div>
              {info.separators.length === 0 ? (
                <p style={{ margin: 0, fontWeight: 700, color: "var(--text-muted)" }}>{t("binders.info.no_separators")}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {info.separators.map((sep) => (
                    <button
                      key={`${sep.pageIndex}-${sep.name}`}
                      type="button"
                      onClick={() => onOpenPage(sep.pageIndex)}
                      style={{
                        textAlign: "left",
                        borderRadius: 12,
                        border: "1px solid var(--color-border)",
                        background: "var(--bg-main)",
                        color: "var(--color-primary)",
                        padding: "10px 12px",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      {sep.name || t("binders.info.untitled_separator")}
                      <span style={{ display: "block", marginTop: 2, fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                        {t("binders.info.page", { n: sep.pageIndex + 1 })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
