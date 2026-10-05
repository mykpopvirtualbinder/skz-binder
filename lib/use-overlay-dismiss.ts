import { useEffect, type MouseEvent } from "react";

/** Esc cierra el overlay (capture, para que no se cuele al modal de debajo). */
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
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, onClose]);
}

/** Clic en el fondo oscuro, no en el contenido. */
export function backdropPointerClose(onClose: () => void) {
  return (e: MouseEvent<HTMLElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
}
