"use client";

import ImageWithExtensionFallback from "@/app/components/ImageWithExtensionFallback";
import { dealPreviewText } from "@/lib/chat-deal-payload";
import { offerPreviewText } from "@/lib/chat-offer-payload";

type NoticeLetterData = {
  type: string;
  content: string;
  created_at: string;
  image_url?: string | null;
  sender_profile?: { display_name?: string | null; avatar_url?: string | null };
};

export default function NoticeLetter({
  notice,
  onClose,
  labels,
}: {
  notice: NoticeLetterData;
  onClose: () => void;
  labels: { close: string; from: string; accept: string; reject: string; counter: string; settled: string; confirm: string; wts: string; trade: string };
}) {
  const from = notice.type === "admin_message"
    ? "My K-pop Binder"
    : (notice.sender_profile?.display_name || "My K-pop Binder");
  const body = dealPreviewText(notice.content, {
    accept: labels.accept,
    reject: labels.reject,
    counter: labels.counter,
    settled: labels.settled,
    confirm: labels.confirm,
  }) || offerPreviewText(notice.content, { wts: labels.wts, trade: labels.trade });
  const photo = notice.type === "admin_message" && notice.image_url && (notice.image_url.startsWith("/") || notice.image_url.startsWith("http"))
    ? notice.image_url
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-kbd-root
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 6000, padding: "20px", backdropFilter: "blur(4px)" }}
    >
      <article
        onClick={(event) => event.stopPropagation()}
        style={{ background: "var(--bg-card)", color: "var(--text-main)", width: "100%", maxWidth: 640, maxHeight: "85vh", overflow: "auto", borderRadius: 20, border: "1px solid var(--color-border)", boxShadow: "0 20px 50px var(--shadow-card)" }}
      >
        <header style={{ padding: "18px 22px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>{labels.from}</div>
            <h2 className="tan-font" style={{ margin: "4px 0 0", color: "var(--color-primary)", fontSize: 22 }}>{from}</h2>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{new Date(notice.created_at).toLocaleString()}</div>
          </div>
          <button type="button" data-kbd="cancel" onClick={onClose} style={{ background: "var(--bg-soft)", color: "var(--color-primary)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "8px 12px", fontWeight: 900, cursor: "pointer" }}>
            {labels.close}
          </button>
        </header>
        <div style={{ padding: "22px", display: "flex", gap: 16, alignItems: "flex-start" }}>
          {photo ? (
            <ImageWithExtensionFallback src={photo} alt="" style={{ width: 92, height: 122, objectFit: "cover", borderRadius: 10, border: "1px solid var(--color-border)", flexShrink: 0 }} />
          ) : null}
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-wrap", fontWeight: 600 }}>{body}</p>
        </div>
      </article>
    </div>
  );
}
