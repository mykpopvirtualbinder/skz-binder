"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import ItemPicker from "../components/ItemPicker";
import type { ChatOfferItem, ChatOfferPayload } from "@/lib/chat-offer-payload";
import { termsFromOffer, type DealTerms } from "@/lib/chat-deal-payload";

export default function OfferDealModal({
  t,
  kind,
  offer,
  meId,
  bidderId,
  ownerId,
  initialStep = "choose",
  onClose,
  onSubmit,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  kind: "wts" | "trade";
  offer: ChatOfferPayload;
  meId: string;
  bidderId: string;
  ownerId: string;
  initialStep?: "choose" | "counter";
  onClose: () => void;
  onSubmit: (action: "accept" | "reject" | "counter", terms: DealTerms, note: string) => void;
}) {
  const initial = termsFromOffer(kind, offer);
  const iAmOwner = meId === ownerId;
  const theirId = iAmOwner ? bidderId : ownerId;
  const [step, setStep] = useState<"choose" | "counter">(initialStep);
  const [price, setPrice] = useState(String(initial.price || ""));
  const [koins, setKoins] = useState(String(initial.koins || ""));
  const [note, setNote] = useState(initial.note || "");
  const [itemsFromBidder, setItemsFromBidder] = useState<ChatOfferItem[]>(initial.itemsFromBidder);
  const [itemsFromOwner, setItemsFromOwner] = useState<ChatOfferItem[]>(initial.itemsFromOwner);
  const [picking, setPicking] = useState<"theirs" | "mine" | null>(null);

  const currentTerms = (): DealTerms => ({
    ...initial,
    price: Number(price) || 0,
    koins: Number(koins) || 0,
    itemsFromBidder,
    itemsFromOwner,
    note: note.trim(),
  });

  const myCount = iAmOwner ? itemsFromOwner.length : itemsFromBidder.length;
  const theirCount = iAmOwner ? itemsFromBidder.length : itemsFromOwner.length;

  if (picking) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 70000, background: "var(--overlay-strong)" }}>
        <ItemPicker
          userId={picking === "theirs" ? theirId : meId}
          remoteCatalog={picking === "theirs"}
          initialSelected={
            picking === "theirs"
              ? (iAmOwner ? itemsFromBidder : itemsFromOwner)
              : (iAmOwner ? itemsFromOwner : itemsFromBidder)
          }
          onSelect={(list: ChatOfferItem[]) => {
            if (picking === "theirs") {
              if (iAmOwner) setItemsFromBidder(list);
              else setItemsFromOwner(list);
            } else if (iAmOwner) setItemsFromOwner(list);
            else setItemsFromBidder(list);
            setPicking(null);
          }}
          onCancel={() => setPicking(null)}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70000, background: "var(--overlay-strong)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 440, maxHeight: "92vh", overflowY: "auto", background: "var(--bg-card)", borderRadius: 24, border: "1px solid var(--color-border)", padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "var(--color-primary)", fontWeight: 900 }}>
            {step === "counter" ? t("me.deal_counter") : t("me.deal_title")}
          </h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={22} color="var(--color-primary)" /></button>
        </div>

        {step === "choose" ? (
          <>
            <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, lineHeight: 1.5 }}>{t("me.deal_choose_hint")}</p>
            <button type="button" onClick={() => onSubmit("accept", currentTerms(), note)} style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "none", background: "var(--color-primary)", color: "white", fontWeight: 900, cursor: "pointer" }}>
              {t("me.deal_accept")}
            </button>
            <button type="button" onClick={() => setStep("counter")} style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--bg-soft)", color: "var(--color-primary)", fontWeight: 900, cursor: "pointer" }}>
              {t("me.deal_counter")}
            </button>
            <button type="button" onClick={() => onSubmit("reject", currentTerms(), note)} style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "none", background: "transparent", color: "var(--state-danger-fg)", fontWeight: 900, cursor: "pointer" }}>
              {t("me.deal_reject")}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, lineHeight: 1.5 }}>{t("me.deal_money_note")}</p>

            <label style={{ display: "block", fontSize: 11, fontWeight: 900, color: "var(--text-muted)", marginTop: 14 }}>{t("me.deal_price")}</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="0.01" style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "var(--text-main)", fontWeight: 800 }} />

            <label style={{ display: "block", fontSize: 11, fontWeight: 900, color: "var(--text-muted)", marginTop: 12 }}>{t("me.deal_koins")}</label>
            <input value={koins} onChange={(e) => setKoins(e.target.value)} type="number" min="0" step="1" style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "var(--text-main)", fontWeight: 800 }} />

            <button type="button" onClick={() => setPicking("theirs")} style={{ width: "100%", marginTop: 14, padding: 10, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--bg-soft)", color: "var(--color-primary)", fontWeight: 900, cursor: "pointer" }}>
              {t("me.deal_pick_their_pcs")} ({theirCount})
            </button>
            <button type="button" onClick={() => setPicking("mine")} style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--bg-soft)", color: "var(--color-primary)", fontWeight: 900, cursor: "pointer" }}>
              {t("me.deal_pick_my_pcs")} ({myCount})
            </button>

            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t("me.deal_note")} style={{ width: "100%", marginTop: 12, padding: 10, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "var(--text-main)", fontWeight: 600, resize: "none" }} />

            <button type="button" onClick={() => onSubmit("counter", currentTerms(), note)} style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "none", background: "var(--color-primary)", color: "white", fontWeight: 900, cursor: "pointer" }}>
              {t("me.deal_send_counter")}
            </button>
            {initialStep !== "counter" && (
              <button type="button" onClick={() => setStep("choose")} style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "none", background: "transparent", color: "var(--color-primary)", fontWeight: 900, cursor: "pointer" }}>
                {t("me.deal_back")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
