import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Banknote, CreditCard, Heart, HeartHandshake, Lightbulb, Smile, Sparkles, Sun, Users, Wrench } from "lucide-react";
import Footer from "../components/footer";

export const metadata: Metadata = {
  title: "About us · My K-pop Binder",
  description: "The story behind MyKpopBinder, written by the three fans who built it.",
};

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
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-main)", color: "var(--text-main)", display: "flex", flexDirection: "column" }}>
      <main style={{ width: "min(860px, calc(100% - 32px))", margin: "28px auto 48px", display: "grid", gap: 28 }}>
        <figure style={{ margin: 0, borderRadius: 28, overflow: "hidden", border: "1px solid var(--color-border)", background: "var(--bg-card)", boxShadow: "0 18px 50px color-mix(in srgb, #8C659C 18%, transparent)" }}>
          <img src="/branding/about-us.jpg" alt="The MyKpopBinder team at a Stray Kids concert" style={{ display: "block", width: "100%", height: "auto" }} />
        </figure>

        <header style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0, letterSpacing: "0.14em", fontSize: 12, fontWeight: 900, color: "#8C659C" }}>MY K-POP BINDER</p>
          <h1 className="tan-font" style={{ margin: 0, fontSize: "clamp(34px, 5vw, 52px)", lineHeight: 1.05, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            About Us
            <Heart size={28} color="#8C659C" fill="#F3C7DA" aria-hidden />
          </h1>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 750, color: "var(--text-muted)" }}>The Story Behind MyKpopBinder</p>
        </header>

        <div style={{ display: "grid", gap: 14, fontSize: 17, lineHeight: 1.75, fontWeight: 650 }}>
          <p style={{ margin: 0 }}>MKBees, STAY (and fellow K-Pop fans & collectors) annyeong!</p>
          <p style={{ margin: 0 }}>
            We are beyond happy and excited to finally welcome you to MyKpopBinder! This platform was created by fans, for fans, out of pure love, dedication, and a shared passion for the incredible world of K-Pop.
          </p>
        </div>

        <Section icon={<Users size={22} />} title="Who We Are">
          <p style={{ margin: 0 }}>
            We are three K-Pop enthusiasts based in Spain who developed a deep connection with this universe around 2024, although one of us had already been in contact with K-pop through BTS around 2015. What started as an admiration for the music quickly turned into a strong friendship centered around our shared love for Stray Kids.
          </p>
          <p style={{ margin: 0 }}>
            While we are mostly STAYs at heart, our music taste continues to grow—one of us has a strong background as an ARMY, and together we are rapidly falling into the traps of incredible groups like ATEEZ, Xdinary Heroes, and many more.
          </p>
        </Section>

        <Section icon={<Lightbulb size={22} />} title="How It All Started">
          <p style={{ margin: 0 }}>
            In the midst of our first steps as baby STAYs! into this new world, we quickly stumbled upon one giant problem: Why and how is there so much stuff to collect?!
          </p>
          <p style={{ margin: 0 }}>
            Album photocards, pre-order benefits (POBs), lucky draws, merch inclusions... we even found out photocards can come with sunscreen?!
            <Mark><Sun size={18} aria-label="sunscreen" /></Mark>
            <Mark><CreditCard size={18} aria-label="photocard" /></Mark>
          </p>
          <p style={{ margin: 0 }}>
            That led to problem number two: ordering like crazy, wanting to get everything, joining over 500 Group Orders (GOs), and ultimately ending up with duplicates, forgotten claims, and zero idea of what we had bought or where it was coming from (because we’ve all been there and we’ve all done that!).
          </p>
          <p style={{ margin: 0 }}>
            So one day, while having lunch together, an idea hit us: Why not create a virtual space where we can easily keep track of all our albums, merch, photocards, and inclusions in one place?
          </p>
          <p style={{ margin: 0 }}>
            Walking around carrying heavy 9-grid binders to K-pop shops and events isn't very practical, and GOM claims or trade announcements always seem to pop up at the absolute worst times. Having a digital space to quickly check if you should claim a PC or not can literally be a life saver — well, call it a life saver or call it money saved for your next K-Pop concert, who are we to judge?
            <Mark><Smile size={18} aria-label="wink" /></Mark>
            <Mark><Banknote size={18} aria-label="money saved" /></Mark>
          </p>
        </Section>

        <Section icon={<Wrench size={22} />} title="The Journey Behind the Code">
          <p style={{ margin: 0 }}>
            Thus, MyKpopBinder was born! Or at least, the idea of it. What followed were many months of intense learning and hard work to turn that dream into reality.
          </p>
          <p style={{ margin: 0 }}>
            None of us has a professional background in computer science, web design, or programming. We all have our daily lives, jobs, and responsibilities beyond this project. But we poured our hearts and souls into building this platform out of pure love (necessity) and passion. We learned everything from scratch, gathered as much data as we could, and spent countless hours refining the experience.
          </p>
          <p style={{ margin: 0 }}>
            Although there is still so much to do and build, we felt it was finally time to open our doors, invite you into this journey, and continue growing together.
          </p>
        </Section>

        <Section icon={<HeartHandshake size={22} />} title="Our Vision & Community">
          <p style={{ margin: 0 }}>
            For us, being a STAY means being part of a warm family and a supportive community. We want to extend that exact feeling to MyKpopBinder.
          </p>
          <p style={{ margin: 0 }}>
            We want this platform to be a safe, welcoming, and inclusive space where everyone feels free to express themselves, share their love for their favorite groups, and be exactly who they want to be. Mutual respect and acceptance are the core pillars of this project.
          </p>
          <p style={{ margin: 0 }}>
            Currently, the platform is mainly focused on Stray Kids, but as our team and community grow, our goal is to expand and add as many groups as possible with your help and feedback!
          </p>
          <p style={{ margin: 0 }}>
            Join us and other fans to collect, track, trade, and explore everything the K-Pop world has to offer. Feel right at home among friends, and give free reign to your passion in a judgment-free community.
          </p>
        </Section>

        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 22, display: "grid", gap: 8 }}>
          <p className="tan-font" style={{ margin: 0, fontSize: 26, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            MyKpopBinder — your safe K-space.
            <Sparkles size={22} color="#8C659C" aria-hidden />
          </p>
          <p style={{ margin: 0, fontWeight: 750 }}>With all our love,</p>
          <p style={{ margin: 0, fontWeight: 850, display: "flex", alignItems: "center", gap: 8 }}>
            The MyKpopBinder Team: P.A.S.
            <Heart size={18} color="#8C659C" fill="#F3C7DA" aria-hidden />
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
