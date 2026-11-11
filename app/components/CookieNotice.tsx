"use client";

import React, { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useGlobal } from "../context/GlobalContext";
import {
  OPEN_COOKIE_SETTINGS,
  readCookieChoice,
  writeCookieChoice,
  type CookieChoice,
} from "@/lib/cookie-consent";

export default function CookieNotice() {
  const { t } = useGlobal();
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState<CookieChoice | null>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(true);

  useEffect(() => {
    const saved = readCookieChoice();
    setChoice(saved);
    setAnalyticsOn(saved !== "necessary");
    setOpen(saved == null);
    setReady(true);
    const show = () => {
      const current = readCookieChoice();
      setChoice(current);
      setAnalyticsOn(current !== "necessary");
      setPanel(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS, show);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, show);
  }, []);

  const save = (next: CookieChoice) => {
    writeCookieChoice(next);
    setChoice(next);
    setAnalyticsOn(next === "all");
    setPanel(false);
    setOpen(false);
  };

  return (
    <>
      {ready && choice === "all" ? (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      ) : null}
      {open ? (
        <aside
          aria-label={t("cookies_banner.policy_link")}
          style={{
            position: "fixed",
            left: "16px",
            right: "16px",
            bottom: "16px",
            zIndex: 4000,
            maxWidth: "720px",
            margin: "0 auto",
            background: "var(--bg-card)",
            color: "var(--text-main)",
            border: "1px solid var(--color-border)",
            borderRadius: "20px",
            boxShadow: "0 16px 40px var(--shadow-card)",
            padding: "18px 18px 16px",
          }}
        >
          <p style={{ margin: "0 0 14px", fontSize: "14px", lineHeight: 1.5, fontWeight: 650 }}>
            {t("cookies_banner.lead_before")}
            <a href="/privacy#cookies" style={{ color: "var(--color-primary)", fontWeight: 800 }}>
              {t("cookies_banner.policy_link")}
            </a>
            {t("cookies_banner.lead_after")}
          </p>
          {panel ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13px", fontWeight: 750 }}>
                <input type="checkbox" checked disabled />
                <span>{t("cookies_banner.tech")}</span>
              </label>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", fontWeight: 650 }}>
                {t("cookies_banner.tech_help")}
              </p>
              <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13px", fontWeight: 750 }}>
                <input type="checkbox" checked={analyticsOn} onChange={(e) => setAnalyticsOn(e.target.checked)} />
                <span>{t("cookies_banner.measure")}</span>
              </label>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", fontWeight: 650 }}>
                {t("cookies_banner.measure_help")}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                <button type="button" onClick={() => save("all")} style={primaryButton}>
                  {t("cookies_banner.accept")}
                </button>
                <button type="button" onClick={() => save(analyticsOn ? "all" : "necessary")} style={ghostButton}>
                  {t("cookies_banner.save")}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button type="button" onClick={() => save("all")} style={primaryButton}>
                {t("cookies_banner.accept")}
              </button>
              <button type="button" onClick={() => setPanel(true)} style={ghostButton}>
                {t("cookies_banner.setup")}
              </button>
            </div>
          )}
        </aside>
      ) : null}
    </>
  );
}

const primaryButton: React.CSSProperties = {
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const ghostButton: React.CSSProperties = {
  background: "transparent",
  color: "var(--color-primary)",
  border: "1px solid var(--color-border)",
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: 800,
  cursor: "pointer",
};
