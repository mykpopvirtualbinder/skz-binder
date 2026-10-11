"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { resolveMockPcImageUrl } from "@/lib/mock-pc-url";
import { backdropPointerClose, useOverlayDismiss } from "@/lib/use-overlay-dismiss";

type Source = "album" | "pc" | "merch" | "fanart";

type PickItem = { id: string; label: string; url: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onPickUrl: (url: string) => void;
  onPickFile: (file: File) => void;
  t: (key: string) => string;
};

const catalogCache: Partial<Record<"album" | "merch" | "fanart", PickItem[]>> = {};

function usableUrl(raw: string | null | undefined): string {
  const url = String(raw || "").trim();
  if (!url || /not-available/i.test(url) || /placehold\.co/i.test(url)) return "";
  return url;
}

function matches(label: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return label.toLowerCase().includes(q);
}

async function loadAlbumOrMerch(source: "album" | "merch"): Promise<PickItem[]> {
  if (catalogCache[source]) return catalogCache[source];
  const path = source === "album" ? "/api/merch-albums-catalog" : "/api/merch-products-catalog";
  const res = await fetch(path);
  const rows = (await res.json()) as Array<{ id?: string; name?: string; album_title?: string; image_url?: string }>;
  const items = (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const url = usableUrl(row.image_url);
      if (!url) return null;
      const label = [row.album_title, row.name].filter(Boolean).join(" · ") || row.name || "";
      return { id: String(row.id || `${source}-${index}`), label, url };
    })
    .filter((row): row is PickItem => Boolean(row));
  catalogCache[source] = items;
  return items;
}

async function loadFanart(): Promise<PickItem[]> {
  if (catalogCache.fanart) return catalogCache.fanart;
  const { data, error } = await supabase
    .from("fanarts")
    .select("id, title, artist_name, image_url, media_type, is_nsfw")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(180);
  if (error) return [];
  const items = (data || [])
    .filter((row) => row.media_type !== "video" && row.media_type !== "pdf" && !row.is_nsfw)
    .map((row) => {
      const url = usableUrl(row.image_url);
      if (!url) return null;
      const label = [row.artist_name, row.title].filter(Boolean).join(" · ");
      return { id: String(row.id), label, url };
    })
    .filter((row): row is PickItem => Boolean(row));
  catalogCache.fanart = items;
  return items;
}

async function loadPcs(query: string): Promise<PickItem[]> {
  const safe = query.trim().replace(/[%_,]/g, "").slice(0, 40);
  let req = supabase.from("items").select("id, name, member, image_url").not("image_url", "is", null).limit(72);
  if (safe.length >= 2) req = req.or(`name.ilike.%${safe}%,member.ilike.%${safe}%`);
  else req = req.order("name", { ascending: true });
  const { data, error } = await req;
  if (error) return [];
  return (data || [])
    .map((row) => {
      const url = usableUrl(resolveMockPcImageUrl(row.image_url));
      if (!url) return null;
      const label = [row.member, row.name].filter(Boolean).join(" · ");
      return { id: String(row.id), label, url };
    })
    .filter((row): row is PickItem => Boolean(row));
}

export default function CoverImageSourceModal({ open, onClose, onPickUrl, onPickFile, t }: Props) {
  const [source, setSource] = useState<Source | null>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PickItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => onCloseRef.current(), []);
  useOverlayDismiss(open, close);

  useEffect(() => {
    if (!open) {
      setSource(null);
      setQuery("");
      setRows([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    setRows([]);
    setLoading(true);
    const timer = window.setTimeout(() => {
      const run = async () => {
        if (source === "pc") return loadPcs(query);
        const all = source === "fanart" ? await loadFanart() : await loadAlbumOrMerch(source);
        return all.filter((row) => matches(row.label, query)).slice(0, 90);
      };
      run()
        .then((list) => {
          if (!cancelled) setRows(list);
        })
        .catch(() => {
          if (!cancelled) setRows([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, source === "pc" ? 220 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, source, query]);

  if (!open || typeof document === "undefined") return null;

  const choose = (url: string) => {
    onPickUrl(url);
    close();
  };

  const optionStyle = {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid var(--color-border)",
    background: "var(--bg-soft)",
    color: "var(--text-main)",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    textAlign: "left" as const,
    padding: "0 16px",
  };

  return createPortal(
    <div
      onMouseDown={backdropPointerClose(close)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 36000,
        background: "var(--overlay-medium)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        data-modal-scroll=""
        style={{
          width: "min(480px, 100%)",
          maxHeight: "min(82dvh, 720px)",
          overflow: "auto",
          background: "var(--bg-card)",
          color: "var(--text-main)",
          borderRadius: 20,
          border: "1px solid var(--color-border)",
          boxShadow: "0 18px 50px var(--overlay-soft)",
          padding: 16,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          {source ? (
            <button type="button" onClick={() => { setSource(null); setQuery(""); }} style={{ ...optionStyle, width: "auto", minHeight: 36, padding: "0 12px" }}>
              {t("binders.cover_source.back")}
            </button>
          ) : null}
          <h3 className="tan-font" style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 950, textAlign: "center" }}>
            {source ? t(`binders.cover_source.${source}`) : t("binders.cover_source.title")}
          </h3>
          <button type="button" onClick={close} aria-label={t("common.cancel")} style={{ ...optionStyle, width: 36, minHeight: 36, padding: 0, textAlign: "center" }}>
            ✕
          </button>
        </div>

        {!source ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["album", "pc", "merch", "fanart"] as Source[]).map((id) => (
              <button key={id} type="button" onClick={() => setSource(id)} style={optionStyle}>
                {t(`binders.cover_source.${id}`)}
              </button>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()} style={{ ...optionStyle, borderColor: "var(--color-primary)", color: "var(--color-primary)" }}>
              {t("binders.cover_source.file")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                onPickFile(file);
                close();
              }}
            />
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("binders.cover_source.search")}
              style={{
                width: "100%",
                height: 42,
                borderRadius: 12,
                border: "1px solid var(--color-border)",
                background: "var(--bg-soft)",
                color: "var(--text-main)",
                fontSize: 16,
                fontWeight: 700,
                padding: "0 12px",
                boxSizing: "border-box",
                marginBottom: 12,
              }}
            />
            {loading ? (
              <p style={{ textAlign: "center", fontWeight: 800, color: "var(--text-muted)" }}>{t("binders.cover_source.loading")}</p>
            ) : rows.length === 0 ? (
              <p style={{ textAlign: "center", fontWeight: 800, color: "var(--text-muted)" }}>{t("binders.cover_source.empty")}</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => choose(row.url)}
                    title={row.label}
                    style={{
                      padding: 0,
                      borderRadius: 12,
                      overflow: "hidden",
                      border: "1px solid var(--color-border)",
                      background: "var(--bg-soft)",
                      cursor: "pointer",
                    }}
                  >
                    <img src={row.url} alt={row.label} style={{ width: "100%", aspectRatio: "3 / 4", objectFit: "cover", display: "block" }} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
