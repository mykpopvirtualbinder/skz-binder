"use client";

import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "@/app/admin-panel/admin-tour.css";

export const USER_TOUR_KEY = "mkb-user-tour";

export const USER_TOUR_PATH: Record<string, string> = {
  inicio: "/",
  biblioteca: "/library",
  albumes: "/albums",
  merch: "/merch",
  market: "/market",
  fanart: "/fanart",
  fanzone: "/fanzone",
  shop: "/shop",
  binders: "/binders",
};

type Side = "top" | "right" | "bottom" | "left";

type TourStep = {
  selector: string;
  title: string;
  text: string;
  side?: Side;
  expand?: boolean;
  /** Abre este menú al iluminar el paso y lo cierra al salir. */
  reveal?: { button: string; menu: string };
  /** Si el selector está oculto, usa este otro (por ejemplo la barra de móvil). */
  fallback?: string;
};

const openedMenus = new Set<HTMLSelectElement>();
let scanTimer: number | null = null;
let active: Driver | null = null;

function stopScan() {
  if (scanTimer != null) window.clearInterval(scanTimer);
  scanTimer = null;
}

function visibleEl(selector: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll(selector));
  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) continue;
    const box = el.getBoundingClientRect();
    if (box.width > 12 && box.height > 12) return el;
  }
  return null;
}

function resolveStep(step: TourStep): Element | null {
  return visibleEl(step.selector) || (step.fallback ? visibleEl(step.fallback) : null);
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

function openReveal(step: TourStep) {
  if (!step.reveal) return;
  if (visibleEl(step.reveal.menu)) return;
  visibleEl(step.reveal.button)?.click();
}

function closeReveal(step: TourStep) {
  if (!step.reveal) return;
  if (!visibleEl(step.reveal.menu)) return;
  visibleEl(step.reveal.button)?.click();
}

function closeHeaderMenus() {
  closeReveal({ selector: "", title: "", text: "", reveal: { button: "[data-tour='hdr-lang']", menu: "[data-tour='hdr-lang-menu']" } });
  closeReveal({ selector: "", title: "", text: "", reveal: { button: "[data-tour='hdr-theme']", menu: "[data-tour='hdr-theme-menu']" } });
}

const adsStep = (text: string): TourStep => ({
  selector: "[data-tour='site-ads']",
  title: "Anuncios",
  text,
  side: "left",
});

const stepsFor = (id: string): TourStep[] => {
  const all: Record<string, TourStep[]> = {
    inicio: [
      {
        selector: "[data-tour='hdr-nav']",
        fallback: "[data-tour='hdr-tabbar']",
        title: "Por dónde se entra",
        text: "Home, Biblioteca, Álbumes, Merch, Market, Fanart, Fanzone y Shop. En el móvil los principales se quedan abajo y el resto sale en Más.",
        side: "bottom",
      },
      {
        selector: "[data-tour='hdr-search']",
        title: "Buscador",
        text: "Escribe un grupo, un álbum o un miembro y te lleva al catálogo. Sirve para saltar directo a lo que estás buscando.",
        side: "bottom",
      },
      {
        selector: "[data-tour='hdr-lang']",
        title: "Idioma",
        text: "La web habla varios idiomas. Ábrelo cuando quieras y elige el tuyo: menús, botones y textos cambian al momento.",
        side: "bottom",
        reveal: { button: "[data-tour='hdr-lang']", menu: "[data-tour='hdr-lang-menu']" },
      },
      {
        selector: "[data-tour='hdr-theme']",
        title: "Temas",
        text: "Aquí cambias el color de toda la web. Algunos temas son un extra VIP: si te suscribes, el binder se viste como a ti te gusta.",
        side: "bottom",
        reveal: { button: "[data-tour='hdr-theme']", menu: "[data-tour='hdr-theme-menu']" },
      },
      {
        selector: "[data-tour='home-market']",
        title: "El mercado te espera",
        text: "Este cartel te lleva a cambios y ventas entre fans. Antes de publicar, mira el aviso naranja: así el trato queda claro para las dos partes.",
        side: "bottom",
      },
      {
        selector: "[data-tour='home-vip']",
        title: "Hazte VIP",
        text: "La corona abre la tienda. Con VIP pagas menos K-oins, tienes más binders y desbloqueas temas. Es el atajo si coleccionas en serio.",
        side: "bottom",
      },
      {
        selector: "[data-tour='home-guide']",
        title: "Esta guía",
        text: "Si un día no recuerdas dónde estaba algo, vuelve aquí. También vive en el footer, dentro de Soporte.",
        side: "top",
      },
      {
        selector: "[data-tour='home-stats']",
        title: "El fandom en números",
        text: "Colecciones, trades y movimiento reciente. Es la foto de cómo va la comunidad ahora mismo.",
        side: "top",
      },
      {
        selector: "[data-tour='home-artist']",
        title: "Artista del mes",
        text: "Destacamos a quien está llenando Fanart de cosas bonitas. Si tú también creas, más adelante verás cómo pedir el perfil de artista.",
        side: "top",
      },
    ],
    biblioteca: [
      {
        selector: "[data-tour='lib-search']",
        title: "Busca tu photocard",
        text: "Escribe grupo, álbum o miembro. La parrilla de abajo se queda solo con lo que coincide.",
        side: "bottom",
      },
      {
        selector: "[data-tour='lib-sort']",
        title: "Orden",
        text: "Por defecto, por álbum, por fecha en tu stock, por precio o por estado. Elige cómo quieres ver la colección.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='lib-status']",
        title: "Qué tienes y qué te falta",
        text: "Filtra por en stock, repetida, wishlist o la que estás buscando. Así el binder y la lista hablan el mismo idioma.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='lib-group']",
        title: "Grupo",
        text: "Empieza por el grupo. A partir de aquí el resto de filtros se estrecha a esa familia.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='lib-kind']",
        title: "Tipo de colección",
        text: "Álbum, Season's Greetings, evento, membership… Cuando eliges uno, aparecen el nombre de la colección y la versión. Si lo dejas en Todos, esos dos se esconden para no estorbar.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='lib-pob']",
        title: "Regular o POB",
        text: "Separa las photocards de álbum de los beneficios de tienda (POB). Solo sale cuando tiene sentido para esa colección.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='lib-member']",
        title: "Miembro",
        text: "Uno, OT8 o el que estés cazando. El nombre sale como lo tenemos en el catálogo.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='lib-type']",
        title: "Qué pieza es",
        text: "Photocard, polaroid, postal… para no mezclar formatos en la misma búsqueda.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='lib-grid']",
        title: "La carta",
        text: "Pincha una y se abre su ficha: anverso, reverso, stock y estado. Si la photocard ya existe, Aportar anverso o reverso solo te pide la foto: el grupo, la colección y el miembro viajan solos.",
        side: "top",
      },
      {
        selector: "[data-tour='lib-colab']",
        title: "¡Aporta un grupo!",
        text: "Úsalo cuando la photocard no está en el catálogo, o para mandar un lote. Ahí sí pedimos tipo, nombre, grupo y miembro, más un archivo de hasta 8 MB (PNG, JPG o WEBP) o un enlace. Escape o un clic fuera cierra la ventana.",
        side: "left",
      },
      adsStep("A los lados (y en el móvil, arriba y abajo) verás la campaña del momento. Es el mismo anuncio: solo cambia el tamaño según la pantalla."),
    ],
    albumes: [
      {
        selector: "[data-tour='albums-tabs']",
        title: "Ediciones e inclusiones",
        text: "Ediciones es el álbum en sí. Inclusiones abre las piezas que venían dentro, con el mismo estilo de ficha que la biblioteca.",
        side: "bottom",
      },
      {
        selector: "[data-tour='album-group']",
        title: "Grupo",
        text: "Filtra las ediciones por grupo. El resto de listas se ajusta a lo que elijas.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='album-region']",
        title: "Región",
        text: "Corea, Japón y el resto de ediciones. Muy útil cuando el mismo álbum salió en varios países.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='album-title']",
        title: "Álbum",
        text: "El nombre de la colección. Si una carpeta todavía está vacía, al entrar verás la invitación para aportar, no un callejón sin salida.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='album-kind']",
        title: "Tipo de edición",
        text: "Limited, regular, digipack… lo que distinga esa tirada.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='album-sort']",
        title: "Ordenar",
        text: "Por defecto, por álbum, por la fecha en tu stock, por precio o por estado.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='merch-stock']",
        title: "Tu stock",
        text: "Estas pastillas cruzan el catálogo con lo que ya marcaste: lo tienes, te falta o está repetido.",
        side: "top",
      },
      {
        selector: "[data-tour='merch-banner']",
        title: "Cómo vais de colección",
        text: "La barra resume el avance. Entra en un álbum para ver portadas, versiones y lo que incluye.",
        side: "bottom",
      },
      adsStep("El anuncio de los lados es la misma campaña en escritorio, tablet y móvil. La web elige el formato que cabe en tu pantalla."),
    ],
    merch: [
      {
        selector: "[data-tour='merch-tabs']",
        title: "Catálogo o tu inventario",
        text: "Catálogo es todo el merch. Tu inventario es lo que ya marcaste como tuyo. Cambia de pestaña y los filtros de abajo siguen contigo.",
        side: "bottom",
      },
      {
        selector: "[data-tour='merch-group']",
        title: "Grupo",
        text: "Empieza por aquí si coleccionas de varios grupos y no quieres mezclar lightsticks con álbumes de otro.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='merch-kind']",
        title: "Qué merch es",
        text: "Lightstick, ropa, season's… Al elegir un tipo aparece otro desplegable con las colecciones de ese tipo.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='merch-stock']",
        title: "Estado",
        text: "Filtra por lo que tienes, lo que buscas o lo repetido. Así preparas trades sin repasar la parrilla entera.",
        side: "top",
      },
      {
        selector: "[data-tour='merch-banner']",
        title: "Progreso",
        text: "Un vistazo a cuánto llevas. Si una pieza no existe todavía, el botón de aportar abre el mismo formulario que en la biblioteca.",
        side: "bottom",
      },
      adsStep("Merch también deja sitio a una campaña. Si no ves columnas a los lados, estás en una pantalla estrecha y el anuncio se coloca en el contenido."),
    ],
    market: [
      {
        selector: "[data-tour='market-toolbar']",
        title: "El mercado",
        text: "Cambios (WTT) y ventas (WTS) entre fans. Lee el aviso naranja: es la regla del juego antes de ofrecer o pedir.",
        side: "bottom",
      },
      {
        selector: "[data-tour='market-mode']",
        title: "Ofrezco o busco",
        text: "En cambios puedes mirar lo que la gente ofrece o lo que está buscando. La lista de debajo se da la vuelta según esto.",
        side: "bottom",
        expand: true,
      },
      {
        selector: "[data-tour='market-filters']",
        title: "Filtros del anuncio",
        text: "Tipo de pieza (photocard, inclusión, álbum, merch) y, al elegir uno, los desplegables de grupo, miembro, gira o evento. No hace falta rellenar lo que no aplica.",
        side: "bottom",
      },
      {
        selector: "[data-tour='market-tabs']",
        title: "Cambios y ventas",
        text: "WTT es intercambio. WTS es venta. Cada pestaña tiene su formulario para publicar y su forma de contactar.",
        side: "bottom",
      },
      adsStep("El mercado también muestra la campaña activa, adaptada a tu pantalla."),
    ],
    fanart: [
      {
        selector: "[data-tour='fanart-main']",
        title: "El muro de arte",
        text: "Dibujos, 3D, artesanía, fanfics y multimedia del fandom. Entra en una obra para verla grande, dejar un corazón o comentar.",
        side: "bottom",
      },
      {
        selector: "[data-tour='fanart-upload']",
        title: "Sube o pide ser artista",
        text: "Si ya eres artista, este botón publica. Si todavía no, se abre la solicitud: nombre, contacto y un mensaje. El equipo lo revisa y, cuando te aprueban, el perfil lleva el pincel.",
        side: "left",
      },
      {
        selector: "[data-tour='fanart-filters']",
        title: "Categorías",
        text: "Estas pastillas cambian el muro: 2D, 3D, artesanía, fanfics o multimedia. En el móvil viven dentro del botón de filtros.",
        side: "bottom",
      },
      adsStep("Fanart deja un hueco a los anuncios sin tapar las obras. Misma campaña, formato según el dispositivo."),
    ],
    fanzone: [
      {
        selector: "[data-tour='fanzone-feed']",
        title: "La plaza",
        text: "Posts del fandom, con foto o vídeo. La primera vez te pedimos aceptar las normas: cuidado, respeto y nada que no quieras ver en tu timeline.",
        side: "left",
      },
      {
        selector: "[data-tour='fanzone-favs']",
        title: "Solo favoritos",
        text: "Actívalo para quedarte con la gente que sigues. Vuelve a pinchar y regresa el timeline completo.",
        side: "bottom",
      },
      {
        selector: "[data-tour='fanzone-composer']",
        title: "Publica",
        text: "Escribe, menciona con @ y adjunta una foto. Publicar pide sesión. En cada post puedes responder, repostear o denunciar si algo no pinta bien.",
        side: "bottom",
      },
      adsStep("En Fanzone el anuncio acompaña al timeline, nunca lo sustituye."),
    ],
    shop: [
      {
        selector: "[data-tour='shop-koins']",
        title: "Tus K-oins",
        text: "Es la moneda de la tienda. El saldo de arriba es el que tienes ahora. VIP paga menos por lo mismo: el precio con corona es el rebajado.",
        side: "bottom",
      },
      {
        selector: "[data-tour='shop-tabs']",
        title: "Qué se puede comprar",
        text: "Suscripción VIP, binders, páginas, separadores y paquetes de K-oins. La suscripción es la que abre precios VIP, más binders y temas extra.",
        side: "bottom",
      },
      {
        selector: "[data-tour='shop-catalog']",
        title: "Elige y listo",
        text: "Cada tarjeta dice lo que incluye y el precio. Si ves dos cifras, la de la corona es la tuya en cuanto seas VIP.",
        side: "top",
      },
    ],
    binders: [
      {
        selector: "[data-tour='binders-title']",
        title: "Tus binders",
        text: "Cada binder es un álbum virtual. El número de al lado es cuántos llevas y cuántos te caben. VIP sube ese tope.",
        side: "bottom",
      },
      {
        selector: "[data-tour='binders-create']",
        title: "Crear uno nuevo",
        text: "Esta tarjeta discontinua añade otro binder, si todavía te queda hueco. Dentro colocas páginas, separadores y las photocards de la biblioteca. Hay que entrar con tu cuenta para crearlo.",
        side: "top",
      },
    ],
  };
  return all[id] ?? [];
};

function prepare(id: string) {
  if (id === "biblioteca" && !visibleEl(".library-filters-grid")) {
    visibleEl(".library-mobile-filters-toggle")?.click();
  }
  if ((id === "fanart" || id === "market" || id === "merch" || id === "albumes") && !visibleEl(".page-filters-panel")) {
    const toggle = visibleEl(".library-mobile-filters-toggle");
    toggle?.click();
  }
}

export function startUserTour(id: string) {
  const steps = stepsFor(id);
  if (!steps.length) return;
  active?.destroy();
  collapseSelect();
  closeHeaderMenus();

  const driveSteps: DriveStep[] = steps.map((step) => ({
    element: () => {
      if (step.selector === "[data-tour='site-ads']") {
        const slots = Array.from(document.querySelectorAll(".ad-slot-card"));
        for (const el of slots) {
          const box = el.getBoundingClientRect();
          if (box.width > 20 && box.height > 20) return el;
        }
      }
      return resolveStep(step) as Element;
    },
    disableActiveInteraction: true,
    skipMissingElement: true,
    waitForElement: 2200,
    onHighlighted: (el, _step, { driver: drv }) => {
      openReveal(step);
      if (step.expand) expandSelect(el);
      window.requestAnimationFrame(() => drv.refresh());
    },
    onDeselected: (el) => {
      if (step.expand) collapseSelect(el);
      closeReveal(step);
    },
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
      const at = opts.index ?? opts.state.activeIndex;
      const last = at != null && at >= steps.length - 1;
      popover.nextButton.textContent = last ? "Cerrar" : "Siguiente";
    },
    onDestroyed: () => {
      collapseSelect();
      closeHeaderMenus();
      if (active === tour) active = null;
    },
  });

  active = tour;
  prepare(id);
  const startedAt = Date.now();
  const begin = () => {
    if (active !== tour) return;
    const ready = resolveStep(steps[0]) || (steps[0].selector === "[data-tour='site-ads']" && document.querySelector("[data-tour='site-ads']"));
    if (ready || Date.now() - startedAt > 8000) {
      tour.drive(0);
      return;
    }
    window.setTimeout(begin, 150);
  };
  begin();
}
