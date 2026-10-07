"use client";

import { Play } from "lucide-react";

const SECTIONS = [
  { id: "publicar", label: "Publicar", group: "Contenido" },
  { id: "catalogo", label: "Catálogo", group: "Contenido" },
  { id: "publicidad", label: "Publicidad", group: "Contenido" },
  { id: "usuarios", label: "Usuarios", group: "Comunidad" },
  { id: "solicitudes", label: "Solicitudes", group: "Comunidad" },
  { id: "denuncias", label: "Denuncias", group: "Comunidad" },
  { id: "buzon", label: "Buzón", group: "Comunidad" },
  { id: "aportaciones", label: "Aportaciones", group: "Comunidad" },
];

export default function AdminManual({ onStartTour }: { onStartTour?: (id: string) => void }) {
  const groups = Array.from(new Set(SECTIONS.map((item) => item.group)));

  return (
    <div className="adm-manual">
      <div className="adm-manual-stage">
        <p className="adm-kicker">Manual</p>
        <h2>Un tour por apartado</h2>
        <p className="adm-lead">
          Cada botón abre esa sección y señala los campos de verdad. Si el campo es un desplegable, las opciones se abren al lado del bocadillo. Siguiente y Anterior lo mueven. La X lo cierra.
        </p>
        {groups.map((group) => (
          <div key={group} className="adm-group">
            <span>{group}</span>
            {SECTIONS.filter((item) => item.group === group).map((item) => (
              <button key={item.id} type="button" onClick={() => onStartTour?.(item.id)}>
                <Play size={16} />
                Tour de {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <style jsx>{`
        .adm-manual-stage {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: 24px;
          box-shadow: 0 10px 30px var(--shadow-card);
          padding: 22px;
        }
        .adm-kicker {
          margin: 0;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        h2 { margin: 4px 0 8px; color: var(--color-primary); font-size: 26px; }
        .adm-lead { margin: 0 0 18px; color: var(--text-main); font-weight: 650; line-height: 1.5; }
        .adm-group { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
        .adm-group span {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .adm-group button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          max-width: 100%;
          background: var(--color-primary);
          color: var(--bg-card);
          border: none;
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 900;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
