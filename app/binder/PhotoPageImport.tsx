"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { resolveMockPcImageUrl } from "@/lib/mock-pc-url";
import { useGlobal } from "../context/GlobalContext";

type CardRow = {
  id: number;
  name: string | null;
  image_url: string | null;
  group_id: number | null;
  album_id: number | null;
  version: string | null;
  member: string | null;
};

type Match = {
  slot: number;
  cropUrl: string;
  picks: CardRow[];
  chosenId: number | null;
  occupied: boolean;
};

const GRID = { cols: 6, rows: 9 };
const fingerprintCache = new Map<string, Float32Array>();

function prettyLabel(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprintRegion(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): Float32Array | null {
  if (sw < 2 || sh < 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = GRID.cols;
  canvas.height = GRID.rows;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, GRID.cols, GRID.rows);
  const data = ctx.getImageData(0, 0, GRID.cols, GRID.rows).data;
  const out = new Float32Array(GRID.cols * GRID.rows * 3);
  for (let i = 0; i < GRID.cols * GRID.rows; i += 1) {
    out[i * 3] = data[i * 4] / 255;
    out[i * 3 + 1] = data[i * 4 + 1] / 255;
    out[i * 3 + 2] = data[i * 4 + 2] / 255;
  }
  return out;
}

function distance(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

async function fingerprintUrl(url: string) {
  const cached = fingerprintCache.get(url);
  if (cached) return cached;
  const img = await loadImage(url);
  const mx = img.naturalWidth * 0.08;
  const my = img.naturalHeight * 0.08;
  const fp = fingerprintRegion(img, mx, my, img.naturalWidth - mx * 2, img.naturalHeight - my * 2);
  if (fp) fingerprintCache.set(url, fp);
  return fp;
}

async function fetchPlaceableIds(userId: string) {
  const counts = new Map<number, { stock: number; wish: number }>();
  for (let from = 0; ; from += 1000) {
    const res = await supabase
      .from("user_item_statuses")
      .select("item_id, status, qty")
      .eq("user_id", userId)
      .range(from, from + 999);
    if (res.error) throw new Error(res.error.message);
    const batch = res.data ?? [];
    for (const row of batch) {
      const itemId = Number(row.item_id);
      if (!Number.isFinite(itemId)) continue;
      const status = String(row.status ?? "").trim().toLowerCase();
      const isWish = status === "wish" || status === "wishlist";
      const qtyRaw = row.qty == null ? (isWish ? 1 : 0) : Number(row.qty);
      const qty = Number.isFinite(qtyRaw) ? Math.max(0, Math.floor(qtyRaw)) : 0;
      const current = counts.get(itemId) ?? { stock: 0, wish: 0 };
      if (status === "have" || status === "wtt" || status === "wts" || status === "on_its_way" || status === "otw") {
        current.stock += qty;
      } else if (isWish) {
        current.wish += qty;
      }
      counts.set(itemId, current);
    }
    if (batch.length < 1000) break;
  }
  return [...counts.entries()].filter(([, c]) => c.stock > 0 || c.wish > 0).map(([id]) => id);
}

async function fetchCards(ids: number[]) {
  const cards: CardRow[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const res = await supabase
      .from("items")
      .select("id, name, image_url, group_id, album_id, version, member")
      .in("id", chunk);
    if (res.error) throw new Error(res.error.message);
    for (const row of res.data ?? []) {
      const image = typeof row.image_url === "string" ? resolveMockPcImageUrl(row.image_url) : null;
      cards.push({
        id: Number(row.id),
        name: row.name ?? null,
        image_url: image,
        group_id: row.group_id == null ? null : Number(row.group_id),
        album_id: row.album_id == null ? null : Number(row.album_id),
        version: row.version ?? null,
        member: row.member ?? null,
      });
    }
  }
  return cards.filter((card) => card.image_url);
}

export default function PhotoPageImport({
  userId,
  cols,
  rows,
  occupiedSlots,
  onClose,
  onPlace,
}: {
  userId: string;
  cols: number;
  rows: number;
  occupiedSlots: Record<number, unknown>;
  onClose: () => void;
  onPlace: (pairs: Array<{ slot: number; itemId: number }>) => Promise<{ placed: number; skipped: number }>;
}) {
  const { t } = useGlobal();
  const photoRef = useRef<HTMLImageElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [inset, setInset] = useState({ top: 8, right: 8, bottom: 8, left: 8 });
  const [cards, setCards] = useState<CardRow[]>([]);
  const [groupNames, setGroupNames] = useState<Record<number, string>>({});
  const [albumNames, setAlbumNames] = useState<Record<number, string>>({});
  const [groupId, setGroupId] = useState<number | "">("");
  const [albumId, setAlbumId] = useState<number | "">("");
  const [version, setVersion] = useState("");
  const [loadingCards, setLoadingCards] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingCards(true);
      setLoadError(null);
      try {
        const ids = await fetchPlaceableIds(userId);
        const loaded = await fetchCards(ids);
        const groupIds = [...new Set(loaded.map((card) => card.group_id).filter((id): id is number => id != null))];
        const albumIds = [...new Set(loaded.map((card) => card.album_id).filter((id): id is number => id != null))];
        const [groupsRes, albumsRes] = await Promise.all([
          groupIds.length
            ? supabase.from("groups").select("id, name").in("id", groupIds)
            : Promise.resolve({ data: [], error: null }),
          albumIds.length
            ? supabase.from("albums").select("id, name").in("id", albumIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (groupsRes.error) throw new Error(groupsRes.error.message);
        if (albumsRes.error) throw new Error(albumsRes.error.message);
        if (cancelled) return;
        const nextGroups: Record<number, string> = {};
        const nextAlbums: Record<number, string> = {};
        for (const row of groupsRes.data ?? []) nextGroups[Number(row.id)] = String(row.name ?? "");
        for (const row of albumsRes.data ?? []) nextAlbums[Number(row.id)] = String(row.name ?? "");
        setGroupNames(nextGroups);
        setAlbumNames(nextAlbums);
        setCards(loaded);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setLoadingCards(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const groups = useMemo(() => {
    const ids = [...new Set(cards.map((card) => card.group_id).filter((id): id is number => id != null))];
    return ids
      .map((id) => ({ id, name: groupNames[id] || String(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cards, groupNames]);

  const albums = useMemo(() => {
    const ids = [
      ...new Set(
        cards
          .filter((card) => groupId === "" || card.group_id === groupId)
          .map((card) => card.album_id)
          .filter((id): id is number => id != null),
      ),
    ];
    return ids
      .map((id) => ({ id, name: albumNames[id] || String(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [albumNames, cards, groupId]);

  const versions = useMemo(() => {
    const values = new Set<string>();
    for (const card of cards) {
      if (albumId === "" || card.album_id !== albumId) continue;
      const label = prettyLabel(card.version);
      if (label) values.add(label);
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [albumId, cards]);

  const pool = useMemo(() => {
    if (albumId === "") return [];
    return cards.filter((card) => {
      if (card.album_id !== albumId) return false;
      if (version && prettyLabel(card.version) !== version) return false;
      return true;
    });
  }, [albumId, cards, version]);

  function clearMatches() {
    setMatches([]);
    setNotice(null);
  }

  async function search() {
    const photo = photoRef.current;
    if (!photo || albumId === "") {
      setNotice(t("binders.photo.need_album"));
      return;
    }
    if (!pool.length) {
      setNotice(t("binders.photo.no_cards"));
      setMatches([]);
      return;
    }
    setSearching(true);
    setNotice(null);
    try {
      const ranked: Array<{ card: CardRow; fp: Float32Array }> = [];
      for (let i = 0; i < pool.length; i += 6) {
        const slice = pool.slice(i, i + 6);
        const part = await Promise.all(
          slice.map(async (card) => {
            try {
              const fp = card.image_url ? await fingerprintUrl(card.image_url) : null;
              return fp ? { card, fp } : null;
            } catch {
              return null;
            }
          }),
        );
        for (const row of part) if (row) ranked.push(row);
      }

      const width = photo.naturalWidth;
      const height = photo.naturalHeight;
      const x0 = (inset.left / 100) * width;
      const y0 = (inset.top / 100) * height;
      const x1 = width - (inset.right / 100) * width;
      const y1 = height - (inset.bottom / 100) * height;
      const cellW = (x1 - x0) / cols;
      const cellH = (y1 - y0) / rows;
      const next: Match[] = [];

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const slot = row * cols + col + 1;
          const sx = x0 + col * cellW;
          const sy = y0 + row * cellH;
          const padX = cellW * 0.06;
          const padY = cellH * 0.06;
          const crop = document.createElement("canvas");
          crop.width = 90;
          crop.height = 135;
          const cropCtx = crop.getContext("2d");
          if (cropCtx) cropCtx.drawImage(photo, sx, sy, cellW, cellH, 0, 0, 90, 135);
          const fp = fingerprintRegion(photo, sx + padX, sy + padY, cellW - padX * 2, cellH - padY * 2);
          const picks = fp
            ? ranked
                .map((entry) => ({ card: entry.card, score: distance(fp, entry.fp) }))
                .sort((a, b) => a.score - b.score)
                .slice(0, 6)
                .map((entry) => entry.card)
            : [];
          const occupied = Boolean(occupiedSlots[slot]);
          next.push({
            slot,
            cropUrl: crop.toDataURL("image/jpeg", 0.72),
            picks,
            chosenId: occupied ? null : picks[0]?.id ?? null,
            occupied,
          });
        }
      }
      setMatches(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSearching(false);
    }
  }

  async function place() {
    const chosen = new Set<number>();
    const pairs: Array<{ slot: number; itemId: number }> = [];
    for (const match of matches) {
      if (match.occupied || match.chosenId == null || chosen.has(match.chosenId)) continue;
      chosen.add(match.chosenId);
      pairs.push({ slot: match.slot, itemId: match.chosenId });
    }
    if (!pairs.length) return;
    setPlacing(true);
    setNotice(null);
    try {
      const result = await onPlace(pairs);
      const bits = [t("binders.photo.placed", { n: result.placed })];
      if (result.skipped > 0) bits.push(t("binders.photo.skipped", { n: result.skipped }));
      setNotice(bits.join(" "));
      if (result.placed > 0 && result.skipped === 0) onClose();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setPlacing(false);
    }
  }

  const fieldStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--color-border)",
    background: "var(--bg-main)",
    color: "var(--text-main)",
  } as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40000,
        background: "var(--overlay-medium)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          maxHeight: "100%",
          overflow: "auto",
          background: "var(--bg-card)",
          color: "var(--text-main)",
          borderRadius: 18,
          border: "1px solid var(--color-primary)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <strong>{t("binders.photo.title")}</strong>
          <button type="button" onClick={onClose} style={{ ...fieldStyle, width: "auto", fontWeight: 800 }}>
            {t("binders.photo.close")}
          </button>
        </div>
        <p style={{ margin: "10px 0 14px", lineHeight: 1.45 }}>{t("binders.photo.hint")}</p>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800, cursor: "pointer" }}>
          {photoUrl ? t("binders.photo.change") : t("binders.photo.choose")}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (photoUrl) URL.revokeObjectURL(photoUrl);
              setPhotoUrl(URL.createObjectURL(file));
              clearMatches();
            }}
          />
        </label>

        {photoUrl && (
          <div style={{ marginTop: 14 }}>
            <div style={{ position: "relative", maxWidth: 520, marginInline: "auto" }}>
              <img ref={photoRef} src={photoUrl} alt="" style={{ width: "100%", display: "block", borderRadius: 12 }} />
              <div
                style={{
                  position: "absolute",
                  top: `${inset.top}%`,
                  right: `${inset.right}%`,
                  bottom: `${inset.bottom}%`,
                  left: `${inset.left}%`,
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                  pointerEvents: "none",
                }}
              >
                {Array.from({ length: cols * rows }, (_, index) => (
                  <div key={index} style={{ border: "1px solid rgba(255,255,255,0.85)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.35)" }} />
                ))}
              </div>
            </div>
            <p style={{ margin: "10px 0" }}>{t("binders.photo.align")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              {(["top", "right", "bottom", "left"] as const).map((edge) => (
                <label key={edge} style={{ fontSize: 13 }}>
                  {t(`binders.photo.${edge}`)}
                  <input
                    type="range"
                    min={0}
                    max={35}
                    value={inset[edge]}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setInset((prev) => ({ ...prev, [edge]: value }));
                      clearMatches();
                    }}
                    style={{ width: "100%" }}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginTop: 14 }}>
          <label>
            {t("binders.photo.group")}
            <select
              value={groupId}
              style={fieldStyle}
              onChange={(event) => {
                setGroupId(event.target.value === "" ? "" : Number(event.target.value));
                setAlbumId("");
                setVersion("");
                clearMatches();
              }}
            >
              <option value="">{t("binders.photo.all")}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("binders.photo.album")}
            <select
              value={albumId}
              style={fieldStyle}
              onChange={(event) => {
                setAlbumId(event.target.value === "" ? "" : Number(event.target.value));
                setVersion("");
                clearMatches();
              }}
            >
              <option value="">{t("binders.photo.all")}</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("binders.photo.version")}
            <select
              value={version}
              style={fieldStyle}
              onChange={(event) => {
                setVersion(event.target.value);
                clearMatches();
              }}
            >
              <option value="">{t("binders.photo.all")}</option>
              {versions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" disabled={!photoUrl || searching || loadingCards} onClick={() => void search()} style={{ ...fieldStyle, width: "auto", fontWeight: 800 }}>
            {searching ? t("binders.photo.searching") : t("binders.photo.search")}
          </button>
          <button type="button" disabled={!matches.length || placing} onClick={() => void place()} style={{ ...fieldStyle, width: "auto", fontWeight: 800 }}>
            {placing ? t("binders.photo.placing") : t("binders.photo.place")}
          </button>
        </div>

        {loadingCards && <p>{t("binders.photo.loading_cards")}</p>}
        {loadError && <p>{loadError}</p>}
        {notice && <p>{notice}</p>}

        <div style={{ display: "grid", gap: 14, marginTop: 8 }}>
          {matches.map((match) => (
            <div key={match.slot}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{t("binders.photo.slot", { n: match.slot })}</div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", alignItems: "flex-end" }}>
                <img src={match.cropUrl} alt="" style={{ width: 72, height: 108, objectFit: "cover", borderRadius: 8, flex: "0 0 auto" }} />
                {match.occupied ? (
                  <span>{t("binders.photo.occupied")}</span>
                ) : (
                  <>
                    {match.picks.map((card) => {
                      const selected = match.chosenId === card.id;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() =>
                            setMatches((prev) =>
                              prev.map((row) => (row.slot === match.slot ? { ...row, chosenId: card.id } : row)),
                            )
                          }
                          style={{
                            width: 72,
                            borderRadius: 8,
                            border: selected ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                            background: "var(--bg-main)",
                            padding: 4,
                            flex: "0 0 auto",
                            color: "var(--text-main)",
                          }}
                        >
                          <img src={card.image_url || ""} alt="" style={{ width: "100%", height: 92, objectFit: "contain" }} />
                          <span style={{ display: "block", fontSize: 10, lineHeight: 1.2 }}>{prettyLabel(card.member) || card.name}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() =>
                        setMatches((prev) => prev.map((row) => (row.slot === match.slot ? { ...row, chosenId: null } : row)))
                      }
                      style={{ ...fieldStyle, width: "auto", alignSelf: "center" }}
                    >
                      {t("binders.photo.empty")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
