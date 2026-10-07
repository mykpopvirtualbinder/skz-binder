"use client";

import { useRouter } from "next/navigation";
import {
  BookHeart,
  Disc,
  Home,
  LayoutGrid,
  MessageCircle,
  Paintbrush,
  ShoppingBag,
  Store,
  Package,
  User,
  type LucideIcon,
} from "lucide-react";
import Footer from "../components/footer";
import { USER_TOUR_KEY, USER_TOUR_PATH } from "@/lib/user-tour";

const SECTIONS: { id: string; label: string; group: string; icon: LucideIcon }[] = [
  { id: "inicio", label: "Inicio", group: "Tu colección", icon: Home },
  { id: "biblioteca", label: "Biblioteca", group: "Tu colección", icon: LayoutGrid },
  { id: "albumes", label: "Álbumes", group: "Tu colección", icon: Disc },
  { id: "merch", label: "Merch", group: "Tu colección", icon: Package },
  { id: "binders", label: "Binders", group: "Tu colección", icon: BookHeart },
  { id: "market", label: "Market", group: "Comunidad", icon: Store },
  { id: "fanart", label: "Fanart", group: "Comunidad", icon: Paintbrush },
  { id: "fanzone", label: "Fanzone", group: "Comunidad", icon: MessageCircle },
  { id: "shop", label: "Shop", group: "Tienda", icon: ShoppingBag },
  { id: "perfil", label: "Perfil", group: "Tu cuenta", icon: User },
];

export default function GuiaPage() {
  const router = useRouter();
  const groups = Array.from(new Set(SECTIONS.map((item) => item.group)));

  const start = (id: string) => {
    const href = USER_TOUR_PATH[id];
    if (!href) return;
    sessionStorage.setItem(USER_TOUR_KEY, id);
    router.push(href);
  };

  return (
    <div style={{ background: "var(--bg-main)", color: "var(--text-main)", minHeight: "100%" }}>
      <main style={{ width: "100%", maxWidth: 980, margin: "0 auto", padding: "36px 20px 24px" }}>
        <div className="guia-stage">
          <p className="guia-kicker">Guía de uso</p>
          <h1>Un paseo por cada rincón</h1>
          <p className="guia-lead">
            Elige una sección y te llevamos allí, con bocadillos que señalan los botones de verdad.
            Los desplegables se abren solos. Siguiente y Anterior te mueven. La X cierra el paseo cuando quieras.
          </p>
          {groups.map((group) => (
            <div key={group} className="guia-group">
              <span>{group}</span>
              <div className="guia-grid">
                {SECTIONS.filter((item) => item.group === group).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} type="button" aria-label={`Tour de ${item.label}`} onClick={() => start(item.id)}>
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
      </main>
      <Footer />
      <style jsx>{`
        .guia-stage {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: 24px;
          box-shadow: 0 10px 30px var(--shadow-card);
          padding: 22px;
        }
        .guia-kicker {
          margin: 0;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        h1 {
          margin: 4px 0 8px;
          color: var(--color-primary);
          font-size: 28px;
        }
        .guia-lead {
          margin: 0 0 8px;
          color: var(--text-main);
          font-weight: 650;
          line-height: 1.5;
        }
        .guia-group { margin-top: 18px; }
        .guia-group > span {
          display: block;
          margin-bottom: 10px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .guia-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }
        .guia-grid button {
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
        .guia-grid strong {
          font-size: 14px;
          font-weight: 900;
          line-height: 1.15;
        }
        .guia-grid small {
          font-size: 11px;
          font-weight: 800;
          line-height: 1.2;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
