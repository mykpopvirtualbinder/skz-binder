"use client";

import { useEffect, useMemo, useState } from "react";
import { loadAdsForSlot, type AdCampaign, type AdDevice, type AdPlacement } from "@/lib/ads";
import { useGlobal } from "@/app/context/GlobalContext";
import { splitTitleBody } from "@/lib/fanfic-translation";

type Props = {
  placement: AdPlacement;
  device: AdDevice;
  section?: string;
  className?: string;
  count?: number;
};

export default function AdSlot({ placement, device, section = "all", className, count = 1 }: Props) {
  const { t, uiLanguage } = useGlobal();
  const [ads, setAds] = useState<AdCampaign[]>([]);
  const [liveCopy, setLiveCopy] = useState<Record<string, { title: string; subtitle?: string | null }>>({});
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    loadAdsForSlot(placement, device, section).then((data) => {
      if (!alive) return;
      setAds(data);
      setIndex(0);
    });
    return () => {
      alive = false;
    };
  }, [placement, device, section]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % ads.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [ads]);

  useEffect(() => {
    const lang = String(uiLanguage || "es").toLowerCase();
    const pending = ads.filter((ad) => !ad.titleKey && lang !== "es");
    if (!pending.length) {
      setLiveCopy({});
      return;
    }
    let alive = true;
    (async () => {
      const next: Record<string, { title: string; subtitle?: string | null }> = {};
      await Promise.all(
        pending.map(async (ad) => {
          const cacheKey = `adxl:${lang}:${ad.id}`;
          try {
            const hit = sessionStorage.getItem(cacheKey);
            if (hit) {
              next[ad.id] = JSON.parse(hit);
              return;
            }
            const res = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mode: "single",
                targetLang: lang,
                text: ad.subtitle ? `${ad.title}\n|||\n${ad.subtitle}` : ad.title,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) return;
            const parsed = splitTitleBody(String(json.translation || ""), ad.title, ad.subtitle || "");
            const value = {
              title: parsed.title,
              subtitle: ad.subtitle ? parsed.body : ad.subtitle,
            };
            sessionStorage.setItem(cacheKey, JSON.stringify(value));
            next[ad.id] = value;
          } catch {
            /* keep original copy */
          }
        })
      );
      if (alive) setLiveCopy(next);
    })();
    return () => {
      alive = false;
    };
  }, [ads, uiLanguage]);

  const visibleAds = useMemo(() => {
    if (!ads.length) return [];
    const safeCount = Math.max(1, count);
    if (ads.length <= safeCount) return ads;
    return Array.from({ length: safeCount }, (_, i) => ads[(index + i) % ads.length]);
  }, [ads, index, count]);

  if (!visibleAds.length) return null;

  return (
    <div className={`ad-slot-stack${className ? ` ${className}` : ""}`}>
      {visibleAds.map((ad, i) => {
        const live = liveCopy[ad.id];
        const title = ad.titleKey ? t(ad.titleKey) : live?.title || ad.title;
        const subtitle = ad.subtitleKey ? t(ad.subtitleKey) : live?.subtitle ?? ad.subtitle;
        return (
          <a
            key={`${ad.id}-${i}`}
            href={ad.target_url}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none" }}
            aria-label={`${t("ads.badge")}: ${title}`}
          >
            <article className="ad-slot-card">
              <span className="ad-slot-badge">{t("ads.badge")}</span>
              {ad.image_url ? (
                <img src={ad.image_url} alt={title} className="ad-slot-image" loading="lazy" />
              ) : (
                <div className="ad-slot-image ad-slot-image-placeholder">
                  <span>{title}</span>
                </div>
              )}
              <div className="ad-slot-content">
                <strong className="ad-slot-title">{title}</strong>
                {subtitle ? <span className="ad-slot-subtitle">{subtitle}</span> : null}
              </div>
            </article>
          </a>
        );
      })}
    </div>
  );
}
