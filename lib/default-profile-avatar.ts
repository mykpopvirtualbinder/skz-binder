/**
 * Avatar por defecto para usuarios nuevos (`public/basic/default-avatar.png`).
 * Se guarda en `profiles.avatar_url` al registrarse y se usa como fallback en sesión.
 */
export const DEFAULT_SITE_PROFILE_AVATAR_URL = "/basic/default-avatar.png";

export function resolveProfileAvatarUrl(
  stored: string | null | undefined,
  userMetadataAvatar?: string | null | undefined,
): string {
  const a = typeof stored === "string" ? stored.trim() : "";
  if (a) return a;
  const b = typeof userMetadataAvatar === "string" ? userMetadataAvatar.trim() : "";
  if (b) return b;
  return DEFAULT_SITE_PROFILE_AVATAR_URL;
}
