
"use client";
import Footer from "../components/footer";
import Header from "../components/header";
import AdRailLayout from "../components/AdRailLayout";
import ImageWithExtensionFallback from "../components/ImageWithExtensionFallback";
import { resolveMockPcImageUrl } from "@/lib/mock-pc-url";
import localFont from "next/font/local";
import { useGlobal } from "../context/GlobalContext";
import { formatCollectionOptionLabel, sortCollectionEntries } from "@/lib/collection-filters";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { avisarFavoritos } from "@/lib/avisos";
import { supabase } from "@/lib/supabase";
import { marketRefUsdStorageKey } from "@/lib/market-reference-keys";
import { getCurrencyOptions } from "./currencyOptions";
import WtsListingModal from "./WtsListingModal";
import WttListingModal from "./WttListingModal";
import {
  Users,
  Disc3,
  Mic2,
  User,
  RotateCw,
  BookOpen,
  SlidersHorizontal,
  Layers,
  ChevronLeft,
  ChevronRight,
  Upload,
  Siren,
  Heart,
  X,
  Sparkles,
  Handshake,
  Search,
} from "lucide-react";
const filterLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--library-filter-label)",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  gap: 6,
  lineHeight: 1.2,
  flexWrap: "wrap",
};

import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

function formatPcPriceDisplay(val: number | null | undefined): string {
  if (val == null || !Number.isFinite(val)) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

type UserItemStatusRow = {
  id: number;
  user_id: string;
  item_id: number;
  status: PersistStatus;
  qty: number | null;
};

type GroupRow = { id: number; name: string | null };
type AlbumRow = { id: number; name: string | null; release_date: string | null };

const tanTangkiwood = localFont({
  src: "../../public/fonts/tan-tangkiwood-regular.otf",
  display: "swap",
  variable: "--font-tan-tangkiwood",
});

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
  if (s === "on_its_way") return "var(--color-accent)";
  if (s === "wishlist") return "var(--state-warning-border)";
  if (s === "wtt") return "var(--state-success-border)";
  if (s === "wts") return "var(--state-success-border)";
  return "var(--state-success-border)";
}

function totalOwnedQtyFromCounts(counts: StatusCounts) {
  return counts.have + counts.wtt + counts.wts + counts.on_its_way;
}

function formatTooltipLines(counts: StatusCounts, inBinder: number) {
  return [
    `Tengo: ${counts.have}`,
    `WTT: ${counts.wtt}`,
    `WTS: ${counts.wts}`,
    `On the way: ${counts.on_its_way}`,
    `Wishlist: ${counts.wish}`,
    `En Binder: ${inBinder}`,
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

  if (tokens.length === 1 && tokens[0].length === 1) {
    const t = tokens[0];
    return memberWords.some((w) => w.includes(t)) || nameWords.some((w) => w.includes(t));
  }

  // "in" (I.N): no usar .includes() sobre versión ni sobre "seungmin"/"changbin" (contienen "in").
  if (tokens.length === 1 && tokens[0] === "in") {
    const pool = [...memberWords, ...nameWords];
    return pool.some((w) => {
      const sq = memberSlugSquish(w);
      return sq === "in" || memberInCanon(sq) === "in";
    });
  }

  const words = [...nameWords, ...memberWords, ...versionWords];

  return tokens.every((t) => {
    if (/^\d+$/.test(t)) return String(it.id).includes(t);
    return words.some((w) => w.includes(t));
  });
}
function memberSlugSquish(raw: string | null | undefined): string {
  return normText(String(raw ?? "")).replace(/\s+/g, "");
}

/** I.N puede venir como `in`, `jeongin`, `i n` (normText) → mismo slug. */
function memberInCanon(squish: string): string | null {
  if (squish === "in" || squish === "jeongin") return "in";
  return null;
}

function memberMatches(memberRaw: string | null, selected: string | "all") {
  if (selected === "all") return true;
  const mSquish = memberSlugSquish(memberRaw);
  const tSquish = memberSlugSquish(selected);
  if (mSquish && tSquish && mSquish === tSquish) return true;
  const cm = memberInCanon(mSquish);
  const ct = memberInCanon(tSquish);
  if (cm && ct && cm === ct) return true;

  const memberWords = normText(memberRaw ?? "").split(/\s+/).filter(Boolean);
  const targetWords = normText(String(selected)).split(/\s+/).filter(Boolean);
  return targetWords.every((tw) => memberWords.includes(tw));
}
const menuBtnStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: "10px 14px",
  textAlign: "left",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 900,
  color: "var(--color-primary)",
  fontSize: 14,
};

const footerColumnTitle: CSSProperties = {
  fontSize: "13px",
  color: "var(--color-primary)",
  fontWeight: 900,
  textTransform: "uppercase",
  marginBottom: "15px",
  display: "block",
};

const footerLinkStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  textDecoration: "none",
  fontWeight: 500,
  marginBottom: "8px",
  display: "block",
};
function unitTypeFromMember(memberRaw: string | null): "single" | "unit" | "ot8" {
  const raw = (memberRaw ?? "").trim();
  if (!raw) return "single";

  const lower = raw.toLowerCase();
  if (/\bot8\b/.test(lower)) return "ot8";
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
  return toNiceTitle(t.replace(/[-_]+/g, " "));
}

function prettyMemberLabel(memberRaw: string | null) {
  const raw = (memberRaw ?? "").trim();
  if (!raw) return "—";

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
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 12 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 10,
            border: "1px solid var(--state-disabled-border)",
            background: "linear-gradient(180deg, var(--bg-card), var(--bg-soft))",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </span>
        <span style={{ fontWeight: 900 }}>{label}</span>
      </div>
      <div style={{ fontWeight: 900, color: "var(--text-main)", textAlign: "left" }}>{value || "—"}</div>    </>
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
          border: "1px solid var(--state-disabled-border)",
          background: "linear-gradient(180deg, var(--bg-card), var(--bg-soft))",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "var(--text-muted)", // iconos mismo tono
        }}
      >
        {icon}
      </span>

      <span
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: "var(--text-main)",
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
function StockTooltip({ title = "Mini resumen ✨", lines, t }: { title?: string; lines: string[]; t: (k: string) => string }) {
  if (!lines || lines.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: -8,
        transform: "translate(-50%, 100%)",
        width: 240,
        background: "var(--bg-card)",
        border: "1px solid var(--state-disabled-border)",
        borderRadius: 14,
        padding: "10px 12px",
        boxShadow: "0 10px 28px var(--overlay-faint)",
        fontSize: 12,
        color: "var(--text-main)",
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{t('library.mini_resumen')}</div>
      <div style={{ lineHeight: 1.35, color: "var(--text-main)" }}>
        {lines.map((line) => (
          <div key={line}>{line}</div>
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
  t,
}: {
  counts: StatusCounts;
  disabled?: boolean;
  onCommit: (next: Record<PersistStatus, number>) => Promise<void>;
  t: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [openToLeft, setOpenToLeft] = useState(false);

  // Inicializamos el borrador con los valores actuales
  const [draft, setDraft] = useState<Record<PersistStatus, number>>({
    have: counts.have ?? 0,
    wtt: counts.wtt ?? 0,
    wts: counts.wts ?? 0,
    on_its_way: counts.on_its_way ?? 0,
    wishlist: counts.wish ?? 0,
  });

  // Sincronizar si cierras y abres o si cambian los datos externos
  useEffect(() => {
    if (!open) {
      setDraft({
        have: counts.have ?? 0,
        wtt: counts.wtt ?? 0,
        wts: counts.wts ?? 0,
        on_its_way: counts.on_its_way ?? 0,
        wishlist: counts.wish ?? 0,
      });
    }
  }, [counts, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const handleQtyChange = (s: PersistStatus, delta: number) => {
    setDraft(prev => {
      const currentVal = prev[s] ?? 0;
      const nextVal = Math.max(0, currentVal + delta);
      const next = { ...prev, [s]: nextVal };

      // Lógica excluyente: Si hay stock físico, no hay wishlist y viceversa
      if (s !== "wishlist" && nextVal > 0) next.wishlist = 0;
      if (s === "wishlist" && nextVal > 0) {
        next.have = 0; next.wtt = 0; next.wts = 0; next.on_its_way = 0;
      }
      return next;
    });
  };

  const total = (draft.have || 0) + (draft.wtt || 0) + (draft.wts || 0) + (draft.on_its_way || 0);

  const toggleOpen = () => {
    if (!open) {
      const rect = boxRef.current?.getBoundingClientRect();
      if (rect) {
        const dropdownWidth = 280;
        const gutter = 8;
        const overflowsRight = rect.left + dropdownWidth > window.innerWidth - gutter;
        setOpenToLeft(overflowsRight);
      }
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={boxRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        style={{
          width: "100%", height: 38, display: "flex", alignItems: "center", gap: 10,
          padding: "0 12px", borderRadius: 12, border: "1px solid var(--color-border)",
          background: "var(--bg-card)", cursor: "pointer", fontSize: 13, fontWeight: 950, color: "var(--library-stock-trigger-fg)"
        }}
      >
        <span>{t('library.stock_title')}</span>
        <span style={{ color: "var(--text-main)", background: "var(--bg-soft)", padding: "2px 8px", borderRadius: 8 }}>{total}</span>
        <span style={{ marginLeft: "auto" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: openToLeft ? "auto" : 0, right: openToLeft ? 0 : "auto", zIndex: 1000,
          width: 280, background: "var(--bg-card)", border: "1px solid var(--color-border)",
          borderRadius: 20, padding: 16, boxShadow: "0 15px 40px color-mix(in srgb, var(--color-primary) 18%, transparent)"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(["have", "wtt", "wts", "on_its_way", "wishlist"] as PersistStatus[]).map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "var(--library-stock-row-label-fg)" }}>
                  {s === "have" ? t('library.status_have') : s === "on_its_way" ? t('library.status_otw') : s.toUpperCase()}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <button type="button" onClick={() => handleQtyChange(s, -1)} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--library-stock-step-minus-border)", background: "var(--library-stock-step-minus-bg)", color: "var(--library-stock-step-minus-fg)", fontWeight: 900, cursor: "pointer" }}>-</button>
                  <span style={{ minWidth: 25, textAlign: "center", fontWeight: 950, fontSize: 14, color: "var(--library-stock-qty-fg)" }}>{draft[s]}</span>
                  <button type="button" onClick={() => handleQtyChange(s, 1)} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--library-stock-step-minus-border)", background: "var(--library-stock-step-minus-bg)", color: "var(--library-stock-step-minus-fg)", fontWeight: 900, cursor: "pointer" }}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "1px solid var(--library-stock-cancel-border)", background: "var(--library-stock-cancel-bg)", color: "var(--library-stock-cancel-fg)", fontWeight: 900, cursor: "pointer" }}>{t('common.cancel')}</button>
            <button type="button" onClick={async () => { await onCommit(draft); setOpen(false); }} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", background: "var(--library-stock-save-bg)", color: "var(--library-stock-save-fg)", fontWeight: 900, cursor: "pointer" }}>{t('common.save')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PinBadge({ t }: { t: (k: string) => string }) {
  return (
    <span
      title={t('library.card.info_tooltip')}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26, // Un poquito más grande para que respire bien
        height: 26,
        borderRadius: 999,
        border: "1px solid var(--color-border)", // Borde rosa
        background: "var(--bg-soft)", // Fondo rosa pastel
        color: "var(--color-primary)", // Tono morado
        boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 20%, transparent)", // Sombra rosada a juego
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
  t,
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
  t: (k: string) => string;
}) {
 
  const [hover, setHover] = useState(false);
  const total = totalOwnedQtyFromCounts(counts);
  const available = total > 0 ? 1 : 0;
  const tooltipLines = formatTooltipLines(counts, inBinder);
  const searchParams = useSearchParams();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 1. Obtenemos TU id al cargar
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setCurrentUserId(data.user.id);
    });
  }, []);

  // 2. Definimos el objetivo (Si hay 'u' en la URL, miramos a ese, si no, a ti)
  const targetUserId = searchParams.get('u') || currentUserId;
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
      : "var(--state-disabled-border)";

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
          background: "var(--bg-card)",
          position: "relative",
          overflow: "hidden",
          boxShadow:
            frameColor !== "var(--state-disabled-border)"
              ? `0 0 0 2px ${frameColor}, 0 8px 24px color-mix(in srgb, var(--text-main) 6%, transparent)`
              : "0 8px 24px color-mix(in srgb, var(--text-main) 6%, transparent)",
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
      background: "linear-gradient(180deg, var(--bg-card), var(--bg-soft))",
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

    <div style={{ height: 1, background: "var(--color-border)", marginTop: 2 }} />

    <div style={{ fontSize: 11, color: "var(--text-main)", lineHeight: 1.55, textAlign: "left" }}>
      {t("binders.statuses.have")}: <b>{counts.have}</b>
      <br />
      WTT: <b>{counts.wtt}</b>
      <br />
      WTS: <b>{counts.wts}</b>
      <br />
      On the way: <b>{counts.on_its_way}</b>
      <br />
      Wishlist: <b>{counts.wish}</b>
      <br />
      {t("library.in_binder")}: <b>{inBinder}</b>
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
          <ImageWithExtensionFallback
            key={`lib-card-f-${item.id}-${item.image_url}`}
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
              color: "var(--text-muted)",
              padding: 8,
              textAlign: "center",
            }}
          >
            {t('library.card.no_image_front')}
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
          <ImageWithExtensionFallback
            key={`lib-card-b-${item.id}-${item.back_image_url ?? DEFAULT_BACK_URL}`}
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
              color: "var(--text-muted)",
              padding: 8,
              textAlign: "center",
            }}
          >
            {t('library.card.no_image_back')}
          </div>
        )}
      </div>
    </div>
  </div>
)}

        {hover && !showInfo && <StockTooltip lines={tooltipLines} t={t} />}
      </div>

      {/* FILA 1: Stock */}
      <div style={{ marginTop: 8, display: "flex", justifyContent: "center", width: 120 }}>
        <div style={{ width: 120 }}>
  <StockDropdown counts={counts} onCommit={onCommitStock} disabled={disableEdits} t={t} />
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
              border: "1px solid var(--color-border)",
              background: "var(--surface-float)",
              color: "var(--library-card-action-flip-fg)",
              fontSize: 14,
              cursor: "pointer",
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px var(--library-card-action-shadow-flip)",
            }}
            title={face === "front" ? t('library.card.view_back') : t('library.card.view_front')}
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
              border: "1px solid var(--color-border)",
              background: "var(--surface-float)",
              color: "var(--library-card-action-info-fg)",
              fontSize: 14,
              cursor: "pointer",
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px var(--library-card-action-shadow-info)",
            }}
            title={t('library.card.info')}
          >
            i
          </button>
          {inBinder > 0 && <PinBadge t={t} />}
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
  alignRightOnCompact,
  t,
  onAlert,
  uiLang = "es",
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
  alignRightOnCompact: boolean;
  t: (k: string) => string;
  onAlert?: (title: string, message: string) => void;
  uiLang?: string;
}) {
  const [face, setFace] = useState<"front" | "back">("front");
  const [rot, setRot] = useState(0);
  const [userPrice, setUserPrice] = useState<string>("");
  const [marketRefUsd, setMarketRefUsd] = useState<string>("");
  const [marketViewCur, setMarketViewCur] = useState<string>("EUR");
  const [marketFxRate, setMarketFxRate] = useState<number | null>(null);
  const [marketFxLoading, setMarketFxLoading] = useState(false);
  const [marketConsultLoading, setMarketConsultLoading] = useState(false);
  const [wtsCurrency, setWtsCurrency] = useState<string>("EUR");
  const marketCurrencyOptions = useMemo(() => getCurrencyOptions(uiLang), [uiLang]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUserPrice(localStorage.getItem(`binder:price:${item.id}`) || "");
      setMarketRefUsd(localStorage.getItem(marketRefUsdStorageKey(item.id)) || "");
      setWtsCurrency(localStorage.getItem(`binder:wtsCurrency:${item.id}`) || "EUR");
      setMarketViewCur(localStorage.getItem(`binder:currency:${item.id}`) || "EUR");
    }
  }, [item.id]);

  useEffect(() => {
    let cancelled = false;
    const usd = Number(String(marketRefUsd).replace(",", ".").trim());
    if (!Number.isFinite(usd) || usd <= 0) {
      setMarketFxRate(null);
      setMarketFxLoading(false);
      return;
    }
    if (marketViewCur === "USD") {
      setMarketFxRate(1);
      setMarketFxLoading(false);
      return;
    }
    setMarketFxLoading(true);
    void (async () => {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        const json = await res.json();
        const r = Number(json?.rates?.[marketViewCur]);
        if (!cancelled && Number.isFinite(r) && r > 0) setMarketFxRate(r);
        else if (!cancelled) setMarketFxRate(null);
      } catch {
        if (!cancelled) setMarketFxRate(null);
      } finally {
        if (!cancelled) setMarketFxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id, marketRefUsd, marketViewCur]);

  const onConsultMarket = async () => {
    setMarketConsultLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const tok = s.session?.access_token;
      if (!tok) throw new Error("login");
      const res = await fetch("/api/market-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = (await res.json()) as { error?: string; usdMedian?: number };
      if (!res.ok) throw new Error(data?.error || "err");
      const n = Number(data.usdMedian);
      if (!Number.isFinite(n)) throw new Error("bad");
      const sval = String(Math.round(n * 100) / 100);
      try {
        localStorage.setItem(marketRefUsdStorageKey(item.id), sval);
      } catch {
        /* ignore */
      }
      setMarketRefUsd(sval);
    } catch {
      const msg = t("binders.item_info.market_consult_error");
      if (onAlert) onAlert(t("common.error"), msg);
      else window.alert(msg);
    } finally {
      setMarketConsultLoading(false);
    }
  };

  const marketUsdNum = Number(String(marketRefUsd).replace(",", ".").trim());
  const marketConverted =
    Number.isFinite(marketUsdNum) && marketUsdNum > 0 && marketFxRate != null
      ? marketUsdNum * marketFxRate
      : null;
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
  const unitLabel = unitType === "ot8" ? t('library.filters.ot8') : unitType === "unit" ? t('library.filters.unit') : t('library.filters.single');

  const uiWttDisplay = counts.wtt;
  const uiWishlist = counts.wish;
  const wttDisabled = isViewingOtherUser || uiWishlist > 0;

 const handleUploadFile = async (file: File) => {
    try {
      setUploadMsg(null);
      setUploading(true);
      
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Debes iniciar sesión para aportar imágenes.");

      // 1. Subir la imagen al bucket 'colaboraciones'
      const fileExt = file.name.split('.').pop();
      const fileName = `${authData.user.id}-${item.id}-${uploadSide}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('colaboraciones')
        .upload(fileName, file);
        
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('colaboraciones').getPublicUrl(fileName);

      // 2. Registrar la aportación en la base de datos
      const { error: dbError } = await supabase.from('aportaciones_pcs').insert({
        user_id: authData.user.id,
        item_id: item.id,
        face: uploadSide,
        image_url: publicUrl,
        status: 'pendiente'
      });

      if (dbError) throw dbError;

      setUploadMsg("✓ ¡Gracias! Hemos recibido tu imagen. Un admin la revisará pronto.");
    } catch (e: any) {
      setUploadMsg("❌ Error: " + e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      setTimeout(() => setUploadMsg(null), 4000);
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
      alert(t('library.report_sent_placeholder'));
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
    border: "1px solid var(--color-border)",
    background: "var(--surface-float)",
    cursor: "pointer",
    fontWeight: 900,
    color: "var(--color-primary)",
    boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 15%, transparent)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease"
  };

  const subtleCard: React.CSSProperties = {
    background: "var(--bg-soft)",
    border: "1px solid var(--color-border)",
    borderRadius: 18,
    boxShadow: "0 8px 24px color-mix(in srgb, var(--color-primary) 10%, transparent)",
  };

  return (
    <div
      className="library-item-modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay-medium)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: alignRightOnCompact ? "flex-end" : "center",
        padding: 20,
      }}
    >
      <div
        className="library-item-modal-shell"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "auto",
          maxWidth: "96vw",
          height: "auto",
          maxHeight: "92vh",
          background: "var(--bg-main)",
          borderRadius: 18,
          border: "1px solid var(--color-border)",
          boxShadow: "0 30px 80px color-mix(in srgb, var(--text-main) 22%, transparent)",
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
            borderBottom: "1px solid var(--color-border)",
            background: "var(--bg-soft)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 950, color: "var(--color-primary)", whiteSpace: "pre-line", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis" }}>
              {title}
            </div>
            {inBinder > 0 && <PinBadge t={t} />}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
            <button
              type="button"
              onClick={onPrev}
              disabled={!canPrev}
              style={{ ...headerIconBtn, opacity: canPrev ? 1 : 0.45 }}
              title={t("common.previous")}
            >
              <ChevronLeft size={18} strokeWidth={2.6} />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              style={{ ...headerIconBtn, opacity: canNext ? 1 : 0.45 }}
              title={t("common.next")}
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
                  border: "1px solid var(--color-border)",
                  background: "var(--bg-soft)",
                  color: "var(--state-danger-fg)",
                }}
                title={t("common.report_content")}
              >
                <Siren size={18} strokeWidth={2.4} />
              </button>
            )}
            <button type="button" onClick={onClose} style={headerIconBtn} title={t("common.close")}>
              ✕
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="library-item-modal-grid" style={{ display: "grid", gridTemplateColumns: "420px 520px", columnGap: 18, justifyContent: "start", height: "100%", minHeight: 0 }}>
          
          {/* IZQ: PREVIEW FOTO */}
          <div style={{ position: "relative", background: "var(--bg-main)", padding: 10, borderRight: "1px solid var(--bg-soft)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
            <div style={{ width: "100%", maxWidth: 320, aspectRatio: "2 / 3", position: "relative", perspective: 1100, background: "transparent", margin: "auto 0" }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transformStyle: "preserve-3d",
                  transition: "transform 950ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                  transform: face === "front" ? "rotateY(0deg)" : "rotateY(180deg)",
                  borderRadius: 14,
                  border: "1px solid var(--state-disabled-border)",
                  background: "var(--bg-card)"
                }}
              >
                {/* FRONT */}
                <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 14, overflow: "hidden" }}>
                  {item.image_url ? (
                    <ImageWithExtensionFallback
                      key={`lib-modal-f-${item.id}-${item.image_url}`}
                      src={item.image_url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", background: "var(--bg-card)", transform: `rotate(${rot}deg) scale(${rotScale})`, transition: "transform 160ms ease", transformOrigin: "center center" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", background: "linear-gradient(180deg, var(--bg-card), var(--bg-soft))" }}>
                      {t("library.card.no_image_front")}
                    </div>
                  )}
                </div>
                {/* BACK */}
                <div style={{ position: "absolute", inset: 0, transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 14, overflow: "hidden" }}>
                  {(item.back_image_url ?? DEFAULT_BACK_URL) ? (
                    <ImageWithExtensionFallback
                      key={`lib-modal-b-${item.id}-${item.back_image_url ?? DEFAULT_BACK_URL}`}
                      src={item.back_image_url ?? DEFAULT_BACK_URL}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", background: "var(--bg-card)", transform: `rotate(${rot}deg) scale(${rotScale})`, transition: "transform 160ms ease", transformOrigin: "center center" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", background: "linear-gradient(180deg, var(--bg-card), var(--bg-soft))" }}>
                      {t("library.card.no_image_back")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CONTROLES */}
            <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", zIndex: 10 }}>
              <button type="button" onClick={() => setFace((p) => (p === "front" ? "back" : "front"))} style={{...headerIconBtn, width: "auto", padding: "10px 14px", gap: 8}}>
                {face === "front" ? t('library.card.view_back') : t('library.card.view_front')}
              </button>
              <button type="button" onClick={() => setRot((r) => (r + 270) % 360)} style={headerIconBtn}>⟲</button>
              <button type="button" onClick={() => setRot((r) => (r + 90) % 360)} style={headerIconBtn}>⟳</button>
            </div>

            {/* UPLOAD */}
            <div style={{ marginTop: 12, padding: 14, width: "100%", ...subtleCard }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0, textAlign: "left" }}>
                  <div style={{ fontWeight: 950, color: "var(--color-primary)", lineHeight: 1.15 }}>{t('library.modal.improve_image')}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.35 }}>{t('library.modal.improve_desc')}</div>
                </div>
                
                {/* 👇 BLOQUE DE BOTONES INFALIBLE 👇 */}
                <div style={{ position: "relative" }}>
                  <div style={{ display: "inline-flex", padding: 3, borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--bg-card)", boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 15%, transparent)", gap: 4, opacity: uploading ? 0.6 : 1 }}>
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
                            fontWeight: 950, fontSize: 12, background: active ? "var(--bg-soft)" : "transparent",
                            boxShadow: active ? "0 2px 4px color-mix(in srgb, var(--color-primary) 18%, transparent)" : "none", color: "var(--color-primary)", minWidth: 74, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8
                          }}
                        >
                          {side === "front" ? "Front" : "Back"}
                          
                          {/* El input oculto va POR DENTRO del label. Ningún navegador lo bloquea. */}
                          <input 
                            type="file" 
                            accept="image/*" 
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
                      border: "1px solid var(--color-border)", 
                      background: "var(--bg-card)", 
                      boxShadow: "0 -8px 32px color-mix(in srgb, var(--color-primary) 25%, transparent)", 
                      padding: "12px 16px", 
                      zIndex: 100 
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 950, color: "var(--color-primary)" }}>{t('library.modal.formats_hint')}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.35 }}>{t('library.modal.light_hint')}</div>
                    </div>
                  )}
                </div>
                {/* 👆 FIN DEL BLOQUE DE BOTONES 👆 */}

              </div>
              
              {uploadMsg && (
                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, color: uploadMsg.includes("Gracias") ? "var(--color-primary)" : "var(--state-danger-fg)", background: uploadMsg.includes("Gracias") ? "var(--bg-soft)" : "color-mix(in srgb, var(--state-danger-fg) 8%, transparent)", border: `1px solid ${uploadMsg.includes("Gracias") ? "var(--color-border)" : "color-mix(in srgb, var(--state-danger-fg) 18%, transparent)"}`, padding: "10px 12px", borderRadius: 14 }}>
                  {uploadMsg}
                </div>
              )}
            </div>
              </div>
          {/* DER: INFO, STOCK, NOTAS Y WTT */}
          <div style={{ padding: 16, overflowY: "auto", height: "100%", minHeight: 0, minWidth: 0, width: "100%" }}>
            
            {/* META INFO */}
            <div style={{ padding: 14, ...subtleCard }}>
              <div className="library-item-meta-grid" style={{ display: "grid", gridTemplateColumns: "130px 1fr", rowGap: 10, columnGap: 12 }}>
                <MetaRow icon={<Users size={16} strokeWidth={2.2} />} label={t("binders.picker.group")} value={prettySlug(groupName)} />
                <MetaRow icon={<Disc3 size={16} strokeWidth={2.2} />} label={t("binders.picker.album")} value={prettyAlbumDisplay(albumName)} />
                <MetaRow icon={<Mic2 size={16} strokeWidth={2.2} />} label={t("binders.picker.version")} value={prettySlugTitle(item.version ?? "")} />
                <MetaRow icon={<User size={16} strokeWidth={2.2} />} label={t("binders.picker.member")} value={title || "-"} />
                <MetaRow icon={<Layers size={16} strokeWidth={2.2} />} label={t("binders.picker.type")} value={unitLabel} />
              </div>
            </div>

            {/* STOCK Y PRECIO (alineado con modal de binder) */}
            <div style={{ marginTop: 14, padding: 14, ...subtleCard }}>
              <div style={{ fontWeight: 950, marginBottom: 10, color: "var(--color-primary)" }}>{t("binders.item_info.price_title")}</div>
              <div className="library-stock-row" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 950, marginBottom: 10, color: "var(--color-primary)" }}>{t('library.stock_title')}</div>
                  <div style={{ fontSize: 13, color: "var(--text-main)", lineHeight: 1.7 }}>
                    {t('library.status_have')}: <b>{counts.have}</b> <br />
                    {t("binders.statuses.wtt")}: <b>{counts.wtt}</b> <br />
                    {t("binders.statuses.wts")}: <b>{counts.wts}</b> <br />
                    {t('library.status_otw')}: <b>{counts.on_its_way}</b> <br />
                    {t('library.status_wish')}: <b>{counts.wish}</b>
                  </div>
                </div>
                <div className="library-stock-price-col" style={{ minWidth: 200, maxWidth: 280, flex: "1 1 200px", display: "grid", gap: 10, alignContent: "start" }}>
                  <div style={{ borderRadius: 14, border: "1px solid var(--color-border)", background: "var(--bg-card)", padding: 8 }}>
                    <div style={{ fontWeight: 950, marginBottom: 6, color: "var(--color-primary)", fontSize: 12 }}>{t("binders.item_info.your_price")}</div>
                    <input
                      value={userPrice ? `${userPrice} ${wtsCurrency}` : "—"}
                      disabled
                      placeholder={t('library.modal.price_unset')}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        height: 34,
                        fontSize: 12,
                        borderRadius: 12,
                        border: "1px solid var(--state-disabled-border)",
                        outline: "none",
                        background: "var(--state-disabled-bg)",
                        color: "var(--text-muted)",
                        cursor: "not-allowed",
                        fontWeight: 700,
                      }}
                    />
                  </div>
                  <div style={{ borderRadius: 14, border: "1px solid var(--color-border)", background: "var(--bg-card)", padding: 8 }}>
                    <div style={{ fontWeight: 950, marginBottom: 6, color: "var(--color-primary)", fontSize: 12 }}>{t("binders.item_info.market_price")}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        value={
                          marketFxLoading
                            ? "…"
                            : marketViewCur === "USD"
                              ? formatPcPriceDisplay(marketUsdNum > 0 ? marketUsdNum : null)
                              : formatPcPriceDisplay(marketConverted)
                        }
                        disabled
                        placeholder={t('library.modal.price_unset')}
                        style={{
                          flex: "1 1 88px",
                          minWidth: 0,
                          padding: "8px 10px",
                          height: 34,
                          fontSize: 12,
                          borderRadius: 12,
                          border: "1px solid var(--state-disabled-border)",
                          outline: "none",
                          background: "var(--state-disabled-bg)",
                          color: "var(--text-muted)",
                          cursor: "not-allowed",
                          fontWeight: 700,
                        }}
                      />
                      <select
                        value={marketViewCur}
                        onChange={(e) => {
                          const cur = e.target.value || "EUR";
                          setMarketViewCur(cur);
                          try {
                            localStorage.setItem(`binder:currency:${item.id}`, cur);
                          } catch {
                            /* ignore */
                          }
                        }}
                        style={{
                          height: 34,
                          padding: "4px 8px",
                          borderRadius: 10,
                          border: "1px solid var(--color-primary)",
                          background: "var(--bg-main)",
                          color: "var(--color-primary)",
                          fontSize: 11,
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {!marketCurrencyOptions.some((c) => c.code === marketViewCur) ? (
                          <option value={marketViewCur}>{marketViewCur}</option>
                        ) : null}
                        {marketCurrencyOptions.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.symbol} {c.name} — {c.code}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={marketConsultLoading}
                        onClick={() => void onConsultMarket()}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid var(--color-primary)",
                          background: marketConsultLoading ? "var(--state-disabled-bg)" : "var(--bg-soft)",
                          color: "var(--color-primary)",
                          fontWeight: 900,
                          fontSize: 11,
                          cursor: marketConsultLoading ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {marketConsultLoading ? t("binders.item_info.market_consulting") : t("binders.item_info.consult_market_price")}
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.35 }}>
                      {Number.isFinite(marketUsdNum) && marketUsdNum > 0
                        ? `${t("binders.item_info.market")}: ${formatPcPriceDisplay(marketUsdNum)} USD${
                            marketViewCur !== "USD" && marketConverted != null
                              ? ` → ${formatPcPriceDisplay(marketConverted)} ${marketViewCur}`
                              : ""
                          }`
                        : t("binders.item_info.market_no_reference")}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-primary)", marginTop: 4, fontWeight: 700 }}>
                      {t("binders.item_info.market_stub_note")}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              
              {/* NOTAS */}
              <div style={{ padding: 14, ...subtleCard }}>
                <div style={{ fontWeight: 950, marginBottom: 8, color: "var(--color-primary)" }}>{t('library.modal.notas')}</div>
                <textarea placeholder={t('library.modal.placeholder_notas')} rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--color-border)", outline: "none", resize: "none", lineHeight: "18px", height: 52, color: "var(--text-main)", background: "var(--bg-card)" }} />
              </div>

              {/* BUSCO EN WTT */}
              <div style={{ padding: 14, ...subtleCard }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontWeight: 950, marginBottom: 0, color: "var(--color-primary)" }}>{t('library.modal.busco_wtt')}</div>
                  <button type="button" onClick={onOpenWttOffer} disabled={wttDisabled} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--bg-card)", cursor: wttDisabled ? "not-allowed" : "pointer", fontWeight: 900, fontSize: 12, color: "var(--color-primary)", opacity: wttDisabled ? 0.6 : 1, boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 15%, transparent)" }}>{t('library.modal.mis_trades')}</button>
                </div>
                
                {/* SOLUCIONADO EL ERROR DE LAS DOS FILAS: Un solo carrusel condicional */}
                {uiWttDisplay > 0 && wttOfferItems?.length ? (
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", overflowY: "hidden", flexWrap: "nowrap", width: "100%", maxWidth: "100%", minWidth: 0, paddingBottom: 6, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", alignItems: "center", height: 112, maxHeight: 112, scrollbarGutter: "stable" }}>
                    {wttOfferItems.map((w, idx) => (
                      <ImageWithExtensionFallback key={`${w.id ?? "wtt"}-${idx}`} src={w.image_url ?? "/mock-pcs/groups/not-available.png"} alt="" draggable={false} title={w.name ?? ""} style={{ width: 90, height: 110, borderRadius: 12, border: "1px solid var(--state-disabled-border)", background: "linear-gradient(180deg, var(--bg-card), var(--bg-soft))", objectFit: "cover", flex: "0 0 auto", scrollSnapAlign: "start", boxShadow: "0 8px 18px color-mix(in srgb, var(--text-main) 6%, transparent)" }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{t('library.modal.wtt_empty')}</div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

        {/* ✅ MODAL REPORT */}
        {reportOpen && (
          <div
            onClick={() => {
              setReportOpen(false);
              resetReport();
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--overlay-strong)",
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
                border: "1px solid color-mix(in srgb, var(--bg-card) 25%, transparent)",
                background: "linear-gradient(180deg, var(--bg-card), var(--bg-soft))",
                boxShadow: "0 22px 70px var(--overlay-medium)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: 14, borderBottom: "1px solid var(--state-disabled-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      border: "1px solid var(--state-danger-bg)",
                      background: "linear-gradient(180deg, var(--state-danger-bg), var(--bg-card))",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--state-danger-fg)",
                      boxShadow: "0 10px 22px var(--overlay-faint)",
                    }}
                  >
                    <Siren size={16} strokeWidth={2.4} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 950, color: "var(--text-main)", lineHeight: 1.1 }}>{t('library.report.title')}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {t('library.report.subtitle')}
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
                    border: "1px solid var(--state-disabled-border)",
                    background: "var(--bg-card)",
                    cursor: "pointer",
                    fontWeight: 900,
                    boxShadow: "0 8px 18px color-mix(in srgb, var(--text-main) 8%, transparent)",
                  }}
                  title={t('common.close')}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: 14, display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 900 }}>{t('library.report.reason')}</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid var(--state-disabled-border)",
                      outline: "none",
                      fontWeight: 900,
                      color: "var(--text-main)",
                      background: "var(--bg-card)",
                    }}
                  >
                    <option value="wrong_info">{t('library.report.wrong_info')}</option>
                    <option value="duplicate">{t('library.report.duplicate')}</option>
                    <option value="bad_image">{t('library.report.bad_image')}</option>
                    <option value="spam">{t('library.report.spam')}</option>
                    <option value="other">{t('library.report.other')}</option>
                  </select>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 900 }}>{t('library.report.details')}</label>
                  <textarea
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder={t('library.report.details_placeholder')}
                    rows={4}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid var(--state-disabled-border)",
                      outline: "none",
                      resize: "none",
                      fontWeight: 800,
                      color: "var(--text-main)",
                      background: "var(--bg-card)",
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
                      border: "1px solid var(--state-disabled-border)",
                      background: "var(--bg-card)",
                      cursor: "pointer",
                      fontWeight: 950,
                      boxShadow: "0 10px 22px color-mix(in srgb, var(--text-main) 8%, transparent)",
                    }}
                  >
                    {t('common.cancel')}
                  </button>

                  <button
                    type="button"
                    onClick={sendReport}
                    disabled={reportSent}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid var(--state-danger-bg)",
                      background: reportSent ? "var(--state-disabled-bg)" : "linear-gradient(180deg, var(--state-danger-bg), var(--bg-card))",
                      cursor: reportSent ? "not-allowed" : "pointer",
                      fontWeight: 950,
                      color: "var(--state-danger-fg)",
                      boxShadow: "0 12px 26px var(--overlay-faint)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Siren size={16} strokeWidth={2.4} />
                    {reportSent ? t('common.sending') : t('library.report.send')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

  );
}
  


function LibraryContent() {
  const { t, showAlert, profile } = useGlobal();
            // Declaración correcta de viewingUserId tras userId
          // --- ESTADOS Y REFS FALTANTES ---
          const [openItemId, setOpenItemId] = useState<number | null>(null);
          const [currentPage, setCurrentPage] = useState(1);
          const [pageJumpInput, setPageJumpInput] = useState("1");
          // Desktop grid uses 5 columns; keep page size multiple of 5
          // so intermediate pages don't end with half-empty rows.
          const ITEMS_PER_PAGE = 75;
          const libraryShellRef = useRef<HTMLDivElement | null>(null);
          const isViewingOtherUser = false;
        // --- ESTADOS DE FILTRO Y BÚSQUEDA ---
        const [fStatus, setFStatus] = useState<StatusFilter>("all");
        const [fGroup, setFGroup] = useState<number | "all">("all");
        const [fAlbum, setFAlbum] = useState<number | "all">("all");
        const [fVersion, setFVersion] = useState<string | "all">("all");
        const [fMember, setFMember] = useState<string | "all">("all");
        const [fUnit, setFUnit] = useState<UnitFilter>("all");
        const [q, setQ] = useState("");
        const [isMobileViewport, setIsMobileViewport] = useState(false);
        const [viewportWidth, setViewportWidth] = useState(1280);
        const [showFiltersPanel, setShowFiltersPanel] = useState(false);
      // --- ESTADOS Y FNS FALTANTES PARA SCOPE ---
      // uParam: parámetro de usuario de la URL (simulación)
      const uParam = null;
      const [email, setEmail] = useState<string | null>(null);
      const [userId, setUserId] = useState<string | null>(null);
      const [myBiasIds, setMyBiasIds] = useState<number[]>([]);
      // viewingUserId debe estar disponible en el render
      const viewingUserId = userId;
      const [items, setItems] = useState<ItemRow[]>([]);
      const [groupNameById, setGroupNameById] = useState<Record<number, string>>({});
      const [albumById, setAlbumById] = useState<Record<number, { name: string; release_date: string | null }>>({});
      const [cardFace, setCardFace] = useState<Record<number, "front" | "back">>({});
      const [pageFace, setPageFace] = useState<"front" | "back">("front");
      const [openInfoById, setOpenInfoById] = useState<Record<number, boolean>>({});
    // --- TIPOS Y ESTADOS FALTANTES PARA SCOPE ---
    type UnitFilter = "all" | "single" | "unit" | "ot8";
    const [placedByItem, setPlacedByItem] = useState<Record<number, number>>({});
    const [invByItem, setInvByItem] = useState<Record<number, StatusCounts>>({});
    const [colabData, setColabData] = useState<{ asunto: string; email: string; mensaje: string; adjunto: string }>({ asunto: "", email: "", mensaje: "", adjunto: "" });
    const [sendingColab, setSendingColab] = useState(false);
    const [showColabModal, setShowColabModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("");
  const router = useRouter();
  const pathname = usePathname(); // 👈 AÑADE ESTO
  const topBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    borderRadius: 999, // Botones más redondeados
    border: "1px solid var(--color-border)", // Borde rosa
    background: "var(--bg-card)",
    color: "var(--color-primary)", // Texto morado
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    textDecoration: "none",
    boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 15%, transparent)", // Sombra rosada
    transition: "all 0.2s ease"
  };

  // ...existing code...

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
const [wttOfferFiltersOpen, setWttOfferFiltersOpen] = useState(false);
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
// --- NUEVA FUNCIÓN DEL BUZÓN ---
  const handleSubmitColab = async () => {
    if (!colabData.asunto || !colabData.mensaje || !colabData.email) {
      return showAlert(t('common.error'), t('library.colab_modal.error_fields'));
    }
    
    try {
      setSendingColab(true);
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('buzon_colaboraciones').insert({
        user_id: user?.id,
        asunto: colabData.asunto,
        email: colabData.email,
        mensaje: colabData.mensaje,
        adjuntos: colabData.adjunto,
        status: 'pendiente'
      });

      if (error) throw error;

      showAlert(t('library.colab_modal.success_title'), t('library.colab_modal.success_msg'));
      setShowColabModal(false);
      setColabData({ asunto: "", email: "", mensaje: "", adjunto: "" });
    } catch (e: any) {
      showAlert(t('library.colab_modal.error_title'), t('library.colab_modal.error_msg') + e.message);
    } finally {
      setSendingColab(false);
    }
  };
const loadAll = useCallback(async () => {
  setLoading(true);
  setError(null);
  setStatus("Leyendo sesión...");

  // 1. Intentamos obtener el usuario de la sesión
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  // Definimos quién es el dueño de la información que vamos a mostrar
  // Prioridad: 1. El parámetro de URL (uParam) | 2. El usuario logueado (user.id) | 3. Nadie (null)
  const targetUid = uParam ?? user?.id ?? null;

  // 2. Si hay un usuario logueado, cargamos sus datos específicos
  if (user) {
    setEmail(user.email ?? null);
    setUserId(user.id);
    
    setStatus("Cargando tus favoritos...");
    const { data: biasData } = await supabase
      .from("user_biases")
      .select("member_id")
      .eq("user_id", user.id);

    if (biasData) {
      setMyBiasIds(biasData.map(b => Number(b.member_id)));
    }
  } else {
    // Si no hay usuario logueado, limpiamos estados de sesión
    setEmail(null);
    setUserId(null);
    setMyBiasIds([]);
    if (!uParam) {
      setStatus("Modo catálogo: inicia sesión para gestionar tu stock");
    }
  }

  // 3. Carga de Items (Público para todos)
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

  const itemsData: ItemRow[] = all.map((r: ItemRow) => {
    const front =
      typeof r.image_url === "string" && r.image_url.trim()
        ? resolveMockPcImageUrl(r.image_url.trim())
        : null;
    const back =
      typeof r.back_image_url === "string" && r.back_image_url.trim()
        ? resolveMockPcImageUrl(r.back_image_url.trim())
        : null;
    return {
    id: Number(r.id),
    name: r.name ?? null,
    image_url: front || null,
    back_image_url: back || null,
    group_id: Number.isFinite(Number(r.group_id)) ? Number(r.group_id) : null,
    album_id: Number.isFinite(Number(r.album_id)) ? Number(r.album_id) : null,
    version: r.version ?? null,
    member: r.member ?? null,
  };
  });

  setItems(itemsData);

  // 4. Carga de Inventario/Stock (Solo si hay un targetUid)
  if (targetUid) {
    setStatus("Cargando stock...");
    const invRes = await supabase
      .from("user_item_statuses")
      .select("id, user_id, item_id, status, qty")
      .eq("user_id", targetUid);

    if (!invRes.error && invRes.data) {
      rebuildInvMap(invRes.data as UserItemStatusRow[]);
    }
    
    // Carga de qué cartas están ya en el binder
    await loadPlacedAcrossBinder(targetUid);
  }

  // 5. Carga de nombres de Grupos y Álbumes (Público)
  const groupIds = Array.from(new Set(itemsData.map(x => Number(x.group_id)).filter(n => Number.isFinite(n))));
  const albumIds = Array.from(new Set(itemsData.map(x => Number(x.album_id)).filter(n => Number.isFinite(n))));

  if (groupIds.length > 0) {
    const gRes = await supabase.from("groups").select("id, name").in("id", groupIds);
    if (!gRes.error && gRes.data) {
      const map: Record<number, string> = {};
      gRes.data.forEach((g: any) => { map[g.id] = (g.name ?? `Grupo ${g.id}`).trim(); });
      setGroupNameById(map);
    }
  }

  if (albumIds.length > 0) {
    const aRes = await supabase.from("albums").select("id, name, release_date").in("id", albumIds);
    if (!aRes.error && aRes.data) {
      const map: Record<number, { name: string; release_date: string | null }> = {};
      aRes.data.forEach((a: any) => {
        map[a.id] = { name: (a.name ?? `Álbum ${a.id}`).trim(), release_date: a.release_date ?? null };
      });
      setAlbumById(map);
    }
  }

  // Inicializar caras de cartas
  setCardFace((prev) => {
    const next = { ...prev };
    itemsData.forEach(it => { if (!next[it.id]) next[it.id] = "front"; });
    return next;
  });
  
  setPageFace("front");
  setStatus(user ? "Inventario listo ✅" : "Catálogo listo ✅");
  setLoading(false);
}, [loadPlacedAcrossBinder, rebuildInvMap, uParam]);
useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  loadAll().catch((e: any) => {
    setError(e?.message ?? "Error cargando la library");
    setLoading(false);
  });
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

  const sorted = sortCollectionEntries(
    ids.map((id) => ({
      id,
      name: albumById[id]?.name ?? "",
      releaseDate: albumById[id]?.release_date ?? null,
    })),
    {
      groupName:
        fGroup === "all" ? null : groupNameById[fGroup] ?? null,
    },
  );
  return sorted.map((x) => x.id);
}, [universeForAlbum, albumById, fGroup, groupNameById]);
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
  if (typeof window === "undefined") return;
  const syncViewport = () => {
    setViewportWidth(window.innerWidth);
    const mobile = window.innerWidth <= 1024;
    setIsMobileViewport(mobile);
    if (!mobile) setShowFiltersPanel(false);
  };
  syncViewport();
  window.addEventListener("resize", syncViewport);
  return () => window.removeEventListener("resize", syncViewport);
}, []);

const persistWttQty = useCallback(
    async (itemId: number, value: number) => {
      if (!userId) return;
      if (isViewingOtherUser) return;
      if (!Number.isFinite(itemId)) return;
      const qty = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
      
      const offerIds = wttOfferByItem[itemId] ?? readWttOffer(itemId).ids ?? []; // 👈 ¡Rescatamos los IDs!

     // 👇 RECUPERAMOS LOS DATOS DEL PASO 1 👇
          const wttComment = localStorage.getItem(`binder:wttMessage:${itemId}`) || "";
          const countryVal = localStorage.getItem(`binder:market:${itemId}`) || "España";

          if (qty > 0) {
            const up = await supabase
              .from("user_item_statuses")
              .upsert(
                [{ 
                  user_id: userId, 
                  item_id: itemId, 
                  status: "wtt", 
                  qty, 
                  wtt_ids: offerIds, 
                  market_comment: wttComment, 
                  origin_country: countryVal 
                }] as any, 
                { onConflict: "user_id,item_id,status" }
              );
            if (up.error) return;
            await avisarFavoritos(userId, 'market_id', itemId);
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
    [userId, isViewingOtherUser, wttOfferByItem, readWttOffer, supabase, emptyCounts]
  );
const [wtsListingModalOpen, setWtsListingModalOpen] = useState(false);
const [wtsListingItemId, setWtsListingItemId] = useState<number | null>(null);
// 2. AÑADE ESTOS DOS ESTADOS NUEVOS PARA EL MODAL WTT
  const [wttListingModalOpen, setWttListingModalOpen] = useState(false);
  const [wttListingItemId, setWttListingItemId] = useState<number | null>(null);
const openWttOfferModal = useCallback(
  (itemId: number) => {
    if (isViewingOtherUser) return;
    setWttOfferForId(itemId);
    const stored = readWttOffer(itemId);
    const storedIds = wttOfferByItem[itemId] ?? stored.ids;
    const storedQty = wttOfferQtyByItem[itemId] ?? stored.qty;
    setWttOfferDraft((storedIds ?? []).slice(0, 10));
    setWttOfferQtyDraft(Number.isFinite(storedQty) ? Math.max(0, Math.floor(storedQty)) : 0);
    setWttOfferQ("");
    setWttOfferGroup("");
    setWttOfferAlbum("");
    setWttOfferVersion("");
    setWttOfferMember("");
    setWttOfferUnit("all");
    setWttOfferFiltersOpen(false);
    setWttOfferOpen(true);
  },
  [isViewingOtherUser, readWttOffer, wttOfferByItem, wttOfferQtyByItem]
);

const wttVersionOptions = useMemo(() => {
  return Array.from(
    new Set(
      items
        .filter((candidate) => {
          if (candidate.id === wttOfferForId) return false;
          const counts = invByItem[candidate.id] ?? emptyCounts();
          if (totalOwnedQtyFromCounts(counts) > 0) return false;
          if (wttOfferGroup !== "" && candidate.group_id !== wttOfferGroup) return false;
          if (wttOfferAlbum !== "" && candidate.album_id !== wttOfferAlbum) return false;
          if (wttOfferMember.trim() && !memberMatches(candidate.member, wttOfferMember)) return false;
          if (wttOfferUnit !== "all" && unitTypeFromMember(candidate.member) !== wttOfferUnit) return false;
          return true;
        })
        .map((candidate) => (candidate.version ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}, [items, wttOfferForId, invByItem, wttOfferGroup, wttOfferAlbum, wttOfferMember, wttOfferUnit]);

const compactGridColumns = useMemo(() => {
  if (viewportWidth <= 360) return 2;
  if (viewportWidth <= 480) return 3;
  if (viewportWidth <= 1024) return 4;
  return 0;
}, [viewportWidth]);



const saveWttOfferDraft = useCallback(async () => {
      if (wttOfferForId == null) return;
      const cappedDraft = wttOfferDraft.slice(0, 10);
      // Forzamos mínimo 1 si hay cartas elegidas
      const qty = cappedDraft.length > 0 ? Math.max(1, wttOfferQtyDraft) : 0;
      const nextIds = qty > 0 ? cappedDraft : [];

      // 1. Guardar localmente
      setWttOfferByItem((prev) => ({ ...prev, [wttOfferForId]: nextIds }));
      setWttOfferQtyByItem((prev) => ({ ...prev, [wttOfferForId]: qty }));
      writeWttOffer(wttOfferForId, qty, nextIds);

      // 2. PUBLICAR EN SUPABASE DIRECTAMENTE (El Guardar y Publicar real)
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user && qty > 0) {
        const wttComment = localStorage.getItem(`binder:wttMessage:${wttOfferForId}`) || "";
        const countryVal = localStorage.getItem(`binder:market:${wttOfferForId}`) || "España";

        await supabase.from("user_item_statuses").upsert({
          user_id: auth.user.id,
          item_id: wttOfferForId,
          status: "wtt",
          qty: qty,
          wtt_ids: nextIds,
          market_comment: wttComment,
          origin_country: countryVal,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id,item_id,status" });
        
        await avisarFavoritos(auth.user.id, 'market_id', wttOfferForId);
      }

      // 3. Cerrar el picker correctamente en la Library
      setWttOfferOpen(false);
    }, [wttOfferForId, wttOfferDraft, wttOfferQtyDraft, writeWttOffer]);
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

    // 1. Limpieza de datos: aseguramos que todo sea número y >= 0
    const cleaned: Record<PersistStatus, number> = {
      have: Math.max(0, Math.floor(next.have ?? 0)),
      wtt: Math.max(0, Math.floor(next.wtt ?? 0)),
      wts: Math.max(0, Math.floor(next.wts ?? 0)),
      on_its_way: Math.max(0, Math.floor(next.on_its_way ?? 0)),
      wishlist: Math.max(0, Math.floor(next.wishlist ?? 0)),
    }; 

    // 2. Lógica para detectar si se acaba de añadir a WTS (Venta)
    const prevCounts = invByItem[itemId] ?? emptyCounts(); 
    const prevWts = Number(prevCounts?.wts ?? 0); 
    const nextWts = Number(cleaned.wts ?? 0); 
    const becameWts = prevWts === 0 && nextWts > 0; 
    const prevWtt = Number(prevCounts?.wtt ?? 0);
    const nextWtt = Number(cleaned.wtt ?? 0);
    const becameWtt = prevWtt === 0 && nextWtt > 0;

    // 3. Preparar filas para UPSERT (las que tienen cantidad > 0)
   const upRows = (Object.keys(cleaned) as PersistStatus[])
        .filter((k) => cleaned[k] > 0)
        .map((k) => {
          // 👈 AÑADIDO: Si es WTT, metemos los ids. Si no, vacío.
         // 👇 MAGIA 2: Leemos los IDs directamente del disco duro
// Blindaje anti-borrados
          const extraData = k === "wtt" ? { 
            wtt_ids: readWttOffer(itemId).ids ?? [],
            market_comment: localStorage.getItem(`binder:wttMessage:${itemId}`) || "",
            origin_country: localStorage.getItem(`binder:market:${itemId}`) || "España"
          } : {};
                    return {
            user_id: userId,
            item_id: itemId,
            status: k,
            qty: cleaned[k],
            ...extraData // 👈 Se envía a Supabase
          };
        });

    if (upRows.length > 0) {
      const { error: upErr } = await supabase
        .from("user_item_statuses")
        .upsert(upRows, { onConflict: "user_id,item_id,status" }); 
      
      if (upErr) {
        setError(upErr.message); 
        return;
      }
    }

    // 4. DELETE: Borrar los estados que el usuario ha puesto a 0
    const zeroStatuses = (Object.keys(cleaned) as PersistStatus[])
      .filter((k) => cleaned[k] === 0); 

    if (zeroStatuses.length > 0) {
      const { error: delErr } = await supabase
        .from("user_item_statuses")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .in("status", zeroStatuses); 
      
      if (delErr) {
        setError(delErr.message); 
        return;
      }
    }

    // 5. Actualizar estado local sincronizado
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

    // 6. Lógica extra: WTS Modal y WTT Sync
    if (becameWts) { 
      setWtsListingItemId(itemId); 
      setWtsListingModalOpen(true); 
    }

    const existingIds = wttOfferByItem[itemId] ?? readWttOffer(itemId).ids; 
    if (cleaned.wtt > 0) {
      setWttOfferByItem((prev) => ({ ...prev, [itemId]: existingIds })); 
      setWttOfferQtyByItem((prev) => ({ ...prev, [itemId]: cleaned.wtt })); 
      writeWttOffer(itemId, cleaned.wtt, existingIds); 
      // Abrir modal WTT solo la primera vez que pasa de 0 a >0
      if (becameWtt) {
        setWttListingItemId(itemId);
        setWttListingModalOpen(true);
      }
    } else {
      setWttOfferByItem((prev) => ({ ...prev, [itemId]: [] })); 
      setWttOfferQtyByItem((prev) => ({ ...prev, [itemId]: 0 })); 
      writeWttOffer(itemId, 0, []); 
    }
  },
  [userId, invByItem, readWttOffer, wttOfferByItem, writeWttOffer, setWtsListingItemId, setWtsListingModalOpen]
); 
// 👇 AÑADE ESTO (PASO 3) 👇
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  useEffect(() => {
    setPageJumpInput(String(currentPage));
  }, [currentPage]);
  const goToTypedPage = useCallback(() => {
    const n = Number(pageJumpInput);
    if (!Number.isFinite(n) || String(pageJumpInput).trim() === "") {
      setPageJumpInput(String(currentPage));
      return;
    }
    const next = Math.max(1, Math.min(totalPages, Math.trunc(n)));
    setCurrentPage(next);
    setPageJumpInput(String(next));
  }, [pageJumpInput, totalPages, currentPage]);
  const paginationPageField = (
    fontSize: number,
    inputWidth: number,
    inputPadding: string,
    borderRadius: number
  ) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontWeight: 900,
        color: "var(--color-primary)",
        fontSize,
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      <span>{t("pagination.page_before")}</span>
      <input
        type="number"
        aria-label={t("pagination.page_input_aria")}
        min={1}
        max={totalPages}
        value={pageJumpInput}
        onChange={(e) => setPageJumpInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") goToTypedPage();
        }}
        onBlur={goToTypedPage}
        style={{
          width: inputWidth,
          padding: inputPadding,
          borderRadius,
          border: "1px solid var(--color-border)",
          background: "var(--bg-card)",
          color: "var(--color-primary)",
          fontWeight: 900,
          textAlign: "center",
          outline: "none",
        }}
      />
      <span>{t("pagination.page_after").replace("{total}", String(totalPages))}</span>
    </span>
  );
  const allLabel = useMemo(() => {
    const raw = String(t("common.all") || "Todos").trim();
    if (!raw) return "Todos";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [t]);
  // 👆 HASTA AQUÍ 👆
 
  const handleWtsListingSaved = async () => {
    if (!userId || !wtsListingItemId) return;
   
    // 1. Recuperamos los datos que el usuario escribió en el modal (guardados en localStorage)
    const priceValue = localStorage.getItem(`binder:price:${wtsListingItemId}`);
    const currencyValue = localStorage.getItem(`binder:wtsCurrency:${wtsListingItemId}`) || "EUR";
    const countryValue = localStorage.getItem(`binder:market:${wtsListingItemId}`) || "España";

    // 2. Actualizamos la fila en Supabase con los nuevos campos públicos
    const { error } = await supabase
      .from("user_item_statuses")
      .upsert([{ 
        user_id: userId, 
        item_id: wtsListingItemId, 
        status: "wts", 
        qty: 1,
        price: priceValue ? parseFloat(priceValue.replace(',', '.')) : null,
        currency: currencyValue,
        origin_country: countryValue
      }] as any, { onConflict: "user_id,item_id,status" });

    if (!error) {
      setWtsListingModalOpen(false);
      setStatus(t("library.status_marketplace_published"));
      await avisarFavoritos(userId, 'market_id', wtsListingItemId);
      loadAll(); // Recarga la lista para ver los cambios
    } else {
      console.error("Error al publicar anuncio:", error.message);
    }
  };
  return (
    <div
      className={tanTangkiwood.variable}
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-main)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AdRailLayout section="library">
      {/* CUERPO DE LA LIBRERIA (Con márgenes laterales preparados para publicidad) */}
      <div ref={libraryShellRef} className="library-shell" style={{ padding: "24px 40px", display: "flex", justifyContent: "center", flex: 1, width: "100%" }}>
        <WtsListingModal
          open={wtsListingModalOpen}
          itemId={wtsListingItemId}
          onClose={() => setWtsListingModalOpen(false)}
          onSaved={handleWtsListingSaved}
        />
        <WttListingModal
          open={wttListingModalOpen}
          itemId={wttListingItemId}
          initialPublicMessage={
            wttListingItemId != null && typeof window !== "undefined"
              ? localStorage.getItem(`binder:wttMessage:${wttListingItemId}`) || ""
              : ""
          }
          onSavePublicMessage={(itemId: number, value: string) => {
            if (typeof window !== "undefined") {
              localStorage.setItem(`binder:wttMessage:${itemId}`, value);
            }
          }}
          onClose={() => {
            setWttListingModalOpen(false);
          }}
          onSaved={() => {
            setWttListingModalOpen(false);
            if (wttListingItemId) {
              openWttOfferModal(wttListingItemId);
            }
          }}
        />
        {/* CONTENEDOR CENTRAL: Limitado a 1120px para dejar hueco a los lados */}
        <div className="library-main-column" style={{ width: "100%", maxWidth: 1120, display: "flex", flexDirection: "column", gap: 20 }}>
          {error && <div style={{ color: "crimson", textAlign: "center", fontWeight: 900 }}>{t("common.error")}: {error}</div>}
          {loading && <div style={{ marginTop: 10, color: "var(--text-muted)" }}>{t("common.loading")}...</div>}

          <div className="library-filters-grid"
            style={{
              display: showFiltersPanel ? "grid" : "none",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
              background: "var(--bg-soft)",
              padding: 16,
              borderRadius: 16,
              border: "1px solid var(--color-border)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={filterLabelStyle}><Layers size={13} /> {t("binders.picker.status") || "Estado"}</label>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value as StatusFilter)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--text-main)", outline: "none", width: "100%" }}>
                <option value="all">{allLabel}</option>
                <option value="have">{t("binders.statuses.have")}</option>
                <option value="wts">{t("binders.statuses.wts")}</option>
                <option value="wtt">{t("binders.statuses.wtt")}</option>
                <option value="on_its_way">{t("binders.statuses.otw")}</option>
                <option value="wish">{t("binders.statuses.wishlist")}</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={filterLabelStyle}><Users size={13} /> {t("binders.picker.group") || "Grupo"}</label>
              <select value={fGroup === "all" ? "all" : String(fGroup)} onChange={(e) => setFGroup(e.target.value === "all" ? "all" : Number(e.target.value))} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--text-main)", outline: "none", width: "100%" }}>
                <option value="all">{allLabel}</option>
                {groupOptions.map((gid) => (
                  <option key={gid} value={String(gid)}>{groupNameById[gid] ?? `Grupo ${gid}`}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={filterLabelStyle}><Disc3 size={13} /> {t("binders.picker.collection") || "Colección / Era"}</label>
              <select value={fAlbum === "all" ? "all" : String(fAlbum)} onChange={(e) => setFAlbum(e.target.value === "all" ? "all" : Number(e.target.value))} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--text-main)", outline: "none", width: "100%" }}>
                <option value="all">{allLabel}</option>
                {albumOptions.map((aid) => (
                  <option key={aid} value={String(aid)}>{formatCollectionOptionLabel(prettyAlbumDisplay(albumById[aid]?.name ?? `Álbum ${aid}`), albumById[aid]?.release_date ?? null)}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={filterLabelStyle}><Layers size={13} /> {t("binders.picker.version") || "Versión"}</label>
              <select value={fVersion} onChange={(e) => setFVersion(e.target.value as string | "all")} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--text-main)", outline: "none", width: "100%" }}>
                <option value="all">{allLabel}</option>
                {versionOptions.map((v) => (
                  <option key={v} value={v}>{prettyVersionLabel(v)}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={filterLabelStyle}><User size={13} /> {t("binders.picker.member") || "Miembro"}</label>
              <select value={fMember === "all" ? "all" : String(fMember)} onChange={(e) => setFMember(e.target.value === "all" ? "all" : e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--text-main)", outline: "none", width: "100%" }}>
                <option value="all">{allLabel}</option>
                {memberOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={filterLabelStyle}><Layers size={13} /> {t("binders.picker.type") || "Tipo"}</label>
              <select value={fUnit} onChange={(e) => setFUnit(e.target.value as UnitFilter)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--text-main)", outline: "none", width: "100%" }}>
                <option value="all">{allLabel}</option>
                <option value="single">{t("binders.picker.type_selfie") || "Selfie"}</option>
                <option value="unit">{t("binders.picker.type_unit") || "Unit"}</option>
                <option value="ot8">OT8</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={filterLabelStyle}><Search size={13} /> {t("common.search") || "Buscar"}</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("binders.picker.search_placeholder") || "Buscar por nombre o id..."}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--text-main)", outline: "none", width: "100%" }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setShowFiltersPanel((v) => !v)}
              className="library-mobile-filters-toggle"
              title={showFiltersPanel ? (t("common.close") || "Cerrar") : (t("common.filters") || "Filtros")}
              style={{
                width: 42,
                height: 42,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--color-border)",
                background: "var(--bg-card)",
                color: "var(--library-filter-label)",
                borderRadius: 999,
                cursor: "pointer",
                boxShadow: "0 8px 18px var(--shadow-card)",
              }}
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setColabData((d) => ({
                  ...d,
                  email: email ?? d.email,
                }));
                setShowColabModal(true);
              }}
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

          {totalPages > 1 && (
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 20,
              marginTop: 10,
              marginBottom: 14,
            }}>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: currentPage === 1 ? "1px solid var(--state-disabled-border)" : "1px solid var(--color-border)",
                  background: currentPage === 1 ? "var(--state-disabled-bg)" : "white",
                  color: currentPage === 1 ? "var(--color-border)" : "var(--color-primary)",
                  fontWeight: 900,
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                }}
              >
                {t("pagination.prev")}
              </button>

              {paginationPageField(14, 64, "8px 10px", 10)}

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: currentPage === totalPages ? "1px solid var(--state-disabled-border)" : "1px solid var(--color-border)",
                  background: currentPage === totalPages ? "var(--state-disabled-bg)" : "white",
                  color: currentPage === totalPages ? "var(--color-border)" : "var(--color-primary)",
                  fontWeight: 900,
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                }}
              >
                {t("pagination.next")}
              </button>
            </div>
          )}

          <div
            key={`lib-grid-${fGroup}-${fAlbum}-${fVersion}-${fMember}-${fUnit}-${currentPage}`}
            className="library-cards-grid"
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: isMobileViewport ? "repeat(auto-fill, minmax(110px, 1fr))" : "repeat(5, minmax(0, 1fr))",
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
                <div key={it.id} style={{ position: "relative" }}>
                  {isFavorite && (
                    <div
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        zIndex: 100,
                        background: "var(--color-border)",
                        borderRadius: "50%",
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 10px color-mix(in srgb, var(--color-primary) 50%, transparent)",
                        border: "2px solid var(--bg-card)",
                      }}
                    >
                      <Heart size={16} fill="var(--bg-card)" color="var(--bg-card)" />
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
                    onToggleInfo={() => setOpenInfoById((prev) => ({ ...prev, [it.id]: !prev[it.id] }))}
                    onToggleFace={() => {
                      setCardFace((prev) => {
                        const cur = prev[it.id] ?? "front";
                        return { ...prev, [it.id]: cur === "front" ? "back" : "front" };
                      });
                    }}
                    onCommitStock={(next) => commitStockForItem(it.id, next)}
                    onOpen={() => setOpenItemId(it.id)}
                    t={t}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
                  border: currentPage === 1 ? "1px solid var(--state-disabled-border)" : "1px solid var(--color-border)",
                  background: currentPage === 1 ? "var(--state-disabled-bg)" : "white",
                  color: currentPage === 1 ? "var(--color-border)" : "var(--color-primary)",
                  fontWeight: 900,
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  boxShadow: currentPage === 1 ? "none" : "0 4px 12px color-mix(in srgb, var(--color-primary) 15%, transparent)",
                  transition: "all 0.2s ease"
                }}
              >
                {t("pagination.prev")}
              </button>

              {paginationPageField(15, 68, "10px 12px", 12)}

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  border: currentPage === totalPages ? "1px solid var(--state-disabled-border)" : "1px solid var(--color-border)",
                  background: currentPage === totalPages ? "var(--state-disabled-bg)" : "white",
                  color: currentPage === totalPages ? "var(--color-border)" : "var(--color-primary)",
                  fontWeight: 900,
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                  boxShadow: currentPage === totalPages ? "none" : "0 4px 12px color-mix(in srgb, var(--color-primary) 15%, transparent)",
                  transition: "all 0.2s ease"
                }}
              >
                {t("pagination.next")}
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
const currentPageIds = paginatedItems.map((x) => x.id);
const pageIdx = currentPageIds.indexOf(openItemId);
const alignRightOnCompact = isMobileViewport && compactGridColumns > 0 && pageIdx >= 0 && (pageIdx + 1) % compactGridColumns === 0;
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
    alignRightOnCompact={alignRightOnCompact}
    onPrev={() => {
      if (!canPrev) return;
      setOpenItemId(orderedIds[idx - 1]);
    }}
    onNext={() => {
      if (!canNext) return;
      setOpenItemId(orderedIds[idx + 1]);
    }}
    t={t}
    onAlert={showAlert}
    uiLang={profile?.language ?? "es"}
  />
);

        })()}

      {wttOfferOpen && wttOfferForId !== null && !isViewingOtherUser && (
        <div
          className="library-wtt-offer-overlay"
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay-medium)", // Oscurecido sutilmente
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
            className="library-wtt-offer-shell"
            style={{
              width: "min(980px, 96vw)",
              height: "min(700px, 92vh)",
              background: "var(--bg-main)", // Fondo vainilla aesthetic
              borderRadius: 18,
              border: "1px solid var(--color-border)", // Borde rosa
              boxShadow: "0 22px 60px color-mix(in srgb, var(--text-main) 22%, transparent)",
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
                borderBottom: "1px solid var(--color-border)",
                background: "var(--bg-soft)", // Fondo rosa
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <img src="/branding/logo.png" alt="" style={{ height: 28, width: "auto", objectFit: "contain", flex: "0 0 auto" }} />
                <div style={{ fontWeight: 900, color: "var(--accent-vibe-purple)", fontSize: 14 }}>
                  {t("library.wtt.picker_title") || "Selecciona PCs para tu oferta WTT"}
                </div>
              </div>
              {isMobileViewport && (
                <button
                  type="button"
                  onClick={() => setWttOfferFiltersOpen((v) => !v)}
                  className="library-wtt-filters-toggle"
                  style={{ border: "1px solid color-mix(in srgb, var(--accent-vibe-pink) 55%, var(--color-border))", background: "var(--bg-card)", color: "var(--accent-vibe-pink)", borderRadius: 999, padding: "8px 12px", fontWeight: 900, cursor: "pointer" }}
                >
                  {wttOfferFiltersOpen ? (t("common.close") || "Cerrar") : (t("common.filters") || "Filtros")}
                </button>
              )}
            </div>

            {/* CONTROLES */}
            <div className="library-wtt-offer-controls" style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", background: "var(--bg-card)", display: !isMobileViewport || wttOfferFiltersOpen ? "grid" : "none", gridTemplateColumns: "2fr repeat(5, minmax(90px, 1fr))", gap: 8 }}>
              <input
                ref={wttOfferQRef}
                value={wttOfferQ}
                onChange={(e) => setWttOfferQ(e.target.value)}
                placeholder={t("library.wtt.search_placeholder") || t("common.search") || "Buscar"}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid color-mix(in srgb, var(--color-secondary) 40%, var(--color-border))", background: "var(--bg-main)", color: "var(--text-main)", outline: "none" }}
              />
              <select value={wttOfferGroup === "" ? "" : String(wttOfferGroup)} onChange={(e) => setWttOfferGroup(e.target.value === "" ? "" : Number(e.target.value))} style={{ padding: "10px", borderRadius: 10, border: "1px solid color-mix(in srgb, var(--accent-vibe-pink) 35%, var(--color-border))", background: "var(--bg-main)", color: "var(--accent-vibe-pink)", fontWeight: 800, outline: "none" }}>
                <option value="">{t("binders.picker.group") || "Grupo"}</option>
                {groupOptions.map((gid) => <option key={gid} value={String(gid)}>{groupNameById[gid] ?? `Grupo ${gid}`}</option>)}
              </select>
              <select value={wttOfferAlbum === "" ? "" : String(wttOfferAlbum)} onChange={(e) => setWttOfferAlbum(e.target.value === "" ? "" : Number(e.target.value))} style={{ padding: "10px", borderRadius: 10, border: "1px solid color-mix(in srgb, var(--accent-vibe-purple) 35%, var(--color-border))", background: "var(--bg-main)", color: "var(--accent-vibe-purple)", fontWeight: 800, outline: "none" }}>
                <option value="">{t("binders.picker.collection") || "Colección / Era"}</option>
                {albumOptions.map((aid) => <option key={aid} value={String(aid)}>{formatCollectionOptionLabel(prettyAlbumDisplay(albumById[aid]?.name ?? `Álbum ${aid}`), albumById[aid]?.release_date ?? null)}</option>)}
              </select>
              <select value={wttOfferVersion} onChange={(e) => setWttOfferVersion(e.target.value)} style={{ padding: "10px", borderRadius: 10, border: "1px solid color-mix(in srgb, var(--color-accent-orange) 40%, var(--color-border))", background: "var(--bg-main)", color: "var(--color-accent-orange)", fontWeight: 800, outline: "none" }}>
                <option value="">{t("binders.picker.version") || "Versión"}</option>
                {wttVersionOptions.map((v) => <option key={v} value={v}>{prettyVersionLabel(v)}</option>)}
              </select>
              <select value={wttOfferMember} onChange={(e) => setWttOfferMember(e.target.value)} style={{ padding: "10px", borderRadius: 10, border: "1px solid color-mix(in srgb, var(--accent-vibe-green) 40%, var(--color-border))", background: "var(--bg-main)", color: "var(--accent-vibe-green)", fontWeight: 800, outline: "none" }}>
                <option value="">{t("binders.picker.member") || "Miembro"}</option>
                {memberOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select value={wttOfferUnit} onChange={(e) => setWttOfferUnit(e.target.value as UnitFilter)} style={{ padding: "10px", borderRadius: 10, border: "1px solid color-mix(in srgb, var(--color-secondary) 40%, var(--color-border))", background: "var(--bg-main)", color: "var(--color-secondary)", fontWeight: 800, outline: "none" }}>
                <option value="all">{t("binders.picker.type") || "Tipo"}</option>
                <option value="single">{t("binders.picker.type_selfie") || "Selfie"}</option>
                <option value="unit">{t("binders.picker.type_unit") || "Unit"}</option>
                <option value="ot8">OT8</option>
              </select>
            </div>

            {/* LISTA DE PCS DISPONIBLES */}
            <div style={{ overflowY: "auto", padding: "14px 16px", background: "var(--bg-main)" }}>
              {(() => {
                const normalizedQ = normText(wttOfferQ);
                const candidates = items.filter((candidate) => {
                  if (candidate.id === wttOfferForId) return false;
                  const counts = invByItem[candidate.id] ?? emptyCounts();
                  if (totalOwnedQtyFromCounts(counts) > 0) return false;
                  if (wttOfferGroup !== "" && candidate.group_id !== wttOfferGroup) return false;
                  if (wttOfferAlbum !== "" && candidate.album_id !== wttOfferAlbum) return false;
                  if (wttOfferVersion.trim() && normText(candidate.version ?? "") !== normText(wttOfferVersion)) return false;
                  if (wttOfferMember.trim() && !memberMatches(candidate.member, wttOfferMember)) return false;
                  if (wttOfferUnit !== "all" && unitTypeFromMember(candidate.member) !== wttOfferUnit) return false;
                  if (normalizedQ && ![candidate.name, candidate.member, candidate.version, String(candidate.id)].some((v) => normText(v ?? "").includes(normalizedQ))) return false;
                  return true;
                });

                if (candidates.length === 0) {
                  return (
                    <div style={{ padding: "18px", borderRadius: 12, border: "1px dashed color-mix(in srgb, var(--accent-vibe-pink) 55%, var(--color-border))", color: "var(--accent-vibe-pink)", textAlign: "center", fontWeight: 800 }}>
                      {t("library.wtt.no_available_cards") || "No hay PCs disponibles con esos filtros."}
                    </div>
                  );
                }

                return (
                  <div className="library-wtt-offer-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
                    {candidates.map((candidate) => {
                      const selected = wttOfferDraft.includes(candidate.id);
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() =>
                            setWttOfferDraft((prev) => {
                              if (prev.includes(candidate.id)) {
                                return prev.filter((id) => id !== candidate.id);
                              }
                              if (prev.length >= 10) {
                                showAlert(
                                  t("common.error"),
                                  t("library.wtt.max_selection") || "Puedes seleccionar como máximo 10 PCs."
                                );
                                return prev;
                              }
                              return [...prev, candidate.id];
                            })
                          }
                          style={{
                            borderRadius: 12,
                            border: selected ? "2px solid var(--color-secondary)" : "1px solid var(--color-border)",
                            background: selected ? "color-mix(in srgb, var(--color-secondary) 14%, var(--bg-card))" : "var(--bg-card)",
                            padding: 6,
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            boxShadow: selected ? "0 4px 14px color-mix(in srgb, var(--color-secondary) 22%, transparent)" : "none",
                          }}
                          title={candidate.name ?? ""}
                        >
                          <ImageWithExtensionFallback
                            src={candidate.image_url ?? "/mock-pcs/groups/not-available.png"}
                            alt={candidate.name ?? ""}
                            style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 8, border: "1px solid var(--state-disabled-border)" }}
                          />
                          <span style={{ fontSize: 11, fontWeight: 800, color: selected ? "var(--accent-vibe-purple)" : "var(--text-main)", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {prettyMemberLabel(candidate.member) !== "—" ? prettyMemberLabel(candidate.member) : (candidate.name ? prettySlugTitle(candidate.name) : `#${candidate.id}`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* FOOTER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: "1px solid var(--color-border)", background: "var(--bg-card)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 12, color: "var(--accent-vibe-pink)", fontWeight: 900 }}>
                  {(t("library.wtt.selected") || "Seleccionadas")}: <b>{wttOfferDraft.length}</b>/10
                </div>
                <input
                  type="number"
                  min={wttOfferDraft.length > 0 ? 1 : 0}
                  value={wttOfferQtyDraft}
                  onChange={(e) => setWttOfferQtyDraft(Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: 88, padding: "7px 8px", borderRadius: 8, border: "1px solid color-mix(in srgb, var(--color-accent-orange) 45%, var(--color-border))", background: "var(--bg-main)", color: "var(--color-accent-orange)", outline: "none", fontWeight: 800 }}
                  title={t("library.wtt.quantity") || "Cantidad"}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setWttOfferDraft([])}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid transparent", background: "transparent", cursor: "pointer", fontWeight: 900, color: "var(--color-accent-orange)" }}
                >
                  {t("library.wtt.clear_selection") || "Borrar selección"}
                </button>
                <button
                  type="button"
                  onClick={() => setWttOfferOpen(false)}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--library-stock-cancel-border)", background: "var(--library-stock-cancel-bg)", cursor: "pointer", fontWeight: 900, color: "var(--library-stock-cancel-fg)" }}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => saveWttOfferDraft()}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "none", background: "var(--library-stock-save-bg)", color: "var(--library-stock-save-fg)", cursor: "pointer", fontWeight: 900, boxShadow: "var(--modal-cta-shadow)" }}
                >
                  {t("common.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

     {!loading && filtered.length === 0 && (
            <div style={{ marginTop: 10, color: "var(--text-muted)" }}>
              {t('library.no_results')}
            </div>
          )}

      {showColabModal && (
        <div className="library-colab-overlay" style={{ position: "fixed", inset: 0, background: "var(--overlay-strong)", backdropFilter: "blur(4px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div className="library-colab-shell" style={{ background: "var(--bg-card)", border: "1px solid var(--color-border)", width: "100%", maxWidth: "min(560px, calc(100vw - 40px))", borderRadius: "32px", padding: "30px", position: "relative", boxShadow: "0 25px 50px var(--overlay-soft)" }}>
            
            <button onClick={() => setShowColabModal(false)} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer" }}>
              <X size={24} />
            </button>

            <div style={{ textAlign: "center", marginBottom: "25px" }}>
              <div
                aria-hidden
                style={{
                  margin: "0 auto 15px",
                  width: "100%",
                  maxWidth: "100%",
                  aspectRatio: "1440 / 810",
                  position: "relative",
                  borderRadius: 20,
                  overflow: "hidden",
                  background: "var(--bg-soft)",
                  boxShadow: "0 8px 24px color-mix(in srgb, var(--color-primary) 12%, transparent)",
                }}
              >
                <video
                  src="/colab-modal-hero.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    pointerEvents: "none",
                    background: "var(--bg-soft)",
                  }}
                />
              </div>
              <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "28px", margin: 0 }}>{t("library.colab_modal.title")}</h2>
              <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "14px" }}>{t("library.colab_modal.subtitle")}</p>
            </div>

           <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "5px" }}>{t("library.colab_modal.label_subject")}</label>
                <input type="text" placeholder={t("library.colab_modal.placeholder_subject")} value={colabData.asunto} onChange={e => setColabData({...colabData, asunto: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", color: "var(--text-main)", background: "var(--bg-main)" }} />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "5px" }}>{t("library.colab_modal.label_email")}</label>
                <input type="email" placeholder={t("library.colab_modal.placeholder_email")} value={colabData.email} onChange={e => setColabData({...colabData, email: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", color: "var(--text-main)", background: "var(--bg-main)" }} />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "5px" }}>{t("library.colab_modal.label_message")}</label>
                <textarea rows={3} placeholder={t("library.colab_modal.placeholder_message")} value={colabData.mensaje} onChange={e => setColabData({...colabData, mensaje: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", resize: "none", color: "var(--text-main)", background: "var(--bg-main)" }} />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", display: "block", marginBottom: "2px" }}>{t("library.colab_modal.label_link")}</label>
                <p style={{fontSize: "11px", color: "var(--text-muted)", margin: "0 0 8px 0", fontWeight: 600}}>{t("library.colab_modal.link_hint")}</p>
                <input type="text" placeholder={t("library.colab_modal.placeholder_link")} value={colabData.adjunto} onChange={e => setColabData({...colabData, adjunto: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", color: "var(--text-main)", background: "var(--bg-main)" }} />
              </div>

              <div style={{ border: "1px dashed var(--color-border)", borderRadius: 14, background: "var(--bg-soft)", padding: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Sparkles size={14} color="var(--color-primary)" />
                  <span style={{ fontSize: 12, fontWeight: 900, color: "var(--color-primary)" }}>
                    {t("library.colab_modal.structure_title")}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px 0", fontWeight: 700, lineHeight: 1.35 }}>
                  {t("library.colab_modal.structure_hint")}
                </p>
                <div
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    padding: "8px 10px",
                    background: "var(--bg-card)",
                    display: "grid",
                    gap: 6,
                  }}
                  title={t("library.colab_modal.structure_example")}
                >
                  <div className="library-colab-structure-anim" style={{ fontSize: 11, fontWeight: 800, color: "var(--text-main)", wordBreak: "break-word" }}>
                    {t("library.colab_modal.structure_example")}
                  </div>
                  <div className="library-colab-structure-anim library-colab-structure-anim-delay" style={{ fontSize: 11, fontWeight: 800, color: "var(--text-main)", wordBreak: "break-word" }}>
                    {t("library.colab_modal.structure_example_back")}
                  </div>
                </div>
              </div>

              <button onClick={handleSubmitColab} disabled={sendingColab} style={{ width: "100%", padding: "15px", borderRadius: "15px", border: "none", background: "var(--color-primary)", color: "white", fontWeight: 900, fontSize: "16px", cursor: "pointer", marginTop: "10px" }}>
                {sendingColab ? t("library.colab_modal.btn_sending") : t("library.colab_modal.btn_send")}
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        .library-colab-structure-anim {
          animation: libraryColabPulse 2.2s ease-in-out infinite;
        }
        .library-colab-structure-anim-delay {
          animation-delay: 1.1s;
        }
        @keyframes libraryColabPulse {
          0%, 100% { opacity: 0.55; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-1px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .library-colab-structure-anim,
          .library-colab-structure-anim-delay {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
      </AdRailLayout>
      <Footer />
    </div>
  );
}
export default function LibraryPageClient() {
  return <LibraryContent />;
}

