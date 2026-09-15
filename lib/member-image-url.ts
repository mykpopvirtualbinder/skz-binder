/**
 * Remaps removed static paths: JPEGs for these members lived under
 * `/members/stray-kids/` and were moved to `/members/` (see public/members).
 */
function remapLegacyStrayKidsMemberJpg(pathname: string): string | null {
  const n = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const m = n.match(/^\/members\/stray-kids\/(felix|han|hyunjin|lee-know)\.jpg$/i);
  if (!m) return null;
  return `/members/${m[1].toLowerCase()}.jpg`;
}

/** Fixes known-broken `members.image_url` values from the database. */
export function resolveMemberAvatarUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl || typeof imageUrl !== "string") return "";
  const raw = imageUrl.trim();
  if (!raw) return "";

  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      const remapped = remapLegacyStrayKidsMemberJpg(u.pathname);
      if (remapped) return `${u.origin}${remapped}`;
      return raw;
    }
  } catch {
    /* ignore */
  }

  const remapped = remapLegacyStrayKidsMemberJpg(raw);
  if (remapped) return remapped;
  return raw;
}
