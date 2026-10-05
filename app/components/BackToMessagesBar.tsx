"use client";

import { readNoticeReturn, goToNoticeChat } from "@/lib/notice-return";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function BackToMessagesBar({ label }: { label: string }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(Boolean(readNoticeReturn()?.senderId));
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => goToNoticeChat((href) => router.push(href))}
      style={{
        position: "fixed",
        bottom: "22px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50000,
        background: "var(--text-main)",
        color: "var(--bg-main)",
        border: "none",
        borderRadius: "999px",
        padding: "12px 18px",
        fontWeight: 900,
        fontSize: "13px",
        cursor: "pointer",
        boxShadow: "0 10px 30px var(--shadow-card)",
      }}
    >
      {label}
    </button>
  );
}
