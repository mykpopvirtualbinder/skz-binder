/** Cuenta operativa del sitio: acceso rápido al panel solo en /me (evita confusión con el equipo). */
export const SITE_ADMIN_EMAIL = "info@mykpopbinder.com";

export function isSiteAdminSession(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SITE_ADMIN_EMAIL.toLowerCase();
}

/** Emails con acceso a operaciones de administración (alineado con el panel). */
export const ADMIN_TEAM_EMAILS = [
  "info@mykpopbinder.com",
  "anabmtnez78@hotmail.com",
  "mysafekspace@gmail.com",
  "sfckern@gmail.com",
  "paula.azules@gmail.com",
] as const;

export function isAdminTeamEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const n = email.trim().toLowerCase();
  return (ADMIN_TEAM_EMAILS as readonly string[]).includes(n);
}

/** El equipo admin puede borrar contenido publicado por cualquier cuenta. */
export function canModerateGlobalContent(email: string | null | undefined): boolean {
  return isAdminTeamEmail(email);
}
