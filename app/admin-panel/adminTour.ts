"use client";

import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./admin-tour.css";

type TourStep = {
  selector: string;
  title: string;
  text: string;
  side?: "top" | "right" | "bottom" | "left";
  tab?: string;
  before?: () => void;
  expand?: boolean;
};

const openedMenus = new Set<HTMLSelectElement>();
const clickedOpen = new Set<string>();

let scanTimer: number | null = null;
let touring = false;

export function adminTourActive() {
  return touring;
}

function stopScan() {
  if (scanTimer != null) window.clearInterval(scanTimer);
  scanTimer = null;
}

function expandSelect(root: Element | undefined) {
  const select = root instanceof HTMLSelectElement ? root : root?.querySelector("select");
  if (!select || select.options.length < 2) return;
  if (!select.dataset.tourWas) select.dataset.tourWas = select.hasAttribute("size") ? select.getAttribute("size") || "" : "";
  select.dataset.tourOpen = "1";
  select.dataset.tourIndex = String(select.selectedIndex);
  select.size = Math.min(Math.max(select.options.length, 2), 6);
  openedMenus.add(select);
  stopScan();
  let i = 0;
  const total = select.options.length;
  const original = select.selectedIndex;
  scanTimer = window.setInterval(() => {
    if (!select.isConnected) {
      stopScan();
      return;
    }
    select.selectedIndex = i % total;
    i += 1;
    if (i >= total * 2) {
      stopScan();
      if (original >= 0) select.selectedIndex = original;
    }
  }, 320);
}

function collapseSelect(root?: Element) {
  stopScan();
  const select = !root ? null : root instanceof HTMLSelectElement ? root : root.querySelector("select");
  const list = select ? [select] : Array.from(openedMenus);
  for (const item of list) {
    if (item.dataset.tourIndex != null) {
      const idx = Number(item.dataset.tourIndex);
      if (Number.isFinite(idx) && idx >= 0) item.selectedIndex = idx;
      delete item.dataset.tourIndex;
    }
    if (item.dataset.tourWas) item.size = Number(item.dataset.tourWas) || 1;
    else item.removeAttribute("size");
    delete item.dataset.tourWas;
    delete item.dataset.tourOpen;
    openedMenus.delete(item);
  }
}

function clickOpen(selector: string) {
  if (clickedOpen.has(selector)) return;
  const btn = document.querySelector(selector);
  if (!(btn instanceof HTMLButtonElement)) return;
  clickedOpen.add(selector);
  if (!btn.textContent?.includes("Ocultar")) btn.click();
}

export type AdminTourHandlers = {
  openTab: (id: string) => void;
  showUserCard: () => void;
  hideUserCard: () => void;
  openFirstSolicitud: () => void;
  openFirstBuzon: () => void;
  showArtworkFields: () => void;
};

export const ADMIN_TOUR_IDS = [
  "publicar",
  "catalogo",
  "publicidad",
  "usuarios",
  "solicitudes",
  "denuncias",
  "buzon",
  "aportaciones",
] as const;

export type AdminTourId = (typeof ADMIN_TOUR_IDS)[number];

let active: Driver | null = null;

function stepsFor(id: string, handlers: AdminTourHandlers): TourStep[] {
  const all: Record<AdminTourId, TourStep[]> = {
    publicar: [
    {
      selector: "[data-tour='pub-titulo']",
      title: "Título",
      text: "El título de la obra. En una continuación de fanfic se rellena solo.",
      side: "bottom",
      tab: "publicar",
    },
    {
      selector: "[data-tour='pub-categoria']",
      title: "Categoría",
      text: "Arte 2D, 3D, artesanía, fanfic o multimedia. Las opciones quedan abiertas para verlas.",
      side: "bottom",
      tab: "publicar",
      expand: true,
    },
    {
      selector: "[data-tour='pub-usuario']",
      title: "A quién se la asignas",
      text: "Busca a la persona. La obra queda en su perfil, no en el de quien está en el panel.",
      side: "bottom",
      tab: "publicar",
    },
    {
      selector: "[data-tour='pub-archivo']",
      title: "Archivo y portada",
      text: "El archivo principal y la imagen de portada.",
      side: "top",
      tab: "publicar",
      before: handlers.showArtworkFields,
    },
    {
      selector: "[data-tour='pub-nsfw']",
      title: "Contenido +18",
      text: "Márcalo antes de publicar si la obra es para mayores.",
      side: "top",
      tab: "publicar",
    },
    {
      selector: "[data-tour='pub-publicar']",
      title: "Publicar",
      text: "Este botón la deja visible en la galería. En fanfics, el texto en español se traduce solo.",
      side: "top",
      tab: "publicar",
    },
    ],
    catalogo: [
    {
      selector: "[data-tour='cat-grupo']",
      title: "Alta de grupo",
      text: "Nombre y logo son lo que ve la gente. El slug es interno. Guardar lo escribe en la base de datos.",
      side: "bottom",
      tab: "catalogo",
    },
    {
      selector: "[data-tour='cat-grupo-select']",
      title: "Grupo del miembro",
      text: "Antes de dar de alta un idol, elige su grupo en este desplegable.",
      side: "bottom",
      tab: "catalogo",
      expand: true,
    },
    {
      selector: "[data-tour='cat-lista-grupos']",
      title: "Lista de grupos",
      text: "El buscador filtra por nombre. Editar carga el grupo en el formulario de arriba. Borrar elimina el grupo y todos sus miembros.",
      side: "top",
      tab: "catalogo",
    },
    {
      selector: "[data-tour='cat-editar-grupo']",
      title: "Editar grupo",
      text: "Rellena el formulario con ese grupo. Cambias nombre, slug o logo y pulsas Guardar.",
      side: "left",
      tab: "catalogo",
    },
    {
      selector: "[data-tour='cat-borrar-grupo']",
      title: "Borrar grupo",
      text: "Pide confirmación. Se van el grupo y sus miembros. No se deshace.",
      side: "left",
      tab: "catalogo",
    },
    {
      selector: "[data-tour='cat-lista-miembros']",
      title: "Lista de miembros",
      text: "Puedes buscar por grupo y, aparte, por el nombre. Editar carga la ficha. Borrar quita solo a ese idol.",
      side: "top",
      tab: "catalogo",
    },
    {
      selector: "[data-tour='cat-editar-miembro']",
      title: "Editar miembro",
      text: "Carga grupo, nombre y foto arriba. Guardar actualiza esa ficha.",
      side: "left",
      tab: "catalogo",
    },
    {
      selector: "[data-tour='cat-borrar-miembro']",
      title: "Borrar miembro",
      text: "Elimina solo a esa persona. El grupo se queda.",
      side: "left",
      tab: "catalogo",
    },
    ],
    publicidad: [
    {
      selector: "[data-tour='ad-copy']",
      title: "El anuncio",
      text: "Título, subtítulo, enlace de destino y, si quieres, imagen.",
      side: "bottom",
      tab: "publicidad",
    },
    {
      selector: "[data-tour='ad-hueco']",
      title: "Dónde aparece",
      text: "El anuncio puede ser el mismo, pero el hueco de la página no: en el ordenador hay barras laterales y en el móvil el anuncio va entre el contenido. Por eso eliges dispositivo y hueco.",
      side: "bottom",
      tab: "publicidad",
      expand: true,
    },
    {
      selector: "[data-tour='ad-dispositivo']",
      title: "Dispositivo",
      text: "Ordenador, tablet o móvil. No cambia el anuncio: cambia en qué pantalla se enseña, porque el diseño no es el mismo.",
      side: "bottom",
      tab: "publicidad",
      expand: true,
    },
    {
      selector: "[data-tour='ad-activar']",
      title: "Activar",
      text: "Márcala activa, pon prioridad y fechas, y créala. Recargar campañas refresca la lista.",
      side: "top",
      tab: "publicidad",
    },
    ],
    usuarios: [
    {
      selector: "[data-tour='usr-resumen']",
      title: "El resumen",
      text: "Altas, pendientes de confirmar, restringidos y bajas. Cada tarjeta abre el listado de ese tipo.",
      side: "bottom",
      tab: "usuarios",
      before: handlers.hideUserCard,
    },
    {
      selector: "[data-tour='usr-ficha']",
      title: "La ficha",
      text: "Así se ve cada persona: nombre, correo, alta y último acceso. Acciones abre los botones de verdad. El tour abre la primera ficha.",
      side: "bottom",
      tab: "usuarios",
      before: handlers.showUserCard,
    },
    {
      selector: "[data-tour='usr-cuenta']",
      title: "La cuenta",
      text: "Premium (un mes, un año o quitarlo), la insignia de artista y la estrella. K-oins se escribe y se confirma con OK. Si quitas artista y hay obras, eliges si se quedan, se borran todas o solo algunas.",
      side: "bottom",
      tab: "usuarios",
      before: handlers.showUserCard,
    },
    {
      selector: "[data-tour='usr-acceso']",
      title: "La sesión",
      text: "Restablecer contraseña, bloquear el login o cerrar sesiones en todos los dispositivos si creen que les han entrado en la cuenta.",
      side: "bottom",
      tab: "usuarios",
      before: handlers.showUserCard,
    },
    {
      selector: "[data-tour='usr-mod']",
      title: "Moderación",
      text: "Un strike avisa. Al tercero la cuenta queda restringida. Historial muestra los que ya tiene. Fulminar borra la cuenta y no se deshace.",
      side: "top",
      tab: "usuarios",
      before: handlers.showUserCard,
    },
    ],
    solicitudes: [
    {
      selector: "[data-tour='sol-filtros-estado']",
      title: "Estado",
      text: "Pendiente, en proceso, aprobada o denegada. Las opciones se abren al señalar el campo.",
      side: "bottom",
      tab: "solicitudes",
      expand: true,
    },
    {
      selector: "[data-tour='sol-filtros-gestor']",
      title: "Quién la lleva",
      text: "Ana, Paula, Silvia o sin asignar, para no abrirla dos a la vez.",
      side: "bottom",
      tab: "solicitudes",
      expand: true,
    },
    {
      selector: "[data-tour='sol-filtros-lectura']",
      title: "Lectura",
      text: "Todas, solo no leídas o solo leídas.",
      side: "bottom",
      tab: "solicitudes",
      expand: true,
    },
    {
      selector: "[data-tour='sol-leido']",
      title: "Marcar leída",
      text: "Una sola, las seleccionadas o todas las de la lista, como leídas o como no leídas.",
      side: "bottom",
      tab: "solicitudes",
    },
    {
      selector: "[data-tour='sol-caso-estado']",
      title: "Estado de esta solicitud",
      text: "En proceso mientras la revisas. Aprobada o denegada la deja en el histórico.",
      side: "bottom",
      tab: "solicitudes",
      expand: true,
      before: handlers.openFirstSolicitud,
    },
    {
      selector: "[data-tour='sol-caso-gestor']",
      title: "Quién la gestiona",
      text: "Asigna a Ana, Paula o Silvia en esta solicitud.",
      side: "bottom",
      tab: "solicitudes",
      expand: true,
      before: handlers.openFirstSolicitud,
    },
    {
      selector: "[data-tour='sol-acciones']",
      title: "Aprobar, publicar o denegar",
      text: "Aprobar como artista da la insignia. Publicar su obra abre Publicar con esa persona. Denegar cierra el expediente sin borrarlo.",
      side: "top",
      tab: "solicitudes",
      before: handlers.openFirstSolicitud,
    },
    {
      selector: "[data-tour='sol-historial-lista']",
      title: "Historial",
      text: "Cada alta de esa persona, con estado, quién la gestiona y qué se hizo. Pulsar una abre esa solicitud.",
      side: "top",
      tab: "solicitudes",
      before: () => {
        handlers.openFirstSolicitud();
        window.setTimeout(() => clickOpen("[data-tour='sol-historial']"), 60);
      },
    },
    ],
    denuncias: [
    {
      selector: "[data-tour='den-categoria']",
      title: "Categoría",
      text: "Comentarios, obras o abuso general.",
      side: "bottom",
      tab: "denuncias",
      expand: true,
    },
    {
      selector: "[data-tour='den-filtros-estado']",
      title: "Estado",
      text: "Pendiente, en proceso, en investigación, reactivación, aprobada, denegada o completada.",
      side: "bottom",
      tab: "denuncias",
      expand: true,
    },
    {
      selector: "[data-tour='den-filtros-gestor']",
      title: "Responsable",
      text: "Ana, Paula o Silvia. Así se ve quién tiene el expediente.",
      side: "bottom",
      tab: "denuncias",
      expand: true,
    },
    {
      selector: "[data-tour='den-caso-estado']",
      title: "Estado de esta denuncia",
      text: "El cambio queda en el historial. Revisar abre pruebas, notas y sanción.",
      side: "bottom",
      tab: "denuncias",
      expand: true,
    },
    ],
    buzon: [
    {
      selector: "[data-tour='buz-filtros']",
      title: "La bandeja",
      text: "Pendiente, gestionando o cerrado, y leídas o no leídas. Cada mensaje es una línea.",
      side: "bottom",
      tab: "buzon",
    },
    {
      selector: "[data-tour='buz-estado']",
      title: "Estado del hilo",
      text: "Pendiente, gestionando o cerrado. Gestionando avisa de que ya hay alguien en ello.",
      side: "bottom",
      tab: "buzon",
      expand: true,
      before: handlers.openFirstBuzon,
    },
    {
      selector: "[data-tour='buz-nota']",
      title: "Nota interna",
      text: "Se guarda en el hilo con tu nombre, para el resto del equipo. El @ abre el perfil para dar K-oins.",
      side: "top",
      tab: "buzon",
      before: handlers.openFirstBuzon,
    },
    ],
    aportaciones: [
    {
      selector: "[data-tour='apo-origen']",
      title: "De dónde es",
      text: "Quien sube la foto indica si es álbum, tour, evento u otra colección, el nombre, el grupo y el miembro. Aquí lo ves en la ficha.",
      side: "bottom",
      tab: "aportaciones",
    },
    {
      selector: "[data-tour='apo-filtros-estado']",
      title: "Decisión",
      text: "En proceso mientras la comparas. Aprobada si la foto entra. Denegada si no sirve.",
      side: "bottom",
      tab: "aportaciones",
      expand: true,
    },
    {
      selector: "[data-tour='apo-filtros-gestor']",
      title: "Quién la revisa",
      text: "Ana, Paula o Silvia, para no descargar la misma dos veces.",
      side: "bottom",
      tab: "aportaciones",
      expand: true,
    },
    {
      selector: "[data-tour='apo-caso-estado']",
      title: "Estado de esta foto",
      text: "La decisión de esta aportación. Revisar abre la imagen para descargarla y subirla al catálogo.",
      side: "bottom",
      tab: "aportaciones",
      expand: true,
    },
    ],
  };

  return all[id as AdminTourId] ?? [];
}

export function startAdminTour(id: string, handlers: AdminTourHandlers) {
  const steps = stepsFor(id, handlers);
  if (!steps.length) return;
  active?.destroy();
  collapseSelect();
  clickedOpen.clear();
  touring = false;
  handlers.openTab(id);
  touring = true;

  const driveSteps: DriveStep[] = steps.map((step) => ({
    element: () => {
      if (step.tab) handlers.openTab(step.tab);
      step.before?.();
      return document.querySelector(step.selector) as Element;
    },
    disableActiveInteraction: true,
    skipMissingElement: true,
    waitForElement: 2200,
    onHighlighted: step.expand
      ? (el, _step, { driver: drv }) => {
          expandSelect(el);
          window.requestAnimationFrame(() => drv.refresh());
        }
      : undefined,
    onDeselected: step.expand ? (el) => collapseSelect(el) : undefined,
    popover: {
      title: step.title,
      description: step.text,
      side: step.side ?? "bottom",
      align: "start",
    },
  }));

  const tour = driver({
    animate: true,
    smoothScroll: true,
    allowClose: true,
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 12,
    popoverClass: "mkb-tour",
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Cerrar",
    disableActiveInteraction: true,
    skipMissingElement: true,
    waitForElement: 2200,
    steps: driveSteps,
    onPopoverRender: (popover, opts) => {
      const index = opts.index ?? opts.state.activeIndex;
      const last = index != null && index >= steps.length - 1;
      popover.nextButton.textContent = last ? "Cerrar" : "Siguiente";
    },
    onDestroyed: () => {
      touring = false;
      collapseSelect();
      clickedOpen.clear();
      if (active === tour) active = null;
    },
  });

  active = tour;
  const firstSelector = steps[0]?.selector;
  const startedAt = Date.now();
  const begin = () => {
    if (active !== tour) return;
    const ready = !firstSelector || document.querySelector(firstSelector);
    if (ready || Date.now() - startedAt > 8000) {
      tour.drive(0);
      return;
    }
    window.setTimeout(begin, 150);
  };
  begin();
}
