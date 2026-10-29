"use client";

import type { ReactNode } from "react";
import { Banknote, CreditCard, Heart, HeartHandshake, Lightbulb, Smile, Sparkles, Sun, Users, Wrench } from "lucide-react";
import Footer from "../components/footer";
import { useGlobal } from "../context/GlobalContext";
import { aboutCopy } from "@/lib/editorial-copy";

function Mark({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", verticalAlign: "middle", margin: "0 2px", color: "#8C659C" }}>
      {children}
    </span>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "14px 16px", alignItems: "start" }}>
      <span style={{ width: 46, height: 46, borderRadius: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, #8C659C 16%, var(--bg-card))", color: "#8C659C" }}>
        {icon}
      </span>
      <div>
        <h2 className="tan-font" style={{ margin: "6px 0 10px", fontSize: 28, color: "var(--color-primary)" }}>{title}</h2>
        <div style={{ display: "grid", gap: 12, fontSize: 16, lineHeight: 1.7, fontWeight: 650 }}>{children}</div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  const { uiLanguage } = useGlobal();
  const copy = aboutCopy(uiLanguage);
  const [sunscreen, orders, idea, binder] = [copy.start[1], copy.start[2], copy.start[3], copy.start[4]];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-main)", color: "var(--text-main)", display: "flex", flexDirection: "column" }}>
      <main style={{ width: "min(860px, calc(100% - 32px))", margin: "28px auto 48px", display: "grid", gap: 28 }}>
        <figure style={{ margin: 0, borderRadius: 28, overflow: "hidden", border: "1px solid var(--color-border)", background: "var(--bg-card)", boxShadow: "0 18px 50px color-mix(in srgb, #8C659C 18%, transparent)" }}>
          <img src="/branding/about-us.jpg" alt={copy.team} style={{ display: "block", width: "100%", height: "auto" }} />
        </figure>

        <header style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0, letterSpacing: "0.14em", fontSize: 12, fontWeight: 900, color: "#8C659C" }}>{copy.kicker}</p>
          <h1 className="tan-font" style={{ margin: 0, fontSize: "clamp(34px, 5vw, 52px)", lineHeight: 1.05, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {copy.title}
            <Heart size={28} color="#8C659C" fill="#F3C7DA" aria-hidden />
          </h1>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 750, color: "var(--text-muted)" }}>{copy.subtitle}</p>
        </header>

        <div style={{ display: "grid", gap: 14, fontSize: 17, lineHeight: 1.75, fontWeight: 650 }}>
          <p style={{ margin: 0 }}>{copy.greeting}</p>
          <p style={{ margin: 0 }}>{copy.welcome}</p>
        </div>

        <Section icon={<Users size={22} />} title={copy.whoTitle}>
          {copy.who.map((paragraph) => <p key={paragraph.slice(0, 24)} style={{ margin: 0 }}>{paragraph}</p>)}
        </Section>

        <Section icon={<Lightbulb size={22} />} title={copy.startTitle}>
          <p style={{ margin: 0 }}>{copy.start[0]}</p>
          <p style={{ margin: 0 }}>
            {sunscreen}
            <Mark><Sun size={18} aria-hidden /></Mark>
            <Mark><CreditCard size={18} aria-hidden /></Mark>
          </p>
          <p style={{ margin: 0 }}>{orders}</p>
          <p style={{ margin: 0 }}>{idea}</p>
          <p style={{ margin: 0 }}>
            {binder}
            <Mark><Smile size={18} aria-hidden /></Mark>
            <Mark><Banknote size={18} aria-hidden /></Mark>
          </p>
        </Section>

        <Section icon={<Wrench size={22} />} title={copy.codeTitle}>
          {copy.code.map((paragraph) => <p key={paragraph.slice(0, 24)} style={{ margin: 0 }}>{paragraph}</p>)}
        </Section>

        <Section icon={<HeartHandshake size={22} />} title={copy.visionTitle}>
          {copy.vision.map((paragraph) => <p key={paragraph.slice(0, 24)} style={{ margin: 0 }}>{paragraph}</p>)}
        </Section>

        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 22, display: "grid", gap: 8 }}>
          <p className="tan-font" style={{ margin: 0, fontSize: 26, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {copy.close}
            <Sparkles size={22} color="#8C659C" aria-hidden />
          </p>
          <p style={{ margin: 0, fontWeight: 750 }}>{copy.love}</p>
          <p style={{ margin: 0, fontWeight: 850, display: "flex", alignItems: "center", gap: 8 }}>
            {copy.team}
            <Heart size={18} color="#8C659C" fill="#F3C7DA" aria-hidden />
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
