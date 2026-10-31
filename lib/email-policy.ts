/** Misma regla en el alta y en el servidor. */
export const EMAIL_MAX = 200;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailOk(value: string): boolean {
  const email = value.trim().toLowerCase();
  return email.length > 0 && email.length <= EMAIL_MAX && EMAIL_OK.test(email);
}
