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
      { hot: "grupo", title: "Grupo", text: "El nombre y el logo son lo que ve la gente en el alta y en el perfil. El slug es interno y opcional." },
      { hot: "miembro", title: "Miembro", text: "Elige el grupo, pon el nombre del idol y su foto. Así entra en filtros de biblioteca y ediciones." },
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
      { hot: "cuenta", title: "La cuenta", text: "Desde la ficha das o quitas premium, artista y estrella, y ajustas los K-oins. Al quitar artista puedes dejar sus obras, borrarlas todas o marcar solo las que salen de la web." },
      { hot: "sesion", title: "La sesión", text: "Puedes cerrar todas las sesiones si creen que les han entrado en la cuenta." },
      { hot: "mod", title: "Moderación", text: "Strike, historial, perdonar una restricción o fulminar la cuenta. Fulminar no se deshace." },
    ],
  },
  {
    id: "solicitudes",
    label: "Solicitudes",
    group: "Comunidad",
    steps: [
      { hot: "filtros", title: "Filtros", text: "Filtra por estado (pendiente, en proceso, aprobada, denegada) o por quién la lleva: Ana, Paula o Silvia. También por el nombre de quien escribió." },
      { hot: "leido", title: "Leída o no", text: "El punto lila es una solicitud nueva. Márcala como leída cuando ya la hayas mirado, o déjala sin leer para el resto del equipo." },
      { hot: "estado", title: "Estado", text: "Pásala a en proceso mientras la revisas. Aprobada o denegada la deja en el histórico: ya no se borra al descartarla." },
      { hot: "gestor", title: "Quién la gestiona", text: "Asigna Ana, Paula o Silvia para que no la abráis dos a la vez." },
      { hot: "aprobar", title: "Aprobar", text: "Aprobar como artista le da la insignia para que publique desde el Estudio. Denegar cierra la solicitud sin borrar el expediente." },
      { hot: "obra", title: "Publicar su obra", text: "Si hay que subir algo en su nombre, Publicar su obra abre Publicar con esa persona ya elegida. Publicar sigue en el menú para hacerlo a mano." },
      { hot: "historial", title: "Historial", text: "Historial de acciones lista qué hizo cada una, en qué solicitud y cuándo." },
    ],
  },
  {
    id: "denuncias",
    label: "Denuncias",
    group: "Comunidad",
    steps: [
      { hot: "filtros", title: "Filtros", text: "Además de la categoría, filtra por estado y por quién la está llevando, o busca al usuario denunciante o denunciado." },
      { hot: "leido", title: "Leída o no", text: "Una denuncia no leída sigue marcada hasta que alguien del equipo la pulse como leída." },
      { hot: "estado", title: "Estado", text: "Pendiente, en proceso, en investigación, reactivación, aprobada, denegada o completada. El cambio queda en el historial." },
      { hot: "gestor", title: "Responsable", text: "Ana, Paula o Silvia. Así se ve quién tiene el expediente abierto." },
      { hot: "revisar", title: "Revisar", text: "Revisar abre el expediente: pruebas, notas, notificación al denunciante y sanciones. El estado de ahí también se guarda." },
      { hot: "historial", title: "Historial", text: "El historial del equipo junta las acciones de cada persona en todas las denuncias." },
    ],
  },
  {
    id: "buzon",
    label: "Buzón",
    group: "Comunidad",
    steps: [
      { hot: "filtros", title: "La bandeja", text: "Pendiente, gestionando o cerrado. Abre el hilo para leer el mensaje y los adjuntos." },
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
      { hot: "filtros", title: "Filtros", text: "Igual que en solicitudes: estado, Ana / Paula / Silvia, y el usuario que subió la foto." },
      { hot: "leido", title: "Leída o no", text: "Marca la aportación como leída cuando ya has visto la imagen, o déjala nueva." },
      { hot: "estado", title: "Decisión", text: "En proceso mientras la comparas con el catálogo. Aprobada si la foto entra. Denegada si no sirve." },
      { hot: "gestor", title: "Quién la revisa", text: "Asigna a una de las tres para que no descarguéis la misma dos veces." },
      { hot: "descarga", title: "Descargar", text: "Descarga la imagen (el archivo lleva el id de la photocard) y súbela al catálogo antes de darla por aprobada." },
      { hot: "historial", title: "Historial", text: "Cada cambio de estado, lectura o responsable queda firmado por quien lo hizo." },
    ],
  },
  {
    id: "manual",
    label: "Manual",
    group: "Ayuda",
    steps: [
      { hot: "menu", title: "Los apartados", text: "Son los mismos que el panel. Elige uno y la animación recorre esa gestión sola." },
      { hot: "pasos", title: "Paso a paso", text: "Avanza sola. Puedes pausar, volver atrás o saltar a un punto. El recuadro iluminado es lo que tocarías en el panel." },
      { hot: "movil", title: "En el móvil", text: "Las secciones salen en cuadrícula bajo Admin, con el nombre a la vista. Filtros, estado, responsable e historial se apilan para usarlos con el dedo. La gestión es la misma que en el ordenador." },
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
  cuenta: "Premium / K-oins",
  sesion: "Cerrar sesiones",
  mod: "Strike / Fulminar",
  filtros: "Filtros",
  leido: "No leída",
  estado: "Estado",
  gestor: "Gestiona: Ana",
  aprobar: "Aprobar artista",
  obra: "Publicar su obra",
  historial: "Historial",
  revisar: "Revisar expediente",
  nota: "Guardar nota",
  perfil: "@usuario",
  descarga: "Descargar imagen",
  menu: "Apartados",
  pasos: "Siguiente paso",
  movil: "Cuadrícula móvil",
};

export default function AdminManual() {
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
          <div className="adm-frame-body">
            {lesson.steps.map((item, index) => {
              const on = item.hot === current.hot && index === step;
              return (
                <div key={item.hot + index} className={on ? "adm-row is-hot" : "adm-row"}>
                  <i />
                  {HOT_LABEL[item.hot] || item.title}
                </div>
              );
            })}
            <div className="adm-cursor" style={{ transform: `translateY(${step * 46}px)` }} />
          </div>
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
        .adm-manual-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .adm-kicker { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
        .adm-manual-top h2 { margin: 2px 0 0; color: var(--color-primary); font-size: 26px; }
        .adm-play { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--color-border) !important; background: var(--bg-main) !important; }
        .adm-frame {
          margin-top: 16px; border-radius: 18px; overflow: hidden; border: 1px solid var(--color-border);
          background: var(--bg-main);
        }
        .adm-frame-bar { display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: var(--bg-soft); }
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
          .adm-manual-nav { flex-direction: row; overflow-x: auto; gap: 8px; }
          .adm-manual-group { flex-direction: row; align-items: center; }
          .adm-manual-group span { display: none; }
          .adm-manual-group button { white-space: nowrap; border: 1px solid var(--color-border); }
        }
      `}</style>
    </div>
  );
}
