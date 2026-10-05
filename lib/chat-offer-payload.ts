export const APP_OFFER_PREFIX = "[APP_OFFER_PAYLOAD]";
export const APP_WTS_OFFER_PREFIX = "[APP_WTS_OFFER_PAYLOAD]";

export type ChatOfferItem = {
  id?: number | string;
  type?: string;
  image_url?: string;
  member?: string;
  version?: string;
  name?: string | null;
  itemType?: string;
};

export type ChatOfferPayload = {
  isWtsOffer?: boolean;
  isSpecialOffer?: boolean;
  price?: number;
  currency?: string;
  listingId?: string;
  listingItem?: ChatOfferItem;
  koins?: number | string | ChatOfferItem[];
  items?: ChatOfferItem[];
  text?: string;
};

export function parseChatOffer(content: string): { kind: "wts" | "trade"; payload: ChatOfferPayload } | null {
  if (!content) return null;
  try {
    if (content.startsWith(APP_WTS_OFFER_PREFIX)) {
      return { kind: "wts", payload: JSON.parse(content.slice(APP_WTS_OFFER_PREFIX.length)) as ChatOfferPayload };
    }
    if (content.startsWith(APP_OFFER_PREFIX)) {
      return { kind: "trade", payload: JSON.parse(content.slice(APP_OFFER_PREFIX.length)) as ChatOfferPayload };
    }
  } catch {
    if (content.startsWith(APP_WTS_OFFER_PREFIX)) return { kind: "wts", payload: {} };
    if (content.startsWith(APP_OFFER_PREFIX)) return { kind: "trade", payload: {} };
  }
  return null;
}

export function offerItems(payload: ChatOfferPayload): ChatOfferItem[] {
  if (Array.isArray(payload.items) && payload.items.length) return payload.items;
  if (Array.isArray(payload.koins)) return payload.koins;
  return [];
}

export function offerKoinsAmount(payload: ChatOfferPayload): number {
  if (typeof payload.koins === "number" && Number.isFinite(payload.koins)) return payload.koins;
  if (typeof payload.koins === "string") {
    const n = Number(payload.koins);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function offerPreviewText(content: string, labels: { wts: string; trade: string }): string {
  const parsed = parseChatOffer(content);
  if (!parsed) return content;
  const text = String(parsed.payload.text || "").trim();
  const title = parsed.kind === "wts" ? labels.wts : labels.trade;
  if (text) return `${title}: ${text}`;
  return title;
}
