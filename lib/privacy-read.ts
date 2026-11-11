const READ_KEY = "mkb-privacy-read";

export function privacyWasRead(): boolean {
  try {
    return sessionStorage.getItem(READ_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPrivacyRead(): void {
  try {
    sessionStorage.setItem(READ_KEY, "1");
  } catch {
    /* el navegador puede bloquear la sesión */
  }
}
