/** Mismo criterio que `EQUIPO_VIP` en GlobalContext (premium por email). */
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
