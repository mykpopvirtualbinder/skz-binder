export const GOM_SOCIALS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "facebook", label: "Facebook" },
  { key: "threads", label: "Threads" },
  { key: "x", label: "X" },
  { key: "youtube", label: "YouTube" },
  { key: "discord", label: "Discord" },
  { key: "telegram", label: "Telegram" },
  { key: "weverse", label: "Weverse" },
] as const;

export type GomSocialKey = (typeof GOM_SOCIALS)[number]["key"];

export type GomSocials = Record<GomSocialKey, string>;

export function emptyGomSocials(): GomSocials {
  return {
    instagram: "",
    tiktok: "",
    whatsapp: "",
    facebook: "",
    threads: "",
    x: "",
    youtube: "",
    discord: "",
    telegram: "",
    weverse: "",
  };
}

export function websiteHref(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.includes(".")) return `https://${raw.replace(/^\/+/, "")}`;
  return "";
}

export function socialHref(key: GomSocialKey, value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.includes(".") && !raw.includes(" ")) return websiteHref(raw);
  const handle = raw.replace(/^@/, "").replace(/\s+/g, "");
  if (!handle) return "";
  if (key === "instagram") return `https://instagram.com/${handle}`;
  if (key === "tiktok") return `https://www.tiktok.com/@${handle}`;
  if (key === "x") return `https://x.com/${handle}`;
  if (key === "facebook") return `https://facebook.com/${handle}`;
  if (key === "threads") return `https://www.threads.net/@${handle}`;
  if (key === "youtube") return `https://youtube.com/@${handle}`;
  if (key === "telegram") return `https://t.me/${handle}`;
  if (key === "weverse") return `https://weverse.io/${handle}`;
  if (key === "discord") return /^\d{6,}$/.test(handle) ? `https://discord.com/users/${handle}` : `https://discord.com/users/${encodeURIComponent(handle)}`;
  if (key === "whatsapp") {
    const digits = raw.replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : "";
  }
  return "";
}
