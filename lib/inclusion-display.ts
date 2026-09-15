import { formatPhysicalMerchLabel } from "@/lib/album-physical-labels";
import { formatCollectionOptionLabel } from "@/lib/collection-filters";

const SCREENSHOT_NAME = /^captura de pantalla/i;

function decodePath(url: string): string {
  const pathPart = String(url ?? "").trim().split("?")[0];
  return pathPart
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      try {
        return decodeURIComponent(seg.replace(/\+/g, "%2B"));
      } catch {
        return seg;
      }
    })
    .join("/");
}

/** Path segments under `/inclusions/` excluding the filename. */
export function inclusionPathSegmentsFromUrl(imageUrl: string | null | undefined): string[] {
  const path = decodePath(String(imageUrl ?? ""));
  const idx = path.toLowerCase().indexOf("/inclusions/");
  if (idx < 0) return [];
  const tail = path.slice(idx + "/inclusions/".length);
  const parts = tail.split("/").filter(Boolean);
  if (parts.length <= 1) return parts;
  return parts.slice(0, -1);
}

export function inclusionSubtypeLabel(imageUrl: string | null | undefined, version?: string | null): string {
  const fromVersion = String(version ?? "").trim();
  if (fromVersion && fromVersion !== "default" && fromVersion !== "inclusions") {
    return formatPhysicalMerchLabel(fromVersion);
  }
  const segments = inclusionPathSegmentsFromUrl(imageUrl);
  if (segments.length === 0) return "";
  return segments.map((s) => formatPhysicalMerchLabel(s)).join(" · ");
}

export function inclusionMemberLabel(member: string | null | undefined): string {
  const raw = String(member ?? "").trim();
  if (!raw) return "";
  return raw
    .split(/[\s+]+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split("-")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    )
    .join(" + ");
}

export function buildInclusionDisplayName(input: {
  name?: string | null;
  albumTitle?: string | null;
  version?: string | null;
  imageUrl?: string | null;
  member?: string | null;
}): string {
  const explicit = String(input.name ?? "").trim();
  if (explicit && !SCREENSHOT_NAME.test(explicit)) return explicit;

  const album = formatCollectionOptionLabel(String(input.albumTitle ?? "").trim());
  const subtype = inclusionSubtypeLabel(input.imageUrl, input.version);
  const member = inclusionMemberLabel(input.member);

  const parts = [album, subtype, member].filter(Boolean);
  return parts.join(" · ") || "Inclusion";
}

export function inclusionAlbumTypeFromRow(input: {
  type?: string | null;
  version?: string | null;
  imageUrl?: string | null;
}): string {
  const subtype = inclusionSubtypeLabel(input.imageUrl, input.version);
  if (subtype) return subtype;
  const typeRaw = String(input.type ?? "").trim();
  const suffix = typeRaw.replace(/^(?:korean-albums|japanese-albums|taiwanese-albums)\/inclusions\/?/i, "");
  if (suffix) return suffix.split("/").map((s) => formatPhysicalMerchLabel(s)).join(" · ");
  return typeRaw.replace(/^inclusions\/?/i, "").split("/").map((s) => formatPhysicalMerchLabel(s)).join(" · ") || "Inclusions";
}
