import { isAdminTeamEmail } from "@/lib/admin-emails";

/** Acceso gratis a las funciones de la web. No abre el panel de admin. */
export const EQUIPO_VIP_EMAILS = [
  "info@mykpopbinder.com",
  "anabmtnez78@hotmail.com",
  "paula.azules@gmail.com",
  "mysafekspace@gmail.com",
  "jimena.esteban.martinez@gmail.com",
] as const;

export function isEquipoVipEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const n = email.trim().toLowerCase();
  return (EQUIPO_VIP_EMAILS as readonly string[]).includes(n);
}

/** Premium y cupos sin límite. El panel sigue siendo solo del equipo admin. */
export function hasComplimentaryAccess(email: string | null | undefined): boolean {
  return isEquipoVipEmail(email) || isAdminTeamEmail(email);
}
