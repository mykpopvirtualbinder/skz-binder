import { useEffect, type MouseEvent } from "react";

let bodyLockCount = 0;
let savedScrollY = 0;
let blockBgTouch: ((e: TouchEvent) => void) | null = null;

function acquireBodyLock() {
  if (typeof document === "undefined") return;
  if (bodyLockCount === 0) {
    const body = document.body;
    const html = document.documentElement;
    savedScrollY = window.scrollY;
    html.dataset.modalLockOverflow = html.style.overflow;
    body.dataset.modalLockOverflow = body.style.overflow;
    body.dataset.modalLockPosition = body.style.position;
    body.dataset.modalLockTop = body.style.top;
    body.dataset.modalLockLeft = body.style.left;
    body.dataset.modalLockRight = body.style.right;
    body.dataset.modalLockWidth = body.style.width;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.classList.add("modal-scroll-lock");
    blockBgTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-modal-scroll]")) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", blockBgTouch, { passive: false });
  }
  bodyLockCount += 1;
}

function releaseBodyLock() {
  if (typeof document === "undefined") return;
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount > 0) return;
  const body = document.body;
  const html = document.documentElement;
  html.style.overflow = html.dataset.modalLockOverflow || "";
  body.style.overflow = body.dataset.modalLockOverflow || "";
  body.style.position = body.dataset.modalLockPosition || "";
  body.style.top = body.dataset.modalLockTop || "";
  body.style.left = body.dataset.modalLockLeft || "";
  body.style.right = body.dataset.modalLockRight || "";
  body.style.width = body.dataset.modalLockWidth || "";
  delete html.dataset.modalLockOverflow;
  delete body.dataset.modalLockOverflow;
  delete body.dataset.modalLockPosition;
  delete body.dataset.modalLockTop;
  delete body.dataset.modalLockLeft;
  delete body.dataset.modalLockRight;
  delete body.dataset.modalLockWidth;
  body.classList.remove("modal-scroll-lock");
  if (blockBgTouch) {
    document.removeEventListener("touchmove", blockBgTouch);
    blockBgTouch = null;
  }
  window.scrollTo(0, savedScrollY);
}

/** Esc cierra el overlay y bloquea el scroll de la página de detrás. */
export function useOverlayDismiss(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    acquireBodyLock();
    return () => {
      window.removeEventListener("keydown", onKey, true);
      releaseBodyLock();
    };
  }, [active, onClose]);
}

/** Clic en el fondo oscuro, no en el contenido. */
export function backdropPointerClose(onClose: () => void) {
  return (e: MouseEvent<HTMLElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
}
