import type { ChatOfferItem, ChatOfferPayload } from "@/lib/chat-offer-payload";
import { APP_OFFER_PREFIX, APP_WTS_OFFER_PREFIX, offerItems, offerKoinsAmount } from "@/lib/chat-offer-payload";

export const APP_DEAL_PREFIX = "[APP_DEAL_PAYLOAD]";

export type DealAction = "accept" | "reject" | "counter" | "confirm" | "settled";

export type DealTerms = {
  price: number;
  currency: string;
  koins: number;
  koinsPayer: "bidder" | "owner";
  itemsFromBidder: ChatOfferItem[];
  itemsFromOwner: ChatOfferItem[];
  listingId?: string;
  note?: string;
};

export type ChatDealPayload = {
  isDeal: true;
  dealId: string;
  action: DealAction;
  kind: "wts" | "trade";
  ownerId: string;
  bidderId: string;
  terms: DealTerms;
  confirmedBy: string[];
  settled?: boolean;
  parentMessageId?: string;
};

export function parseChatDeal(content: string): ChatDealPayload | null {
  if (!content?.startsWith(APP_DEAL_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(APP_DEAL_PREFIX.length)) as ChatDealPayload;
    if (!parsed?.dealId || !parsed?.isDeal) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function serializeChatDeal(payload: ChatDealPayload) {
  return `${APP_DEAL_PREFIX}${JSON.stringify(payload)}`;
}

export function termsFromOffer(
  kind: "wts" | "trade",
  offer: ChatOfferPayload,
): DealTerms {
  const listing = (offer as ChatOfferPayload & { listingItem?: ChatOfferItem }).listingItem;
  return {
    price: Number(offer.price) || 0,
    currency: String(offer.currency || "EUR"),
    koins: offerKoinsAmount(offer),
    koinsPayer: "bidder",
    itemsFromBidder: offerItems(offer),
    itemsFromOwner: listing ? [listing] : [],
    listingId: offer.listingId,
    note: offer.text,
  };
}

export function offerFromTerms(terms: DealTerms): ChatOfferPayload {
  return {
    price: terms.price,
    currency: terms.currency,
    listingId: terms.listingId,
    listingItem: terms.itemsFromOwner[0],
    items: terms.itemsFromBidder,
    koins: terms.koins,
    text: terms.note,
  };
}

export function newDealId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `deal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function dealPreviewText(
  content: string,
  labels: { accept: string; reject: string; counter: string; settled: string; confirm: string },
): string | null {
  const deal = parseChatDeal(content);
  if (!deal) return null;
  const title =
    deal.action === "reject" ? labels.reject
    : deal.action === "counter" ? labels.counter
    : deal.action === "settled" || deal.settled ? labels.settled
    : deal.action === "confirm" ? labels.confirm
    : labels.accept;
  const bits = [title];
  if (deal.terms?.price) bits.push(`${deal.terms.price} ${deal.terms.currency || "EUR"}`);
  if (deal.terms?.koins) bits.push(`${deal.terms.koins} K-oins`);
  const note = String(deal.terms?.note || "").trim();
  if (note) bits.push(note);
  return bits.join(" · ");
}

export { APP_OFFER_PREFIX, APP_WTS_OFFER_PREFIX };
