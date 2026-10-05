export const NOTICE_RETURN_KEY = "notice_return";

export type NoticeReturnState = {
  senderId: string;
  senderName?: string;
  senderAvatar?: string | null;
  messageId?: string;
};

export function saveNoticeReturn(state: NoticeReturnState) {
  if (typeof window === "undefined" || !state.senderId) return;
  try {
    sessionStorage.setItem(NOTICE_RETURN_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function readNoticeReturn(): NoticeReturnState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(NOTICE_RETURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NoticeReturnState;
    if (!parsed?.senderId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearNoticeReturn() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(NOTICE_RETURN_KEY);
  } catch {
    /* ignore */
  }
}

export function noticeChatHref(state?: NoticeReturnState | null) {
  const senderId = state?.senderId;
  if (!senderId) return "/me?tab=notices";
  const params = new URLSearchParams({ tab: "notices", chat: senderId });
  if (state?.messageId) params.set("msg", state.messageId);
  return `/me?${params.toString()}`;
}

export function goToNoticeChat(push: (href: string) => void) {
  const state = readNoticeReturn();
  push(noticeChatHref(state));
}
