const COUNTRY_CODE = /^[A-Z]{2}$/;
const SKIPPED_COUNTRY_CODES = new Set(["XX", "T1"]);

/** País ISO de la conexión (Vercel o Cloudflare). No incluye la IP. */
export function countryFromRequest(req: Request): string | null {
  const raw = req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "";
  const code = raw.trim().toUpperCase();
  if (!COUNTRY_CODE.test(code) || SKIPPED_COUNTRY_CODES.has(code)) return null;
  return code;
}

export function countryLabel(code: string | null | undefined): string | null {
  if (!code || !COUNTRY_CODE.test(code)) return null;
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}
