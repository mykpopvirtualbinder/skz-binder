/**
 * Avatar por defecto para quien no ha elegido foto: el logo de la web, en tamaño pequeño.
 * Se guarda en `profiles.avatar_url` al registrarse y se usa como fallback en sesión.
 */
export const DEFAULT_SITE_PROFILE_AVATAR_URL = "/branding/logo-avatar.png";

const UNSET_AVATAR_MARKERS = [
  "/basic/default-avatar.png",
  "/branding/logo.png",
  "ui-avatars.com",
  "dicebear.com",
];

/** True cuando no hay foto elegida por la persona (vacío, icono genérico o avatar automático). */
export function isUnsetProfileAvatar(stored: string | null | undefined): boolean {
  const value = typeof stored === "string" ? stored.trim() : "";
  if (!value) return true;
  return UNSET_AVATAR_MARKERS.some((marker) => value.includes(marker));
}

export function resolveProfileAvatarUrl(
  stored: string | null | undefined,
  userMetadataAvatar?: string | null | undefined,
): string {
  const a = typeof stored === "string" ? stored.trim() : "";
  if (a && !isUnsetProfileAvatar(a)) return a;
  const b = typeof userMetadataAvatar === "string" ? userMetadataAvatar.trim() : "";
  if (b && !isUnsetProfileAvatar(b)) return b;
  return DEFAULT_SITE_PROFILE_AVATAR_URL;
}
