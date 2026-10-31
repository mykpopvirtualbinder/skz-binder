/** Misma regla en el alta y en el servidor. */
export const PASSWORD_MAX = 200;
const PASSWORD_OK = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function isPasswordOk(password: string): boolean {
  return password.length <= PASSWORD_MAX && PASSWORD_OK.test(password);
}
