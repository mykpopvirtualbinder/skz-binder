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
};

export type AdminTourHandlers = {
  openTab: (id: string) => void;
  showUserCard: () => void;
  hideUserCard: () => void;
  openFirstSolicitud: () => void;
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
      title: "Título y categoría",
      text: "El título de la obra y si es arte, fanfic o multimedia. En una continuación de fanfic el título se rellena solo.",
      side: "bottom",
      tab: "publicar",
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
      text: "El archivo principal y la imagen de portada. Si es +18, márcalo antes de publicar.",
      side: "top",
      tab: "publicar",
      before: handlers.showArtworkFields,
    },
    {
      selector: "[data-tour='pub-publicar']",
      title: "Publicar",
      text: "Este botón la deja visible en la galería. En fanfics, el texto en español se traduce solo: espera unos segundos.",
      side: "top",
      tab: "publicar",
    },
    ],
    catalogo: [
    {
      selector: "[data-tour='cat-grupo']",
      title: "Grupo",
      text: "Nombre y logo son lo que ve la gente en el alta y en el perfil. El slug es interno. Abajo, el buscador filtra la lista por nombre.",
      side: "bottom",
      tab: "catalogo",
    },
    {
      selector: "[data-tour='cat-miembro']",
      title: "Miembro",
      text: "Elige el grupo, el nombre del idol y su foto. En la lista puedes buscar por grupo y, aparte, por el nombre del miembro.",
      side: "bottom",
      tab: "catalogo",
    },
    ],
    publicidad: [
    {
      selector: "[data-tour='ad-form']",
      title: "La campaña",
      text: "Título, enlace, hueco (sidebar, tablet o móvil), dispositivo, sección, prioridad y fechas. Márcala activa y créala.",
      side: "bottom",
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
      selector: "[data-tour='sol-filtros']",
      title: "Filtros de solicitudes",
      text: "Estado, quién la lleva (Ana, Paula o Silvia), el nombre de quien escribió, y leídas o no leídas.",
      side: "bottom",
      tab: "solicitudes",
    },
    {
      selector: "[data-tour='sol-leido']",
      title: "Leída o no",
      text: "Una sola, las seleccionadas o todas las de la lista, como leídas o como no leídas.",
      side: "bottom",
      tab: "solicitudes",
    },
    {
      selector: "[data-tour='sol-card']",
      title: "La solicitud",
      text: "En el móvil es una línea: nombre, estado y Abrir. Dentro están el mensaje, los adjuntos, el estado, quién la gestiona, aprobar, denegar y publicar su obra.",
      side: "bottom",
      tab: "solicitudes",
      before: handlers.openFirstSolicitud,
    },
    ],
    denuncias: [
    {
      selector: "[data-tour='den-filtros']",
      title: "Denuncias",
      text: "Categoría, estado, responsable, usuario y lectura. Revisar abre el expediente: pruebas, notas y sanción. El historial lista las de esa persona.",
      side: "bottom",
      tab: "denuncias",
    },
    ],
    buzon: [
    {
      selector: "[data-tour='buz-filtros']",
      title: "El buzón",
      text: "Pendiente, gestionando o cerrado, y leídas o no leídas. Cada mensaje es una línea. Abrir entra en el hilo.",
      side: "bottom",
      tab: "buzon",
    },
    {
      selector: "[data-tour='buz-list']",
      title: "El hilo",
      text: "Dentro: el mensaje, el estado, una nota interna con tu nombre para el equipo, y el @ para abrir el perfil y dar K-oins.",
      side: "top",
      tab: "buzon",
    },
    ],
    aportaciones: [
    {
      selector: "[data-tour='apo-filtros']",
      title: "Aportaciones",
      text: "Igual que las solicitudes: estado, quién la revisa y lectura. Revisar abre la foto para descargarla y subirla al catálogo antes de aprobarla.",
      side: "bottom",
      tab: "aportaciones",
    },
    ],
  };

  return all[id as AdminTourId] ?? [];
}

export function startAdminTour(id: string, handlers: AdminTourHandlers) {
  const steps = stepsFor(id, handlers);
  if (!steps.length) return;
  active?.destroy();

  const driveSteps: DriveStep[] = steps.map((step) => ({
    element: () => {
      if (step.tab) handlers.openTab(step.tab);
      step.before?.();
      return document.querySelector(step.selector) as Element;
    },
    disableActiveInteraction: true,
    skipMissingElement: true,
    waitForElement: 1500,
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
    waitForElement: 1500,
    steps: driveSteps,
    onDestroyed: () => {
      if (active === tour) active = null;
    },
  });

  active = tour;
  tour.drive(0);
}
