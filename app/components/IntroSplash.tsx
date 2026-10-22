"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useGlobal } from "../context/GlobalContext";

const SEEN_KEY = "mkb-intro-seen";

const STEPS: { kind: "logo" | "text"; key?: string; ms: number }[] = [
  { kind: "logo", ms: 1500 },
  { kind: "text", key: "intro.fans", ms: 3400 },
  { kind: "logo", ms: 1300 },
  { kind: "text", key: "intro.groups", ms: 3400 },
  { kind: "logo", ms: 1300 },
  { kind: "text", key: "intro.yours", ms: 4800 },
];

const COPY = ["intro.fans", "intro.groups", "intro.yours"] as const;

export default function IntroSplash() {
  const pathname = usePathname();
  const { t } = useGlobal();
  const skipRoute = pathname.startsWith("/admin-panel");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [still, setStill] = useState(false);
  const logoRef = useRef<HTMLDivElement>(null);
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
    document.documentElement.classList.remove("intro-active", "intro-flying");
    setOpen(false);
  }, []);

  const flyToHeader = useCallback(() => {
    const source = logoRef.current;
    const target = document.getElementById("site-header-logo");
    if (!source || !target) {
      close();
      return;
    }
    const from = source.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (!from.width || !to.width) {
      close();
      return;
    }
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = to.width / from.width;
    document.documentElement.classList.add("intro-flying");
    window.requestAnimationFrame(() => {
      source.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    });
    timers.current.push(window.setTimeout(() => close(), 1750));
  }, [close]);

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
      document.documentElement.classList.remove("intro-active", "intro-flying");
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
      timers.current.push(window.setTimeout(() => close(), 8000));
    } else {
      let delay = 280;
      STEPS.forEach((_, i) => {
        timers.current.push(window.setTimeout(() => setIndex(i), delay));
        delay += STEPS[i].ms;
      });
      timers.current.push(window.setTimeout(() => setIndex(STEPS.length), delay));
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      clearTimers();
    };
  }, [open, close]);

  useEffect(() => {
    if (!open || still || index < STEPS.length) return;
    const id = window.requestAnimationFrame(() => flyToHeader());
    return () => window.cancelAnimationFrame(id);
  }, [open, still, index, flyToHeader]);

  if (!open || skipRoute) return null;

  const step = STEPS[index];
  const showLogo = still || !step || step.kind === "logo";
  const heading = still
    ? t("intro.fans")
    : step?.kind === "text" && step.key
      ? t(step.key)
      : "My K-pop Binder";

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true" aria-labelledby="intro-heading">
      <button type="button" className="intro-skip" onClick={() => close()}>
        {t("intro.skip")}
      </button>
      {still ? (
        <div className="intro-still">
          <Image className="intro-logo" src="/branding/logo.png" alt="" width={2938} height={2463} priority />
          {COPY.map((key) => (
            <p key={key} id={key === "intro.fans" ? "intro-heading" : undefined}>
              {t(key)}
            </p>
          ))}
        </div>
      ) : (
        <div className="intro-stage">
          {showLogo ? (
            <div key={`logo-${index}`} ref={logoRef} className="intro-logo-wrap">
              <Image
                className="intro-logo"
                src="/branding/logo.png"
                alt=""
                width={2938}
                height={2463}
                priority
              />
            </div>
          ) : (
            <p key={step?.key || index} id="intro-heading" className="intro-beat intro-copy">
              {heading}
            </p>
          )}
          {showLogo ? (
            <p id="intro-heading" className="intro-sr">
              {heading}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
