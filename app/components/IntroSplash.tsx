"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useGlobal } from "../context/GlobalContext";

const SEEN_KEY = "mkb-intro-seen-2";
const PHRASES = ["intro.fans", "intro.groups", "intro.yours", "intro.send"] as const;

const FLOATS: Array<{
  kind: "pc" | "plush" | "key";
  src?: string;
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
];

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
      <button type="button" className="intro-skip" onClick={() => close()}>
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
