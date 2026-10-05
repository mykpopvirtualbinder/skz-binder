"use client";

import React, { useCallback, useRef, useState } from "react";
import { BookOpen, Info, RotateCcw } from "lucide-react";

const DRAG_THRESHOLD_PX = 6;
const MAX_ROT_X = 18;

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
  depth = 22,
  interactive = true,
  onOpenBinder,
  t,
  showHint = true,
}: Binder3DBookProps) {
  const [rotY, setRotY] = useState(-22);
  const [rotX, setRotX] = useState(6);
  const [isDragging, setIsDragging] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const drag = useRef<{ pid: number | null; lx: number; ly: number }>({ pid: null, lx: 0, ly: 0 });
  const movedRef = useRef(false);
  const d = Math.max(14, Math.min(28, depth));
  const z = d / 2 - 0.4;
  const accent = color || "var(--color-primary)";

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
    setRotY((y) => y + dx * 0.5);
    setRotX((x) => Math.max(-MAX_ROT_X, Math.min(MAX_ROT_X, x - dy * 0.28)));
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

  const faceSeal: React.CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  const faceImg = (url: string | null | undefined): React.CSSProperties => ({
    backgroundColor: url ? "#1a1a1a" : accent,
    backgroundImage: url ? `url("${url}")` : "none",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    ...faceSeal,
  });

  return (
    <div
      style={{
        position: "relative",
        width,
        perspective: Math.max(640, width * 6),
        touchAction: interactive ? "none" : undefined,
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
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: isDragging ? "none" : "transform 0.25s ease",
          cursor: interactive ? (isDragging ? "grabbing" : "grab") : "default",
          outline: "none",
          filter: "drop-shadow(6px 10px 16px rgba(0,0,0,0.28))",
        }}
      >
        {/* Cuerpo único: 6 caras del mismo prisma */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateZ(${z}px)`,
            ...faceImg(coverUrl),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {!coverUrl && <BookOpen color="white" size={Math.max(24, width * 0.28)} />}
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `rotateY(180deg) translateZ(${z}px)`,
            ...faceImg(backCoverUrl || coverUrl),
            filter: backCoverUrl ? undefined : coverUrl ? "brightness(0.82)" : undefined,
            overflow: "hidden",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: d,
            height,
            transformOrigin: "left center",
            transform: `translateZ(${z}px) rotateY(-90deg)`,
            background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 35%, #111) 0%, ${accent} 55%, color-mix(in srgb, ${accent} 85%, #fff) 100%)`,
            overflow: "hidden",
            ...faceSeal,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontSize: Math.max(7, width * 0.06),
              fontWeight: 900,
              color: "rgba(255,255,255,0.88)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              maxHeight: height - 8,
            }}
          >
            {title || t("binder_shelf.default_name")}
          </span>
        </div>

        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: d,
            height,
            transformOrigin: "right center",
            transform: `translateZ(${z}px) rotateY(90deg)`,
            background: "linear-gradient(to bottom, #f4efe4, #e6dcc8 12%, #f7f2e8 50%, #d9d0be)",
            ...faceSeal,
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height: d,
            transformOrigin: "top center",
            transform: `translateZ(${z}px) rotateX(90deg)`,
            background: `linear-gradient(to bottom, color-mix(in srgb, ${accent} 70%, #222), #efe8da)`,
            ...faceSeal,
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width,
            height: d,
            transformOrigin: "bottom center",
            transform: `translateZ(${z}px) rotateX(-90deg)`,
            background: `linear-gradient(to top, color-mix(in srgb, ${accent} 70%, #222), #e7dfd0)`,
            ...faceSeal,
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
              setRotY(-22);
              setRotX(6);
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
