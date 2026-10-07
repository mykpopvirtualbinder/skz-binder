"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

type Step = { hot: string; title: string; text: string };
type Lesson = { id: string; label: string; group: string; steps: Step[] };

const LESSONS: Lesson[] = [
  {
    id: "publicar",
    label: "Publicar",
    group: "Contenido",
    steps: [
      { hot: "titulo", title: "Título y categoría", text: "Escribe el título de la obra y elige si es arte, fanfic o multimedia. En una continuación de fanfic el título se rellena solo." },
      { hot: "usuario", title: "A quién se la asignas", text: "Busca al usuario. La obra quedará publicada en su perfil, no en el de quien está en el panel." },
      { hot: "archivo", title: "Archivo y portada", text: "Sube el archivo principal y una imagen de portada. Si es +18, márcalo antes de publicar." },
      { hot: "publicar", title: "Publicar", text: "Publicar en la galería la deja visible. En fanfics, el texto en español se traduce solo: espera unos segundos." },
    ],
  },
  {
    id: "catalogo",
    label: "Catálogo",
    group: "Contenido",
    steps: [
      { hot: "grupo", title: "Grupo", text: "El nombre y el logo son lo que ve la gente en el alta y en el perfil. El slug es interno y opcional. En la lista, el buscador filtra por nombre." },
      { hot: "miembro", title: "Miembro", text: "Elige el grupo, pon el nombre del idol y su foto. En la lista puedes buscar por grupo y, aparte, por el nombre del miembro." },
      { hot: "guardar", title: "Guardar", text: "Guarda el grupo o el miembro. Si no ves el cambio, usa Recargar." },
    ],
  },
  {
    id: "publicidad",
    label: "Publicidad",
    group: "Contenido",
    steps: [
      { hot: "copy", title: "El anuncio", text: "Título, subtítulo, enlace de destino y, si quieres, imagen." },
      { hot: "hueco", title: "Dónde aparece", text: "Elige el hueco (sidebar, tablet o móvil), el dispositivo y la sección de la web." },
      { hot: "fechas", title: "Prioridad y fechas", text: "La prioridad decide cuál sale primero. Las fechas limitan la campaña." },
      { hot: "activar", title: "Activar", text: "Marca la campaña como activa y créala. Recargar campañas refresca la lista." },
    ],
  },
  {
    id: "usuarios",
    label: "Usuarios",
    group: "Comunidad",
    steps: [
      { hot: "resumen", title: "El resumen", text: "Altas, pendientes de confirmar, restringidos y bajas. Entra en cada tarjeta para ver el listado." },
      { hot: "ficha", title: "La ficha", text: "Así se ve cada persona: nombre, correo, fecha de alta y último acceso. Acciones abre los botones de verdad." },
      { hot: "premium", title: "Premium", text: "Suma un mes o un año, o quita premium si ya lo tiene." },
      { hot: "artista", title: "Artista", text: "Da o quita la insignia. Si la quitas y hay obras, eliges si se quedan, se borran todas o solo algunas." },
      { hot: "estrella", title: "Estrella", text: "Marca o quita al artista estrella." },
      { hot: "koins", title: "K-oins", text: "Escribes el saldo y pulsas OK." },
      { hot: "sesion", title: "La sesión", text: "Cerrar sesiones le saca de todos los dispositivos si creen que les han entrado en la cuenta." },
      { hot: "strike", title: "Strike", text: "Un strike avisa. Al tercero la cuenta queda restringida." },
      { hot: "historial", title: "Historial", text: "Aquí ves los strikes que ya tiene esa persona." },
      { hot: "fulminar", title: "Fulminar", text: "Borra la cuenta. No se deshace." },
    ],
  },
  {
    id: "solicitudes",
    label: "Solicitudes",
    group: "Comunidad",
    steps: [
      { hot: "filtros", title: "Filtros", text: "Filtra por estado, por quién la lleva, por el nombre de quien escribió y por leídas o no leídas." },
      { hot: "leido", title: "Leída o no", text: "Puedes marcar una sola, las que tengas seleccionadas o todas las de la lista, como leídas o como no leídas. En el historial, pulsa una solicitud para abrirla." },
      { hot: "estado", title: "Estado", text: "Pásala a en proceso mientras la revisas. Aprobada o denegada la deja en el histórico: ya no se borra al descartarla." },
      { hot: "gestor", title: "Quién la gestiona", text: "Asigna Ana, Paula o Silvia para que no la abráis dos a la vez." },
      { hot: "aprobar", title: "Aprobar", text: "Aprobar como artista le da la insignia para que publique desde el Estudio. Denegar cierra la solicitud sin borrar el expediente." },
      { hot: "obra", title: "Publicar su obra", text: "Si hay que subir algo en su nombre, Publicar su obra abre Publicar con esa persona ya elegida. Publicar sigue en el menú para hacerlo a mano." },
      { hot: "historial", title: "Historial", text: "Dentro de la solicitud, Historial de solicitudes de esa persona lista cada alta suya, con estado, quién la gestiona y qué se hizo." },
    ],
  },
  {
    id: "denuncias",
    label: "Denuncias",
    group: "Comunidad",
    steps: [
      { hot: "filtros", title: "Filtros", text: "Además de la categoría, filtra por estado, por quién la está llevando, por usuario y por leídas o no leídas." },
      { hot: "leido", title: "Leída o no", text: "Marca la denuncia como leída o vuelve a dejarla sin leer. En el historial, pulsa una para abrir esa denuncia." },
      { hot: "estado", title: "Estado", text: "Pendiente, en proceso, en investigación, reactivación, aprobada, denegada o completada. El cambio queda en el historial." },
      { hot: "gestor", title: "Responsable", text: "Ana, Paula o Silvia. Así se ve quién tiene el expediente abierto." },
      { hot: "revisar", title: "Revisar", text: "Revisar abre el expediente: pruebas, notas, notificación al denunciante y sanciones. El estado de ahí también se guarda." },
      { hot: "historial", title: "Historial", text: "Historial de denuncias de esa persona abre las que ha enviado, con estado y las acciones del equipo." },
    ],
  },
  {
    id: "buzon",
    label: "Buzón",
    group: "Comunidad",
    steps: [
      { hot: "filtros", title: "La bandeja", text: "Pendiente, gestionando o cerrado, y también leídas o no leídas. Cada mensaje se marca como leído o se deja sin leer. Abre el hilo para ver el texto y los adjuntos." },
      { hot: "estado", title: "Estado del hilo", text: "Cambia el estado desde el desplegable del hilo. Gestionando avisa de que ya hay alguien en ello." },
      { hot: "nota", title: "Nota interna", text: "La respuesta se guarda en el hilo con tu nombre, para que el resto del equipo la vea." },
      { hot: "perfil", title: "K-oins", text: "El @ del usuario abre su perfil desde el admin para premiar la colaboración con K-oins." },
    ],
  },
  {
    id: "aportaciones",
    label: "Aportaciones",
    group: "Comunidad",
    steps: [
      { hot: "filtros", title: "Filtros", text: "Igual que en solicitudes: estado, Ana / Paula / Silvia, el usuario que subió la foto, y leídas o no leídas." },
      { hot: "leido", title: "Leída o no", text: "Marca la aportación como leída cuando ya has visto la imagen, o como no leída si tiene que volver a la bandeja. En el historial, pulsa una para abrirla." },
      { hot: "estado", title: "Decisión", text: "En proceso mientras la comparas con el catálogo. Aprobada si la foto entra. Denegada si no sirve." },
      { hot: "gestor", title: "Quién la revisa", text: "Asigna a una de las tres para que no descarguéis la misma dos veces." },
      { hot: "descarga", title: "Descargar", text: "Descarga la imagen (el archivo lleva el id de la photocard) y súbela al catálogo antes de darla por aprobada." },
      { hot: "historial", title: "Historial", text: "Historial de aportaciones de esa persona muestra cada foto que ha enviado, el estado y quién la tocó." },
    ],
  },
  {
    id: "manual",
    label: "Manual",
    group: "Ayuda",
    steps: [
      { hot: "menu", title: "Los apartados", text: "Son los mismos que el panel. Elige uno y la animación recorre esa gestión sola." },
      { hot: "pasos", title: "Paso a paso", text: "Avanza sola. Puedes pausar, volver atrás o saltar a un punto. El recuadro iluminado es lo que tocarías en el panel." },
      { hot: "movil", title: "En el móvil", text: "Las secciones salen en cuadrícula y se desplazan con la página, para no tapar el título de la sección. Filtros y estados se apilan. La gestión es la misma que en el ordenador." },
    ],
  },
];

const HOT_LABEL: Record<string, string> = {
  titulo: "Título",
  usuario: "Buscar usuario",
  archivo: "Archivo + portada",
  publicar: "Publicar",
  grupo: "Grupo",
  miembro: "Miembro",
  guardar: "Guardar",
  copy: "Título y enlace",
  hueco: "Hueco y dispositivo",
  fechas: "Prioridad y fechas",
  activar: "Campaña activa",
  resumen: "Resumen de cuentas",
  ficha: "Ficha de Hana",
  premium: "+ Mes / + Año",
  artista: "Artista",
  estrella: "Estrella",
  koins: "K-oins",
  sesion: "Cerrar sesiones",
  strike: "Strike",
  historial: "Historial",
  fulminar: "Fulminar",
  filtros: "Filtros",
  leido: "No leída",
  estado: "Estado",
  gestor: "Gestiona: Ana",
  aprobar: "Aprobar artista",
  obra: "Publicar su obra",
  revisar: "Revisar expediente",
  nota: "Guardar nota",
  perfil: "@usuario",
  descarga: "Descargar imagen",
  menu: "Apartados",
  pasos: "Siguiente paso",
  movil: "Cuadrícula móvil",
};

function ManualScreen({ lessonId, hot }: { lessonId: string; hot: string }) {
  const on = (id: string) => (hot === id ? "mk-hot" : "");
  if (lessonId === "usuarios") {
    return (
      <div className="mk-screen">
        <div className={`mk-pills ${on("resumen")}`}>
          {["Altas 128", "Pendientes 4", "Restringidos 1", "Bajas 2"].map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className={`mk-user ${on("ficha")}`}>
          <div>
            <strong>Hana</strong> <em>👑 ✨</em> <b>ALTA</b>
            <small>hana@correo.com · Alta: 12 mar 2026 · Último acceso: hoy</small>
          </div>
          <span className="mk-pill">Acciones</span>
        </div>
        <p className="mk-label">CUENTA</p>
        <div className="mk-actions">
          <span className={on("premium")}>+ Mes</span>
          <span className={on("premium")}>+ Año</span>
          <span className={on("artista")}>Artista</span>
          <span className={on("estrella")}>Estrella</span>
          <span className={on("koins")}>K-oins 120 OK</span>
        </div>
        <p className="mk-label">ACCESO</p>
        <div className="mk-actions">
          <span>Restablecer contraseña</span>
          <span className={on("sesion")}>Cerrar sesiones</span>
        </div>
        <p className="mk-label">MODERACIÓN</p>
        <div className="mk-actions">
          <span className={on("strike")}>Strike 0/3</span>
          <span className={on("historial")}>Historial</span>
          <span className={on("fulminar")}>Fulminar</span>
        </div>
      </div>
    );
  }
  if (lessonId === "solicitudes" || lessonId === "denuncias" || lessonId === "aportaciones") {
    return (
      <div className="mk-screen">
        <div className={`mk-actions ${on("filtros")}`}>
          <span>Estado</span><span>Quién gestiona</span><span>Usuario</span><span className={on("leido")}>Lectura</span>
        </div>
        <div className="mk-actions">
          <span className={on("leido")}>Seleccionar todas</span>
          <span className={on("leido")}>Seleccionadas leídas</span>
          <span className={on("leido")}>Todas no leídas</span>
        </div>
        <div className="mk-card">
          <strong>{lessonId === "aportaciones" ? "PC #204 (front) · ch-an-a" : lessonId === "denuncias" ? "Denuncia de comentario · ch-an-a" : "Solicitud de ch-an-a"}</strong>
          <div className="mk-actions">
            <span className={on("leido")}>Marcar como leída</span>
            <span className={on("estado")}>En proceso</span>
            <span className={on("gestor")}>Ana</span>
          </div>
          {lessonId === "solicitudes" && (
            <div className="mk-actions">
              <span className={on("aprobar")}>Aprobar como Artista</span>
              <span className={on("obra")}>Publicar su obra</span>
            </div>
          )}
          {lessonId === "denuncias" && <span className={`mk-pill ${on("revisar")}`}>Revisar</span>}
          {lessonId === "aportaciones" && <span className={`mk-pill ${on("descarga")}`}>Descargar imagen</span>}
          <span className={`mk-pill ${on("historial")}`}>Historial de esta persona</span>
        </div>
      </div>
    );
  }
  if (lessonId === "buzon") {
    return (
      <div className="mk-screen">
        <div className={`mk-actions ${on("filtros")}`}>
          <span>Pendiente</span><span>Gestionando</span><span className={on("leido")}>No leídas</span><span>Seleccionar todas</span>
        </div>
        <div className="mk-card">
          <strong>Falta una photocard · @hana</strong>
          <div className="mk-actions">
            <span className={on("leido")}>Marcar como leída</span>
            <span>Abrir hilo</span>
          </div>
          <span className={on("estado")}>Estado: gestionando</span>
          <span className={on("nota")}>Nota interna del equipo</span>
          <span className={`mk-pill ${on("perfil")}`}>@hana · K-oins</span>
        </div>
      </div>
    );
  }
  if (lessonId === "catalogo") {
    return (
      <div className="mk-screen">
        <div className={`mk-card ${on("grupo")}`}><strong>Grupo</strong><span>Nombre visible · slug · logo</span><span className={on("guardar")}>Guardar en base de datos</span></div>
        <div className={`mk-card ${on("miembro")}`}><strong>Miembro</strong><span>Grupo · nombre · foto</span></div>
        <span className={on("grupo")}>Buscar grupo</span>
        <span className={on("miembro")}>Buscar por grupo · buscar miembro</span>
      </div>
    );
  }
  if (lessonId === "publicar") {
    return (
      <div className="mk-screen">
        <span className={on("titulo")}>Título · Arte / Fanfic / Multimedia</span>
        <span className={on("usuario")}>Buscar usuario</span>
        <span className={on("archivo")}>Archivo + portada · +18</span>
        <span className={`mk-pill ${on("publicar")}`}>Publicar en la galería</span>
      </div>
    );
  }
  if (lessonId === "publicidad") {
    return (
      <div className="mk-screen">
        <span className={on("copy")}>Título, subtítulo, enlace, imagen</span>
        <span className={on("hueco")}>Hueco · dispositivo · sección</span>
        <span className={on("fechas")}>Prioridad y fechas</span>
        <span className={`mk-pill ${on("activar")}`}>Campaña activa</span>
      </div>
    );
  }
  return (
    <div className="mk-screen">
      <div className={`mk-actions ${on("menu")}`}><span>Publicar</span><span>Usuarios</span><span>Solicitudes</span><span>Manual</span></div>
      <span className={on("pasos")}>El recuadro lila es el botón de este paso</span>
      <span className={on("movil")}>En el móvil el menú es una cuadrícula</span>
    </div>
  );
}

export default function AdminManual({ onStartTour }: { onStartTour?: (id: string) => void }) {
  const [lessonId, setLessonId] = useState(LESSONS[0].id);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const lesson = LESSONS.find((item) => item.id === lessonId) || LESSONS[0];
  const current = lesson.steps[Math.min(step, lesson.steps.length - 1)];

  useEffect(() => {
    setStep(0);
    setPlaying(true);
  }, [lessonId]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setStep((prev) => (prev + 1) % lesson.steps.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [playing, lesson.steps.length, lessonId]);

  const groups = Array.from(new Set(LESSONS.map((item) => item.group)));

  return (
    <div className="adm-manual">
      <div className="adm-manual-nav">
        {groups.map((group) => (
          <div key={group} className="adm-manual-group">
            <span>{group}</span>
            {LESSONS.filter((item) => item.group === group).map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === lesson.id ? "is-on" : ""}
                onClick={() => setLessonId(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>

        <div className="adm-manual-stage">
        <div className="adm-tour-banner">
          <div>
            <p className="adm-kicker">Un tour por apartado</p>
            <h2>Tour de {lesson.label}</h2>
            <p>{lesson.id === "manual"
              ? "Cada pestaña del panel tiene el suyo. Elige Publicar, Usuarios, Catálogo… y lánzalo aquí, o pulsa Tour dentro de esa sección."
              : "Recorre solo esta sección, sobre la pantalla de verdad. Siguiente y Anterior mueven el bocadillo. La X lo cierra."}</p>
          </div>
          {lesson.id !== "manual" && (
            <button type="button" className="adm-tour-go" onClick={() => onStartTour?.(lesson.id)}>
              <Play size={16} /> Empezar
            </button>
          )}
        </div>
        <div className="adm-manual-top">
          <div>
            <p className="adm-kicker">{lesson.group}</p>
            <h2>{lesson.label}</h2>
          </div>
          <button type="button" className="adm-play" onClick={() => setPlaying((v) => !v)}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
            {playing ? "Pausa" : "Seguir"}
          </button>
        </div>

        <div className="adm-frame" aria-hidden="true">
          <div className="adm-frame-bar">
            <span />
            <span />
            <span />
            <strong>{lesson.label}</strong>
          </div>
          <ManualScreen lessonId={lesson.id} hot={current.hot} />
        </div>

        <div className="adm-caption">
          <div className="adm-progress">
            {lesson.steps.map((item, index) => (
              <button key={item.hot + index} type="button" className={index === step ? "is-on" : index < step ? "is-done" : ""} onClick={() => { setStep(index); setPlaying(false); }} aria-label={item.title} />
            ))}
          </div>
          <p className="adm-stepcount">Paso {step + 1} de {lesson.steps.length}</p>
          <h3>{current.title}</h3>
          <p>{current.text}</p>
          <div className="adm-nav-btns">
            <button type="button" onClick={() => { setPlaying(false); setStep((s) => Math.max(0, s - 1)); }}>Anterior</button>
            <button type="button" onClick={() => { setPlaying(false); setStep((s) => (s + 1) % lesson.steps.length); }}>Siguiente</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .adm-manual { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 18px; align-items: start; }
        .adm-manual-nav { display: flex; flex-direction: column; gap: 14px; }
        .adm-manual-group { display: flex; flex-direction: column; gap: 4px; }
        .adm-manual-group span { font-size: 10px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); margin: 0 8px 4px; }
        .adm-manual-group button, .adm-play, .adm-nav-btns button {
          border: none; background: transparent; color: var(--text-main); font-weight: 800; text-align: left;
          border-radius: 12px; padding: 8px 10px; cursor: pointer;
        }
        .adm-manual-group button.is-on { background: color-mix(in srgb, var(--color-primary) 16%, var(--bg-card)); color: var(--color-primary); }
        .adm-manual-stage {
          background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 24px;
          box-shadow: 0 10px 30px var(--shadow-card); padding: 22px;
        }
        .adm-tour-banner {
          display: flex; justify-content: space-between; gap: 14px; align-items: center;
          padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px dashed var(--color-border);
        }
        .adm-tour-banner h2 { margin: 2px 0 6px; color: var(--color-primary); font-size: 22px; }
        .adm-tour-banner p:last-child { margin: 0; color: var(--text-main); font-weight: 650; line-height: 1.45; font-size: 14px; }
        .adm-tour-go {
          display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0;
          background: var(--color-primary) !important; color: var(--bg-card) !important;
          border: none !important; border-radius: 12px; padding: 12px 16px !important;
          font-weight: 900; cursor: pointer; white-space: nowrap;
        }
        .adm-manual-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .adm-kicker { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
        .adm-manual-top h2 { margin: 2px 0 0; color: var(--color-primary); font-size: 26px; }
        .adm-play { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--color-border) !important; background: var(--bg-main) !important; }
        .adm-frame {
          margin-top: 16px; border-radius: 18px; overflow: hidden; border: 1px solid var(--color-border);
          background: var(--bg-main);
        }
        .adm-frame-bar { display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: var(--bg-soft); }
        :global(.mk-screen) { padding: 12px; display: flex; flex-direction: column; gap: 8px; color: var(--text-main); font-size: 12px; font-weight: 800; }
        :global(.mk-screen) span, :global(.mk-pills) span, :global(.mk-actions) span, :global(.mk-pill), :global(.mk-card), :global(.mk-user) {
          border: 1px solid var(--color-border); background: var(--bg-card); border-radius: 10px; padding: 8px 10px;
        }
        :global(.mk-pills), :global(.mk-actions) { display: flex; flex-wrap: wrap; gap: 6px; }
        :global(.mk-card) { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
        :global(.mk-user) { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
        :global(.mk-user) small { display: block; font-weight: 700; color: var(--text-muted); margin-top: 2px; }
        :global(.mk-user) b { color: var(--state-success-fg); font-size: 10px; }
        :global(.mk-label) { margin: 4px 0 0; font-size: 10px; letter-spacing: 0.08em; color: var(--text-muted); }
        :global(.mk-hot) {
          border-color: var(--color-primary) !important;
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 22%, transparent);
          color: var(--color-primary);
        }
        .adm-frame-bar span { width: 8px; height: 8px; border-radius: 99px; background: var(--color-border); }
        .adm-frame-bar strong { margin-left: 6px; font-size: 12px; color: var(--color-primary); }
        .adm-frame-body { position: relative; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .adm-row {
          height: 38px; border-radius: 12px; border: 1px solid var(--color-border); background: var(--bg-card);
          display: flex; align-items: center; gap: 8px; padding: 0 12px; font-size: 13px; font-weight: 800; color: var(--text-main);
          transition: border-color 0.35s, box-shadow 0.35s, transform 0.35s;
        }
        .adm-row i { width: 8px; height: 8px; border-radius: 99px; background: var(--color-border); }
        .adm-row.is-hot {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 18%, transparent);
          color: var(--color-primary);
          transform: translateX(4px);
        }
        .adm-row.is-hot i { background: var(--color-primary); animation: adm-pulse 1.2s ease-in-out infinite; }
        .adm-cursor {
          position: absolute; left: 8px; top: 22px; width: 14px; height: 14px; border-radius: 99px 99px 99px 2px;
          background: var(--color-primary); box-shadow: 0 4px 10px var(--shadow-card);
          transition: transform 0.55s cubic-bezier(0.2, 0.8, 0.2, 1); pointer-events: none;
        }
        .adm-caption h3 { margin: 8px 0 6px; color: var(--color-primary); font-size: 18px; }
        .adm-caption p { margin: 0; color: var(--text-main); font-weight: 650; line-height: 1.5; }
        .adm-stepcount { margin: 10px 0 0 !important; font-size: 12px; color: var(--text-muted) !important; font-weight: 800 !important; }
        .adm-progress { display: flex; gap: 6px; margin-top: 14px; }
        .adm-progress button { height: 6px; flex: 1; border-radius: 99px; padding: 0; background: var(--color-border); }
        .adm-progress button.is-done { background: color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); }
        .adm-progress button.is-on { background: var(--color-primary); }
        .adm-nav-btns { display: flex; gap: 8px; margin-top: 14px; }
        .adm-nav-btns button { border: 1px solid var(--color-border) !important; background: var(--bg-main) !important; }
        @keyframes adm-pulse { 50% { transform: scale(1.45); } }
        @media (max-width: 800px) {
          .adm-manual { grid-template-columns: 1fr; }
          .adm-tour-banner { flex-direction: column; align-items: stretch; }
          .adm-tour-go { justify-content: center; }
          .adm-manual-nav { flex-direction: row; overflow-x: auto; gap: 8px; }
          .adm-manual-group { flex-direction: row; align-items: center; }
          .adm-manual-group span { display: none; }
          .adm-manual-group button { white-space: nowrap; border: 1px solid var(--color-border); }
        }
      `}</style>
    </div>
  );
}
