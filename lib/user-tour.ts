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
  perfil: "/me",
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
  /** Clic que abre el elemento de este paso (modal, pestaña, desplegable). */
  clickBefore?: string;
  /** Espera extra tras el clic, en ms. */
  wait?: number;
  /** Clic al salir del paso, por ejemplo para cerrar un modal. */
  closeAfter?: string;
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
      {
        selector: "[data-tour='hdr-account']",
        fallback: "[data-tour='hdr-avatar']",
        title: "Tu cuenta",
        text: "Entrar abre tu sesión. Cuando ya estás dentro, el avatar lleva a tu perfil: foto, nombre, grupos y el engranaje de ajustes. El sobre, al lado, es el centro de notificaciones.",
        side: "bottom",
      },
      {
        selector: "[data-tour='hdr-mail']",
        title: "Notificaciones",
        text: "El numerito del sobre es lo que no has leído. Ábrelo y caes en tu perfil, pestaña de avisos: trades, comentarios y respuestas del equipo.",
        side: "bottom",
      },
      {
        selector: "[data-tour='site-footer']",
        title: "El pie de la web",
        text: "Abajo del todo: legal, reglas del mercado, privacidad, esta guía, preguntas frecuentes y el botón para reportar un abuso. En todas las secciones, merch incluido.",
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
        text: "Un miembro, una unit o una OT (el grupo entero: en unos grupos son 4, en otros 7 u 8). El nombre sale como lo tenemos en el catálogo.",
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
        title: "La parrilla",
        text: "Cada carta es una photocard. Debajo tienes el stock, el giro de cara y la i de resumen. Pinchar la foto abre la ficha completa.",
        side: "top",
      },
      {
        selector: "[data-tour='lib-card-stock']",
        title: "Desplegable de stock",
        text: "Este botón abre el stock de esa carta sin salir de la parrilla. El número es cuántas llevas entre tengo, cambio, venta y en camino.",
        side: "top",
      },
      {
        selector: "[data-tour='lib-stock-panel']",
        title: "Tengo, cambio, venta…",
        text: "Suma o resta: tengo, WTT (cambio), WTS (venta), en camino y wishlist. Guardar lo escribe en tu colección. Cancelar lo deja como estaba.",
        side: "left",
        clickBefore: "[data-tour='lib-card-stock']",
        wait: 350,
        closeAfter: "[data-tour='lib-card-stock']",
      },
      {
        selector: "[data-tour='lib-card-info']",
        title: "La i de la carta",
        text: "Voltea la miniatura y enseña un resumen: grupo, colección, miembro y estado. La ficha grande es pinchando la foto.",
        side: "top",
      },
      {
        selector: "[data-tour='pc-modal']",
        title: "Ficha de la photocard",
        text: "Aquí ves la pieza entera. Las flechas pasan a la anterior y a la siguiente. La X, Escape o un clic fuera cierran.",
        side: "left",
        clickBefore: "[data-tour='lib-card']",
        wait: 500,
      },
      {
        selector: "[data-tour='pc-modal-meta']",
        title: "De dónde es",
        text: "Grupo, colección, versión, miembro y tipo (selfie, unit u OT). Si ya está en un binder, también sale el pin.",
        side: "bottom",
      },
      {
        selector: "[data-tour='pc-modal-face']",
        title: "Anverso, reverso y giro",
        text: "Cambia de cara y rota la foto si llegó torcida. La lupa la abre a tamaño grande.",
        side: "left",
      },
      {
        selector: "[data-tour='pc-modal-stock']",
        title: "Stock dentro de la ficha",
        text: "Los mismos contadores que el desplegable de la carta, más el precio y las notas. Guardar actualiza tu inventario.",
        side: "left",
      },
      {
        selector: "[data-tour='pc-modal-contribute']",
        title: "Aportar esta photocard",
        text: "Front o Back abre una ventana solo para la foto. El origen ya viene del catálogo. Si la carta no existe, usa ¡Aporta un grupo!",
        side: "left",
        closeAfter: "[data-tour='pc-modal-close']",
      },
      {
        selector: "[data-tour='lib-colab']",
        title: "¡Aporta un grupo!",
        text: "Para una photocard que no está, o un lote. Pedimos tipo, nombre, grupo y miembro, más un archivo de hasta 8 MB (PNG, JPG o WEBP) o un enlace. Escape o un clic fuera cierra la ventana.",
        side: "left",
      },
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
        title: "Tu stock en ediciones",
        text: "Estas pastillas cruzan el catálogo con lo que ya marcaste: lo tienes, te falta o está repetido.",
        side: "top",
      },
      {
        selector: "[data-tour='merch-info']",
        title: "Ficha de la edición",
        text: "La i abre el álbum: portada, versión y el stock de esa pieza. Es el mismo tipo de ventana que en merch.",
        side: "left",
      },
      {
        selector: "[data-tour='merch-modal']",
        title: "Info del álbum",
        text: "Grupo, edición y los contadores de stock. Guardar los deja en tu inventario. La X cierra.",
        side: "left",
        clickBefore: "[data-tour='merch-info']",
        wait: 500,
      },
      {
        selector: "[data-tour='merch-modal-stock']",
        title: "Stock de la edición",
        text: "Tengo, cambio, venta y en camino. Lo mismo que verás en la photocard, aplicado a esta edición.",
        side: "left",
        closeAfter: "[data-tour='merch-modal-close']",
      },
      {
        selector: "[data-tour='albums-inclusions']",
        title: "Inclusiones",
        text: "Esta pestaña son las photocards y extras que venían dentro. A partir de aquí la parrilla es la de la biblioteca.",
        side: "bottom",
      },
      {
        selector: "[data-tour='lib-card-stock']",
        title: "Stock de la inclusión",
        text: "Cada pieza tiene su desplegable: tengo, WTT, WTS, en camino y wishlist.",
        side: "top",
        clickBefore: "[data-tour='albums-inclusions']",
        wait: 1400,
      },
      {
        selector: "[data-tour='lib-stock-panel']",
        title: "El desplegable",
        text: "Ajusta las cantidades y guarda. Cancelar no toca nada.",
        side: "left",
        clickBefore: "[data-tour='lib-card-stock']",
        wait: 350,
        closeAfter: "[data-tour='lib-card-stock']",
      },
      {
        selector: "[data-tour='pc-modal']",
        title: "Ficha de la inclusión",
        text: "Pinchar la foto abre la ficha: caras, miembro, versión y stock. Las flechas recorren la lista.",
        side: "left",
        clickBefore: "[data-tour='lib-card']",
        wait: 500,
      },
      {
        selector: "[data-tour='pc-modal-stock']",
        title: "Stock en la ficha",
        text: "Aquí editas el inventario de esa inclusión y, si quieres, dejas una nota o un precio.",
        side: "left",
        closeAfter: "[data-tour='pc-modal-close']",
      },
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
        selector: "[data-tour='go-binders']",
        title: "Mis binders",
        text: "Este atajo te lleva a tus binders sin pasar por el menú. Está en merch, en la biblioteca y en álbumes.",
        side: "left",
      },
      {
        selector: "[data-tour='merch-card-stock']",
        title: "Stock de la pieza",
        text: "Tengo, en camino, WTT y WTS suman de uno en uno. La estrella la mete o la saca de la wishlist.",
        side: "top",
      },
      {
        selector: "[data-tour='merch-info']",
        title: "Info del item",
        text: "La i abre la ficha: foto, datos y los contadores para editarlos con calma.",
        side: "left",
      },
      {
        selector: "[data-tour='merch-modal']",
        title: "Ficha de merch",
        text: "La misma ventana que en una photocard. Flechas para la pieza anterior y la siguiente. La X cierra.",
        side: "left",
        clickBefore: "[data-tour='merch-info']",
        wait: 500,
      },
      {
        selector: "[data-tour='merch-modal-stock']",
        title: "Stock en la ficha",
        text: "Ajusta tengo, cambio, venta y en camino, y guarda. Wishlist se marca desde la tarjeta.",
        side: "left",
        closeAfter: "[data-tour='merch-modal-close']",
      },
      {
        selector: "[data-tour='merch-tab-inventory']",
        title: "Mi inventario",
        text: "Aquí solo queda lo que ya marcaste como tuyo. El catálogo sigue siendo la lista completa.",
        side: "bottom",
      },
      {
        selector: "[data-tour='site-footer']",
        title: "Footer",
        text: "Merch también cierra con el pie de la web: guía, normas, privacidad y reportar.",
        side: "top",
      },
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
        text: "WTT es intercambio. WTS es venta. Publicar un anuncio pide sesión y una pieza de tu binder o de tu inventario.",
        side: "bottom",
      },
      {
        selector: "[data-tour='market-wtt']",
        title: "WTT, el cambio",
        text: "Ves lo que ofrecen o lo que buscan. En cada anuncio, Contactar abre el mensaje y, si quieres, las cartas que propones.",
        side: "bottom",
      },
      {
        selector: "[data-tour='market-contact-btn']",
        title: "Contactar",
        text: "Escribe al fan, adjunta lo que ofreces y envía. La conversación sigue en tus notificaciones.",
        side: "top",
        clickBefore: "[data-tour='market-wtt']",
        wait: 400,
      },
      {
        selector: "[data-tour='market-contact']",
        title: "El mensaje de cambio",
        text: "Eliges qué cartas pones encima de la mesa, puedes sumar K-oins y dejas un texto. Enviar lo manda a la otra persona.",
        side: "left",
        clickBefore: "[data-tour='market-contact-btn']",
        wait: 500,
        closeAfter: "[data-tour='market-contact-close']",
      },
      {
        selector: "[data-tour='market-wts']",
        title: "WTS, la venta",
        text: "Aquí los anuncios tienen precio. Comprar reserva el trato. Ofertar propone otro precio o un cambio.",
        side: "bottom",
      },
      {
        selector: "[data-tour='market-buy']",
        title: "Comprar u ofertar",
        text: "Comprar abre el mensaje de compra, ya escrito si no quieres añadir nada. Ofertar es para negociar. Hace falta estar dentro de tu cuenta.",
        side: "top",
        clickBefore: "[data-tour='market-wts']",
        wait: 400,
      },
      {
        selector: "[data-tour='market-contact']",
        title: "El mensaje de compra",
        text: "Puedes dejar el texto que ya viene o escribir el tuyo. Enviar se lo manda a quien vende. Hasta que no pulsas enviar, no sale nada.",
        side: "left",
        clickBefore: "[data-tour='market-buy']",
        wait: 500,
        closeAfter: "[data-tour='market-contact-close']",
      },
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
      {
        selector: "[data-tour='fanart-like']",
        title: "Me gusta",
        text: "El corazón de la tarjeta suma un like sin abrir la obra. Pide sesión. El número de al lado es el total.",
        side: "top",
      },
      {
        selector: "[data-tour='fanart-card']",
        title: "Abrir la obra",
        text: "Pincha la tarjeta para verla grande. Si es vídeo, se reproduce. Si es fanfic, se lee por capítulos.",
        side: "top",
      },
      {
        selector: "[data-tour='fanart-view']",
        title: "La obra en grande",
        text: "Foto, vídeo o texto. Ver en grande la pone a pantalla completa. Contactar lleva al perfil de quien la hizo.",
        side: "left",
        clickBefore: "[data-tour='fanart-card']",
        wait: 500,
      },
      {
        selector: "[data-tour='fanart-translate']",
        title: "Traducir",
        text: "En un fanfic, este idioma traduce título y capítulos. En un dibujo no aparece: no hay texto que traducir.",
        side: "bottom",
      },
      {
        selector: "[data-tour='fanart-report']",
        title: "Denunciar",
        text: "Si algo no debería estar, denuncia desde aquí. El equipo lo recibe en el panel. Hace falta una cuenta.",
        side: "left",
      },
      {
        selector: "[data-tour='fanart-thread']",
        title: "Comentarios",
        text: "Lee lo que ha dicho la gente y deja el tuyo al final. También puedes denunciar un comentario suelto. La X cierra la obra.",
        side: "top",
        closeAfter: "[data-tour='fanart-close']",
      },
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
        text: "Escribe, menciona con @ y adjunta una foto o un vídeo. Publicar pide sesión.",
        side: "bottom",
      },
      {
        selector: "[data-tour='fanzone-media']",
        title: "Foto o vídeo",
        text: "El clip abre la galería. Vale una imagen o un vídeo corto. En las respuestas se puede adjuntar lo mismo.",
        side: "top",
      },
      {
        selector: "[data-tour='fanzone-actions']",
        title: "En cada post",
        text: "Comentar, repostear, dar me gusta y compartir. El nombre abre el perfil de esa persona.",
        side: "top",
      },
      {
        selector: "[data-tour='fanzone-report']",
        title: "Denunciar",
        text: "La banderita avisa al equipo si un post no debería estar. En un comentario hay otra igual. Hace falta sesión.",
        side: "left",
      },
      {
        selector: "[data-tour='site-footer']",
        title: "Footer",
        text: "Normas de la comunidad, privacidad y reportar un abuso viven aquí abajo, por si el post no bastaba con la banderita.",
        side: "top",
      },
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
        text: "Cada binder es un álbum virtual. Sin sesión, esta página te pide entrar. Con sesión ves la estantería: color, portadas y, al pinchar la miniatura, las páginas por dentro. VIP sube el tope.",
        side: "bottom",
      },
      {
        selector: "[data-tour='binders-create']",
        title: "Crear uno nuevo",
        text: "Esta tarjeta discontinua añade otro binder, si todavía te queda hueco. Hay que entrar con tu cuenta. VIP sube el máximo.",
        side: "top",
      },
      {
        selector: "[data-tour='binders-style']",
        title: "Personalizar la estantería",
        text: "El nombre se edita en el título. Los círculos cambian el color. Las caras (portada, contraportada e interiores) se suben aquí. Algunas son un extra VIP.",
        side: "top",
      },
      {
        selector: "[data-tour='binders-preview']",
        title: "Hojear sin editar",
        text: "Ver abre el binder como un libro: pasas páginas y miras las caras. Para colocar cartas, entra en la miniatura.",
        side: "top",
      },
      {
        selector: "[data-tour='binder-preview']",
        title: "El libro",
        text: "Aquí solo se mira. Las flechas pasan de página. La X vuelve a la estantería, donde sí se personaliza y se colocan photocards.",
        side: "left",
        clickBefore: "[data-tour='binders-preview']",
        wait: 600,
        closeAfter: "[data-tour='binder-preview-close']",
      },
      {
        selector: "[data-tour='binders-enter']",
        title: "Entrar al binder",
        text: "La miniatura abre el binder de verdad: páginas, bolsillos y las cuatro caras. Ahí se coloca la colección.",
        side: "top",
      },
      {
        selector: "[data-tour='binder-covers']",
        title: "Las cuatro caras",
        text: "Portada, interior delantero, interior trasero y contraportada. Pincha una y la decoras: color, borde e imagen.",
        side: "bottom",
        clickBefore: "[data-tour='binders-enter']",
        wait: 1600,
      },
      {
        selector: "[data-tour='binder-tools']",
        title: "Páginas y separadores",
        text: "El + añade una página de bolsillos. El marcador añade un separador. Al lado vas viendo cuántos te quedan del cupo. Guardar fija los cambios.",
        side: "bottom",
      },
      {
        selector: "[data-tour='binder-page']",
        title: "La página",
        text: "Cada hueco es un bolsillo. Pincha uno vacío para meter una photocard de tu biblioteca, o una que ya está para ver su ficha, su stock y moverla.",
        side: "top",
      },
    ],
    perfil: [
      {
        selector: "[data-tour='me-avatar']",
        fallback: "[data-tour='hdr-account']",
        title: "Tu foto",
        text: "Pincha el avatar para cambiarlo. Hay pack básico y extras VIP. Si no has entrado, este tour te deja en la puerta de login.",
        side: "bottom",
      },
      {
        selector: "[data-tour='me-tab-home']",
        title: "Inicio del perfil",
        text: "Tu colección, tu actividad y un resumen de cómo va tu binder. Las otras pestañas son grupos, fanzone y avisos.",
        side: "bottom",
      },
      {
        selector: "[data-tour='me-settings']",
        title: "Ajustes",
        text: "El engranaje abre nombre, bio y el resto de tu ficha. El correo se ve, pero no se cambia desde aquí.",
        side: "left",
      },
      {
        selector: "[data-tour='me-settings-panel']",
        title: "Personalizar el perfil",
        text: "Nombre visible, biografía y lo que quieras que vea el fandom. Guardar lo publica. La X cierra sin insistir.",
        side: "left",
        clickBefore: "[data-tour='me-settings']",
        wait: 400,
        closeAfter: "[data-tour='me-settings-close']",
      },
      {
        selector: "[data-tour='me-notices']",
        title: "Notificaciones",
        text: "Trades, comentarios, likes y avisos del equipo. El sobre del header trae aquí. Puedes marcarlas leídas.",
        side: "top",
        clickBefore: "[data-tour='me-tab-notices']",
        wait: 400,
      },
      {
        selector: "[data-tour='site-footer']",
        title: "Y el footer",
        text: "También desde el perfil llegas a la guía, las normas y el reporte de abuso.",
        side: "top",
      },
    ],
  };
  return all[id] ?? [];
};

function clickSel(selector?: string) {
  if (!selector) return;
  const el = document.querySelector(selector);
  if (el instanceof HTMLElement) el.click();
}

function shellOf(selector: string): Element | null {
  const el = document.querySelector(selector);
  if (!(el instanceof Element)) return null;
  return el.closest(
    "[data-tour='pc-modal'], [data-tour='merch-modal'], [data-tour='market-contact'], [data-tour='fanart-view'], [data-tour='me-settings-panel'], [data-tour='binder-preview'], [data-tour='lib-stock-panel']",
  );
}

function leaving(step: TourStep, other?: TourStep) {
  if (!step.closeAfter) return false;
  if (!other) return true;
  const shell = shellOf(step.selector);
  if (!shell) return true;
  const dest = document.querySelector(other.selector);
  return !dest || !shell.contains(dest);
}

const CLOSE_ON_EXIT = [
  "[data-tour='pc-modal-close']",
  "[data-tour='merch-modal-close']",
  "[data-tour='market-contact-close']",
  "[data-tour='fanart-close']",
  "[data-tour='me-settings-close']",
  "[data-tour='binder-preview-close']",
];

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

  const canEnterBinder = !!document.querySelector("[data-tour='binders-enter']");
  const waitFor = (step: TourStep) => {
    const openerMissing = !!step.clickBefore && !document.querySelector(step.clickBefore);
    const targetMissing = !document.querySelector(step.selector);
    if (openerMissing && targetMissing) return 0;
    if (step.selector.includes("binder-covers") && canEnterBinder) return 8000;
    if (step.clickBefore?.includes("albums-inclusions")) return 8000;
    if (step.clickBefore) return 2500;
    return 0;
  };
  const driveSteps: DriveStep[] = steps.map((step, index) => ({
    element: () => resolveStep(step) as Element,
    disableActiveInteraction: true,
    skipMissingElement: true,
    waitForElement: waitFor(step),
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
      onNextClick: (_el, _s, opts) => {
        const next = steps[index + 1];
        if (!next) {
          if (step.closeAfter) clickSel(step.closeAfter);
          opts.driver.moveNext();
          return;
        }
        if (leaving(step, next)) clickSel(step.closeAfter);
        const needsOpen = Boolean(next.clickBefore) && !visibleEl(next.selector) && !!document.querySelector(next.clickBefore || "");
        if (needsOpen) clickSel(next.clickBefore);
        if (needsOpen) window.setTimeout(() => opts.driver.moveNext(), next.wait ?? 700);
        else opts.driver.moveNext();
      },
      onPrevClick: (_el, _s, opts) => {
        const prev = steps[index - 1];
        if (leaving(step, prev)) clickSel(step.closeAfter);
        opts.driver.movePrevious();
      },
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
    waitForElement: 0,
    steps: driveSteps,
    onPopoverRender: (popover, opts) => {
      const at = opts.index ?? opts.state.activeIndex;
      const last = at != null && at >= steps.length - 1;
      popover.nextButton.textContent = last ? "Cerrar" : "Siguiente";
    },
    onDestroyed: () => {
      collapseSelect();
      closeHeaderMenus();
      if (visibleEl("[data-tour='lib-stock-panel']")) clickSel("[data-tour='lib-card-stock']");
      for (const sel of CLOSE_ON_EXIT) clickSel(sel);
      if (active === tour) active = null;
    },
  });

  active = tour;
  prepare(id);
  const startedAt = Date.now();
  const begin = () => {
    if (active !== tour) return;
    const ready = resolveStep(steps[0]);
    if (ready || Date.now() - startedAt > 8000) {
      tour.drive(0);
      return;
    }
    window.setTimeout(begin, 150);
  };
  begin();
}
