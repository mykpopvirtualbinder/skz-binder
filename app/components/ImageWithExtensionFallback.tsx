"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildMockPcBackCandidates, buildMockPcImageCandidates, encodeMockPcPathUrl } from "@/lib/mock-pc-url";

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
  /** Front photocard URL — `src` is the stored back; candidates include member and OT8 backs. */
  frontSrcForBack?: string;
};

function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[8] === 0x57 && bytes[9] === 0x45) {
    return "image/webp";
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return "image/heic";
  }
  return null;
}

export default function ImageWithExtensionFallback({
  src,
  fallbackSrc,
  frontSrcForBack,
  onError,
  loading = "lazy",
  decoding = "async",
  ...rest
}: Props) {
  const resolvedFallback =
    fallbackSrc ??
    (frontSrcForBack ? "/mock-pcs/groups/default-back.png" : "/mock-pcs/groups/not-available.png");
  const candidates = useMemo(() => {
    const raw = typeof src === "string" ? src : undefined;
    const front = String(frontSrcForBack || "").trim();
    if (front && /^\/mock-pcs\//i.test(front)) {
      return buildMockPcBackCandidates(front, raw, resolvedFallback);
    }
    return buildMockPcImageCandidates(raw, resolvedFallback);
  }, [src, resolvedFallback, frontSrcForBack]);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const blobSrcRef = useRef<string | null>(null);
  const sniffingRef = useRef(false);
  const mountedRef = useRef(true);
  const srcGenerationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (blobSrcRef.current) {
        URL.revokeObjectURL(blobSrcRef.current);
        blobSrcRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    srcGenerationRef.current += 1;
    setCandidateIdx(0);
    setUseFallback(false);
    setBlobSrc(null);
    sniffingRef.current = false;
    if (blobSrcRef.current) {
      URL.revokeObjectURL(blobSrcRef.current);
      blobSrcRef.current = null;
    }
  }, [src, resolvedFallback, frontSrcForBack]);

  const fallbackEncoded =
    encodeMockPcPathUrl(String(resolvedFallback).trim()) || String(resolvedFallback).trim();

  const displaySrc = blobSrc
    ? blobSrc
    : useFallback
      ? fallbackEncoded
      : (candidates[candidateIdx] ?? fallbackEncoded);

  const trySniffBlob = async (url: string, gen: number) => {
    if (sniffingRef.current) return false;
    sniffingRef.current = true;
    try {
      const res = await fetch(url);
      if (!res.ok) return false;
      const buf = await res.arrayBuffer();
      if (!mountedRef.current || gen !== srcGenerationRef.current) return false;
      const mime = sniffImageMime(new Uint8Array(buf.slice(0, 16)));
      if (!mime || mime === "image/heic") return false;
      const objectUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
      if (blobSrcRef.current) URL.revokeObjectURL(blobSrcRef.current);
      blobSrcRef.current = objectUrl;
      setBlobSrc(objectUrl);
      return true;
    } catch {
      return false;
    } finally {
      sniffingRef.current = false;
    }
  };

  return (
    <img
      {...rest}
      loading={loading}
      decoding={decoding}
      src={displaySrc}
      onError={(e) => {
        if (!mountedRef.current) return;
        const gen = srcGenerationRef.current;
        if (blobSrc) {
          setUseFallback(true);
          onError?.(e);
          return;
        }
        setCandidateIdx((prev) => {
          if (!mountedRef.current || gen !== srcGenerationRef.current) return prev;
          const next = prev + 1;
          if (next < candidates.length) return next;
          const original = typeof src === "string" ? encodeMockPcPathUrl(src.trim()) || src : "";
          const last = candidates[prev] || original;
          queueMicrotask(() => {
            if (!mountedRef.current || gen !== srcGenerationRef.current) return;
            void (async () => {
              const ok = original ? await trySniffBlob(original, gen) : false;
              if (ok || !mountedRef.current || gen !== srcGenerationRef.current) return;
              if (last && last !== original) {
                const okLast = await trySniffBlob(last, gen);
                if (okLast || !mountedRef.current || gen !== srcGenerationRef.current) return;
              }
              setUseFallback(true);
              onError?.(e);
            })();
          });
          return prev;
        });
      }}
    />
  );
}
