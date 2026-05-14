"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { encodeMockPcPathUrl } from "@/lib/mock-pc-url";
import { PC_IMAGE_EXTENSIONS, splitPcImageStemExt } from "@/lib/pc-image-extensions";

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
};

function extUpperVariant(alt: string): string {
  return alt.toUpperCase();
}

function buildCandidates(src: string | undefined, fallbackSrc?: string): string[] {
  const rawBase = String(src || "").trim();
  const base = encodeMockPcPathUrl(rawBase);
  const normFallback = fallbackSrc
    ? encodeMockPcPathUrl(String(fallbackSrc).trim()) || String(fallbackSrc).trim()
    : undefined;
  const out: string[] = [];
  const pushUnique = (v: string) => {
    if (v && !out.includes(v)) out.push(v);
  };
  const pathVariants = (v: string): string[] => {
    const vars = [v];
    if (v.includes("/korean-albums/")) vars.push(v.replace("/korean-albums/", "/korean-album/"));
    if (v.includes("/korean-album/")) vars.push(v.replace("/korean-album/", "/korean-albums/"));
    if (v.includes("/japanese-albums/")) vars.push(v.replace("/japanese-albums/", "/japanese-album/"));
    if (v.includes("/japanese-album/")) vars.push(v.replace("/japanese-album/", "/japanese-albums/"));
    if (v.includes("/taiwanese-albums/")) vars.push(v.replace("/taiwanese-albums/", "/taiwanese-album/"));
    if (v.includes("/taiwanese-album/")) vars.push(v.replace("/taiwanese-album/", "/taiwanese-albums/"));
    return vars;
  };
  /** Exact URL, path aliases, otras extensiones de imagen y mayúsculas/minúsculas (p. ej. .JPG en Linux). */
  const pushWithExtVariants = (v: string) => {
    pathVariants(v).forEach(pushUnique);
    const se = splitPcImageStemExt(v);
    if (!se) return;
    const ordered = [se.extLower, ...PC_IMAGE_EXTENSIONS.filter((e) => e !== se.extLower)];
    for (const alt of ordered) {
      pathVariants(`${se.stem}.${alt}`).forEach(pushUnique);
      pathVariants(`${se.stem}.${extUpperVariant(alt)}`).forEach(pushUnique);
    }
  };
  if (!base) return normFallback ? [normFallback] : [];
  pushWithExtVariants(base);
  if (normFallback) pushUnique(normFallback);
  return out;
}

export default function ImageWithExtensionFallback({
  src,
  fallbackSrc = "/mock-pcs/groups/not-available.png",
  onError,
  ...rest
}: Props) {
  const candidates = useMemo(
    () => buildCandidates(typeof src === "string" ? src : undefined, fallbackSrc),
    [src, fallbackSrc]
  );
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [candidatesExhausted, setCandidatesExhausted] = useState(false);
  const stopExtFallbackRef = useRef(false);

  useEffect(() => {
    setCandidateIdx(0);
    setCandidatesExhausted(false);
    stopExtFallbackRef.current = false;
  }, [src, fallbackSrc]);

  const displaySrc = candidatesExhausted
    ? encodeMockPcPathUrl(String(fallbackSrc).trim()) || fallbackSrc
    : (candidates[candidateIdx] ?? fallbackSrc);

  return (
    <img
      {...rest}
      src={displaySrc}
      onError={(e) => {
        if (stopExtFallbackRef.current) return;
        setCandidateIdx((prev) => {
          const next = prev + 1;
          if (next < candidates.length) return next;
          stopExtFallbackRef.current = true;
          queueMicrotask(() => {
            onError?.(e);
            setCandidatesExhausted(true);
          });
          return prev;
        });
      }}
    />
  );
}
