"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookHeart } from "lucide-react";
import { useGlobal } from "../context/GlobalContext";
import { saveBindersReturn } from "@/lib/binders-return";

export default function BindersShortcut() {
  const { t } = useGlobal();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goHref = () => {
    const qs = searchParams?.toString() ?? "";
    saveBindersReturn(qs ? `${pathname}?${qs}` : pathname || "/");
  };

  return (
    <Link
      href="/binders"
      onClick={goHref}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 999,
        border: "1px solid var(--color-border)",
        background: "var(--bg-card)",
        color: "var(--color-primary)",
        fontWeight: 900,
        fontSize: 13,
        textDecoration: "none",
        boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 12%, transparent)",
        whiteSpace: "nowrap",
      }}
    >
      <BookHeart size={16} />
      {t("common.go_binders") || t("menu.binders") || "Binders"}
    </Link>
  );
}
