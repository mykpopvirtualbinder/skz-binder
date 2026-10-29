const PEER_MESSAGE_TYPES = new Set([
  "chat_message",
  "wtt_message",
  "wts_message",
  "offer_message",
  "deal_message",
  "deal_settled",
]);

/** Mensaje escrito de una cuenta a otra. El resto de avisos se lee como un correo. */
export function isUserToUserMessage(type: string | null | undefined): boolean {
  const value = String(type || "");
  return PEER_MESSAGE_TYPES.has(value) || value.startsWith("deal_");
}
