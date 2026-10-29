import { readFileSync } from "fs";
import { join } from "path";
import { SITE_ADMIN_EMAIL } from "@/lib/admin-emails";

export const SIGNATURE_URL = "https://www.mykpopbinder.com/branding/mailing/signature.jpg";

export const SIGNATURE_TEXT = [
  "",
  "--",
  "STAFF My K-Pop Binder",
  "Collect · Trade · Connect",
  "Instagram: @mykpopbinder",
  "https://www.mykpopbinder.com",
  SITE_ADMIN_EMAIL,
].join("\n");

export function signatureImage(): Buffer | null {
  try {
    return readFileSync(join(process.cwd(), "public/branding/mailing/signature.jpg"));
  } catch {
    return null;
  }
}

export function signatureHtml(imageSrc: string) {
  const img = `<img src="${imageSrc}" alt="STAFF My K-Pop Binder · Collect · Trade · Connect" width="193" height="352" style="width:193px;max-width:100%;height:auto;border:0;display:block;" />`;
  return `<p style="margin:28px 0 0;">${img}</p>`;
}

export function withSignatureText(text: string) {
  return `${text}${SIGNATURE_TEXT}`;
}
