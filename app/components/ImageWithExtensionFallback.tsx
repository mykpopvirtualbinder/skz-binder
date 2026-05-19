"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildMockPcImageCandidates } from "@/lib/mock-pc-url";
import { encodeMockPcPathUrl } from "@/lib/mock-pc-url";

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
};

export default function ImageWithExtensionFallback({
  src,
  fallbackSrc = "/mock-pcs/groups/not-available.png",
  onError,
  loading = "lazy",
  decoding = "async",
  ...rest
}: Props) {
  const candidates = useMemo(
    () => buildMockPcImageCandidates(typeof src === "string" ? src : undefined, fallbackSrc),
    [src, fallbackSrc],
  );
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const mountedRef = useRef(true);
  const srcGenerationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    srcGenerationRef.current += 1;
    setCandidateIdx(0);
    setUseFallback(false);
  }, [src, fallbackSrc]);

  const fallbackEncoded =
    encodeMockPcPathUrl(String(fallbackSrc).trim()) || String(fallbackSrc).trim();

  const displaySrc = useFallback
    ? fallbackEncoded
    : (candidates[candidateIdx] ?? fallbackEncoded);

  return (
    <img
      {...rest}
      loading={loading}
      decoding={decoding}
      src={displaySrc}
      onError={(e) => {
        if (!mountedRef.current) return;
        const gen = srcGenerationRef.current;
        setCandidateIdx((prev) => {
          if (!mountedRef.current || gen !== srcGenerationRef.current) return prev;
          const next = prev + 1;
          if (next < candidates.length) return next;
          queueMicrotask(() => {
            if (!mountedRef.current || gen !== srcGenerationRef.current) return;
            setUseFallback(true);
            onError?.(e);
          });
          return prev;
        });
      }}
    />
  );
}
