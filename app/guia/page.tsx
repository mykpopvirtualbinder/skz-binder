"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookHeart,
  Disc,
  Home,
  LayoutGrid,
  LifeBuoy,
  MessageCircle,
  Paintbrush,
  ShoppingBag,
  Store,
  Package,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import Footer from "../components/footer";
import { USER_TOUR_KEY, USER_TOUR_PATH } from "@/lib/user-tour";
import { supabase } from "@/lib/supabase";
import { pingAdminInbox } from "@/lib/ping-admin-inbox";

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
  const [contactOpen, setContactOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");

  const sendContact = async () => {
    const body = message.trim();
    const mail = email.trim();
    if (body.length < 8) {
      setError("Cuéntanos un poco más, para poder ayudarte.");
      return;
    }
    if (!mail.includes("@")) {
      setError("Necesitamos un correo para contestarte.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: created, error: insertError } = await supabase.from("buzon_colaboraciones").insert({
        user_id: user?.id ?? null,
        asunto: "Duda de la guía",
        email: mail,
        mensaje: body,
        adjuntos: "",
        status: "pendiente",
      }).select("id").maybeSingle();
      if (insertError) throw insertError;
      if (created?.id) void pingAdminInbox("buzon", created.id);
      setSent("Listo. Nos llega al buzón y te respondemos a ese correo.");
      setMessage("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se ha podido enviar.";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

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
          <button type="button" className="guia-contact" onClick={() => { setContactOpen(true); setSent(""); setError(""); }}>
            <LifeBuoy size={18} />
            ¿Duda o algo no funciona? Escríbenos
          </button>
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
      {contactOpen && (
        <div className="guia-contact-layer" onClick={() => setContactOpen(false)}>
          <div className="guia-contact-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="guia-contact-title">
            <div className="guia-contact-head">
              <h2 id="guia-contact-title">Escríbenos</h2>
              <button type="button" aria-label="Cerrar" onClick={() => setContactOpen(false)}><X size={22} /></button>
            </div>
            <p>Si te queda una duda del funcionamiento, o ves que algo no va bien, mándalo aquí. Llega al buzón del equipo.</p>
            <label>
              Tu correo
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" />
            </label>
            <label>
              Qué pasa
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="La guía de biblioteca no marca el buscador…" />
            </label>
            {error && <p className="guia-contact-error">{error}</p>}
            {sent && <p className="guia-contact-ok">{sent}</p>}
            <button type="button" className="guia-contact-send" disabled={sending} onClick={() => void sendContact()}>
              {sending ? "Enviando…" : "Enviar al buzón"}
            </button>
          </div>
        </div>
      )}
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
        .guia-contact {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--color-border);
          background: var(--bg-main);
          color: var(--color-primary);
          font-weight: 900;
          font-size: 14px;
          cursor: pointer;
        }
        .guia-contact-layer {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: var(--overlay-medium);
        }
        .guia-contact-card {
          width: 100%;
          max-width: 460px;
          background: var(--bg-card);
          color: var(--text-main);
          border: 1px solid var(--border-card);
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 20px 40px var(--shadow-card);
        }
        .guia-contact-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .guia-contact-head h2 {
          margin: 0;
          color: var(--color-primary);
          font-size: 22px;
        }
        .guia-contact-head button {
          background: none;
          border: none;
          color: var(--text-main);
          cursor: pointer;
        }
        .guia-contact-card > p {
          margin: 8px 0 14px;
          font-size: 14px;
          font-weight: 650;
          line-height: 1.45;
        }
        .guia-contact-card label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 12px;
          font-size: 12px;
          font-weight: 900;
          color: var(--text-subheading);
        }
        .guia-contact-card input,
        .guia-contact-card textarea {
          width: 100%;
          box-sizing: border-box;
          border-radius: 12px;
          border: 1px solid var(--color-border);
          background: var(--bg-main);
          color: var(--text-main);
          padding: 10px 12px;
          font: inherit;
          font-weight: 650;
        }
        .guia-contact-error { color: var(--state-danger-fg); font-weight: 800; }
        .guia-contact-ok { color: var(--state-success-fg); font-weight: 800; }
        .guia-contact-send {
          width: 100%;
          border: none;
          border-radius: 12px;
          padding: 12px;
          background: var(--color-primary);
          color: var(--modal-cta-fg);
          font-weight: 900;
          cursor: pointer;
        }
        .guia-contact-send:disabled { opacity: 0.6; cursor: wait; }
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
