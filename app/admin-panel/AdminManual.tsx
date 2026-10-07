"use client";

import { ImagePlus, Mail, MailOpen, PenTool, ShieldAlert, Sparkles, Tags, Users, type LucideIcon } from "lucide-react";

const SECTIONS: { id: string; label: string; group: string; icon: LucideIcon }[] = [
  { id: "publicar", label: "Publicar", group: "Contenido", icon: PenTool },
  { id: "catalogo", label: "Catálogo", group: "Contenido", icon: Tags },
  { id: "publicidad", label: "Publicidad", group: "Contenido", icon: Sparkles },
  { id: "usuarios", label: "Usuarios", group: "Comunidad", icon: Users },
  { id: "solicitudes", label: "Solicitudes", group: "Comunidad", icon: Mail },
  { id: "denuncias", label: "Denuncias", group: "Comunidad", icon: ShieldAlert },
  { id: "buzon", label: "Buzón", group: "Comunidad", icon: MailOpen },
  { id: "aportaciones", label: "Aportaciones", group: "Comunidad", icon: ImagePlus },
];

export default function AdminManual({ onStartTour }: { onStartTour?: (id: string) => void }) {
  const groups = Array.from(new Set(SECTIONS.map((item) => item.group)));

  return (
    <div className="adm-manual">
      <div className="adm-manual-stage">
        <p className="adm-kicker">Manual</p>
        <h2>Un tour por apartado</h2>
        <p className="adm-lead">
          Cada botón abre esa sección y señala los campos de verdad. Si el campo es un desplegable, las opciones se recorren solas. Siguiente y Anterior lo mueven. La X lo cierra.
        </p>
        {groups.map((group) => (
          <div key={group} className="adm-group">
            <span>{group}</span>
            <div className="adm-grid">
              {SECTIONS.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" aria-label={`Tour de ${item.label}`} onClick={() => onStartTour?.(item.id)}>
                    <Icon size={28} strokeWidth={2.2} />
                    <strong>{item.label}</strong>
                    <small>Tour de la sección</small>
                  </button>
                );
              })}
            </div>
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
        .adm-group { margin-top: 18px; }
        .adm-group > span {
          display: block;
          margin-bottom: 10px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .adm-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }
        .adm-grid button {
          aspect-ratio: 1;
          width: 100%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid var(--color-border);
          background: var(--bg-main);
          color: var(--color-primary);
          cursor: pointer;
          text-align: center;
        }
        .adm-grid strong {
          font-size: 14px;
          font-weight: 900;
          line-height: 1.15;
        }
        .adm-grid small {
          font-size: 11px;
          font-weight: 800;
          line-height: 1.2;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
