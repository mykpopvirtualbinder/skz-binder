export const SITE_LANGUAGES = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "id", label: "Indonesia" },
  { code: "th", label: "ไทย" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
] as const;

export function normalizeSiteLanguage(value: string | null | undefined): string {
  const base = (value || "es").trim().toLowerCase().split("-")[0];
  return SITE_LANGUAGES.some((lang) => lang.code === base) ? base : "es";
}

export function siteLanguageLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const base = value.trim().toLowerCase().split("-")[0];
  return SITE_LANGUAGES.find((lang) => lang.code === base)?.label ?? null;
}
