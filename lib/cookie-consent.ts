export const COOKIE_CHOICE_KEY = "mkb-cookie-choice";
export const OPEN_COOKIE_SETTINGS = "mkb-open-cookies";

export type CookieChoice = "all" | "necessary";

export function readCookieChoice(): CookieChoice | null {
  try {
    const value = localStorage.getItem(COOKIE_CHOICE_KEY);
    return value === "all" || value === "necessary" ? value : null;
  } catch {
    return null;
  }
}

export function writeCookieChoice(choice: CookieChoice): void {
  try {
    localStorage.setItem(COOKIE_CHOICE_KEY, choice);
  } catch {
    /* el navegador puede bloquear el almacenamiento */
  }
}

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS));
}
