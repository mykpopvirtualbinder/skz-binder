const CANCEL_RE = /^(cancelar|cerrar|salir|volver|saltar|omitir|close|cancel|back|skip|no)$/i;
const CONFIRM_RE = /^(aceptar|ok|entendido|guardar|confirmar|enviar|sí|si|yes|save|done|descontar|eliminar|borrar|continuar|aplicar)$/i;

function visible(el: HTMLElement) {
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

function layerZ(el: HTMLElement) {
  const z = Number(getComputedStyle(el).zIndex);
  return Number.isFinite(z) ? z : 0;
}

function isLayer(el: HTMLElement) {
  if (!visible(el)) return false;
  if (el.getAttribute("role") === "dialog" || el.getAttribute("aria-modal") === "true" || el.hasAttribute("data-kbd-root")) return true;
  const box = el.getBoundingClientRect();
  return box.width >= window.innerWidth * 0.85 && box.height >= window.innerHeight * 0.85;
}

function topmostLayer() {
  const nodes = document.querySelectorAll<HTMLElement>("[style*='position: fixed'], [style*='position:fixed'], [role='dialog'], [aria-modal='true'], [data-kbd-root]");
  const layers = [...nodes].filter(isLayer);
  layers.sort((a, b) => layerZ(b) - layerZ(a));
  return layers[0] ?? null;
}

function labelOf(button: HTMLButtonElement) {
  return (button.getAttribute("aria-label") || button.textContent || "").replace(/\s+/g, " ").trim();
}

function enabledButtons(layer: HTMLElement) {
  return [...layer.querySelectorAll<HTMLButtonElement>("button")].filter((button) => !button.disabled && visible(button));
}

function cancelButton(layer: HTMLElement) {
  const marked = layer.querySelector<HTMLButtonElement>("[data-kbd='cancel']");
  if (marked && !marked.disabled && visible(marked)) return marked;
  return enabledButtons(layer).find((button) => CANCEL_RE.test(labelOf(button))) ?? null;
}

function confirmButton(layer: HTMLElement) {
  const marked = layer.querySelector<HTMLButtonElement>("[data-kbd='confirm']");
  if (marked && !marked.disabled && visible(marked)) return marked;
  const candidates = enabledButtons(layer).filter((button) => !CANCEL_RE.test(labelOf(button)));
  return candidates.find((button) => CONFIRM_RE.test(labelOf(button))) ?? (candidates.length === 1 ? candidates[0] : null);
}

function typingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "SELECT" || tag === "BUTTON" || tag === "A" || tag === "TEXTAREA") return tag;
  if (target.isContentEditable) return "editable";
  if (tag === "INPUT") return (target as HTMLInputElement).type || "text";
  return false;
}

/** Enter confirma el cuadro de arriba. Esc lo cierra. Shift+Enter sigue siendo un salto de línea. */
export function applySiteKeyboard(event: KeyboardEvent) {
  if (event.defaultPrevented || event.repeat) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key !== "Enter" && event.key !== "Escape") return;
  const layer = topmostLayer();
  if (!layer) return;

  if (event.key === "Escape") {
    const cancel = cancelButton(layer);
    if (!cancel) return;
    event.preventDefault();
    event.stopPropagation();
    cancel.click();
    return;
  }

  if (event.shiftKey) return;
  if (event.target instanceof HTMLElement && event.target.hasAttribute("data-kbd-add")) return;
  const typing = typingTarget(event.target);
  if (typing === "SELECT" || typing === "BUTTON" || typing === "A" || typing === "checkbox" || typing === "radio" || typing === "file") return;
  const confirm = confirmButton(layer);
  if (!confirm) return;
  event.preventDefault();
  event.stopPropagation();
  confirm.click();
}
