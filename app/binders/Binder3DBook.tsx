"use client";

import React, { useCallback, useRef, useState } from "react";
import { BookOpen, Info, RotateCcw } from "lucide-react";

const DRAG_THRESHOLD_PX = 6;
const MAX_ROT_X = 28;
const PAGE_SHEETS = 10;

type Binder3DBookProps = {
  title: string;
  color: string;
  coverUrl?: string | null;
  width: number;
  height: number;
  /** Spine thickness in px */
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
  width,
  height,
  depth = 42,
  interactive = true,
  onOpenBinder,
  t,
  showHint = true,
}: Binder3DBookProps) {
  const [rotY, setRotY] = useState(-28);
  const [rotX, setRotX] = useState(12);
  const [isDragging, setIsDragging] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const drag = useRef<{ pid: number | null; lx: number; ly: number }>({
    pid: null,
    lx: 0,
    ly: 0,
  });
  const movedRef = useRef(false);

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

  const resetRotation = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRotY(-28);
    setRotX(12);
  };

  const accent = color || "var(--color-primary)";
  const coverBg = coverUrl ? `url("${coverUrl}")` : "none";
  const inset = Math.max(3, Math.round(width * 0.035));
  const pageW = width - inset * 2;
  const pageH = height - inset * 2;
  const block = Math.max(28, depth);

  return (
    <div
      className="binder-shelf-thumb-stage"
      style={{
        position: "relative",
        width,
        marginBottom: 0,
        touchAction: interactive ? "none" : undefined,
        perspective: Math.max(900, width * 10),
      }}
    >
      <div style={{ position: "relative", width, height, overflow: "visible" }}>
        <button
          type="button"
          title={t("binder_shelf.thumb_reset")}
          aria-label={t("binder_shelf.thumb_reset")}
          onClick={resetRotation}
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            zIndex: 12,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "1px solid var(--color-border)",
            background: "var(--bg-card)",
            color: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 12px var(--overlay-faint)",
          }}
        >
          <RotateCcw size={14} strokeWidth={2.5} />
        </button>
        {showHint && (
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
              position: "absolute",
              top: -10,
              left: -10,
              zIndex: 12,
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "1px solid var(--color-border)",
              background: "var(--bg-card)",
              color: "var(--color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 12px var(--overlay-faint)",
            }}
          >
            <Info size={14} strokeWidth={2.5} />
          </button>
        )}
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
            transition: isDragging ? "none" : "transform 0.22s ease",
            cursor: interactive ? (isDragging ? "grabbing" : "grab") : "default",
            outline: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {Array.from({ length: PAGE_SHEETS }, (_, i) => {
            const tNorm = (i + 1) / (PAGE_SHEETS + 1);
            const z = -block / 2 + tNorm * block;
            const shade = 246 - i * 4;
            return (
              <div
                key={`sheet-${i}`}
                aria-hidden
                style={{
                  position: "absolute",
                  left: inset,
                  top: inset,
                  width: pageW,
                  height: pageH,
                  transform: `translateZ(${z}px)`,
                  background: `linear-gradient(90deg, rgb(${shade - 8},${shade - 10},${shade - 14}), rgb(${shade},${shade - 2},${shade - 8}))`,
                  border: "1px solid rgba(180,170,150,0.45)",
                  boxShadow: "inset -6px 0 8px rgba(0,0,0,0.06)",
                  borderRadius: 1,
                }}
              />
            );
          })}

          {/* Front cover */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translateZ(${block / 2 + 1}px)`,
              backgroundColor: coverUrl ? "transparent" : accent,
              backgroundImage: coverBg,
              backgroundSize: "cover",
              backgroundPosition: "center",
              borderRadius: "3px 8px 8px 3px",
              boxShadow: "8px 10px 22px var(--overlay-faint)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backfaceVisibility: "hidden",
            }}
          >
            {!coverUrl && (
              <BookOpen color="white" size={Math.max(28, width * 0.32)} style={{ opacity: 0.9, filter: "drop-shadow(0 2px 4px var(--overlay-soft))" }} />
            )}
          </div>

          {/* Back cover */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `rotateY(180deg) translateZ(${block / 2 + 1}px)`,
              backgroundColor: coverUrl ? "color-mix(in srgb, var(--bg-card) 70%, #222)" : `color-mix(in srgb, ${accent} 75%, #111)`,
              backgroundImage: coverUrl ? coverBg : "none",
              backgroundSize: "cover",
              filter: coverUrl ? "brightness(0.72)" : undefined,
              borderRadius: "8px 3px 3px 8px",
              backfaceVisibility: "hidden",
            }}
          />

          {/* Spine */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: block,
              height,
              transform: `rotateY(-90deg) translateZ(${block / 2}px)`,
              transformOrigin: "left center",
              background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 45%, #111), ${accent}, color-mix(in srgb, ${accent} 70%, #fff))`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 2,
            }}
          >
            <span
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                fontSize: Math.max(7, width * 0.07),
                fontWeight: 900,
                color: "color-mix(in srgb, var(--bg-card) 80%, transparent)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                maxHeight: height - 12,
              }}
            >
              {title || t("binder_shelf.default_name")}
            </span>
          </div>

          {/* Fore-edge (visible page stack) */}
          <div
            style={{
              position: "absolute",
              top: inset,
              right: 0,
              width: block,
              height: pageH,
              transform: `rotateY(90deg) translateZ(${block / 2 - 1}px)`,
              transformOrigin: "right center",
              background: "repeating-linear-gradient(to bottom, #f7f2e8 0px, #f7f2e8 1px, #e4dccb 2px, #d9d0be 3px)",
              borderRadius: 1,
              boxShadow: "inset 0 0 8px rgba(0,0,0,0.12)",
            }}
          />

          {/* Top of page block */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: inset,
              top: inset,
              width: pageW,
              height: block,
              transform: `rotateX(90deg) translateZ(${block / 2}px)`,
              transformOrigin: "top center",
              background: "repeating-linear-gradient(to right, #f4efe4 0px, #f4efe4 2px, #ddd4c2 3px)",
            }}
          />
        </div>
      </div>
      {showHint && hintOpen && (
        <p
          style={{
            margin: "10px 0 0 0",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-muted)",
            textAlign: "center",
            lineHeight: 1.25,
            maxWidth: width + 40,
            background: "var(--bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            padding: "8px 10px",
            position: "relative",
            zIndex: 20,
          }}
        >
          {t("binder_shelf.thumb_drag_hint")}
        </p>
      )}
    </div>
  );
}
