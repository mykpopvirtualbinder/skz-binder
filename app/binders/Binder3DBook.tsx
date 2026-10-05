"use client";

import React, { useCallback, useRef, useState } from "react";
import { BookOpen, Info, RotateCcw } from "lucide-react";

const DRAG_THRESHOLD_PX = 6;
const MAX_ROT_X = 22;

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
  depth = 26,
  interactive = true,
  onOpenBinder,
  t,
  showHint = true,
}: Binder3DBookProps) {
  const [rotY, setRotY] = useState(-24);
  const [rotX, setRotX] = useState(7);
  const [isDragging, setIsDragging] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const drag = useRef<{ pid: number | null; lx: number; ly: number }>({
    pid: null,
    lx: 0,
    ly: 0,
  });
  const movedRef = useRef(false);

  const thick = Math.max(16, Math.min(32, depth));

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
    setRotY((y) => y + dx * 0.55);
    setRotX((x) => Math.max(-MAX_ROT_X, Math.min(MAX_ROT_X, x - dy * 0.3)));
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

  const resetRotation = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRotY(-24);
    setRotX(7);
  };

  const accent = color || "var(--color-primary)";
  const frontBg = coverUrl ? `url("${coverUrl}")` : "none";
  const backBg = backCoverUrl ? `url("${backCoverUrl}")` : coverUrl ? `url("${coverUrl}")` : "none";

  return (
    <div
      className="binder-shelf-thumb-stage"
      style={{
        position: "relative",
        width,
        touchAction: interactive ? "none" : undefined,
        perspective: Math.max(700, width * 7),
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
          position: "relative",
          margin: "0 auto",
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: isDragging ? "none" : "transform 0.28s ease",
          cursor: interactive ? (isDragging ? "grabbing" : "grab") : "default",
          outline: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          transformOrigin: "center center",
        }}
      >
        {/* Front cover — attached to the block */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateZ(${thick / 2}px)`,
            backgroundColor: coverUrl ? "#111" : accent,
            backgroundImage: frontBg,
            backgroundSize: "cover",
            backgroundPosition: "center",
            borderRadius: "2px 6px 6px 2px",
            boxShadow: "4px 8px 18px var(--overlay-faint)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {!coverUrl && (
            <BookOpen color="white" size={Math.max(26, width * 0.3)} style={{ opacity: 0.92 }} />
          )}
        </div>

        {/* Spine flush with front left edge */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: thick,
            height,
            transformOrigin: "left center",
            transform: `translateZ(${thick / 2}px) rotateY(-90deg)`,
            background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 42%, #0a0a0a), ${accent} 55%, color-mix(in srgb, ${accent} 80%, #fff))`,
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
              color: "rgba(255,255,255,0.82)",
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

        {/* Page block (one piece, tucked under the covers) */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 2,
            right: 0,
            width: thick - 1,
            height: height - 4,
            transformOrigin: "right center",
            transform: `translateZ(${thick / 2}px) rotateY(90deg)`,
            background: "linear-gradient(to bottom, #f6f1e6, #e8dfcc 8%, #f4eee3 50%, #ddd3c0)",
            boxShadow: "inset 0 0 6px rgba(0,0,0,0.08)",
          }}
        />

        {/* Back cover flush with spine */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `rotateY(180deg) translateZ(${thick / 2}px)`,
            backgroundColor: backCoverUrl || coverUrl ? "#111" : `color-mix(in srgb, ${accent} 78%, #111)`,
            backgroundImage: backBg,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: backCoverUrl ? undefined : coverUrl ? "brightness(0.78)" : undefined,
            borderRadius: "6px 2px 2px 6px",
            overflow: "hidden",
          }}
        />
      </div>

      {showHint && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            title={t("binder_shelf.thumb_info")}
            aria-label={t("binder_shelf.thumb_info")}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setHintOpen((v) => !v);
            }}
            style={{
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
            }}
          >
            <Info size={13} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            title={t("binder_shelf.thumb_reset")}
            aria-label={t("binder_shelf.thumb_reset")}
            onClick={resetRotation}
            style={{
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
            }}
          >
            <RotateCcw size={13} strokeWidth={2.4} />
          </button>
        </div>
      )}
      {showHint && hintOpen && (
        <p
          style={{
            margin: "8px 0 0 0",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-muted)",
            textAlign: "center",
            lineHeight: 1.3,
            maxWidth: width + 48,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {t("binder_shelf.thumb_drag_hint")}
        </p>
      )}
    </div>
  );
}
