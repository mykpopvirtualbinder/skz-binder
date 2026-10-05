export type BinderFaces = {
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  insideBackUrl?: string | null;
};

const keyFor = (binderId: number) => `mkb_binder_faces:${binderId}`;

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
  localStorage.setItem(keyFor(binderId), JSON.stringify({ ...prev, ...patch }));
}

export function mergeBinderFaces(row: {
  id: number;
  cover_url?: string | null;
  back_cover_url?: string | null;
  inside_back_url?: string | null;
}): BinderFaces {
  const local = readBinderFacesLocal(row.id);
  return {
    coverUrl: row.cover_url ?? local.coverUrl ?? null,
    backCoverUrl: row.back_cover_url ?? local.backCoverUrl ?? null,
    insideBackUrl: row.inside_back_url ?? local.insideBackUrl ?? null,
  };
}
