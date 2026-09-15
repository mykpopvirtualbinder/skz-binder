"use client";

import { useEffect, useMemo, useState } from "react";
import { loadAdsForSlot, type AdCampaign, type AdDevice, type AdPlacement } from "@/lib/ads";

type Props = {
  placement: AdPlacement;
  device: AdDevice;
  section?: string;
  className?: string;
  count?: number;
};

export default function AdSlot({ placement, device, section = "all", className, count = 1 }: Props) {
  const [ads, setAds] = useState<AdCampaign[]>([]);
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

  const visibleAds = useMemo(() => {
    if (!ads.length) return [];
    const safeCount = Math.max(1, count);
    if (ads.length <= safeCount) return ads;
    return Array.from({ length: safeCount }, (_, i) => ads[(index + i) % ads.length]);
  }, [ads, index, count]);

  if (!visibleAds.length) return null;

  return (
    <div className={`ad-slot-stack${className ? ` ${className}` : ""}`}>
      {visibleAds.map((ad, i) => (
        <a
          key={`${ad.id}-${i}`}
          href={ad.target_url}
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "none" }}
          aria-label={`Publicidad: ${ad.title}`}
        >
          <article className="ad-slot-card">
            <span className="ad-slot-badge">Publicidad</span>
            {ad.image_url ? (
              <img src={ad.image_url} alt={ad.title} className="ad-slot-image" loading="lazy" />
            ) : (
              <div className="ad-slot-image ad-slot-image-placeholder">
                <span>{ad.title}</span>
              </div>
            )}
            <div className="ad-slot-content">
              <strong className="ad-slot-title">{ad.title}</strong>
              {ad.subtitle ? <span className="ad-slot-subtitle">{ad.subtitle}</span> : null}
            </div>
          </article>
        </a>
      ))}
    </div>
  );
}
