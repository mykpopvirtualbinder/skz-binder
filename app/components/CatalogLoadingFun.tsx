"use client";

import { useEffect, useState } from "react";
import { useGlobal } from "../context/GlobalContext";

export default function CatalogLoadingFun({ title, fullPage }: { title?: string; fullPage?: boolean }) {
  const { t } = useGlobal();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setIdx((i) => (i + 1) % 3), 1800);
    return () => window.clearInterval(id);
  }, []);

  const inner = (
    <div className="library-loading-fun" role="status" aria-live="polite">
      <div className="library-loading-fun__card" aria-hidden>
        <img src="/branding/logo.png" alt="" />
      </div>
      <p className="library-loading-fun__title">
        {title || (fullPage ? t("common.page_loading_title") : t("common.library_loading_title")) || "Cargando…"}
      </p>
      <p className="library-loading-fun__hint">
        {t(`common.library_loading_fun_${(idx % 3) + 1}`) || t("common.library_loading_hint") || t("common.loading")}
      </p>
    </div>
  );

  if (fullPage) {
    return (
      <div
        style={{
          minHeight: "calc(100vh - 120px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-main)",
          padding: 24,
        }}
      >
        {inner}
      </div>
    );
  }

  return inner;
}
