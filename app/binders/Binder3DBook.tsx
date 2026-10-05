"use client";

import React, { useCallback, useRef, useState } from "react";
import { BookOpen, Info, RotateCcw } from "lucide-react";

const DRAG_THRESHOLD_PX = 6;
const MAX_ROT_X = 28;

type Binder3DBookProps = {
  title: string;
  color: string;
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  width: number;
  height: number;
  depth?: number;
  interactive?: boolean;
  onOpenBinder?: () => void;
  t: (key: string) => string;
  showHint?: boolean;
};

export default function Binder3DBook({
  title,
  color,
  coverUrl,
  backCoverUrl,
  width,
  height,
  depth = 42,
  interactive = true,
  onOpenBinder,
  t,
  showHint = true,
}: Binder3DBookProps) {
  const [rotY, setRotY] = useState(-34);
  const [rotX, setRotX] = useState(16);
  const [isDragging, setIsDragging] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const drag = useRef<{ pid: number | null; lx: number; ly: number }>({ pid: null, lx: 0, ly: 0 });
  const movedRef = useRef(false);
  const d = Math.max(28, depth);
  const accent = color || "var(--color-primary)";
  const hx = width / 2;
  const hy = height / 2;
  const hz = d / 2;

  const endDrag = useCallback((target: HTMLElement, pointerId: number) => {
    setIsDragging(false);
    drag.current.pid = null;
    try {
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
    } catch {
      /* noop */
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || e.button !== 0) return;
    movedRef.current = false;
    setIsDragging(true);
    drag.current = { pid: e.pointerId, lx: e.clientX, ly: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || drag.current.pid !== e.pointerId) return;
    const dx = e.clientX - drag.current.lx;
    const dy = e.clientY - drag.current.ly;
    drag.current.lx = e.clientX;
    drag.current.ly = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) movedRef.current = true;
    if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
    setRotY((y) => y + dx * 0.6);
    setRotX((x) => Math.max(-MAX_ROT_X, Math.min(MAX_ROT_X, x - dy * 0.35)));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || drag.current.pid !== e.pointerId) return;
    endDrag(e.currentTarget, e.pointerId);
    if (!movedRef.current) onOpenBinder?.();
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || drag.current.pid !== e.pointerId) return;
    endDrag(e.currentTarget, e.pointerId);
  };

  const coverFace = (url: string | null | undefined, darkened?: boolean): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    backgroundColor: url ? "#141414" : accent,
    backgroundImage: url ? `url("${url}")` : "none",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    overflow: "hidden",
    filter: darkened && url ? "brightness(0.82)" : undefined,
  });

  return (
    <div
      className="binder-shelf-thumb-stage"
      style={{
        position: "relative",
        width: width + d,
        padding: `${Math.max(18, d * 0.35)}px 0 ${Math.max(12, d * 0.25)}px`,
        touchAction: interactive ? "none" : undefined,
        perspective: Math.max(900, width * 10),
        perspectiveOrigin: "50% 45%",
        overflow: "visible",
      }}
    >
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={`${title || t("binder_shelf.default_name")}. ${t("binder_shelf.thumb_drag_hint")}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={(e) => {
          if (!interactive) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenBinder?.();
          }
        }}
        style={{
          width,
          height,
          margin: "0 auto",
          position: "relative",
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: isDragging ? "none" : "transform 0.22s ease",
          cursor: interactive ? (isDragging ? "grabbing" : "grab") : "default",
          outline: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          transformOrigin: "center center",
        }}
      >
        {/* Portada */}
        <div
          style={{
            ...coverFace(coverUrl),
            transform: `translateZ(${hz}px)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 28px rgba(0,0,0,0.28)",
          }}
        >
          {!coverUrl && <BookOpen color="white" size={Math.max(26, width * 0.3)} />}
        </div>

        {/* Contraportada */}
        <div
          style={{
            ...coverFace(backCoverUrl || coverUrl, !backCoverUrl),
            transform: `rotateY(180deg) translateZ(${hz}px)`,
          }}
        />

        {/* Lomo — cara izquierda del prisma */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: (width - d) / 2,
            width: d,
            height,
            transform: `rotateY(-90deg) translateZ(${hx}px)`,
            background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 38%, #0a0a0a) 0%, ${accent} 55%, color-mix(in srgb, ${accent} 82%, #fff) 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontSize: Math.max(7, width * 0.065),
              fontWeight: 900,
              color: "rgba(255,255,255,0.88)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              maxHeight: height - 10,
            }}
          >
            {title || t("binder_shelf.default_name")}
          </span>
        </div>

        {/* Canto de páginas — cara derecha */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: (width - d) / 2,
            width: d,
            height,
            transform: `rotateY(90deg) translateZ(${hx}px)`,
            background:
              "repeating-linear-gradient(to bottom, #f7f2e8 0px, #f7f2e8 2px, #e6dcc8 3px, #d8cfbd 4px)",
            boxShadow: "inset 0 0 10px rgba(0,0,0,0.12)",
          }}
        />

        {/* Canto superior */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: (height - d) / 2,
            width,
            height: d,
            transform: `rotateX(90deg) translateZ(${hy}px)`,
            background:
              "repeating-linear-gradient(to right, #f4efe4 0px, #f4efe4 2px, #ddd4c2 3px)",
          }}
        />

        {/* Canto inferior */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: (height - d) / 2,
            width,
            height: d,
            transform: `rotateX(-90deg) translateZ(${hy}px)`,
            background: `linear-gradient(to top, color-mix(in srgb, ${accent} 55%, #222), #e7dfd0)`,
          }}
        />
      </div>

      <div
        aria-hidden
        style={{
          width: width * 0.72,
          height: 14,
          margin: "10px auto 0",
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.28) 0%, transparent 72%)",
          pointerEvents: "none",
        }}
      />

      {showHint && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            title={t("binder_shelf.thumb_info")}
            aria-label={t("binder_shelf.thumb_info")}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setHintOpen((v) => !v);
            }}
            style={chipBtn}
          >
            <Info size={13} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            title={t("binder_shelf.thumb_reset")}
            aria-label={t("binder_shelf.thumb_reset")}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setRotY(-34);
              setRotX(16);
            }}
            style={chipBtn}
          >
            <RotateCcw size={13} strokeWidth={2.4} />
          </button>
        </div>
      )}
      {showHint && hintOpen && (
        <p
          style={{
            margin: "8px auto 0",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-muted)",
            textAlign: "center",
            maxWidth: width + 40,
            lineHeight: 1.3,
          }}
        >
          {t("binder_shelf.thumb_drag_hint")}
        </p>
      )}
    </div>
  );
}

const chipBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  border: "1px solid var(--color-border)",
  background: "var(--bg-card)",
  color: "var(--color-primary)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
