"use client";
import Header from "../components/header";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import WtsListingModal from "./WtsListingModal";
import { Users, Disc3, Mic2, User, RotateCw, BookOpen, SlidersHorizontal, Layers, ChevronLeft, ChevronRight, Upload, Siren, Heart } from "lucide-react";/** * Tipos
 */
type StatusKey = "have" | "wtt" | "wts" | "on_its_way" | "wish";
type StatusCounts = Record<StatusKey, number>;
type PersistStatus = "have" | "wtt" | "wts" | "on_its_way" | "wishlist";
type StatusFilter = "all" | "have" | "wts" | "wtt" | "on_its_way" | "wish";
type ItemRow = {
  id: number;
  name: string | null;
  image_url: string | null;
  back_image_url: string | null;
  group_id: number | null;
  album_id: number | null;
  version: string | null;
  member: string | null;
};

type UserItemStatusRow = {
  id: number;
  user_id: string;
  item_id: number;
  status: PersistStatus;
  qty: number | null;
};

type GroupRow = { id: number; name: string | null };
type AlbumRow = { id: number; name: string | null; release_date: string | null };
function emptyCounts(): StatusCounts {
  return { have: 0, wtt: 0, wts: 0, on_its_way: 0, wish: 0 };
}

function persistToCountsKey(s: PersistStatus): StatusKey {
  if (s === "wishlist") return "wish";
  return s;
}

function statusLabelFromPersist(s: PersistStatus) {
  if (s === "have") return "Tengo";
  if (s === "wtt") return "WTT";
  if (s === "wts") return "WTS";
  if (s === "on_its_way") return "On the way";
  return "Wishlist";
}

function statusColorFromPersist(s: PersistStatus) {
  if (s === "on_its_way") return "#57d7e5";
  if (s === "wishlist") return "#f1d86a";
  if (s === "wtt") return "#5bd66b";
  if (s === "wts") return "#9fe0b5";
  return "#5bd66b";
}

function totalOwnedQtyFromCounts(counts: StatusCounts) {
  // Stock real: lo que tienes / WTT / WTS / en camino
  // Wishlist NO cuenta como stock
  return counts.have + counts.wtt + counts.wts + counts.on_its_way;
}

function formatTooltipLines(counts: StatusCounts, inBinder: number) {
  return [
    `Tengo: ${counts.have}`,
    `WTT: ${counts.wtt}`,
    `WTS: ${counts.wts}`,
    `On the way: ${counts.on_its_way}`,
    `Wishlist: ${counts.wish}`,
    `En binder: ${inBinder}`,
  ];
}

function normText(s: string) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function matchesQuery(it: ItemRow, query: string) {
  const tokens = normText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const memberWords = normText(it.member ?? "").split(/\s+/).filter(Boolean);
  const nameWords = normText(it.name ?? "").split(/\s+/).filter(Boolean);
  const versionWords = normText(it.version ?? "").split(/\s+/).filter(Boolean);

 // ✅ Si es 1 carácter: busca en cualquier parte (member + name)
if (tokens.length === 1 && tokens[0].length === 1) {
  const t = tokens[0];
  return memberWords.some((w) => w.includes(t)) || nameWords.some((w) => w.includes(t));
}

  // ✅ Normal: member + name + version
  const words = [...nameWords, ...memberWords, ...versionWords];

  return tokens.every((t) => {
    if (/^\d+$/.test(t)) return String(it.id).includes(t);
return words.some((w) => w.includes(t));
  });
}
function memberMatches(memberRaw: string | null, selected: string | "all") {
  if (selected === "all") return true;
  const memberWords = normText(memberRaw ?? "").split(/\s+/).filter(Boolean);
  const targetWords = normText(String(selected)).split(/\s+/).filter(Boolean);
  // bang-chan => ["bang","chan"] debe estar dentro del memberWords
  return targetWords.every((t) => memberWords.includes(t));
}
const menuBtnStyle: CSSProperties = { 
  background: "transparent", border: "none", padding: "10px 14px", textAlign: "left", 
  borderRadius: 10, cursor: "pointer", fontWeight: 900, color: "#8C659C", fontSize: 14 
};

const footerColumnTitle: CSSProperties = { 
  fontSize: "13px", color: "#8C659C", fontWeight: 900, textTransform: "uppercase", marginBottom: "15px", display: "block" 
};

const footerLinkStyle: CSSProperties = { 
  fontSize: "12px", color: "#b17eac", textDecoration: "none", fontWeight: 500, marginBottom: "8px", display: "block" 
};
function unitTypeFromMember(memberRaw: string | null): "single" | "unit" | "ot8" {
  const raw = (memberRaw ?? "").trim();
  if (!raw) return "single";

  const lower = raw.toLowerCase();

  // OT8 prioridad absoluta
  if (/\bot8\b/.test(lower)) return "ot8";

  // Unit: más de un miembro (espacios o +)
  if (lower.includes("+")) return "unit";
  if (lower.split(/\s+/).length > 1) return "unit";

  return "single";
}
function toNiceTitle(s: string) {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function prettySlug(s: string | null) {
  const t = (s ?? "").trim();
  if (!t) return "—";
  return toNiceTitle(t.replace(/[-_]+/g, " "));
}

function prettyVersionLabel(s: string | null) {
  const t = (s ?? "").trim();
  if (!t) return "—";
  // ejemplo: "skz2020-high-touch-venue-ver" -> "Skz2020 High Touch Venue Ver"
  return toNiceTitle(t.replace(/[-_]+/g, " "));
}

function prettyMemberLabel(memberRaw: string | null) {
  const raw = (memberRaw ?? "").trim();
  if (!raw) return "—";

  // acepta: "bang-chan-felix" o "bang-chan felix" o "bang-chan / felix"
  const cleaned = raw
  .replace(/[|]/g, " ")
  .replace(/[,_]/g, " ")
  .replace(/[+/]/g, " ")
  .replace(/-/g, " ")
  .trim();

  const tokens = cleaned.split(/\s+/).filter(Boolean);

  const map: Record<string, string> = {
    bang: "Bang",
    chan: "Chan",
    bangchan: "Bang Chan",
    bangchanfelix: "Bang Chan · Felix",
    lee: "Lee",
    know: "Know",
    leeknow: "Lee Know",
    changbin: "Changbin",
    hyunjin: "Hyunjin",
    han: "Han",
    felix: "Felix",
    seungmin: "Seungmin",
    in: "I.N",
    "i.n": "I.N",
    jeongin: "I.N",
  };

  const joined = tokens.join("");
  if (map[joined]) return map[joined];

  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];

    if (a === "bang" && b === "chan") {
      out.push("Bang Chan");
      i++;
      continue;
    }
    if (a === "lee" && b === "know") {
      out.push("Lee Know");
      i++;
      continue;
    }
    if (a === "in") {
      out.push("I.N");
      continue;
    }

    out.push(map[a] ?? toNiceTitle(a));
  }

  const uniq = Array.from(new Set(out.filter(Boolean)));
  return uniq.join(" · ") || "—";
}

function prettySlugTitle(s: string) {
  const raw = (s ?? "").trim();
  if (!raw) return "—";

  const noNum = raw.replace(/^\d+-/, "");
  const spaced = noNum.replace(/[-_]+/g, " ").trim();

  // quita "ver" si viene al final
  const noVer = spaced.replace(/\s+ver$/i, "").trim();

  return noVer
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (w.toUpperCase() === w && w.length >= 2) return w;
      return w[0].toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}
function prettyAlbumDisplay(s: string | null) {
  const raw = (s ?? "").trim();
  if (!raw) return "—";

  const spaced = raw.replace(/[-_]+/g, " ").trim();
  const words = spaced.split(/\s+/).filter(Boolean);

  return words
    .map((w) => {
      // SKZ + año: skz2024 -> SKZ2024
      const m = w.match(/^skz(\d+)?$/i);
      if (m) return `SKZ${m[1] ?? ""}`;

      // OT8, etc si algún día lo usas en álbum
      if (w.toLowerCase() === "ot8") return "OT8";

      // Default title-case
      return w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;
    })
    .join(" ");
}
function MetaRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#70708a", fontSize: 12 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 10,
            border: "1px solid #ececf6",
            background: "linear-gradient(180deg, #ffffff, #f6f7ff)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </span>
        <span style={{ fontWeight: 900 }}>{label}</span>
      </div>
      <div style={{ fontWeight: 900, color: "#232336", textAlign: "left" }}>{value || "—"}</div>    </>
  );
}
function InfoLine({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 10,
          border: "1px solid #ececf6",
          background: "linear-gradient(180deg, #ffffff, #f6f7ff)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#70708a", // iconos mismo tono
        }}
      >
        {icon}
      </span>

      <span
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: "#232336",
          textAlign: "left",
          lineHeight: 1.25,
          wordBreak: "break-word",
          flex: 1,
        }}
      >
        {text || "—"}
      </span>
    </div>
  );
}
/** Tooltip flotante */
function StockTooltip({ title = "Mini resumen ✨", lines }: { title?: string; lines: string[] }) {
  if (!lines || lines.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: -8,
        transform: "translate(-50%, 100%)",
        width: 240,
        background: "white",
        border: "1px solid #e7e7ef",
        borderRadius: 14,
        padding: "10px 12px",
        boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
        fontSize: 12,
        color: "#333",
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{title}</div>
      <div style={{ lineHeight: 1.35, color: "#444" }}>
        {lines.map((t) => (
          <div key={t}>{t}</div>
        ))}
      </div>
    </div>
  );
}

/**
 * Stock dropdown
 */
function StockDropdown({
  counts,
  disabled,
  onCommit,
}: {
  counts: StatusCounts;
  disabled?: boolean;
  onCommit: (next: Record<PersistStatus, number>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const toDraft = useCallback(() => {
    const d: Record<PersistStatus, number> = {
      have: counts.have,
      wtt: counts.wtt,
      wts: counts.wts,
      on_its_way: counts.on_its_way,
      wishlist: counts.wish,
    };
    return d;
  }, [counts]);

  const [draft, setDraft] = useState<Record<PersistStatus, number>>(toDraft());

  useEffect(() => {
    setDraft(toDraft());
  }, [toDraft]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const total = useMemo(() => {
    return (draft.have ?? 0) + (draft.wtt ?? 0) + (draft.wts ?? 0) + (draft.on_its_way ?? 0);
  }, [draft]);

  const dominant: PersistStatus = useMemo(() => {
    if ((draft.on_its_way ?? 0) > 0) return "on_its_way";
    if ((draft.wishlist ?? 0) > 0) return "wishlist";
    if ((draft.wtt ?? 0) > 0) return "wtt";
    if ((draft.wts ?? 0) > 0) return "wts";
    return "have";
  }, [draft]);

  const dotColor = statusColorFromPersist(dominant);
  const wishOn = (draft.wishlist ?? 0) > 0;

  const setQty = (s: PersistStatus, v: number) => {
    const safe = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    setDraft((prev) => ({ ...prev, [s]: safe }));
  };

 const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #F3DCE7", // Borde rosita
    background: "white",
  };

  return (
    <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 10,
          border: disabled ? "1px solid #eee" : "1px solid #F3DCE7",
          background: disabled ? "#f9f9f9" : "white",
          cursor: disabled ? "not-allowed" : "pointer",
          height: 34,
          boxShadow: disabled ? "none" : "0 4px 12px rgba(247,168,216,0.08)",
        }}
        title="Stock por estado"
      >
        <span style={{ fontSize: 12, fontWeight: 900, color: disabled ? "#999" : "#8C659C" }}>Stock</span>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: dotColor,
            border: "1px solid #ddd",
            display: "inline-block",
          }}
          title={statusLabelFromPersist(dominant)}
        />
        <span style={{ fontSize: 12, fontWeight: 900, color: "#2F2740" }}>{total}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#8C659C" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 1000,
            width: 280,
            background: "#FFFDF5",
            border: "1px solid #F3DCE7",
            borderRadius: 18,
            boxShadow: "0 18px 44px rgba(140,101,156,0.15)",
            overflow: "hidden",
            padding: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["have", "wtt", "wts", "on_its_way", "wishlist"] as PersistStatus[]).map((s) => {
              const color = statusColorFromPersist(s);
              const val = draft[s] ?? 0;

              return (
                <div key={s} style={rowStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: color,
                        border: "1px solid #ddd",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 900, color: "#8C659C" }}>
                      {statusLabelFromPersist(s)}
                    </span>
                  </div>

                  {(() => {
                    const isWishlist = s === "wishlist";
                    const locked = wishOn && !isWishlist;

                    if (isWishlist) {
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (wishOn) {
                              setQty("wishlist", 0);
                            } else {
                              setDraft((prev) => ({
                                ...prev,
                                have: 0,
                                wtt: 0,
                                wts: 0,
                                on_its_way: 0,
                                wishlist: 1,
                              }));
                            }
                          }}
                          style={{
                            width: 74,
                            height: 26,
                            borderRadius: 10,
                            border: wishOn ? "1px solid #f1d86a" : "1px solid #F3DCE7",
                            background: wishOn ? "#fff7d6" : "white",
                            color: wishOn ? "#7a5a00" : "#8C659C",
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                          title="Marcar como Wishlist"
                        >
                          <span>{wishOn ? "★" : "☆"}</span>
                          <span>Wish</span>
                        </button>
                      );
                    }

                    return (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "44px 22px",
                          height: 26,
                          borderRadius: 10,
                          border: "1px solid #F3DCE7",
                          background: locked ? "#f9f9f9" : "white",
                          overflow: "hidden",
                          opacity: locked ? 0.55 : 1,
                        }}
                      >
                        <input
                          value={String(val)}
                          disabled={locked}
                          onChange={(e) => {
                            const t = e.target.value;
                            if (/^\d*$/.test(t)) setQty(s, t === "" ? 0 : Number(t));
                          }}
                          inputMode="numeric"
                          style={{
                            width: "100%",
                            height: "100%",
                            border: 0,
                            outline: "none",
                            textAlign: "center",
                            fontSize: 12,
                            fontWeight: 900,
                            color: locked ? "#999" : "#2F2740",
                            background: "transparent",
                          }}
                          title={locked ? "Desactiva Wishlist para editar" : "Cantidad"}
                        />
                        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", borderLeft: "1px solid #F3DCE7" }}>
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => setQty(s, val + 1)}
                            style={{
                              border: 0,
                              background: "transparent",
                              cursor: locked ? "not-allowed" : "pointer",
                              fontSize: 12,
                              fontWeight: 900,
                              color: "#8C659C",
                              lineHeight: 1,
                              opacity: locked ? 0.45 : 1,
                            }}
                            title="Sumar"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            disabled={locked || val <= 0}
                            onClick={() => setQty(s, Math.max(0, val - 1))}
                            style={{
                              border: 0,
                              background: "transparent",
                              cursor: locked || val <= 0 ? "not-allowed" : "pointer",
                              fontSize: 12,
                              fontWeight: 900,
                              color: "#8C659C",
                              lineHeight: 1,
                              opacity: locked || val <= 0 ? 0.45 : 1,
                            }}
                            title="Restar"
                          >
                            −
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setDraft(toDraft());
                setOpen(false);
              }}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid #F7A8D8",
                background: "white",
                color: "#8C659C",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                await onCommit(draft);
                setOpen(false);
              }}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid #F7A8D8",
                background: "#FFF5FA",
                color: "#8C659C",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(247,168,216,0.14)",
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PinBadge() {
  return (
    <span
      title="Ya colocada en el binder"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26, // Un poquito más grande para que respire bien
        height: 26,
        borderRadius: 999,
        border: "1px solid #F7A8D8", // Borde rosa
        background: "#FFF5FA", // Fondo rosa pastel
        color: "#8C659C", // Tono morado
        boxShadow: "0 2px 8px rgba(247,168,216,0.20)", // Sombra rosada a juego
        fontSize: 14,
        zIndex: 10,
      }}
    >
      📍
    </span>
  );
}

/**
 * Card estilo “slot”
 */
function LibraryItemCard({
  item,
  counts,
  inBinder,
  face,
  groupName,
  albumName,
  showInfo,
  onToggleInfo,
  onToggleFace,
  onCommitStock,
  onOpen,
  disableEdits,
}: {
  item: ItemRow;
  counts: StatusCounts;
  inBinder: number;
  face: "front" | "back";
  groupName: string;
  albumName: string;
  showInfo: boolean;
  onToggleInfo: () => void;
  onToggleFace: () => void;
  onCommitStock: (next: Record<PersistStatus, number>) => Promise<void>;
  onOpen: () => void;
  disableEdits?: boolean;
}) {
 
  const [hover, setHover] = useState(false);
  


  const total = totalOwnedQtyFromCounts(counts);
  const available = total > 0 ? 1 : 0;
  const tooltipLines = formatTooltipLines(counts, inBinder);

  const prettyGroup = prettySlug(groupName);
  const prettyAlbum = prettyAlbumDisplay(albumName);
  const prettyVersion = prettyVersionLabel(item.version);
  const prettyMember = prettyMemberLabel(item.member);

  const DEFAULT_BACK_URL = "/mock-pcs/groups/default-back.png";

 const imgUrl =
  face === "front"
    ? item.image_url
    : (item.back_image_url ?? DEFAULT_BACK_URL);

  const ownedTotal = totalOwnedQtyFromCounts(counts);
  const frameColor =
    counts.on_its_way > 0
      ? statusColorFromPersist("on_its_way")
      : counts.wish > 0 && ownedTotal === 0
      ? statusColorFromPersist("wishlist")
      : "#c9c9d6";

  return (
<div
  style={{ width: showInfo ? 140 : 120, transition: "width 0.2s ease", position: "relative" }}
>      <div
        onClick={onOpen}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      
  style={{
    width: "100%",
    height: showInfo ? "auto" : 190,
    minHeight: 190,
          borderRadius: 14,
          border: `2px solid ${frameColor}`,
          background: "white",
          position: "relative",
          overflow: "hidden",
          boxShadow: frameColor !== "#c9c9d6" ? `0 0 0 2px ${frameColor}33` : "0 8px 24px rgba(0,0,0,0.06)",
        }}
      >
 {showInfo ? (
  <div
    data-info-panel="1"
    style={{
      width: "100%",
      height: "100%",
      padding: 12,
      overflowY: "auto",
      background: "linear-gradient(180deg, #ffffff, #fbf7ff)",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}
  >
    <InfoLine icon={<Users size={16} strokeWidth={2.4} />} text={prettyGroup} />
    <InfoLine icon={<Disc3 size={16} strokeWidth={2.4} />} text={prettyAlbum} />
    <InfoLine
      icon={<Mic2 size={16} strokeWidth={2.8} />}   // 👈 el micro “engorda” para no verse más pequeño
      text={prettyVersion}
    />
    <InfoLine icon={<User size={16} strokeWidth={2.4} />} text={prettyMember} />

    <div style={{ height: 1, background: "#ece6ff", marginTop: 2 }} />

    <div style={{ fontSize: 11, color: "#333", lineHeight: 1.55, textAlign: "left" }}>
      Tengo: <b>{counts.have}</b>
      <br />
      WTT: <b>{counts.wtt}</b>
      <br />
      WTS: <b>{counts.wts}</b>
      <br />
      On the way: <b>{counts.on_its_way}</b>
      <br />
      Wishlist: <b>{counts.wish}</b>
      <br />
      En binder: <b>{inBinder}</b>
    </div>
  </div>
) : (
  <div
    style={{
      width: "100%",
      height: "100%",
      position: "relative",
      perspective: 900,
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
        transformStyle: "preserve-3d",
        transition: "transform 850ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        transform: face === "front" ? "rotateY(0deg)" : "rotateY(180deg)",
      }}
    >
      {/* FRONT */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: "#999",
              padding: 8,
              textAlign: "center",
            }}
          >
            Sin imagen
            <br />(anverso)
          </div>
        )}
      </div>

      {/* BACK */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: "rotateY(180deg)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        {(item.back_image_url ?? DEFAULT_BACK_URL) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.back_image_url ?? DEFAULT_BACK_URL}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: "#999",
              padding: 8,
              textAlign: "center",
            }}
          >
            Sin imagen
            <br />(reverso)
          </div>
        )}
      </div>
    </div>
  </div>
)}

        {hover && !showInfo && <StockTooltip lines={tooltipLines} />}
      </div>

      {/* FILA 1: Stock */}
      <div style={{ marginTop: 8, display: "flex", justifyContent: "center", width: 120 }}>
        <div style={{ width: 120 }}>
<StockDropdown counts={counts} onCommit={onCommitStock} disabled={disableEdits} />
        </div>
      </div>

     {/* FILA 2 */}
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
            width: 120,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFace();
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 10,
              border: "1px solid #F7A8D8",
              background: "rgba(255,255,255,0.92)",
              color: "#8C659C",
              fontSize: 14,
              cursor: "pointer",
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(247,168,216,0.15)",
            }}
            title={face === "front" ? "Ver reverso" : "Ver anverso"}
          >
            ⇄
          </button>
          <button
            type="button"
            data-info-toggle="1"
            onClick={(e) => {
              e.stopPropagation();
              onToggleInfo();
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 10,
              border: "1px solid #F7A8D8",
              background: "rgba(255,255,255,0.92)",
              color: "#8C659C",
              fontSize: 14,
              cursor: "pointer",
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(247,168,216,0.15)",
            }}
            title="Info"
          >
            i
          </button>
          {inBinder > 0 && <PinBadge />}
        </div>
      </div>

  );
}
function ItemModal({
  item,
  counts,
  inBinder,
  groupName,
  albumName,
  viewingUserId,
  isViewingOtherUser,
  wttOfferItems,
  onOpenWttOffer,
  onClose,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  item: ItemRow;
  counts: StatusCounts;
  inBinder: number;
  groupName: string;
  albumName: string;
  viewingUserId: string | null;
  isViewingOtherUser: boolean;
  wttOfferItems: ItemRow[];
  onOpenWttOffer: () => void;
  onClose: () => void;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [face, setFace] = useState<"front" | "back">("front");
  const [rot, setRot] = useState(0);
// 👇 AÑADE ESTO 👇
  const [userPrice, setUserPrice] = useState<string>("");
  const [marketPrice, setMarketPrice] = useState<string>("");
  const [wtsCurrency, setWtsCurrency] = useState<string>("EUR");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUserPrice(localStorage.getItem(`binder:price:${item.id}`) || "");
      setMarketPrice(localStorage.getItem(`binder:market:${item.id}`) || "");
      setWtsCurrency(localStorage.getItem(`binder:wtsCurrency:${item.id}`) || "EUR");
    }
  }, [item.id]);
  // 👆 HASTA AQUÍ 👆
  // ===== Upload UI =====
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadSide, setUploadSide] = useState<"front" | "back">("front");
  const [formatHintOpen, setFormatHintOpen] = useState(false);
  const hintTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    };
  }, []);
  // ===== Report UI =====
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>("wrong_info");
  const [reportText, setReportText] = useState<string>("");
  const [reportSent, setReportSent] = useState(false);

  const niceMembers = prettyMemberLabel(item.member);
  const title = niceMembers || "Photocard";

  const DEFAULT_BACK_URL = "/mock-pcs/groups/default-back.png";
  const imgUrl =
    face === "front" ? item.image_url : (item.back_image_url ?? DEFAULT_BACK_URL);

  const isQuarterTurn = rot % 180 !== 0;
  const rotScale = isQuarterTurn ? 0.72 : 1;

  const unitType = unitTypeFromMember(item.member);
  const unitLabel = unitType === "ot8" ? "OT8" : unitType === "unit" ? "Unit" : "Single";

  const uiWttDisplay = counts.wtt;
  const uiWishlist = counts.wish;
  const wttDisabled = isViewingOtherUser || uiWishlist > 0;

  const handleUploadFile = async (file: File) => {
    try {
      setUploadMsg(null);
      setUploading(true);

      // Placeholder: aquí luego conectamos Storage + update DB
      setUploadMsg("✅ ¡Gracias! Hemos recibido tu imagen y la revisaremos.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      setTimeout(() => setUploadMsg(null), 3000);
    }
  };

  const resetReport = () => {
    setReportReason("wrong_info");
    setReportText("");
    setReportSent(false);
  };

  const sendReport = async () => {
    // Placeholder. Luego lo conectamos a Supabase (tabla reports).
    setReportSent(true);
    setTimeout(() => {
      setReportOpen(false);
      resetReport();
      alert("Reporte enviado (placeholder). Gracias 🙏");
    }, 450);
  };
// 👇 ATAJOS DE TECLADO PARA CERRAR LA PC / REPORTAR 👇
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          // Si el modal de reporte está abierto, Esc solo cierra el reporte
          if (reportOpen) {
            setReportOpen(false);
            resetReport();
          } else {
            // Si no, Esc cierra toda la ventana de la PC
            onClose();
          }
        } else if (e.key === "Enter" && reportOpen && !e.shiftKey) {
          const target = e.target as HTMLElement | null;
          const tag = target?.tagName?.toLowerCase();
          if (tag === "textarea") return; // Permite usar Enter para saltos de línea al escribir
          
          e.preventDefault();
          e.stopPropagation();
          if (!reportSent) {
             sendReport(); // Envía el reporte con Enter
          }
        }
      };

      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose, reportOpen, reportSent]); // Asegúrate de incluir reportSent en las dependencias si lo usas
    // 👆 FIN ATAJOS DE TECLADO 👆
  // Helpers UI
  const headerIconBtn: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 12,
    border: "1px solid #F7A8D8",
    background: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    color: "#8C659C",
    boxShadow: "0 2px 8px rgba(247,168,216,0.15)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease"
  };

  const subtleCard: React.CSSProperties = {
    background: "#FFF9FB",
    border: "1px solid #F3DCE7",
    borderRadius: 18,
    boxShadow: "0 8px 24px rgba(247, 168, 216, 0.10)",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.40)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "auto",
          maxWidth: "96vw",
          height: "auto",
          maxHeight: "92vh",
          background: "#F7F4EE",
          borderRadius: 18,
          border: "1px solid #F3DCE7",
          boxShadow: "0 30px 80px rgba(0,0,0,0.22)",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "62px auto",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            borderBottom: "1px solid #F3C7DA",
            background: "#FFD9E6",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 950, color: "#8C659C", whiteSpace: "pre-line", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis" }}>
              {title}
            </div>
            {inBinder > 0 && <PinBadge />}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
            <button
              type="button"
              onClick={onPrev}
              disabled={!canPrev}
              style={{ ...headerIconBtn, opacity: canPrev ? 1 : 0.45 }}
              title="Anterior"
            >
              <ChevronLeft size={18} strokeWidth={2.6} />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              style={{ ...headerIconBtn, opacity: canNext ? 1 : 0.45 }}
              title="Siguiente"
            >
              <ChevronRight size={18} strokeWidth={2.6} />
            </button>

            {/* REPORT SOLO SI ESTÁS VIENDO A OTRO USUARIO */}
            {isViewingOtherUser && (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                style={{
                  ...headerIconBtn,
                  border: "1px solid #F4C7D8",
                  background: "#FFF7FA",
                  color: "#b42318",
                }}
                title="Reportar"
              >
                <Siren size={18} strokeWidth={2.4} />
              </button>
            )}
            <button type="button" onClick={onClose} style={headerIconBtn} title="Cerrar">
              ✕
            </button>
          </div>
        </div>

        {/* BODY */}
        <div style={{ display: "grid", gridTemplateColumns: "420px 520px", columnGap: 18, justifyContent: "start", height: "100%", minHeight: 0 }}>
          
          {/* IZQ: PREVIEW FOTO */}
          <div style={{ position: "relative", background: "#F7F4EE", padding: 10, borderRight: "1px solid #FFD9E6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
            <div style={{ width: "100%", maxWidth: 320, aspectRatio: "2 / 3", position: "relative", perspective: 1100, background: "transparent", margin: "auto 0" }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transformStyle: "preserve-3d",
                  transition: "transform 950ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                  transform: face === "front" ? "rotateY(0deg)" : "rotateY(180deg)",
                  borderRadius: 14,
                  border: "1px solid #e7e7ef",
                  background: "white"
                }}
              >
                {/* FRONT */}
                <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 14, overflow: "hidden" }}>
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", background: "#fff", transform: `rotate(${rot}deg) scale(${rotScale})`, transition: "transform 160ms ease", transformOrigin: "center center" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", background: "linear-gradient(180deg, #ffffff, #f6f7ff)" }}>
                      Sin imagen<br />(anverso)
                    </div>
                  )}
                </div>
                {/* BACK */}
                <div style={{ position: "absolute", inset: 0, transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 14, overflow: "hidden" }}>
                  {(item.back_image_url ?? DEFAULT_BACK_URL) ? (
                    <img
                      src={item.back_image_url ?? DEFAULT_BACK_URL}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", background: "#fff", transform: `rotate(${rot}deg) scale(${rotScale})`, transition: "transform 160ms ease", transformOrigin: "center center" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", background: "linear-gradient(180deg, #ffffff, #f6f7ff)" }}>
                      Sin imagen<br />(reverso)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CONTROLES */}
            <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", zIndex: 10 }}>
              <button type="button" onClick={() => setFace((p) => (p === "front" ? "back" : "front"))} style={{...headerIconBtn, width: "auto", padding: "10px 14px", gap: 8}}>
                {face === "front" ? "Ver reverso" : "Ver anverso"}
              </button>
              <button type="button" onClick={() => setRot((r) => (r + 270) % 360)} style={headerIconBtn} title="Rotar izquierda">⟲</button>
              <button type="button" onClick={() => setRot((r) => (r + 90) % 360)} style={headerIconBtn} title="Rotar derecha">⟳</button>
            </div>

            {/* UPLOAD */}
            <div style={{ marginTop: 12, padding: 14, width: "100%", ...subtleCard }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0, textAlign: "left" }}>
                  <div style={{ fontWeight: 950, color: "#8C659C", lineHeight: 1.15 }}>Mejorar imagen</div>
                  <div style={{ fontSize: 12, color: "#5b5b72", marginTop: 3, lineHeight: 1.35 }}>Sube una foto nítida.</div>
                </div>
                
                {/* 👇 BLOQUE DE BOTONES INFALIBLE 👇 */}
                <div style={{ position: "relative" }}>
                  <div style={{ display: "inline-flex", padding: 3, borderRadius: 999, border: "1px solid #F3DCE7", background: "white", boxShadow: "0 2px 8px rgba(247,168,216,0.15)", gap: 4, opacity: uploading ? 0.6 : 1 }}>
                    {(["front", "back"] as const).map((side) => {
                      const active = uploadSide === side;
                      return (
                        <label
                          key={side}
                          onClick={() => {
                            setUploadSide(side);
                            setFormatHintOpen(true);
                            if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
                            hintTimerRef.current = window.setTimeout(() => setFormatHintOpen(false), 5000);
                          }}
                          style={{
                            padding: "7px 12px", borderRadius: 999, border: 0, cursor: uploading ? "not-allowed" : "pointer",
                            fontWeight: 950, fontSize: 12, background: active ? "#FFF5FA" : "transparent",
                            boxShadow: active ? "0 2px 4px rgba(247,168,216,0.18)" : "none", color: "#8C659C", minWidth: 74, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8
                          }}
                        >
                          {side === "front" ? "Front" : "Back"}
                          
                          {/* El input oculto va POR DENTRO del label. Ningún navegador lo bloquea. */}
                          <input 
                            type="file" 
                            accept="image/png,image/jpeg,image/webp" 
                            style={{ display: "none" }} 
                            disabled={uploading}
                            onChange={(e) => { 
                              const f = e.target.files?.[0]; 
                              if (f) handleUploadFile(f); 
                              e.target.value = ''; // Permite que se pueda volver a subir el mismo archivo si hay un error
                            }} 
                          />
                        </label>
                      );
                    })}
                  </div>
                  
                  {/* Hint de formatos */}
                  {formatHintOpen && (
                    <div style={{ 
                      position: "absolute", 
                      right: 0, 
                      bottom: "calc(100% + 12px)", 
                      width: "max-content",
                      maxWidth: 280,
                      borderRadius: 14, 
                      border: "1px solid #F3DCE7", 
                      background: "white", 
                      boxShadow: "0 -8px 32px rgba(247,168,216,0.25)", 
                      padding: "12px 16px", 
                      zIndex: 100 
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 950, color: "#8C659C" }}>Formatos: PNG / JPG / WEBP</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "#6a6a80", lineHeight: 1.35 }}>Consejo: usa un fondo plano y buena luz.</div>
                    </div>
                  )}
                </div>
                {/* 👆 FIN DEL BLOQUE DE BOTONES 👆 */}

              </div>
              
              {uploadMsg && (
                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, color: uploadMsg.includes("Gracias") ? "#8C659C" : "#b42318", background: uploadMsg.includes("Gracias") ? "#FFF5FA" : "rgba(138,31,31,0.08)", border: `1px solid ${uploadMsg.includes("Gracias") ? "#F7A8D8" : "rgba(138,31,31,0.18)"}`, padding: "10px 12px", borderRadius: 14 }}>
                  {uploadMsg}
                </div>
              )}
            </div>
              </div>
          {/* DER: INFO, STOCK, NOTAS Y WTT */}
          <div style={{ padding: 16, overflowY: "auto", height: "100%", minHeight: 0, minWidth: 0, width: "100%" }}>
            
            {/* META INFO */}
            <div style={{ padding: 14, ...subtleCard }}>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", rowGap: 10, columnGap: 12 }}>
                <MetaRow icon={<Users size={16} strokeWidth={2.2} />} label="Grupo" value={prettySlug(groupName)} />
                <MetaRow icon={<Disc3 size={16} strokeWidth={2.2} />} label="Álbum" value={prettyAlbumDisplay(albumName)} />
                <MetaRow icon={<Mic2 size={16} strokeWidth={2.2} />} label="Versión" value={prettySlugTitle(item.version ?? "")} />
                <MetaRow icon={<User size={16} strokeWidth={2.2} />} label="Miembro" value={title || "-"} />
                <MetaRow icon={<Layers size={16} strokeWidth={2.2} />} label="Tipo" value={unitLabel} />
              </div>
            </div>

            {/* STOCK Y PRECIO */}
            <div style={{ marginTop: 14, padding: 14, ...subtleCard }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 950, marginBottom: 10, color: "#8C659C" }}>Stock</div>
                  <div style={{ fontSize: 13, color: "#333", lineHeight: 1.7 }}>
                    Tengo: <b>{counts.have}</b> <br />
                    WTT: <b>{counts.wtt}</b> <br />
                    WTS: <b>{counts.wts}</b> <br />
                    On the way: <b>{counts.on_its_way}</b> <br />
                    Wishlist: <b>{counts.wish}</b>
                  </div>
                </div>
                <div style={{ width: 160, display: "grid", gridTemplateRows: "auto auto", gap: 10, alignContent: "start" }}>
                <div style={{ borderRadius: 14, border: "1px solid #F3DCE7", background: "white", padding: 8 }}>
                  <div style={{ fontWeight: 950, marginBottom: 6, color: "#8C659C", fontSize: 12 }}>Precio venta (usuario)</div>
                  <input
                    value={userPrice ? `${userPrice} ${wtsCurrency}` : "—"}
                    disabled
                    placeholder="Sin fijar"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      height: 34,
                      fontSize: 12,
                      borderRadius: 12,
                      border: "1px solid #dfe0ee",
                      outline: "none",
                      background: "#f4f4f8",
                      color: "#666",
                      cursor: "not-allowed",
                      fontWeight: 700,
                    }}
                  />
                </div>
                <div style={{ borderRadius: 14, border: "1px solid #F3DCE7", background: "white", padding: 8 }}>
                  <div style={{ fontWeight: 950, marginBottom: 6, color: "#8C659C", fontSize: 12 }}>Precio medio (mercado)</div>
                  <input
                    value={marketPrice ? `${marketPrice} USD` : "—"}
                    disabled
                    placeholder="Sin fijar"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      height: 34,
                      fontSize: 12,
                      borderRadius: 12,
                      border: "1px solid #dfe0ee",
                      outline: "none",
                      background: "#f4f4f8",
                      color: "#666",
                      cursor: "not-allowed",
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              
              {/* NOTAS */}
              <div style={{ padding: 14, ...subtleCard }}>
                <div style={{ fontWeight: 950, marginBottom: 8, color: "#8C659C" }}>Notas</div>
                <textarea placeholder="Escribe una nota breve (máx. 2 lineas)" rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #F3DCE7", outline: "none", resize: "none", lineHeight: "18px", height: 52, color: "#333", background: "white" }} />
              </div>

              {/* BUSCO EN WTT */}
              <div style={{ padding: 14, ...subtleCard }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontWeight: 950, marginBottom: 0, color: "#8C659C" }}>Busco en WTT</div>
                  <button type="button" onClick={onOpenWttOffer} disabled={wttDisabled} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #F7A8D8", background: "white", cursor: wttDisabled ? "not-allowed" : "pointer", fontWeight: 900, fontSize: 12, color: "#8C659C", opacity: wttDisabled ? 0.6 : 1, boxShadow: "0 2px 8px rgba(247,168,216,0.15)" }}>Mis trades</button>
                </div>
                
                {/* SOLUCIONADO EL ERROR DE LAS DOS FILAS: Un solo carrusel condicional */}
                {uiWttDisplay > 0 && wttOfferItems?.length ? (
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", overflowY: "hidden", flexWrap: "nowrap", width: "100%", maxWidth: "100%", minWidth: 0, paddingBottom: 6, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", alignItems: "center", height: 112, maxHeight: 112, scrollbarGutter: "stable" }}>
                    {wttOfferItems.map((w, idx) => (
                      <img key={`${w.id ?? "wtt"}-${idx}`} src={w.image_url ?? "/mock-pcs/groupsui/not-available.png"} alt="" draggable={false} title={w.name ?? ""} style={{ width: 90, height: 110, borderRadius: 12, border: "1px solid #e7e7ef", background: "linear-gradient(180deg, #ffffff, #f6f7ff)", objectFit: "cover", flex: "0 0 auto", scrollSnapAlign: "start", boxShadow: "0 8px 18px rgba(0,0,0,0.06)" }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "#5b5b72", lineHeight: 1.5 }}>Aún no has añadido nada a "Busco en WTT".</div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

        ,{/* ✅ MODAL REPORT */}
        {reportOpen && (
          <div
            onClick={() => {
              setReportOpen(false);
              resetReport();
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 15, 25, 0.55)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 18,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(520px, 94vw)",
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "linear-gradient(180deg, #ffffff, #fbfbff)",
                boxShadow: "0 22px 70px rgba(0,0,0,0.35)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: 14, borderBottom: "1px solid #efeff7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      border: "1px solid #ffe1e1",
                      background: "linear-gradient(180deg, #fff5f5, #ffffff)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#b42318",
                      boxShadow: "0 10px 22px rgba(0,0,0,0.10)",
                    }}
                  >
                    <Siren size={16} strokeWidth={2.4} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 950, color: "#232336", lineHeight: 1.1 }}>Reportar contenido</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                      Cuéntanos qué pasa. Lo revisaremos.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReportOpen(false);
                    resetReport();
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    border: "1px solid #e7e7ef",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 900,
                    boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
                  }}
                  title="Cerrar"
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: 14, display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "#666", fontWeight: 900 }}>Motivo</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid #dfe0ee",
                      outline: "none",
                      fontWeight: 900,
                      color: "#232336",
                      background: "white",
                    }}
                  >
                    <option value="wrong_info">Información incorrecta</option>
                    <option value="duplicate">Duplicado</option>
                    <option value="bad_image">Imagen mala / no corresponde</option>
                    <option value="spam">Spam / contenido raro</option>
                    <option value="other">Otro</option>
                  </select>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "#666", fontWeight: 900 }}>Detalles</label>
                  <textarea
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder="Explícanos en una frase qué está mal (opcional, pero ayuda mucho)."
                    rows={4}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid #dfe0ee",
                      outline: "none",
                      resize: "none",
                      fontWeight: 800,
                      color: "#232336",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setReportOpen(false);
                      resetReport();
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid #e7e7ef",
                      background: "white",
                      cursor: "pointer",
                      fontWeight: 950,
                      boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={sendReport}
                    disabled={reportSent}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid #ffe1e1",
                      background: reportSent ? "#f4f4f8" : "linear-gradient(180deg, #fff5f5, #ffffff)",
                      cursor: reportSent ? "not-allowed" : "pointer",
                      fontWeight: 950,
                      color: "#b42318",
                      boxShadow: "0 12px 26px rgba(0,0,0,0.10)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Siren size={16} strokeWidth={2.4} />
                    {reportSent ? "Enviando…" : "Enviar reporte"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

  );
}
  


export default function LibraryPageClient() {
  const router = useRouter();
  const pathname = usePathname(); // 👈 AÑADE ESTO
  const topBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    borderRadius: 999, // Botones más redondeados
    border: "1px solid #F7A8D8", // Borde rosa
    background: "white",
    color: "#8C659C", // Texto morado
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    textDecoration: "none",
    boxShadow: "0 4px 12px rgba(247, 168, 216, 0.15)", // Sombra rosada
    transition: "all 0.2s ease"
  };

  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const sp = useSearchParams();
  const uParam = sp.get("u"); // ?u=...
  const viewingUserId = uParam ?? userId; // si no hay u=, eres tú
  const isViewingOtherUser = Boolean(viewingUserId && userId && viewingUserId !== userId);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Cargando inventario...");
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [invByItem, setInvByItem] = useState<Record<number, StatusCounts>>({});
  const [myBiasIds, setMyBiasIds] = useState<number[]>([]);
  const [placedByItem, setPlacedByItem] = useState<Record<number, number>>({});

  const [groupNameById, setGroupNameById] = useState<Record<number, string>>({});
const [albumById, setAlbumById] = useState<Record<number, { name: string; release_date: string | null }>>({});
  // filtros
const [fStatus, setFStatus] = useState<StatusFilter>("all");
const [fGroup, setFGroup] = useState<number | "all">("all");
const [fAlbum, setFAlbum] = useState<number | "all">("all");
const [fVersion, setFVersion] = useState<string | "all">("all");
const [fMember, setFMember] = useState<string | "all">("all");
type UnitFilter = "all" | "single" | "unit" | "ot8";
const [fUnit, setFUnit] = useState<UnitFilter>("all");
const [q, setQ] = useState("");
  // 👇 AÑADE ESTO:
  const [currentPage, setCurrentPage] = useState(1);
 
  const ITEMS_PER_PAGE = 70; // 10 filas exactas de 7 columnas
const [openItemId, setOpenItemId] = useState<number | null>(null);
const libraryShellRef = useRef<HTMLDivElement | null>(null);
const [openInfoById, setOpenInfoById] = useState<Record<number, boolean>>({});
// flip
const [pageFace, setPageFace] = useState<"front" | "back">("front");
const [cardFace, setCardFace] = useState<Record<number, "front" | "back">>({});

const readWttOffer = useCallback((itemId: number) => {
  try {
    const raw = localStorage.getItem(`binder:wttOffer:${itemId}`);
    if (!raw) return { qty: 0, ids: [] as number[] };
    const parsed = JSON.parse(raw);
    const qty = Number(parsed?.qty ?? 0);
    const ids = Array.isArray(parsed?.ids)
      ? parsed.ids.filter((x: any) => Number.isFinite(Number(x))).map((x: any) => Number(x))
      : [];
    return { qty: Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0, ids };
  } catch {
    return { qty: 0, ids: [] as number[] };
  }
}, []);

const writeWttOffer = useCallback((itemId: number, qty: number, ids: number[]) => {
  try {
    const cleanQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
    const cleanIds = Array.isArray(ids) ? ids.filter((x) => Number.isFinite(Number(x))).map(Number) : [];
    if (!cleanQty && !cleanIds.length) {
      localStorage.removeItem(`binder:wttOffer:${itemId}`);
      return;
    }
    localStorage.setItem(`binder:wttOffer:${itemId}`, JSON.stringify({ qty: cleanQty, ids: cleanIds }));
  } catch {}
}, []);

const [wttOfferByItem, setWttOfferByItem] = useState<Record<number, number[]>>({});
const [wttOfferQtyByItem, setWttOfferQtyByItem] = useState<Record<number, number>>({});
const [wttOfferOpen, setWttOfferOpen] = useState(false);
const [wttOfferForId, setWttOfferForId] = useState<number | null>(null);
const [wttOfferDraft, setWttOfferDraft] = useState<number[]>([]);
const [wttOfferQtyDraft, setWttOfferQtyDraft] = useState<number>(0);
const [wttOfferQ, setWttOfferQ] = useState("");
const wttOfferQRef = useRef<HTMLInputElement | null>(null);
const [wttOfferGroup, setWttOfferGroup] = useState<number | "">("");
const [wttOfferAlbum, setWttOfferAlbum] = useState<number | "">("");
const [wttOfferVersion, setWttOfferVersion] = useState<string>("");
const [wttOfferMember, setWttOfferMember] = useState<string>("");
const [wttOfferUnit, setWttOfferUnit] = useState<UnitFilter>("all");

const loadPlacedAcrossBinder = useCallback(async (uid: string) => {
  const binderRes = await supabase
    .from("binders")
    .select("id")
    .eq("user_id", uid)
    .order("id", { ascending: false })
    .limit(1);
  if (binderRes.error) return;

  const binderId = binderRes.data?.[0]?.id;
  if (!binderId) return;

  const pagesRes = await supabase.from("binder_pages").select("id").eq("binder_id", binderId);
  if (pagesRes.error) return;

  const pageIds = (pagesRes.data ?? [])
    .map((r: { id: number }) => r.id)
    .filter(Boolean);

  if (pageIds.length === 0) return;

  const slotsRes = await supabase.from("page_slots").select("item_id").in("page_id", pageIds);
  if (slotsRes.error) return;

  const counts: Record<number, number> = {};
  for (const r of slotsRes.data ?? []) {
    const itemId = r.item_id as number | null;
    if (!itemId) continue;
    counts[itemId] = (counts[itemId] ?? 0) + 1;
  }

  setPlacedByItem(counts);
}, []);

const rebuildInvMap = useCallback((rows: UserItemStatusRow[]) => {
  const next: Record<number, StatusCounts> = {};
  for (const row of rows) {
    const itemId = row.item_id;
    const qty = Number(row.qty ?? 0);
    const qn = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;

    if (!next[itemId]) next[itemId] = emptyCounts();
    const key = persistToCountsKey(row.status);
    next[itemId][key] = qn;
  }
  setInvByItem(next);
}, []);

const loadAll = useCallback(async () => {
  setLoading(true);
  setError(null);
  setStatus("Leyendo sesión...");
// 3. Cargar tus Bias seleccionados
setStatus("Cargando tus favoritos..."); 
const { data: userData, error: userErr } = await supabase.auth.getUser();
if (userErr) {
  setError(userErr.message);
  setLoading(false);
  return;
}

const user = userData.user;
if (!user) {
  setStatus("No hay sesión. Ve a /login");
  setLoading(false);
  return;
}



  setEmail(user.email ?? null);
  setUserId(user.id);
// Dentro de loadAll, tras setUserld(user.id)
const { data: biasData, error: biasError } = await supabase
  .from("user_biases")
  .select("member_id")
  .eq("user_id", user.id);

if (biasError) {
  console.error("Error cargando bias:", biasError.message);
} else if (biasData) {
  // Guardamos solo los números de los IDs
  const ids = biasData.map(b => Number(b.member_id));
  console.log("Bias detectados en DB:", ids);
  setMyBiasIds(ids); 
}
    setStatus("Cargando items...");

  const PAGE = 1000;
  let from = 0;
  const all: any[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("items")
      .select("id, name, image_url, back_image_url, group_id, album_id, version, member")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const batch = data ?? [];
    all.push(...batch);

    if (batch.length < PAGE) break;
    from += PAGE;
  }

  const itemsData: ItemRow[] = all.map((r: ItemRow) => ({
    id: Number(r.id),
    name: r.name ?? null,
    image_url: r.image_url ?? null,
    back_image_url: r.back_image_url ?? null,
    group_id: Number.isFinite(Number(r.group_id)) ? Number(r.group_id) : null,
    album_id: Number.isFinite(Number(r.album_id)) ? Number(r.album_id) : null,
    version: r.version ?? null,
    member: r.member ?? null,
  }));

  setItems(itemsData);
  // 🔎 DEBUG: ¿llegan los items de ese álbum y cómo vienen las versiones?
  const debugAlbumId = 62; // <-- pon aquí el album_id de tu Seasons Greetings (en tu screenshot es 62)
  const subset = itemsData.filter((x) => x.album_id === debugAlbumId);

  console.log("DEBUG itemsData total:", itemsData.length);
  console.log("DEBUG subset album", debugAlbumId, "count:", subset.length);
  console.log(
    "DEBUG versions in subset:",
    subset.reduce((acc: Record<string, number>, it) => {
      const v = (it.version ?? "NULL").trim() || "EMPTY";
      acc[v] = (acc[v] ?? 0) + 1;
      return acc;
    }, {})
  );
  setStatus("Cargando stock por estado...");
  const invRes = await supabase
    .from("user_item_statuses")
    .select("id, user_id, item_id, status, qty")
.eq("user_id", uParam ?? user.id);  if (invRes.error) {
    setError(invRes.error.message);
    setLoading(false);
    return;
  }

  rebuildInvMap((invRes.data ?? []) as UserItemStatusRow[]);

  const groupIds = Array.from(
    new Set(
      itemsData
        .map((x) => Number(x.group_id))
        .filter((n) => Number.isFinite(n))
    )
  );

  const albumIds = Array.from(
    new Set(
      itemsData
        .map((x) => Number(x.album_id))
        .filter((n) => Number.isFinite(n))
    )
  );

  if (groupIds.length > 0) {
    const gRes = await supabase.from("groups").select("id, name").in("id", groupIds);
    if (!gRes.error) {
      const map: Record<number, string> = {};
      for (const g of (gRes.data ?? []) as GroupRow[]) map[g.id] = (g.name ?? `Grupo ${g.id}`).trim();
      setGroupNameById(map);
    }
  }

  if (albumIds.length > 0) {
const aRes = await supabase.from("albums").select("id, name, release_date").in("id", albumIds);    if (!aRes.error) {
      const map: Record<number, { name: string; release_date: string | null }> = {};
for (const a of (aRes.data ?? []) as AlbumRow[]) {
  map[a.id] = { name: (a.name ?? `Álbum ${a.id}`).trim(), release_date: a.release_date ?? null };
}
setAlbumById(map);
    }
  }

await loadPlacedAcrossBinder(uParam ?? user.id);  setCardFace((prev) => {
    const next = { ...prev };
    for (const it of itemsData) if (!next[it.id]) next[it.id] = "front";
    return next;
  });
  setPageFace("front");

  setStatus("Inventario listo ✅");
  setLoading(false);
}, [loadPlacedAcrossBinder, rebuildInvMap, uParam]);
useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  loadAll();
}, [loadAll]);
useEffect(() => {
  const onDown = (e: MouseEvent) => {
    const path = (e.composedPath?.() ?? []) as Array<EventTarget>;

    const clickedInfoOrToggle = path.some((node) => {
      if (!(node instanceof HTMLElement)) return false;
      return node.dataset.infoPanel === "1" || node.dataset.infoToggle === "1";
    });

    if (clickedInfoOrToggle) return;

    // En cualquier otro click: cierra TODAS las infos
    setOpenInfoById({});
  };

  document.addEventListener("mousedown", onDown);
  return () => document.removeEventListener("mousedown", onDown);
}, []);
const flipWholePage = useCallback(() => {
  const nextFace: "front" | "back" = pageFace === "front" ? "back" : "front";
  setPageFace(nextFace);

  setCardFace((prev) => {
    const next = { ...prev };
    for (const it of items) next[it.id] = nextFace;
    return next;
  });
}, [pageFace, items]);
const opts = useMemo(
  () => ({ fStatus, fGroup, fAlbum, fVersion, fMember, fUnit, q }),
  [fStatus, fGroup, fAlbum, fVersion, fMember, fUnit, q]
);
function matchesForOptions(
  it: ItemRow,
  counts: StatusCounts,
  opts: {
    fStatus: StatusFilter;
    fGroup: number | "all";
    fAlbum: number | "all";
  }
) {
  // STATUS
  if (opts.fStatus !== "all") {
    if (opts.fStatus === "have" && counts.have <= 0) return false;
    if (opts.fStatus === "wts" && counts.wts <= 0) return false;
    if (opts.fStatus === "wtt" && counts.wtt <= 0) return false;
    if (opts.fStatus === "on_its_way" && counts.on_its_way <= 0) return false;
    if (opts.fStatus === "wish" && counts.wish <= 0) return false;
  }

  // GROUP
  if (opts.fGroup !== "all" && (it.group_id ?? null) !== opts.fGroup) return false;

  // ALBUM
  if (opts.fAlbum !== "all" && (it.album_id ?? null) !== opts.fAlbum) return false;

  return true;
}
const universeForMember = useMemo(() => {
  return items.filter((it) => {
    const counts = invByItem[it.id] ?? emptyCounts();

    // status + group + album
    if (!matchesForOptions(it, counts, { fStatus, fGroup, fAlbum })) return false;

    // version (solo si está seleccionada)
    if (fVersion !== "all" && String(it.version ?? "") !== String(fVersion)) return false;

    return true;
  });
}, [items, invByItem, fStatus, fGroup, fAlbum, fVersion]);

const universeForGroup = useMemo(() => {
  return items.filter((it) =>
    matchesForOptions(it, invByItem[it.id] ?? emptyCounts(), { fStatus, fGroup: "all", fAlbum: "all" })
  );
}, [items, invByItem, fStatus]);

const universeForAlbum = useMemo(() => {
  return items.filter((it) =>
    matchesForOptions(it, invByItem[it.id] ?? emptyCounts(), { fStatus, fGroup, fAlbum: "all" })
  );
}, [items, invByItem, fStatus, fGroup]);

const universeForVersion = useMemo(() => {
  return items.filter((it) =>
    matchesForOptions(it, invByItem[it.id] ?? emptyCounts(), { fStatus, fGroup, fAlbum })
  );
}, [items, invByItem, fStatus, fGroup, fAlbum]);

const groupOptions = useMemo(() => {
  const s = new Set<number>();
  for (const it of universeForGroup) {
    const n = Number(it.group_id);
    if (Number.isFinite(n) && n > 0) s.add(n);
  }
  return Array.from(s).sort((a, b) => a - b);
}, [universeForGroup]);

const albumOptions = useMemo(() => {
  const s = new Set<number>();
  for (const it of universeForAlbum) {
    const n = Number(it.album_id);
    if (Number.isFinite(n) && n > 0) s.add(n);
  }

  const ids = Array.from(s);

  ids.sort((a, b) => {
    const da = albumById[a]?.release_date ? new Date(albumById[a].release_date!).getTime() : Number.POSITIVE_INFINITY;
    const db = albumById[b]?.release_date ? new Date(albumById[b].release_date!).getTime() : Number.POSITIVE_INFINITY;

    if (da !== db) return da - db;

    const na = albumById[a]?.name ?? "";
    const nb = albumById[b]?.name ?? "";
    return na.localeCompare(nb, "es");
  });

  return ids;
}, [universeForAlbum, albumById]);
useEffect(() => {
  if (fAlbum === "all") return;
  if (!albumOptions.includes(fAlbum)) setFAlbum("all");
}, [albumOptions, fAlbum]);
const versionOptions = useMemo(() => {
  const s = new Set<string>();
  for (const it of universeForVersion) {
    const v = (it.version ?? "").trim();
    if (v) s.add(v);
  }
  
  return Array.from(s).sort((a, b) => a.localeCompare(b, "es"));
}, [universeForVersion]);
useEffect(() => {
  if (fVersion === "all") return;
  if (!versionOptions.includes(String(fVersion))) setFVersion("all");
}, [versionOptions, fVersion]);
// ===== MIEMBROS (8 fijos, pero dependientes del resto de filtros) =====
const memberOptionsFixed = useMemo(
  () => [
    { value: "bang-chan", label: "Bang Chan" },
    { value: "lee-know", label: "Lee Know" },
    { value: "changbin", label: "Changbin" },
    { value: "hyunjin", label: "Hyunjin" },
    { value: "han", label: "Han" },
    { value: "felix", label: "Felix" },
    { value: "seungmin", label: "Seungmin" },
    { value: "in", label: "I.N" },
  ],
  []
);

const availableMemberSet = useMemo(() => {
  const set = new Set<string>();

  for (const it of universeForMember) {
    for (const m of memberOptionsFixed) {
      if (memberMatches(it.member, m.value)) set.add(m.value);
    }
  }

  return set;
}, [universeForMember, memberOptionsFixed]);
const memberOptions = useMemo(() => {
  return memberOptionsFixed.filter((m) => availableMemberSet.has(m.value));
}, [memberOptionsFixed, availableMemberSet]);


// ✅ BÚSQUEDA DESDE 1 CARÁCTER (sin exigir 4)
function matchesAllExcept(
  it: ItemRow,
  counts: StatusCounts,
skip: "status" | "group" | "album" | "version" | "member" | "unit" | "q",  opts: {
    fStatus: StatusFilter;
    fGroup: number | "all";
    fAlbum: number | "all";
    fVersion: string | "all";
    fMember: string | "all";
    fUnit: UnitFilter;   // 👈 añade esto
    q: string;
  }
) {
  // STATUS
  if (skip !== "status" && opts.fStatus !== "all") {
    if (opts.fStatus === "have" && counts.have <= 0) return false;
    if (opts.fStatus === "wts" && counts.wts <= 0) return false;
    if (opts.fStatus === "wtt" && counts.wtt <= 0) return false;
    if (opts.fStatus === "on_its_way" && counts.on_its_way <= 0) return false;
    if (opts.fStatus === "wish" && counts.wish <= 0) return false;
  }

  // GROUP
  if (skip !== "group" && opts.fGroup !== "all" && (it.group_id ?? null) !== opts.fGroup) return false;

  // ALBUM
  if (skip !== "album" && opts.fAlbum !== "all" && (it.album_id ?? null) !== opts.fAlbum) return false;

  // VERSION
  if (skip !== "version" && opts.fVersion !== "all" && String(it.version ?? "") !== String(opts.fVersion)) return false;

    // MEMBER (1 de los 8, pero debe incluir duos/ot8)
  if (skip !== "member" && opts.fMember !== "all") {
    if (!memberMatches(it.member, opts.fMember)) return false;
  }
  
// TIPO (single / unit / ot8)
if (skip !== "unit" && opts.fUnit !== "all") {
  const ut = unitTypeFromMember(it.member);
  if (ut !== opts.fUnit) return false;
}
  // SEARCH
  if (skip !== "q") {
    const tokens = normText(opts.q).split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      if (!matchesQuery(it, opts.q)) return false;
    }
  }

  return true;
}
const filtered = useMemo(() => {
  return items.filter((it) => {
    const counts = invByItem[it.id] ?? emptyCounts();

    if (fStatus !== "all") {
      if (fStatus === "have" && counts.have <= 0) return false;
      if (fStatus === "wts" && counts.wts <= 0) return false;
      if (fStatus === "wtt" && counts.wtt <= 0) return false;
      if (fStatus === "on_its_way" && counts.on_its_way <= 0) return false;
      if (fStatus === "wish" && counts.wish <= 0) return false;
    }

    if (fGroup !== "all" && (it.group_id ?? null) !== fGroup) return false;
    if (fAlbum !== "all" && (it.album_id ?? null) !== fAlbum) return false;
    if (fVersion !== "all" && String(it.version ?? "") !== String(fVersion)) return false;

    if (fMember !== "all") {
      if (!memberMatches(it.member, fMember)) return false;
    }

    if (fUnit !== "all") {
  const ut = unitTypeFromMember(it.member);
  if (ut !== fUnit) return false;
}

    return matchesQuery(it, q);
  });
}, [items, invByItem, q, fStatus, fGroup, fAlbum, fVersion, fMember, fUnit]);
 // Resetea a la página 1 cada vez que cambias un filtro o buscas algo
  useEffect(() => {
    setCurrentPage(1);
  }, [fStatus, fGroup, fAlbum, fVersion, fMember, fUnit, q]);
useEffect(() => {
  const debugAlbumId = 62;

  const inItems = items.filter((x) => x.album_id === debugAlbumId);
  const inFiltered = filtered.filter((x) => x.album_id === debugAlbumId);

  const countByVersion = (arr: ItemRow[]) =>
    arr.reduce((acc: Record<string, number>, it) => {
      const v = (it.version ?? "NULL").trim() || "EMPTY";
      acc[v] = (acc[v] ?? 0) + 1;
      return acc;
    }, {});

  console.log("🔎 DEBUG FILTERS NOW:", { fStatus, fGroup, fAlbum, fVersion, fMember, fUnit, q });
  console.log("🔎 DEBUG album subset items:", inItems.length, countByVersion(inItems));
  console.log("🔎 DEBUG album subset filtered:", inFiltered.length, countByVersion(inFiltered));
}, [items, filtered, fStatus, fGroup, fAlbum, fVersion, fMember, fUnit, q]);

const persistWttQty = useCallback(
  async (itemId: number, value: number) => {
    if (!userId) return;
    if (isViewingOtherUser) return;
    if (!Number.isFinite(itemId)) return;

    const qty = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

    if (qty > 0) {
      const up = await supabase
        .from("user_item_statuses")
        .upsert(
          [{ user_id: userId, item_id: itemId, status: "wtt", qty }] as any,
          { onConflict: "user_id,item_id,status" }
        );
      if (up.error) return;
    } else {
      const del = await supabase
        .from("user_item_statuses")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .eq("status", "wtt");
      if (del.error) return;
    }

    setInvByItem((prev) => ({
      ...prev,
      [itemId]: { ...(prev?.[itemId] ?? emptyCounts()), wtt: qty },
    }));
  },
  [userId, isViewingOtherUser]
);
const [wtsListingModalOpen, setWtsListingModalOpen] = useState(false);
const [wtsListingItemId, setWtsListingItemId] = useState<number | null>(null);
const openWttOfferModal = useCallback(
  (itemId: number) => {
    if (isViewingOtherUser) return;
    setWttOfferForId(itemId);
    const stored = readWttOffer(itemId);
    const storedIds = wttOfferByItem[itemId] ?? stored.ids;
    const storedQty = wttOfferQtyByItem[itemId] ?? stored.qty;
    setWttOfferDraft(storedIds ?? []);
    setWttOfferQtyDraft(Number.isFinite(storedQty) ? Math.max(0, Math.floor(storedQty)) : 0);
    setWttOfferQ("");
    setWttOfferGroup("");
    setWttOfferAlbum("");
    setWttOfferVersion("");
    setWttOfferMember("");
    setWttOfferUnit("all");
    setWttOfferOpen(true);
  },
  [isViewingOtherUser, readWttOffer, wttOfferByItem, wttOfferQtyByItem]
);



const saveWttOfferDraft = useCallback(() => {
  if (wttOfferForId == null) return;
  const qty = Number.isFinite(wttOfferQtyDraft) ? Math.max(0, Math.floor(wttOfferQtyDraft)) : 0;
  const nextIds = qty > 0 ? wttOfferDraft : [];
  setWttOfferByItem((prev) => ({ ...prev, [wttOfferForId]: nextIds }));
  setWttOfferQtyByItem((prev) => ({ ...prev, [wttOfferForId]: qty }));
  writeWttOffer(wttOfferForId, qty, nextIds);
  void persistWttQty(wttOfferForId, qty);
  setWttOfferOpen(false);
}, [wttOfferForId, wttOfferDraft, wttOfferQtyDraft, writeWttOffer, persistWttQty]);
useEffect(() => {
    if (!wttOfferOpen) return;
    requestAnimationFrame(() => wttOfferQRef.current?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setWttOfferOpen(false); // Cierra con Esc
      } else if (e.key === "Enter") {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        
        // Si el usuario está escribiendo texto en el buscador, no cerramos de golpe
        if (tag === "input" || tag === "textarea") return;
        
        e.preventDefault();
        e.stopPropagation();
        saveWttOfferDraft(); // Guarda con Enter
      }
    };
    
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [wttOfferOpen, saveWttOfferDraft]);
useEffect(() => {
  if (openItemId == null) return;
  const wttQty = wttOfferQtyByItem[openItemId] ?? readWttOffer(openItemId).qty ?? 0;
  if (wttQty > 0) return;

  const hasSelection = (wttOfferByItem[openItemId]?.length ?? 0) > 0;
  if (!hasSelection) return;

  setWttOfferByItem((prev) => ({ ...prev, [openItemId]: [] }));
  setWttOfferQtyByItem((prev) => ({ ...prev, [openItemId]: 0 }));
  writeWttOffer(openItemId, 0, []);
}, [openItemId, wttOfferByItem, wttOfferQtyByItem, readWttOffer, writeWttOffer]);

const commitStockForItem = useCallback(
  async (itemId: number, next: Record<PersistStatus, number>) => {
    if (!userId) return;

    setError(null);

    const cleaned: Record<PersistStatus, number> = {
      have: Math.max(0, Math.floor(next.have ?? 0)),
      wtt: Math.max(0, Math.floor(next.wtt ?? 0)),
      wts: Math.max(0, Math.floor(next.wts ?? 0)),
      on_its_way: Math.max(0, Math.floor(next.on_its_way ?? 0)),
      wishlist: Math.max(0, Math.floor(next.wishlist ?? 0)),
    };
// ✅ detectar transición a WTS (para abrir modal “Publicar venta”)
const prevCounts = invByItem[itemId] ?? emptyCounts();
const prevWts = Number(prevCounts?.wts ?? 0);
const nextWts = Number(cleaned.wts ?? 0);
const becameWts = prevWts === 0 && nextWts > 0;
    const upRows = (Object.keys(cleaned) as PersistStatus[])
      .filter((k) => cleaned[k] > 0)
      .map((k) => ({
        user_id: userId,
        item_id: itemId,
        status: k,
        qty: cleaned[k],
      }));

    if (upRows.length > 0) {
      const up = await supabase.from("user_item_statuses").upsert(upRows, { onConflict: "user_id,item_id,status" });
      if (up.error) {
        setError(up.error.message);
        return;
      }
    }

    const zeroStatuses = (Object.keys(cleaned) as PersistStatus[]).filter((k) => cleaned[k] === 0);
    if (zeroStatuses.length > 0) {
      const del = await supabase
        .from("user_item_statuses")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .in("status", zeroStatuses);

      if (del.error) {
        setError(del.error.message);
        return;
      }
    }

    setInvByItem((prev) => {
      const nextMap = { ...prev };
      nextMap[itemId] = {
        have: cleaned.have,
        wtt: cleaned.wtt,
        wts: cleaned.wts,
        on_its_way: cleaned.on_its_way,
        wish: cleaned.wishlist,
      };
      return nextMap;
    });
// ✅ si acaba de activar WTS, pedir precio/moneda/país
if (becameWts) {
  setWtsListingItemId(itemId);
  setWtsListingModalOpen(true);
}
    const existingIds = wttOfferByItem[itemId] ?? readWttOffer(itemId).ids;
    if (cleaned.wtt > 0) {
      setWttOfferByItem((prev) => ({ ...prev, [itemId]: existingIds }));
      setWttOfferQtyByItem((prev) => ({ ...prev, [itemId]: cleaned.wtt }));
      writeWttOffer(itemId, cleaned.wtt, existingIds);
    } else {
      setWttOfferByItem((prev) => ({ ...prev, [itemId]: [] }));
      setWttOfferQtyByItem((prev) => ({ ...prev, [itemId]: 0 }));
      writeWttOffer(itemId, 0, []);
    }
  }, [
  userId,
  invByItem,
  readWttOffer,
  wttOfferByItem,
  writeWttOffer,
  setWtsListingItemId,
  setWtsListingModalOpen,
]);
// 👇 AÑADE ESTO (PASO 3) 👇
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  // 👆 HASTA AQUÍ 👆
return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFDF5", display: "flex", flexDirection: "column" }}>
      
    <Header />
     {/* CUERPO DE LA LIBRERIA (Con márgenes laterales preparados para publicidad) */}
      <div ref={libraryShellRef} style={{ padding: "24px 40px", display: "flex", justifyContent: "center", flex: 1, width: "100%" }}>
        
        <WtsListingModal
          open={wtsListingModalOpen}
          itemId={wtsListingItemId}
          onClose={() => setWtsListingModalOpen(false)}
          onSaved={() => setWtsListingModalOpen(false)}
        />

        {/* CONTENEDOR CENTRAL: Limitado a 1120px para dejar hueco a los lados */}
        <div style={{ width: "100%", maxWidth: 1120, display: "flex", flexDirection: "column", gap: 20 }}>
          
          {error && <div style={{ color: "crimson", textAlign: "center", fontWeight: 900 }}>Error: {error}</div>}

        {/* FILA 1: BUSCADOR Y BOTONES PRINCIPALES */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, width: "100%" }}>
            
            {/* BUSCADOR (Izquierda) */}
            <div style={{ position: "relative", flex: "1 1 300px", maxWidth: 450 }}>
              <div style={{ 
                position: "absolute", 
                left: 14, 
                top: "50%", 
                transform: "translateY(-50%)", 
                color: "#8C659C", 
                pointerEvents: "none", 
                display: "flex" 
              }}>

              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, miembro, versión o ID..."
                style={{ 
                  padding: "10px 14px 10px 42px", 
                  borderRadius: 12, 
                  border: "2px solid #F3DCE7", 
                  background: "white", 
                  color: "#2F2740", 
                  boxShadow: "0 4px 14px rgba(247,168,216,0.12)", 
                  width: "100%", 
                  outline: "none",
                  fontSize: 14,
                  transition: "border 0.2s ease",
                  boxSizing: "border-box"
                }}
              />
            </div>

            {/* BOTONES DE ACCIÓN (Forzados a la derecha) */}
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginLeft: "auto" }}>
              
              {/* Botón Voltear */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#8C659C" }}>
                  Voltear
                </span>
                <button 
                  onClick={flipWholePage} 
                  disabled={loading} 
                  style={{ 
                    ...topBtnStyle, 
                    width: 40, 
                    height: 40, 
                    padding: 0, 
                    justifyContent: "center",
                    gap: 0 
                  }} 
                  title="Voltear página"
                >
                  <RotateCw size={18} strokeWidth={2.4} />
                </button>
              </div>

              <a href="/binder" style={{...topBtnStyle, background: "#FFF5FA", borderColor: "#F7A8D8"}}>
                <BookOpen size={16} strokeWidth={2.4} />
                Ir al binder
              </a>
            </div>
          </div>

          {/* FILA 2: FILTROS DETALLADOS (Diseño compacto y empaquetado) */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", 
            gap: 12, 
            background: "#FFF9FB", 
            padding: 16, 
            borderRadius: 16, 
            border: "1px solid #F3DCE7",
            boxShadow: "0 4px 12px rgba(247,168,216,0.05)"
          }}>
            
            {/* ESTADO */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#8C659C", fontWeight: 900, display: "flex", alignItems: "center", gap: 6 }}>
                <SlidersHorizontal size={14} strokeWidth={2.4} /> Estado
              </label>
              <select
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value as StatusFilter)}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #F3DCE7", background: "white", color: "#2F2740", outline: "none", width: "100%" }}
              >
                <option value="all">Todos</option>
                <option value="have">Tengo</option>
                <option value="wts">WTS</option>
                <option value="wtt">WTT</option>
                <option value="on_its_way">On the way</option>
                <option value="wish">Wishlist</option>
              </select>
            </div>

            {/* GRUPO */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#8C659C", fontWeight: 900, display: "flex", alignItems: "center", gap: 6 }}>
                <Users size={14} strokeWidth={2.4} /> Grupo
              </label>
              <select
                value={fGroup === "all" ? "all" : String(fGroup)}
                onChange={(e) => setFGroup(e.target.value === "all" ? "all" : Number(e.target.value))}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #F3DCE7", background: "white", color: "#2F2740", outline: "none", width: "100%" }}
              >
                <option value="all">Todos</option>
                {groupOptions.map((gid) => (
                  <option key={gid} value={String(gid)}>
                    {groupNameById[gid] ?? `Grupo ${gid}`}
                  </option>
                ))}
              </select>
            </div>

            {/* ALBUM */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#8C659C", fontWeight: 900, display: "flex", alignItems: "center", gap: 6 }}>
                <Disc3 size={14} strokeWidth={2.4} /> Álbum
              </label>
              <select
                value={fAlbum === "all" ? "all" : String(fAlbum)}
                onChange={(e) => setFAlbum(e.target.value === "all" ? "all" : Number(e.target.value))}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #F3DCE7", background: "white", color: "#2F2740", outline: "none", width: "100%" }}
              >
                <option value="all">Todos</option>
                {albumOptions.map((aid) => (
                  <option key={aid} value={String(aid)}>
                    {prettyAlbumDisplay(albumById[aid]?.name ?? `Álbum ${aid}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* VERSION */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#8C659C", fontWeight: 900, display: "flex", alignItems: "center", gap: 6 }}>
                <Mic2 size={14} strokeWidth={2.4} /> Versión
              </label>
              <select
                value={fVersion === "all" ? "all" : String(fVersion)}
                onChange={(e) => setFVersion(e.target.value === "all" ? "all" : e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #F3DCE7", background: "white", color: "#2F2740", outline: "none", width: "100%" }}
              >
                <option value="all">Todas</option>
                {versionOptions.map((v) => (
                  <option key={v} value={v}>
                    {toNiceTitle(v.replace(/[-_]+/g, " "))}
                  </option>
                ))}
              </select>
            </div>

            {/* MIEMBRO */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#8C659C", fontWeight: 900, display: "flex", alignItems: "center", gap: 6 }}>
                <User size={14} strokeWidth={2.4} /> Miembro
              </label>
              <select
                value={fMember === "all" ? "all" : String(fMember)}
                onChange={(e) => setFMember(e.target.value === "all" ? "all" : e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #F3DCE7", background: "white", color: "#2F2740", outline: "none", width: "100%" }}
              >
                <option value="all">Todos</option>
                {memberOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* TIPO */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#8C659C", fontWeight: 900, display: "flex", alignItems: "center", gap: 6 }}>
                <Layers size={14} strokeWidth={2.4} /> Tipo
              </label>
              <select
                value={fUnit}
                onChange={(e) => setFUnit(e.target.value as UnitFilter)}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #F3DCE7", background: "white", color: "#2F2740", outline: "none", width: "100%" }}
              >
                <option value="all">Todas</option>
                <option value="single">Single</option>
                <option value="unit">Unit</option>
                <option value="ot8">OT8</option>
              </select>
            </div>
            
          </div>
          {/* FIN DE FILA 2 */}
      {loading && <div style={{ marginTop: 10, color: "#666" }}>Cargando…</div>}

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(7, 120px)",
          gap: 18,
          justifyContent: "center",
          alignItems: "start",
          width: "100%",
        }}
      >
{paginatedItems.map((it) => {
  const counts = invByItem[it.id] ?? emptyCounts();
  const inBinder = placedByItem[it.id] ?? 0;
  const faceValue = cardFace[it.id] ?? "front";
  const groupName = it.group_id ? (groupNameById[it.group_id] ?? `Grupo ${it.group_id}`) : "—";
  const albumName = it.album_id ? (albumById[it.album_id]?.name ?? `Álbum ${it.album_id}`) : "—";
  const isFavorite = myBiasIds.includes(Number(it.group_id));

  return (
    <div key={it.id} style={{ position: 'relative' }}>
      {/* MARCA VISUAL K-POP */}
      {isFavorite && (
        <div style={{
          position: 'absolute', top: -8, right: -8, zIndex: 100,
          background: '#F7A8D8', borderRadius: '50%', width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(247,168,216,0.5)', border: '2px solid white'
        }}>
          <Heart size={16} fill="white" color="white" />
        </div>
      )}

      <LibraryItemCard
        disableEdits={isViewingOtherUser}
        item={it}
        counts={counts}
        inBinder={inBinder}
        face={faceValue}
        groupName={groupName}
        albumName={albumName}
        showInfo={Boolean(openInfoById[it.id])}
        onToggleInfo={() =>
          setOpenInfoById((prev) => ({ ...prev, [it.id]: !prev[it.id] }))
        }
        onToggleFace={() => {
          setCardFace((prev) => {
            const cur = prev[it.id] ?? "front";
            return { ...prev, [it.id]: cur === "front" ? "back" : "front" };
          });
        }}
        onCommitStock={(next) => commitStockForItem(it.id, next)}
        onOpen={() => setOpenItemId(it.id)}
      />
    </div>
  );
})}
</div>
{/* 👇 CONTROLES DE PAGINACIÓN 👇 */}
          {totalPages > 1 && (
            <div style={{ 
              display: "flex", 
              justifyContent: "center", 
              alignItems: "center", 
              gap: 20, 
              marginTop: 40, 
              paddingBottom: 40 
            }}>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  border: currentPage === 1 ? "1px solid #eee" : "1px solid #F7A8D8",
                  background: currentPage === 1 ? "#f9f9f9" : "white",
                  color: currentPage === 1 ? "#ccc" : "#8C659C",
                  fontWeight: 900,
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  boxShadow: currentPage === 1 ? "none" : "0 4px 12px rgba(247, 168, 216, 0.15)",
                  transition: "all 0.2s ease"
                }}
              >
                ◀ Anterior
              </button>

              <span style={{ fontWeight: 900, color: "#8C659C", fontSize: 15 }}>
                Página {currentPage} de {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  border: currentPage === totalPages ? "1px solid #eee" : "1px solid #F7A8D8",
                  background: currentPage === totalPages ? "#f9f9f9" : "white",
                  color: currentPage === totalPages ? "#ccc" : "#8C659C",
                  fontWeight: 900,
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                  boxShadow: currentPage === totalPages ? "none" : "0 4px 12px rgba(247, 168, 216, 0.15)",
                  transition: "all 0.2s ease"
                }}
              >
                Siguiente ▶
              </button>
            </div>
          )}
          {/* 👆 FIN PAGINACIÓN 👆 */}
      {openItemId !== null &&
        (() => {
          const it = items.find((x) => x.id === openItemId);
          if (!it) return null;

          const counts = invByItem[it.id] ?? emptyCounts();
          const inBinder = placedByItem[it.id] ? 1 : 0;

          const groupName = it.group_id ? (groupNameById[it.group_id] ?? `Grupo ${it.group_id}`) : "—";

         const orderedIds = filtered.map((x) => x.id);
const idx = orderedIds.indexOf(openItemId);

const canPrev = idx > 0;
const canNext = idx >= 0 && idx < orderedIds.length - 1;
const albumName =
  it.album_id ? (albumById[it.album_id]?.name ?? `Álbum ${it.album_id}`) : "—";
const wttOfferIds = wttOfferByItem[it.id] ?? readWttOffer(it.id).ids ?? [];
const wttOfferItems = wttOfferIds
  .map((id) => items.find((x) => x.id === id))
  .filter((x): x is ItemRow => Boolean(x));
return (
  <ItemModal
  isViewingOtherUser={isViewingOtherUser}
viewingUserId={viewingUserId}
    key={openItemId}
    item={it}
    counts={counts}
    inBinder={inBinder}
    groupName={groupName}
    albumName={albumName}
    wttOfferItems={wttOfferItems}
    onOpenWttOffer={() => openWttOfferModal(it.id)}
    
    onClose={() => setOpenItemId(null)}
    canPrev={canPrev}
    canNext={canNext}
    onPrev={() => {

      if (!canPrev) return;
      setOpenItemId(orderedIds[idx - 1]);
    }}
    onNext={() => {
      if (!canNext) return;
      setOpenItemId(orderedIds[idx + 1]);
      
    }}
  />
);

        })()}

      {wttOfferOpen && wttOfferForId !== null && !isViewingOtherUser && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.40)", // Oscurecido sutilmente
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100000,
            padding: 18,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setWttOfferOpen(false);
          }}
        >
          <div
            style={{
              width: "min(980px, 96vw)",
              height: "min(700px, 92vh)",
              background: "#F7F4EE", // Fondo vainilla aesthetic
              borderRadius: 18,
              border: "1px solid #F3DCE7", // Borde rosa
              boxShadow: "0 22px 60px rgba(0,0,0,0.22)",
              overflow: "hidden",
              display: "grid",
              gridTemplateRows: "62px auto 1fr 64px",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid #F3C7DA",
                background: "#FFD9E6", // Fondo rosa
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <img src="/branding/logo.png" alt="" style={{ height: 28, width: "auto", objectFit: "contain", flex: "0 0 auto" }} />
                <div style={{ fontWeight: 950, color: "#8C659C", fontSize: 20, lineHeight: 1.1 }}>
                  Mis trades (WTT)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWttOfferOpen(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid #F7A8D8",
                  background: "white",
                  color: "#8C659C",
                  cursor: "pointer",
                  fontWeight: 900,
                  transition: "all 0.15s ease",
                  boxShadow: "0 2px 8px rgba(247,168,216,0.15)"
                }}
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* CONTROLES / FILTROS */}
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid #F3DCE7",
                display: "grid",
                gap: 10,
                background: "#FFF9FB", // Rosa muuuy claro
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: "#8C659C", fontWeight: 900 }}>Nº de PCs para tradear</div>
                  <input
                    type="number"
                    min={0}
                    value={wttOfferQtyDraft}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const next = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
                      setWttOfferQtyDraft(next);
                      if (next === 0) setWttOfferDraft([]);
                      if (wttOfferForId != null) {
                        const nextIds = next > 0 ? wttOfferDraft : [];
                        setWttOfferByItem((prev) => ({ ...prev, [wttOfferForId]: nextIds }));
                        setWttOfferQtyByItem((prev) => ({ ...prev, [wttOfferForId]: next }));
                        writeWttOffer(wttOfferForId, next, nextIds);
                        setInvByItem((prev: any) => ({
                          ...prev,
                          [wttOfferForId]: { ...(prev?.[wttOfferForId] ?? emptyCounts()), wtt: next },
                        }));
                        void persistWttQty(wttOfferForId, next);
                      }
                    }}
                    style={{ height: 34, padding: "6px 10px", borderRadius: 10, border: "1px solid #F3DCE7", background: "white", fontSize: 13, color: "#2F2740", outline: "none" }}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "#8C659C", fontWeight: 900, display: "flex", alignItems: "center", gap: 6 }}>
                    Buscar en mis WTT
                  </label>
                  <input
                    ref={wttOfferQRef}
                    value={wttOfferQ}
                    onChange={(e) => {
                      setWttOfferQ(e.target.value);
                      requestAnimationFrame(() => wttOfferQRef.current?.focus());
                    }}
                    placeholder="Busca por nombre, miembro, versión..."
                    style={{ height: 34, padding: "6px 10px", borderRadius: 10, border: "1px solid #F3DCE7", background: "white", fontSize: 13, outline: "none" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "#8C659C", display: "flex", alignItems: "center", gap: 6, fontWeight: 900 }}>
                    <Users size={14} strokeWidth={2.4} /> Grupo
                  </label>
                  <select
                    value={wttOfferGroup}
                    onChange={(e) => setWttOfferGroup(e.target.value ? Number(e.target.value) : "")}
                    style={{ background: "white", padding: "8px 10px", borderRadius: 10, border: "1px solid #F3DCE7", color: "#2F2740", outline: "none" }}
                  >
                    <option value="">Todos</option>
                    {Array.from(new Set(items.map((i) => i.group_id).filter((x): x is number => typeof x === "number")))
                      .map((id) => ({ id, name: groupNameById[id] ?? `#${id}` }))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "#8C659C", display: "flex", alignItems: "center", gap: 6, fontWeight: 900 }}>
                    <Disc3 size={14} strokeWidth={2.4} /> Álbum
                  </label>
                  <select
                    value={wttOfferAlbum}
                    onChange={(e) => setWttOfferAlbum(e.target.value ? Number(e.target.value) : "")}
                    style={{ background: "white", padding: "8px 10px", borderRadius: 10, border: "1px solid #F3DCE7", color: "#2F2740", outline: "none" }}
                  >
                    <option value="">Todos</option>
                    {Array.from(new Set(items.filter((i) => (wttOfferGroup === "" ? true : i.group_id === wttOfferGroup)).map((i) => i.album_id).filter((x): x is number => typeof x === "number")))
                      .map((id) => ({ id, name: albumById[id]?.name ?? `#${id}`, release_date: albumById[id]?.release_date ?? null }))
                      .sort((a, b) => {
                        const da = a.release_date ? new Date(a.release_date).getTime() : Number.POSITIVE_INFINITY;
                        const db = b.release_date ? new Date(b.release_date).getTime() : Number.POSITIVE_INFINITY;
                        if (da !== db) return da - db;
                        return a.name.localeCompare(b.name, "es");
                      })
                      .map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "#8C659C", display: "flex", alignItems: "center", gap: 6, fontWeight: 900 }}>
                    <Mic2 size={14} strokeWidth={2.4} /> Versión
                  </label>
                  <select
                    value={wttOfferVersion}
                    onChange={(e) => setWttOfferVersion(e.target.value)}
                    style={{ background: "white", padding: "8px 10px", borderRadius: 10, border: "1px solid #F3DCE7", color: "#2F2740", outline: "none" }}
                  >
                    <option value="">Todas</option>
                    {Array.from(new Set(items.filter((i) => (wttOfferGroup === "" ? true : i.group_id === wttOfferGroup)).filter((i) => (wttOfferAlbum === "" ? true : i.album_id === wttOfferAlbum)).map((i) => i.version ?? "").filter((v) => String(v || "").trim())))
                      .map((v) => String(v))
                      .sort((a, b) => a.localeCompare(b, "es"))
                      .map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "#8C659C", display: "flex", alignItems: "center", gap: 6, fontWeight: 900 }}>
                    <User size={14} strokeWidth={2.4} /> Miembro
                  </label>
                  <select
                    value={wttOfferMember}
                    onChange={(e) => setWttOfferMember(e.target.value)}
                    style={{ background: "white", padding: "8px 10px", borderRadius: 10, border: "1px solid #F3DCE7", color: "#2F2740", outline: "none" }}
                  >
                    <option value="">Todos</option>
                    {(() => {
                      const order = ["bang chan", "lee know", "changbin", "hyunjin", "han", "felix", "seungmin", "in"];
                      const orderIndex = (raw: string) => {
                        const key = String(raw).toLowerCase().replace(/\./g, "").trim();
                        const hit = order.findIndex((o) => key.includes(o));
                        return hit === -1 ? Number.POSITIVE_INFINITY : hit;
                      };
                      return Array.from(new Set(items.map((i) => i.member ?? "").filter((m) => String(m || "").trim()).map((m) => String(m))))
                        .sort((a, b) => {
                          const ia = orderIndex(a);
                          const ib = orderIndex(b);
                          if (ia !== ib) return ia - ib;
                          return a.localeCompare(b, "es");
                        })
                        .map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ));
                    })()}
                  </select>
                </div>
              </div>
            </div>

            {/* GRILLA DE CARTAS */}
            <div style={{ padding: 12, overflow: "auto", overflowAnchor: "none" }}>
              {(() => {
                const filtered = items.filter((it) => {
                  if (wttOfferGroup !== "" && it.group_id !== wttOfferGroup) return false;
                  if (wttOfferAlbum !== "" && it.album_id !== wttOfferAlbum) return false;
                  if (wttOfferVersion && String(it.version ?? "") !== wttOfferVersion) return false;
                  if (wttOfferMember && !memberMatches(it.member ?? null, wttOfferMember)) return false;
                  if (wttOfferUnit !== "all" && unitTypeFromMember(it.member) !== wttOfferUnit) return false;

                  const g = normText(wttOfferQ);
                  if (!g) return true;
                  const hay = normText([it.id, it.name ?? "", it.member ?? "", it.version ?? ""].join(" "));
                  return hay.includes(g);
                });

                if (!filtered.length) {
                  return <div style={{ fontSize: 13, color: "#8C659C", fontWeight: 800 }}>No hay resultados para tu búsqueda.</div>;
                }

                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
                    {filtered.map((it) => {
                      const selected = wttOfferDraft.includes(it.id);
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => {
                            setWttOfferDraft((prev) =>
                              prev.includes(it.id) ? prev.filter((x) => x !== it.id) : [...prev, it.id]
                            );
                          }}
                          style={{
                            border: selected ? "2px solid #F7A8D8" : "2px solid transparent", // Selección rosada
                            borderRadius: 12,
                            background: selected ? "#FFF5FA" : "white",
                            padding: 6,
                            cursor: "pointer",
                            textAlign: "left",
                            boxShadow: selected ? "0 8px 18px rgba(247,168,216,0.25)" : "0 8px 18px rgba(0,0,0,0.06)",
                            transition: "all 0.15s ease"
                          }}
                        >
                          <img
                            src={it.image_url ?? "/mock-pcs/groupsui/not-available.png"}
                            alt=""
                            draggable={false}
                            style={{
                              width: "100%",
                              aspectRatio: "3/4",
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1px solid #F3DCE7",
                              background: "#fafafa",
                              display: "block",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* FOOTER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: "1px solid #F3DCE7", background: "white" }}>
              <div style={{ fontSize: 12, color: "#8C659C", fontWeight: 900 }}>
                Seleccionadas: <b>{wttOfferDraft.length}</b>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setWttOfferDraft([])}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #F3DCE7", background: "white", cursor: "pointer", fontWeight: 900, color: "#8C659C" }}
                >
                  Borrar selección
                </button>
                <button
                  type="button"
                  onClick={() => setWttOfferOpen(false)}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #F3DCE7", background: "white", cursor: "pointer", fontWeight: 900, color: "#8C659C" }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => saveWttOfferDraft()}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "none", background: "#B17EAC", color: "white", cursor: "pointer", fontWeight: 900, boxShadow: "0 4px 10px rgba(177, 126, 172, 0.3)" }}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

     {!loading && filtered.length === 0 && (
            <div style={{ marginTop: 10, color: "#777" }}>
              No hay resultados para este filtro.
            </div>
          )}
        </div>
      </div>

      {/* ESTILOS GLOBALES (FUENTES) */}
      <style jsx global>{`
        @font-face {
          font-family: 'TanTangkiwood';
          src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype');
          font-weight: normal;
          font-style: normal;
        }
        .tan-font {
          font-family: 'TanTangkiwood', sans-serif !important;
          text-transform: uppercase;
        }
      `}</style>
     <footer style={{ 
  width: "100%", backgroundColor: "white", borderTop: "1px solid #F3DCE7", 
  padding: "60px 80px 30px 80px", display: "flex", flexDirection: "column", 
  gap: "40px", marginTop: "auto" 
}}>
  <div style={{ 
    display: "grid", 
    gridTemplateColumns: "1.5fr 1fr 1fr 1fr", 
    gap: "40px", 
    alignItems: "start" 
  }}>
    
    {/* Columna 1: Branding */}
    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
      <span className="tan-font" style={{ color: "#b17eac", fontSize: "24px", letterSpacing: "1px" }}>
        MY KPOP BINDER
      </span>
      <p style={{ fontSize: "14px", color: "#8C659C", fontWeight: 600, maxWidth: "250px", lineHeight: "1.5" }}>
        Tu rincón digital para organizar, comprar y tradear tus photocards favoritas de la forma más eficiente.
      </p>
      <span style={{ fontSize: "12px", color: "#b17eac", fontWeight: 700, marginTop: "10px" }}>
        © 2026 My Kpop Binder. Hecho por fans para fans.
      </span>
    </div>

    {/* Columna 2: Legal */}
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={footerColumnTitle}>LEGAL</span>
      <a href="/terms" style={footerLinkStyle}>Términos y Condiciones</a>
      <a href="/terms#community" style={footerLinkStyle}>Normas de la Comunidad</a>
      <a href="/terms#copyright" style={footerLinkStyle}>Aviso de Copyright</a>
    </div>

    {/* Columna 3: Marketplace */}
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={footerColumnTitle}>MARKETPLACE</span>
      <a href="/market-rules" style={footerLinkStyle}>Reglas del Mercado</a>
      <a href="/anti-scam" style={footerLinkStyle}>Política Anti-Fraude</a>
      <a href="/privacy" style={footerLinkStyle}>Privacidad y Cookies</a>
    </div>

    {/* Columna 4: Soporte */}
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={footerColumnTitle}>SOPORTE</span>
      <a href="/faq" style={footerLinkStyle}>Preguntas Frecuentes</a>
      <a href="/report" style={{ ...footerLinkStyle, fontWeight: 900, textDecoration: "underline" }}>
        Reportar Abuso (DSA)
      </a>
      <a href="mailto:info@mykpopbinder.com" style={footerLinkStyle}>info@mykpopbinder.com</a>
    </div>
  </div>
</footer>
    </div>
  );
}