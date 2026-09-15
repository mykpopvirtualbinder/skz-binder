"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Disc, Layers } from "lucide-react";
import { useGlobal } from "../context/GlobalContext";
import MerchClient from "../merch/MerchClient";
import LibraryPageClient from "../library/LibraryPageClient";
import Footer from "../components/footer";

type AlbumsTab = "ediciones" | "inclusiones";

export default function AlbumsPageClient() {
  const { t } = useGlobal();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: AlbumsTab = searchParams.get("tab") === "inclusiones" ? "inclusiones" : "ediciones";

  const setTab = useCallback(
    (next: AlbumsTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "ediciones") params.delete("tab");
      else params.set("tab", "inclusiones");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div style={{ minHeight: "100%", backgroundColor: "var(--bg-main)", color: "var(--text-main)" }}>
      <div style={{ width: "100%", maxWidth: "1400px", margin: "0 auto", padding: "28px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <Disc size={28} color="var(--accent-vibe-violet)" />
          <h1 className="tan-font" style={{ fontSize: 36, color: "var(--text-heading)", margin: 0 }}>
            {t("albums.title") || t("menu.albums") || "ÁLBUMES"}
          </h1>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            borderBottom: "2px solid var(--color-border)",
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setTab("ediciones")}
            style={{
              background: "none",
              border: "none",
              padding: "10px 16px",
              fontSize: 16,
              fontWeight: 900,
              color: tab === "ediciones" ? "var(--accent-vibe-violet)" : "var(--text-muted)",
              borderBottom: tab === "ediciones" ? "3px solid var(--accent-vibe-violet)" : "3px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Disc size={18} />
            {t("albums.tab_editions") || "Ediciones"}
          </button>
          <button
            type="button"
            onClick={() => setTab("inclusiones")}
            style={{
              background: "none",
              border: "none",
              padding: "10px 16px",
              fontSize: 16,
              fontWeight: 900,
              color: tab === "inclusiones" ? "var(--accent-vibe-violet)" : "var(--text-muted)",
              borderBottom: tab === "inclusiones" ? "3px solid var(--accent-vibe-violet)" : "3px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Layers size={18} />
            {t("albums.tab_inclusions") || "Inclusiones"}
          </button>
        </div>
      </div>
      {tab === "ediciones" ? <MerchClient variant="albums" /> : <LibraryPageClient catalog="inclusions" />}
      <Footer />
    </div>
  );
}
