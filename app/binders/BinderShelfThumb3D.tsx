"use client";

import React, { useCallback, useRef, useState } from "react";
import { BookOpen, RotateCcw } from "lucide-react";

const DRAG_THRESHOLD_PX = 6;
const MAX_ROT_X = 32;

type BinderShelfThumb3DProps = {
  title: string;
  color: string;
  coverUrl?: string | null;
  onOpenBinder: () => void;
  t: (key: string) => string;
};

export default function BinderShelfThumb3D({
  title,
  color,
  coverUrl,
  onOpenBinder,
  t,
}: BinderShelfThumb3DProps) {
  const [rotY, setRotY] = useState(0);
  const [rotX, setRotX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
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
    if (e.button !== 0) return;
    movedRef.current = false;
    setIsDragging(true);
    drag.current = { pid: e.pointerId, lx: e.clientX, ly: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current.pid !== e.pointerId) return;
    const dx = e.clientX - drag.current.lx;
    const dy = e.clientY - drag.current.ly;
    drag.current.lx = e.clientX;
    drag.current.ly = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) movedRef.current = true;
    if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
    setRotY((y) => y + dx * 0.55);
    setRotX((x) => Math.max(-MAX_ROT_X, Math.min(MAX_ROT_X, x - dy * 0.38)));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current.pid !== e.pointerId) return;
    endDrag(e.currentTarget, e.pointerId);
    if (!movedRef.current) onOpenBinder();
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current.pid !== e.pointerId) return;
    endDrag(e.currentTarget, e.pointerId);
  };

  const resetRotation = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRotY(0);
    setRotX(0);
  };

  const transform = `perspective(1000px) rotateY(${rotY}deg) rotateX(${rotX}deg)`;
  const hasTilt = Math.abs(rotY) > 0.4 || Math.abs(rotX) > 0.4;
  const accent = color || "var(--color-primary)";

  return (
    <div
      className="binder-shelf-thumb-stage"
      style={{
        position: "relative",
        width: 100,
        marginBottom: 10,
        touchAction: "none",
        perspective: 1000,
      }}
    >
      <div style={{ position: "relative", width: 100 }}>
        {hasTilt && (
          <button
            type="button"
            title={t("binder_shelf.thumb_reset")}
            aria-label={t("binder_shelf.thumb_reset")}
            onClick={resetRotation}
            style={{
              position: "absolute",
              top: -8,
              right: -8,
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
        )}
        <div
          role="button"
          tabIndex={0}
          aria-label={`${title || t("binder_shelf.default_name")}. ${t("binder_shelf.thumb_drag_hint")}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenBinder();
            }
          }}
          style={{
            width: 100,
            height: 140,
            backgroundColor: !coverUrl ? accent : "transparent",
            backgroundImage: coverUrl ? `url("${coverUrl}")` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            borderRadius: "4px 12px 12px 4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isDragging ? "grabbing" : "grab",
            position: "relative",
            transform: transform,
            transformStyle: "preserve-3d",
            transition: isDragging ? "none" : "transform 0.22s ease, box-shadow 0.25s ease",
            boxShadow: hasTilt
              ? `20px 20px 40px color-mix(in srgb, ${accent} 40%, transparent)`
              : "6px 4px 15px var(--overlay-faint)",
            borderLeft: "12px solid var(--overlay-faint)",
            outline: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -12,
              width: 12,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                fontSize: "7px",
                fontWeight: 900,
                color: "color-mix(in srgb, var(--bg-card) 70%, transparent)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {title || t("binder_shelf.default_name")}
            </span>
          </div>

          <div
            style={{
              position: "absolute",
              right: -3,
              top: 4,
              bottom: 4,
              width: 8,
              background: "linear-gradient(to right, var(--bg-card), var(--state-disabled-bg))",
              borderRadius: "0 4px 4px 0",
              border: "1px solid var(--state-disabled-border)",
              zIndex: -1,
              pointerEvents: "none",
            }}
          />

          {!coverUrl && (
            <BookOpen color="white" size={36} style={{ opacity: 0.9, filter: "drop-shadow(0 2px 4px var(--overlay-soft))" }} />
          )}
        </div>
      </div>
      <p
        style={{
          margin: "6px 0 0 0",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          textAlign: "center",
          lineHeight: 1.25,
          pointerEvents: "none",
          maxWidth: 100,
        }}
      >
        {t("binder_shelf.thumb_drag_hint")}
      </p>
    </div>
  );
}
