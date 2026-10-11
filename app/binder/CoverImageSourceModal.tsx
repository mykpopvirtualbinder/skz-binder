"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveMockPcImageUrl } from "@/lib/mock-pc-url";
import { backdropPointerClose, useOverlayDismiss } from "@/lib/use-overlay-dismiss";

type Source = "album" | "pc" | "merch" | "fanart";
type FacetKey = "group" | "collection" | "version" | "member" | "category";

type PickItem = {
  id: string;
  label: string;
  url: string;
  group: string;
  collection: string;
  version: string;
  member: string;
  category: string;
};

type Filters = Record<FacetKey, string>;

type PcFacets = {
  groups: { id: string; name: string }[];
  albums: { id: string; name: string; groupId: string }[];
  members: { id: string; name: string; groupId: string }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPickUrl: (url: string) => void;
  onPickFile: (file: File) => void;
  t: (key: string) => string;
};

const EMPTY_FILTERS: Filters = { group: "", collection: "", version: "", member: "", category: "" };

const FIELDS: Record<Source, FacetKey[]> = {
  album: ["group", "collection", "version"],
  pc: ["group", "collection", "version", "member"],
  merch: ["group", "category", "collection"],
  fanart: ["category", "member"],
};

const FANART_CATEGORY_KEY: Record<string, string> = {
  "Arte 2D": "fanart.filters.2d",
  "Arte 3D": "fanart.filters.3d",
  "Artesanía": "fanart.filters.crafts",
  Fanfics: "fanart.filters.fanfics",
  Multimedia: "fanart.filters.multimedia",
};

const catalogCache: Partial<Record<"album" | "merch" | "fanart", PickItem[]>> = {};
let pcFacetCache: PcFacets | null = null;

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

function prettyGroup(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function asId(value: string): string | number {
  return /^\d+$/.test(value) ? Number(value) : value;
}

function blankItem(partial: Omit<PickItem, "group" | "collection" | "version" | "member" | "category"> & Partial<PickItem>): PickItem {
  return {
    group: "",
    collection: "",
    version: "",
    member: "",
    category: "",
    ...partial,
  };
}

async function loadAlbumOrMerch(source: "album" | "merch"): Promise<PickItem[]> {
  if (catalogCache[source]) return catalogCache[source];
  const path = source === "album" ? "/api/merch-albums-catalog" : "/api/merch-products-catalog";
  const res = await fetch(path);
  const rows = (await res.json()) as Array<{
    id?: string;
    name?: string;
    album_title?: string;
    album_version?: string;
    group_name?: string;
    category?: string;
    image_url?: string;
  }>;
  const items = (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const url = usableUrl(row.image_url);
      if (!url) return null;
      const label = [row.album_title, row.name].filter(Boolean).join(" · ") || row.name || "";
      return blankItem({
        id: String(row.id || `${source}-${index}`),
        label,
        url,
        group: String(row.group_name || ""),
        collection: String(row.album_title || ""),
        version: String(row.album_version || ""),
        category: String(row.category || ""),
      });
    })
    .filter((row): row is PickItem => Boolean(row));
  catalogCache[source] = items;
  return items;
}

async function loadFanart(): Promise<PickItem[]> {
  if (catalogCache.fanart) return catalogCache.fanart;
  const { data, error } = await supabase
    .from("fanarts")
    .select("id, title, artist_name, category, image_url, media_type, is_nsfw")
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
      return blankItem({
        id: String(row.id),
        label,
        url,
        member: String(row.artist_name || ""),
        category: String(row.category || ""),
      });
    })
    .filter((row): row is PickItem => Boolean(row));
  catalogCache.fanart = items;
  return items;
}

async function loadPcFacets(): Promise<PcFacets> {
  if (pcFacetCache) return pcFacetCache;
  const [groups, albums, members] = await Promise.all([
    supabase.from("groups").select("id, name").order("name"),
    supabase.from("albums").select("id, name, group_id").order("name"),
    supabase.from("members").select("member_id, name, group_id").order("name"),
  ]);
  pcFacetCache = {
    groups: (groups.data || []).map((row) => ({ id: String(row.id), name: String(row.name || "") })).filter((row) => row.name),
    albums: (albums.data || []).map((row) => ({
      id: String(row.id),
      name: String(row.name || ""),
      groupId: String(row.group_id ?? ""),
    })).filter((row) => row.name),
    members: (members.data || []).map((row) => ({
      id: String(row.member_id ?? ""),
      name: String(row.name || ""),
      groupId: String(row.group_id ?? ""),
    })).filter((row) => row.name),
  };
  return pcFacetCache;
}

async function loadPcs(query: string, filters: Filters): Promise<PickItem[]> {
  const safe = query.trim().replace(/[%_,]/g, "").slice(0, 40);
  let req = supabase.from("items").select("id, name, member, image_url, version").not("image_url", "is", null).limit(90);
  if (filters.group) req = req.eq("group_id", asId(filters.group));
  if (filters.collection) req = req.eq("album_id", asId(filters.collection));
  if (filters.version) req = req.eq("version", filters.version);
  if (filters.member) req = req.ilike("member", filters.member);
  if (safe.length >= 2) req = req.or(`name.ilike.%${safe}%,member.ilike.%${safe}%`);
  else req = req.order("name", { ascending: true });
  const { data, error } = await req;
  if (error) return [];
  return (data || [])
    .map((row) => {
      const url = usableUrl(resolveMockPcImageUrl(row.image_url));
      if (!url) return null;
      const label = [row.member, row.name].filter(Boolean).join(" · ");
      return blankItem({
        id: String(row.id),
        label,
        url,
        member: String(row.member || ""),
        version: String(row.version || ""),
      });
    })
    .filter((row): row is PickItem => Boolean(row));
}

function applyFacets(items: PickItem[], filters: Filters, query: string): PickItem[] {
  return items.filter((item) => {
    if (!matches(item.label, query)) return false;
    if (filters.group && item.group !== filters.group) return false;
    if (filters.collection && item.collection !== filters.collection) return false;
    if (filters.version && item.version !== filters.version) return false;
    if (filters.member && item.member !== filters.member) return false;
    if (filters.category && item.category !== filters.category) return false;
    return true;
  });
}

function uniqueValues(items: PickItem[], key: FacetKey): string[] {
  const values = new Set<string>();
  for (const item of items) {
    const value = item[key];
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
}

export default function CoverImageSourceModal({ open, onClose, onPickUrl, onPickFile, t }: Props) {
  const [source, setSource] = useState<Source | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [allRows, setAllRows] = useState<PickItem[]>([]);
  const [pcFacets, setPcFacets] = useState<PcFacets | null>(pcFacetCache);
  const [pcVersions, setPcVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => onCloseRef.current(), []);
  useOverlayDismiss(open, close);

  const resetBrowse = useCallback(() => {
    setQuery("");
    setFilters(EMPTY_FILTERS);
    setFiltersOpen(false);
    setAllRows([]);
    setPcVersions([]);
  }, []);

  useEffect(() => {
    if (!open) {
      setSource(null);
      resetBrowse();
    }
  }, [open, resetBrowse]);

  useEffect(() => {
    if (!open || !source || source === "pc") return;
    let cancelled = false;
    setLoading(true);
    const run = source === "fanart" ? loadFanart() : loadAlbumOrMerch(source);
    run
      .then((list) => {
        if (!cancelled) setAllRows(list);
      })
      .catch(() => {
        if (!cancelled) setAllRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, source]);

  useEffect(() => {
    if (!open || source !== "pc") return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      loadPcs(query, filters)
        .then((list) => {
          if (!cancelled) setAllRows(list);
        })
        .catch(() => {
          if (!cancelled) setAllRows([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, source, query, filters]);

  useEffect(() => {
    if (!open || source !== "pc") return;
    let cancelled = false;
    loadPcFacets().then((facets) => {
      if (!cancelled) setPcFacets(facets);
    });
    return () => {
      cancelled = true;
    };
  }, [open, source]);

  useEffect(() => {
    if (source !== "pc" || !filters.collection) {
      setPcVersions([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("items")
      .select("version")
      .eq("album_id", asId(filters.collection))
      .limit(500)
      .then(({ data }) => {
        if (cancelled) return;
        const values = new Set<string>();
        for (const row of data || []) {
          const version = String(row.version || "").trim();
          if (version) values.add(version);
        }
        setPcVersions([...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })));
      });
    return () => {
      cancelled = true;
    };
  }, [source, filters.collection]);

  const shown = useMemo(() => {
    if (!source || source === "pc") return allRows;
    return applyFacets(allRows, filters, query).slice(0, 120);
  }, [allRows, filters, query, source]);

  const activeFilterCount = (Object.values(filters).filter(Boolean).length) + (query.trim() ? 1 : 0);

  if (!open || typeof document === "undefined") return null;

  const choose = (url: string) => {
    onPickUrl(url);
    close();
  };

  const setFacet = (key: FacetKey, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "group") {
        next.collection = "";
        next.version = "";
        next.member = "";
      }
      if (key === "collection") next.version = "";
      return next;
    });
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

  const fieldLabel = (key: FacetKey) => {
    if (key === "group") return t("binders.picker.group");
    if (key === "collection") return t("binders.picker.collection");
    if (key === "version") return t("binders.picker.version");
    if (key === "category") return t("binders.picker.type");
    return source === "fanart" ? t("binders.cover_source.artist") : t("binders.picker.member");
  };

  const fieldOptions = (key: FacetKey): { value: string; label: string }[] => {
    if (source === "pc" && pcFacets) {
      if (key === "group") return pcFacets.groups.map((row) => ({ value: row.id, label: row.name }));
      if (key === "collection") {
        return pcFacets.albums
          .filter((row) => !filters.group || row.groupId === filters.group)
          .map((row) => ({ value: row.id, label: row.name }));
      }
      if (key === "member") {
        return pcFacets.members
          .filter((row) => !filters.group || row.groupId === filters.group)
          .map((row) => ({ value: row.name, label: row.name }));
      }
      if (key === "version") return pcVersions.map((value) => ({ value, label: value }));
    }
    const pool = allRows.filter((item) => {
      if (key !== "group" && filters.group && item.group !== filters.group) return false;
      if (key !== "collection" && key !== "group" && filters.collection && item.collection !== filters.collection) return false;
      if (key === "version" && filters.category && item.category !== filters.category) return false;
      return true;
    });
    return uniqueValues(pool, key).map((value) => ({
      value,
      label: key === "group"
        ? prettyGroup(value)
        : key === "category" && FANART_CATEGORY_KEY[value]
          ? t(FANART_CATEGORY_KEY[value])
          : value,
    }));
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
        style={{
          width: "min(480px, 100%)",
          maxHeight: "min(82dvh, 720px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg-card)",
          color: "var(--text-main)",
          borderRadius: 20,
          border: "1px solid var(--color-border)",
          boxShadow: "0 18px 50px var(--overlay-soft)",
          padding: 16,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flex: "0 0 auto" }}>
          {source ? (
            <button
              type="button"
              onClick={() => {
                setSource(null);
                resetBrowse();
              }}
              style={{ ...optionStyle, width: "auto", minHeight: 36, padding: "0 12px" }}
            >
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
              <button key={id} type="button" onClick={() => { resetBrowse(); setSource(id); }} style={optionStyle}>
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
          <div data-modal-scroll="" style={{ overflow: "auto", minHeight: 0, flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            {!filtersOpen ? (
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                style={{
                  ...optionStyle,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  color: "var(--color-primary)",
                  borderColor: "var(--color-border)",
                  background: "var(--bg-card)",
                }}
              >
                <SlidersHorizontal size={16} strokeWidth={2.4} />
                {t("binders.picker.filters_button")}
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 900, color: "var(--color-primary)", textTransform: "uppercase" }}>
                  {t("binders.cover_source.search")}
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
                      textTransform: "none",
                    }}
                  />
                </label>
                {FIELDS[source].map((key) => (
                  <label key={key} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 900, color: "var(--color-primary)", textTransform: "uppercase" }}>
                    {fieldLabel(key)}
                    <select
                      value={filters[key]}
                      onChange={(e) => setFacet(key, e.target.value)}
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
                      }}
                    >
                      <option value="">{t("binders.picker.all_masculine")}</option>
                      {fieldOptions(key).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    borderRadius: 12,
                    border: "1px solid var(--color-primary)",
                    background: "var(--color-primary)",
                    color: "var(--modal-cta-fg)",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {t("binders.picker.apply_filters")}
                </button>
              </div>
            )}

            {!filtersOpen && (loading ? (
              <p style={{ textAlign: "center", fontWeight: 800, color: "var(--text-muted)" }}>{t("binders.cover_source.loading")}</p>
            ) : shown.length === 0 ? (
              <p style={{ textAlign: "center", fontWeight: 800, color: "var(--text-muted)" }}>{t("binders.cover_source.empty")}</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {shown.map((row) => (
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
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
