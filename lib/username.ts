/** Nombre visible del perfil. La comparación ignora mayúsculas y espacios de más. */
export const USERNAME_MAX = 80;

export function normalizeUsername(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function usernameKey(value: string): string {
  return normalizeUsername(value).toLocaleLowerCase("es");
}

export function isUsernameShapeOk(value: string): boolean {
  const name = normalizeUsername(value);
  return name.length > 0 && name.length <= USERNAME_MAX;
}
