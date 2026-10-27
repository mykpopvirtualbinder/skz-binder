"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useGlobal } from "../context/GlobalContext";

const SEEN_KEY = "mkb-intro-seen-3";
const PHRASES = ["intro.fans", "intro.groups", "intro.yours", "intro.send"] as const;

type MotifName = "flag" | "hanbok" | "bibimbap" | "fan" | "lantern";

const FLOATS: Array<{
  kind: "pc" | "plush" | "key" | "motif";
  src?: string;
  motif?: MotifName;
  top: string;
  dur: string;
  delay: string;
  rot?: string;
  tone?: string;
  dir: "ltr" | "rtl";
}> = [
  { kind: "pc", top: "8%", dur: "11s", delay: "-2s", rot: "-8deg", tone: "pink", dir: "ltr" },
  { kind: "plush", src: "/ui/wolfchan-cursor.png", top: "18%", dur: "13s", delay: "-7s", dir: "rtl" },
  { kind: "key", top: "72%", dur: "12s", delay: "-1s", tone: "lilac", dir: "ltr" },
  { kind: "pc", top: "78%", dur: "15s", delay: "-9s", rot: "7deg", tone: "blue", dir: "rtl" },
  { kind: "plush", src: "/ui/leebit-cursor.png", top: "62%", dur: "14s", delay: "-4s", dir: "ltr" },
  { kind: "key", top: "28%", dur: "16s", delay: "-11s", tone: "mint", dir: "rtl" },
  { kind: "pc", top: "46%", dur: "10s", delay: "-3s", rot: "5deg", tone: "cream", dir: "ltr" },
  { kind: "plush", src: "/ui/dwaekki-cursor.png", top: "84%", dur: "12s", delay: "-6s", dir: "rtl" },
  { kind: "plush", src: "/ui/bbokari-cursor.png", top: "4%", dur: "17s", delay: "-12s", dir: "ltr" },
  { kind: "key", top: "54%", dur: "13s", delay: "-8s", tone: "peach", dir: "ltr" },
  { kind: "pc", top: "34%", dur: "18s", delay: "-14s", rot: "-4deg", tone: "lilac", dir: "rtl" },
  { kind: "plush", src: "/ui/jiniret-cursor.png", top: "90%", dur: "11s", delay: "-2s", dir: "ltr" },
  { kind: "motif", motif: "flag", top: "22%", dur: "16s", delay: "-5s", rot: "-6deg", dir: "rtl" },
  { kind: "motif", motif: "hanbok", top: "40%", dur: "18s", delay: "-11s", rot: "4deg", dir: "ltr" },
  { kind: "motif", motif: "bibimbap", top: "66%", dur: "14s", delay: "-3s", rot: "-3deg", dir: "rtl" },
  { kind: "motif", motif: "fan", top: "50%", dur: "15s", delay: "-8s", rot: "8deg", dir: "ltr" },
  { kind: "motif", motif: "lantern", top: "32%", dur: "17s", delay: "-13s", rot: "-4deg", dir: "rtl" },
];

function Trigram({ x, y, rot, bars }: { x: number; y: number; rot: number; bars: Array<"solid" | "split"> }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} stroke="#111" strokeWidth="1.15" fill="none">
      {bars.map((kind, i) => (
        kind === "solid"
          ? <path key={i} d={`M0 ${i * 3.2}h9`} />
          : <path key={i} d={`M0 ${i * 3.2}h3.5M5.5 ${i * 3.2}h3.5`} />
      ))}
    </g>
  );
}

function IntroMotif({ name }: { name: MotifName }) {
  if (name === "flag") {
    return (
      <svg className="intro-motif intro-motif--flag" viewBox="0 0 72 48" aria-hidden>
        <rect width="72" height="48" rx="2" fill="#fff" stroke="#1a1a1a" strokeWidth="1" />
        <g transform="translate(36 24) rotate(-28)">
          <path fill="#cd2e3a" d="M0-9a9 9 0 0 1 0 18 4.5 4.5 0 0 1 0-9 4.5 4.5 0 0 0 0-9" />
          <path fill="#0047a0" d="M0-9a9 9 0 0 0 0 18 4.5 4.5 0 0 0 0-9 4.5 4.5 0 0 1 0-9" />
        </g>
        <Trigram x={14} y={9} rot={-50} bars={["solid", "solid", "solid"]} />
        <Trigram x={50} y={8} rot={50} bars={["split", "solid", "split"]} />
        <Trigram x={13} y={34} rot={50} bars={["solid", "split", "solid"]} />
        <Trigram x={51} y={33} rot={-50} bars={["split", "split", "split"]} />
      </svg>
    );
  }
  if (name === "hanbok") {
    return (
      <svg className="intro-motif" viewBox="0 0 64 78" aria-hidden>
        <path d="M16 34 L6 74 H58 L48 34 Z" fill="#c23b4a" />
        <path d="M14 28 L2 38 L16 42 Z" fill="#f6ead2" />
        <path d="M50 28 L62 38 L48 42 Z" fill="#f6ead2" />
        <path d="M20 22 H44 L50 38 H14 Z" fill="#f6ead2" />
        <path d="M28 22 L32 32 L36 22" fill="none" stroke="#c23b4a" strokeWidth="1.6" />
        <path d="M32 26 C42 34 46 32 44 46" fill="none" stroke="#c23b4a" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "bibimbap") {
    return (
      <svg className="intro-motif" viewBox="0 0 72 52" aria-hidden>
        <ellipse cx="36" cy="40" rx="28" ry="8" fill="#c9844a" />
        <path d="M10 28 Q10 46 36 48 Q62 46 62 28 L56 31 Q36 40 16 31 Z" fill="#efe6d6" />
        <ellipse cx="36" cy="26" rx="22" ry="11" fill="#f7f1e3" />
        <circle cx="27" cy="24" r="4.2" fill="#d23b3b" />
        <circle cx="40" cy="21" r="3.6" fill="#3d8b4a" />
        <circle cx="33" cy="29" r="3.2" fill="#e2b13c" />
        <circle cx="45" cy="28" r="3.1" fill="#e07a2f" />
        <ellipse cx="36" cy="24" rx="5" ry="3" fill="#fffaf2" />
      </svg>
    );
  }
  if (name === "fan") {
    return (
      <svg className="intro-motif" viewBox="0 0 72 50" aria-hidden>
        <path d="M36 46 L8 20 A34 34 0 0 1 64 20 Z" fill="#f6efe2" stroke="#2b2118" strokeWidth="1.2" />
        <path d="M36 46 L18 16 M36 46 L26 12 M36 46 L36 10 M36 46 L46 12 M36 46 L54 16" stroke="#2b2118" strokeWidth="0.8" />
        <path d="M36 46 L36 12" stroke="#c23b4a" strokeWidth="1.3" />
        <circle cx="36" cy="46" r="2.6" fill="#c9a227" />
      </svg>
    );
  }
  return (
    <svg className="intro-motif" viewBox="0 0 48 72" aria-hidden>
      <path d="M16 8 H32" stroke="#7a1f1f" strokeWidth="2" />
      <path d="M24 8 V14" stroke="#7a1f1f" strokeWidth="1.4" />
      <ellipse cx="24" cy="34" rx="14" ry="18" fill="#e23b3b" />
      <ellipse cx="24" cy="34" rx="8" ry="12" fill="#f7d56a" />
      <path d="M12 22 H36 M12 46 H36" stroke="#f2c14e" strokeWidth="1.6" />
      <path d="M24 52 V64" stroke="#7a1f1f" strokeWidth="1.3" />
      <path d="M16 64 H32" stroke="#c9a227" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function IntroSplash() {
  const pathname = usePathname();
  const { t } = useGlobal();
  const skipRoute = pathname.startsWith("/admin-panel");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [still, setStill] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const close = useCallback(() => {
    clearTimers();
    try {
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode */
    }
    document.documentElement.classList.remove("intro-active");
    setOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (skipRoute) return;
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    document.documentElement.classList.add("intro-active");
    const id = window.setTimeout(() => setOpen(true), 0);
    return () => {
      window.clearTimeout(id);
      document.documentElement.classList.remove("intro-active");
    };
  }, [skipRoute]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      timers.current.push(window.setTimeout(() => setStill(true), 0));
      timers.current.push(window.setTimeout(() => close(), 7000));
    } else {
      PHRASES.forEach((_, i) => {
        timers.current.push(window.setTimeout(() => setIndex(i), i * 1600));
      });
      timers.current.push(window.setTimeout(() => close(), PHRASES.length * 1600 + 400));
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      clearTimers();
    };
  }, [open, close]);

  if (!open || skipRoute) return null;

  const phrase = t(PHRASES[index] || PHRASES[0]);

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true" aria-labelledby="intro-heading">
      <button type="button" className="intro-skip" data-kbd="cancel" onClick={() => close()}>
        {t("intro.skip")}
      </button>
      <div className="intro-sky" aria-hidden>
        {FLOATS.map((item, i) => (
          <span
            key={`${item.kind}-${i}`}
            className={`intro-float intro-float--${item.dir}`}
            style={{ ["--top" as string]: item.top, ["--dur" as string]: item.dur, ["--delay" as string]: item.delay, ["--rot" as string]: item.rot || "0deg" }}
          >
            {item.kind === "pc" ? <span className={`intro-pc intro-pc--${item.tone || "pink"}`} /> : null}
            {item.kind === "plush" && item.src ? (
              <Image className="intro-plush" src={item.src} alt="" width={96} height={96} />
            ) : null}
            {item.kind === "key" ? (
              <span className={`intro-key intro-key--${item.tone || "lilac"}`}>
                <span />
              </span>
            ) : null}
            {item.kind === "motif" && item.motif ? <IntroMotif name={item.motif} /> : null}
          </span>
        ))}
      </div>
      <div className="intro-focus">
        <Image className="intro-mark" src="/branding/logo.png" alt="" width={2938} height={2463} priority />
        {still ? (
          <div className="intro-still">
            {PHRASES.map((key) => (
              <p key={key} id={key === "intro.fans" ? "intro-heading" : undefined}>{t(key)}</p>
            ))}
          </div>
        ) : (
          <p key={PHRASES[index]} id="intro-heading" className="intro-copy">{phrase}</p>
        )}
      </div>
    </div>
  );
}
