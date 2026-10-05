export type CoverFaceKey = "front" | "insideFront" | "insideBack" | "back";

export type CoverFaceStyle = {
  imageUrl?: string | null;
  fill?: string | null;
  border?: string | null;
  text?: string | null;
};

export type BinderFaces = {
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  insideFrontUrl?: string | null;
  insideBackUrl?: string | null;
  styles?: Partial<Record<CoverFaceKey, CoverFaceStyle>>;
};

const keyFor = (binderId: number) => `mkb_binder_faces:${binderId}`;

export const EMPTY_COVER_STYLES: Record<CoverFaceKey, CoverFaceStyle> = {
  front: {},
  insideFront: {},
  insideBack: {},
  back: {},
};

export function emptyCoverStyles(): Record<CoverFaceKey, CoverFaceStyle> {
  return {
    front: {},
    insideFront: {},
    insideBack: {},
    back: {},
  };
}

export function readBinderFacesLocal(binderId: number): BinderFaces {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(keyFor(binderId)) || "{}") as BinderFaces;
  } catch {
    return {};
  }
}

export function writeBinderFacesLocal(binderId: number, patch: BinderFaces) {
  if (typeof window === "undefined") return;
  const prev = readBinderFacesLocal(binderId);
  const styles = {
    ...emptyCoverStyles(),
    ...(prev.styles || {}),
    ...(patch.styles || {}),
  };
  localStorage.setItem(keyFor(binderId), JSON.stringify({ ...prev, ...patch, styles }));
}

function mergeStyle(
  key: CoverFaceKey,
  imageFromRow: string | null | undefined,
  rowStyles: Partial<Record<CoverFaceKey, CoverFaceStyle>> | undefined,
  local: BinderFaces
): CoverFaceStyle {
  const fromRow = rowStyles?.[key] || {};
  const fromLocal = local.styles?.[key] || {};
  const imageUrl = imageFromRow ?? fromRow.imageUrl ?? fromLocal.imageUrl ?? null;
  return {
    imageUrl,
    fill: fromRow.fill ?? fromLocal.fill ?? null,
    border: fromRow.border ?? fromLocal.border ?? null,
    text: fromRow.text ?? fromLocal.text ?? null,
  };
}

export function mergeBinderFaces(row: {
  id: number;
  cover_url?: string | null;
  back_cover_url?: string | null;
  inside_front_url?: string | null;
  inside_back_url?: string | null;
  cover_styles?: Partial<Record<CoverFaceKey, CoverFaceStyle>> | null;
}): BinderFaces {
  const local = readBinderFacesLocal(row.id);
  const styles: Record<CoverFaceKey, CoverFaceStyle> = {
    front: mergeStyle("front", row.cover_url ?? local.coverUrl, row.cover_styles || undefined, local),
    insideFront: mergeStyle("insideFront", row.inside_front_url ?? local.insideFrontUrl, row.cover_styles || undefined, local),
    insideBack: mergeStyle("insideBack", row.inside_back_url ?? local.insideBackUrl, row.cover_styles || undefined, local),
    back: mergeStyle("back", row.back_cover_url ?? local.backCoverUrl, row.cover_styles || undefined, local),
  };
  return {
    coverUrl: styles.front.imageUrl ?? null,
    backCoverUrl: styles.back.imageUrl ?? null,
    insideFrontUrl: styles.insideFront.imageUrl ?? null,
    insideBackUrl: styles.insideBack.imageUrl ?? null,
    styles,
  };
}

export function urlColumnForCoverFace(key: CoverFaceKey): "cover_url" | "back_cover_url" | "inside_front_url" | "inside_back_url" {
  if (key === "front") return "cover_url";
  if (key === "back") return "back_cover_url";
  if (key === "insideFront") return "inside_front_url";
  return "inside_back_url";
}
