"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resolveMockPcImageUrl } from "@/lib/mock-pc-url";
import { resolveBinderQuota } from "@/lib/binder-quotas";
import { useGlobal } from "../context/GlobalContext";

type CardRow = {
  id: number;
  name: string | null;
  image_url: string | null;
  source_url: string | null;
  group_id: number | null;
  album_id: number | null;
  version: string | null;
  member: string | null;
  member_id: number | null;
};

type SlotOcc = {
  item_id: number | null;
  member_id: number | null;
  rot: number;
  flip_h: boolean;
  is_custom: boolean;
  custom_text: string | null;
  custom_image_url: string | null;
};

type SlotChoice = {
  slot: number;
  cropUrl: string;
  picks: CardRow[];
  mode: "item" | "custom" | "skip";
  itemId: number | null;
  unsure: boolean;
  query: string;
  manual: CardRow[];
};

type Piece =
  | { kind: "item"; itemId: number; memberId: number | null }
  | { kind: "custom"; blob: Blob };

type BinderOption = { id: number; title: string };
type PageOption = { id: number; page_index: number; layout_type: string };
type SlotPreview = { slot: number; image: string | null; label: string };

const GRIDS = [
  { key: "3x3", cols: 3, rows: 3, slots: 9 },
  { key: "4x3", cols: 4, rows: 3, slots: 12 },
  { key: "3x4", cols: 3, rows: 4, slots: 12 },
  { key: "4x4", cols: 4, rows: 4, slots: 16 },
  { key: "2x2", cols: 2, rows: 2, slots: 4 },
  { key: "2x3", cols: 2, rows: 3, slots: 6 },
];

const PAGE_LAYOUTS: Record<string, { cols: number; rows: number; slots: number }> = {
  "3x3": { cols: 3, rows: 3, slots: 9 },
  "4x3": { cols: 4, rows: 3, slots: 12 },
  "3x4": { cols: 3, rows: 4, slots: 12 },
  "4x4": { cols: 4, rows: 4, slots: 16 },
  "2x2": { cols: 2, rows: 2, slots: 4 },
  "2x3": { cols: 2, rows: 3, slots: 6 },
  "2x4": { cols: 2, rows: 4, slots: 8 },
  "1x2": { cols: 1, rows: 2, slots: 2 },
  "1x3": { cols: 1, rows: 3, slots: 3 },
  "1x4": { cols: 1, rows: 4, slots: 4 },
  sp_2x2: { cols: 2, rows: 2, slots: 4 },
  sp_1x2: { cols: 1, rows: 2, slots: 2 },
  sp_1x3: { cols: 1, rows: 3, slots: 3 },
  sp_1x4: { cols: 1, rows: 4, slots: 4 },
  sp_1x1: { cols: 1, rows: 1, slots: 1 },
};

const VISION_DIM = 512;
const VISION_SHOW = 0.84;
const VISION_AUTO = 0.88;

type VisionIndex = { vectors: Float32Array; byPath: Map<string, number> };

let visionPromise: Promise<VisionIndex> | null = null;
let embedderPromise: Promise<(image: HTMLCanvasElement) => Promise<Float32Array>> | null = null;

function visionKeys(url: string | null | undefined) {
  const keys = new Set<string>();
  if (!url) return keys;
  const add = (value: string) => {
    const clean = value.split("?")[0];
    if (!clean) return;
    keys.add(clean);
    try {
      keys.add(decodeURIComponent(clean));
    } catch {
      /* keep the raw path */
    }
  };
  add(url);
  try {
    add(new URL(url, "https://local").pathname);
  } catch {
    /* relative paths stay as they are */
  }
  return keys;
}

function loadVisionIndex() {
  if (!visionPromise) {
    visionPromise = Promise.all([
      fetch("/card-embedding-paths.json").then(async (res) => {
        if (!res.ok) throw new Error("card-embeddings");
        return (await res.json()) as string[];
      }),
      fetch("/card-embeddings.bin").then(async (res) => {
        if (!res.ok) throw new Error("card-embeddings");
        return res.arrayBuffer();
      }),
    ]).then(([paths, buffer]) => {
      const byPath = new Map<string, number>();
      paths.forEach((item, index) => byPath.set(item, index));
      return { vectors: new Float32Array(buffer), byPath };
    });
  }
  return visionPromise;
}

function loadEmbedder() {
  if (!embedderPromise) {
    embedderPromise = import("@huggingface/transformers").then(async ({ pipeline }) => {
      const extractor = await pipeline("image-feature-extraction", "Xenova/clip-vit-base-patch32", { dtype: "q8" });
      return async (image: HTMLCanvasElement) => {
        const out = await extractor(image);
        const data = out.data;
        const vec = new Float32Array(VISION_DIM);
        let norm = 0;
        const size = Math.min(VISION_DIM, data.length);
        for (let i = 0; i < size; i += 1) norm += data[i] * data[i];
        norm = Math.sqrt(norm) || 1;
        for (let i = 0; i < size; i += 1) vec[i] = data[i] / norm;
        return vec;
      };
    });
  }
  return embedderPromise;
}

function visionScore(vectors: Float32Array, index: number, query: Float32Array) {
  const offset = index * VISION_DIM;
  let sum = 0;
  for (let i = 0; i < VISION_DIM; i += 1) sum += vectors[offset + i] * query[i];
  return sum;
}

function slotsFor(layout: string) {
  return PAGE_LAYOUTS[layout]?.slots ?? 9;
}

function colsFor(layout: string) {
  return PAGE_LAYOUTS[layout]?.cols ?? 3;
}

function prettyLabel(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapCard(row: {
  id: number;
  name?: string | null;
  image_url?: string | null;
  group_id?: number | null;
  album_id?: number | null;
  version?: string | null;
  member?: string | null;
  member_id?: number | null;
}): CardRow {
  const image = typeof row.image_url === "string" ? resolveMockPcImageUrl(row.image_url) : null;
  return {
    id: Number(row.id),
    name: row.name ?? null,
    image_url: image,
    source_url: typeof row.image_url === "string" ? row.image_url : null,
    group_id: row.group_id == null ? null : Number(row.group_id),
    album_id: row.album_id == null ? null : Number(row.album_id),
    version: row.version ?? null,
    member: row.member ?? null,
    member_id: row.member_id == null ? null : Number(row.member_id),
  };
}

function dataUrlToBlob(dataUrl: string) {
  const [head, body] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(head)?.[1] || "image/jpeg";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function addHave(userId: string, itemId: number) {
  const current = await supabase
    .from("user_item_statuses")
    .select("qty")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("status", "have")
    .maybeSingle();
  if (current.error) throw new Error(current.error.message);
  const qty = Math.max(0, Number(current.data?.qty ?? 0)) + 1;
  const up = await supabase.from("user_item_statuses").upsert(
    { user_id: userId, item_id: itemId, status: "have", qty },
    { onConflict: "user_id,item_id,status" },
  );
  if (up.error) throw new Error(up.error.message);
}

export default function PhotoPageImport({
  userId,
  isAdmin = false,
  initialGrid = "3x3",
  initialPieces,
  onClose,
  onPlaced,
}: {
  userId: string;
  isAdmin?: boolean;
  initialGrid?: string;
  initialPieces?: Array<{ itemId: number; memberId: number | null }>;
  onClose: () => void;
  onPlaced?: () => void;
}) {
  const { t, showConfirm } = useGlobal();
  const router = useRouter();
  const photoRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [gridKey, setGridKey] = useState(GRIDS.some((grid) => grid.key === initialGrid) ? initialGrid : "3x3");
  const grid = GRIDS.find((item) => item.key === gridKey) ?? GRIDS[0];
  const [inset, setInset] = useState({ top: 8, right: 8, bottom: 8, left: 8 });
  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [albums, setAlbums] = useState<Array<{ id: number; name: string; group_id: number | null }>>([]);
  const [groupId, setGroupId] = useState<number | "">("");
  const [albumId, setAlbumId] = useState<number | "">("");
  const [version, setVersion] = useState("");
  const [versions, setVersions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [choices, setChoices] = useState<SlotChoice[]>([]);
  const [step, setStep] = useState<"scan" | "place" | "page" | "slot">(initialPieces?.length ? "place" : "scan");
  const [pieces, setPieces] = useState<Piece[]>(
    () => initialPieces?.map((piece) => ({ kind: "item" as const, itemId: piece.itemId, memberId: piece.memberId })) ?? [],
  );
  const [binders, setBinders] = useState<BinderOption[]>([]);
  const [binderId, setBinderId] = useState<number | "">("");
  const [pages, setPages] = useState<PageOption[]>([]);
  const [pageId, setPageId] = useState<number | "">("");
  const [previews, setPreviews] = useState<SlotPreview[]>([]);
  const [pageThumbs, setPageThumbs] = useState<Record<number, Array<string | null>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!initialPieces?.length) return;
    let cancelled = false;
    void (async () => {
      const binderRes = await supabase.from("binders").select("id, title").eq("user_id", userId).order("id");
      if (cancelled) return;
      if (binderRes.error) {
        setNotice(binderRes.error.message);
        return;
      }
      setBinders(
        (binderRes.data ?? []).map((row) => ({
          id: Number(row.id),
          title: String(row.title || "").trim() || `Binder ${row.id}`,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [initialPieces, userId]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOn || !video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [cameraOn]);

  async function openCamera() {
    setNotice(null);
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice(t("binders.photo.camera_denied"));
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setNotice(t("binders.photo.camera_denied"));
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopCamera();
      useFile(new File([blob], "scan.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [groupRes, albumRes] = await Promise.all([
        supabase.from("groups").select("id, name").order("name"),
        supabase.from("albums").select("id, name, group_id").order("name"),
      ]);
      if (cancelled) return;
      setGroups((groupRes.data ?? []).map((row) => ({ id: Number(row.id), name: String(row.name ?? "") })));
      setAlbums(
        (albumRes.data ?? []).map((row) => ({
          id: Number(row.id),
          name: String(row.name ?? ""),
          group_id: row.group_id == null ? null : Number(row.group_id),
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (albumId === "") {
      setVersions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await supabase.from("items").select("version").eq("album_id", albumId).limit(1000);
      if (cancelled || res.error) return;
      const values = new Set<string>();
      for (const row of res.data ?? []) {
        const label = prettyLabel(row.version);
        if (label) values.add(label);
      }
      setVersions([...values].sort((a, b) => a.localeCompare(b)));
    })();
    return () => {
      cancelled = true;
    };
  }, [albumId]);

  const visibleAlbums = useMemo(
    () => albums.filter((album) => groupId === "" || album.group_id === groupId),
    [albums, groupId],
  );

  function useFile(file: File | undefined) {
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setChoices([]);
    setNotice(null);
    setStep("scan");
  }

  async function fetchPool() {
    const cards: CardRow[] = [];
    for (let from = 0; ; from += 1000) {
      let query = supabase
        .from("items")
        .select("id, name, image_url, group_id, album_id, version, member, member_id")
        .not("image_url", "is", null)
        .range(from, from + 999);
      if (albumId !== "") query = query.eq("album_id", albumId);
      else if (groupId !== "") query = query.eq("group_id", groupId);
      const res = await query;
      if (res.error) throw new Error(res.error.message);
      const batch = res.data ?? [];
      for (const row of batch) {
        const card = mapCard(row);
        if (!card.image_url) continue;
        if (version && prettyLabel(card.version) !== version) continue;
        cards.push(card);
      }
      if (batch.length < 1000) break;
    }
    return cards;
  }

  async function search() {
    const photo = photoRef.current;
    if (!photo?.naturalWidth) return;
    setSearching(true);
    setNotice(null);
    setProgress(t("binders.photo.vision"));
    try {
      const [pool, index, embed] = await Promise.all([fetchPool(), loadVisionIndex(), loadEmbedder()]);
      const known = pool.flatMap((card) => {
        const keys = new Set([...visionKeys(card.source_url), ...visionKeys(card.image_url)]);
        for (const key of keys) {
          const row = index.byPath.get(key);
          if (row != null) return [{ card, row }];
        }
        return [];
      });
      const width = photo.naturalWidth;
      const height = photo.naturalHeight;
      const x0 = (inset.left / 100) * width;
      const y0 = (inset.top / 100) * height;
      const x1 = width - (inset.right / 100) * width;
      const y1 = height - (inset.bottom / 100) * height;
      const cellW = (x1 - x0) / grid.cols;
      const cellH = (y1 - y0) / grid.rows;
      const next: SlotChoice[] = [];
      for (let row = 0; row < grid.rows; row += 1) {
        for (let col = 0; col < grid.cols; col += 1) {
          const slot = row * grid.cols + col + 1;
          const sx = x0 + col * cellW;
          const sy = y0 + row * cellH;
          const crop = document.createElement("canvas");
          crop.width = 90;
          crop.height = 135;
          crop.getContext("2d")?.drawImage(photo, sx, sy, cellW, cellH, 0, 0, 90, 135);
          const padX = cellW * 0.08;
          const padY = cellH * 0.08;
          const sample = document.createElement("canvas");
          sample.width = 224;
          sample.height = Math.max(224, Math.round(224 * (cellH / Math.max(1, cellW))));
          sample
            .getContext("2d")
            ?.drawImage(photo, sx + padX, sy + padY, Math.max(2, cellW - padX * 2), Math.max(2, cellH - padY * 2), 0, 0, sample.width, sample.height);
          const fp = await embed(sample);
          const scored = known
            .map((entry) => ({ card: entry.card, score: visionScore(index.vectors, entry.row, fp) }))
            .filter((entry) => entry.score >= VISION_SHOW)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
          const best = scored[0]?.score ?? 0;
          const second = scored[1]?.score ?? 0;
          const unsure = !scored.length || best < VISION_AUTO || best - second < 0.04;
          next.push({
            slot,
            cropUrl: crop.toDataURL("image/jpeg", 0.72),
            picks: scored.map((entry) => entry.card),
            mode: unsure ? "custom" : "item",
            itemId: unsure ? null : scored[0]?.card.id ?? null,
            unsure,
            query: "",
            manual: [],
          });
          setProgress(t("binders.photo.progress", { n: slot, total: grid.cols * grid.rows }));
        }
      }
      setChoices(next);
      if (next.every((choice) => choice.picks.length === 0)) setNotice(t("binders.photo.no_close"));
      setProgress("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSearching(false);
    }
  }

  async function searchManual(slot: number, query: string) {
    setChoices((prev) => prev.map((row) => (row.slot === slot ? { ...row, query } : row)));
    const q = query.replace(/[%_,()]/g, " ").trim();
    if (q.length < 2) {
      setChoices((prev) => prev.map((row) => (row.slot === slot ? { ...row, manual: [] } : row)));
      return;
    }
    const res = await supabase
      .from("items")
      .select("id, name, image_url, group_id, album_id, version, member, member_id")
      .or(`member.ilike.%${q}%,name.ilike.%${q}%`)
      .limit(12);
    if (res.error) return;
    const manual = (res.data ?? []).map(mapCard).filter((card) => card.image_url);
    setChoices((prev) => prev.map((row) => (row.slot === slot ? { ...row, manual } : row)));
  }

  async function confirmStock() {
    const nextPieces: Piece[] = [];
    const seen = new Set<number>();
    let stocked = 0;
    setBusy(true);
    setNotice(null);
    try {
      for (const choice of choices) {
        if (choice.mode === "skip") continue;
        if (choice.mode === "custom") {
          nextPieces.push({ kind: "custom", blob: dataUrlToBlob(choice.cropUrl) });
          continue;
        }
        if (choice.itemId == null || seen.has(choice.itemId)) continue;
        seen.add(choice.itemId);
        await addHave(userId, choice.itemId);
        stocked += 1;
        const card = [...choice.picks, ...choice.manual].find((item) => item.id === choice.itemId);
        nextPieces.push({ kind: "item", itemId: choice.itemId, memberId: card?.member_id ?? null });
      }
      setPieces(nextPieces);
      setNotice(t("binders.photo.stock_done", { n: stocked }));
      const binderRes = await supabase.from("binders").select("id, title").eq("user_id", userId).order("id");
      if (binderRes.error) throw new Error(binderRes.error.message);
      const list = (binderRes.data ?? []).map((row) => ({
        id: Number(row.id),
        title: String(row.title || "").trim() || `Binder ${row.id}`,
      }));
      setBinders(list);
      setStep("place");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function loadPages(nextBinderId: number) {
    const res = await supabase
      .from("binder_pages")
      .select("id, page_index, layout_type")
      .eq("binder_id", nextBinderId)
      .order("page_index", { ascending: true });
    if (res.error) throw new Error(res.error.message);
    const list = (res.data ?? []).map((row) => ({
      id: Number(row.id),
      page_index: Number(row.page_index),
      layout_type: String(row.layout_type || "3x3"),
    }));
    setPages(list);
    void loadThumbs(list);
    return list;
  }

  async function loadThumbs(list: PageOption[]) {
    const visible = list.filter((page) => page.layout_type !== "separator");
    const ids = visible.map((page) => page.id);
    if (!ids.length) {
      setPageThumbs({});
      return;
    }
    const slotRes = await supabase
      .from("page_slots")
      .select("page_id, slot_index, item_id, is_custom, custom_image_url")
      .in("page_id", ids);
    if (slotRes.error) return;
    const itemIds = (slotRes.data ?? []).map((row) => Number(row.item_id)).filter((id) => Number.isFinite(id) && id > 0);
    const images = new Map<number, string>();
    if (itemIds.length) {
      const itemRes = await supabase.from("items").select("id, image_url").in("id", [...new Set(itemIds)]);
      for (const row of itemRes.data ?? []) images.set(Number(row.id), resolveMockPcImageUrl(row.image_url));
    }
    const thumbs: Record<number, Array<string | null>> = {};
    for (const page of visible) thumbs[page.id] = Array.from({ length: slotsFor(page.layout_type) }, () => null);
    for (const row of slotRes.data ?? []) {
      const slots = thumbs[Number(row.page_id)];
      const index = Number(row.slot_index) - 1;
      if (!slots || index < 0 || index >= slots.length) continue;
      slots[index] = row.is_custom ? row.custom_image_url || null : images.get(Number(row.item_id)) || null;
    }
    setPageThumbs(thumbs);
  }

  async function quotaFor(targetBinderId: number, pageRows: PageOption[]) {
    const profileRes = await supabase
      .from("profiles")
      .select("plan_type, extra_pages, is_premium")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileRes.error) throw new Error(profileRes.error.message);
    const quota = resolveBinderQuota({
      planType: profileRes.data?.plan_type,
      isPremium: profileRes.data?.is_premium,
      isAdmin,
      extraPages: Number(profileRes.data?.extra_pages ?? 0),
    });
    const used = pageRows.filter((page) => page.layout_type !== "separator").length;
    return { maxPages: quota.maxPages, used, binderId: targetBinderId };
  }

  async function createPages(targetBinderId: number, count: number, layout: string) {
    const last = await supabase
      .from("binder_pages")
      .select("page_index")
      .eq("binder_id", targetBinderId)
      .order("page_index", { ascending: false })
      .limit(1);
    if (last.error) throw new Error(last.error.message);
    let nextIndex = (last.data?.[0]?.page_index ?? -1) + 1;
    const created: PageOption[] = [];
    for (let i = 0; i < count; i += 1) {
      const ins = await supabase
        .from("binder_pages")
        .insert({ binder_id: targetBinderId, page_index: nextIndex, layout_type: layout })
        .select("id, page_index, layout_type")
        .single();
      if (ins.error || !ins.data) throw new Error(ins.error?.message || "page");
      created.push({
        id: Number(ins.data.id),
        page_index: Number(ins.data.page_index),
        layout_type: String(ins.data.layout_type),
      });
      nextIndex += 1;
    }
    return created;
  }

  async function placeFresh() {
    if (binderId === "" || !pieces.length) return;
    setBusy(true);
    setNotice(null);
    try {
      const pageRows = pages.length ? pages : await loadPages(binderId);
      const perPage = slotsFor(gridKey);
      const needed = Math.ceil(pieces.length / perPage);
      const quota = await quotaFor(binderId, pageRows);
      if (quota.used + needed > quota.maxPages) {
        setNotice(t("binders.photo.need_pages"));
        router.push("/shop");
        return;
      }
      const created = await createPages(binderId, needed, gridKey);
      await writePieces(created, 1, pieces);
      setNotice(t("binders.photo.placed_done"));
      onPlaced?.();
      onClose();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function showPage(nextPageId: number) {
    setPageId(nextPageId);
    const page = pages.find((item) => item.id === nextPageId);
    const count = slotsFor(page?.layout_type || "3x3");
    const slotRes = await supabase
      .from("page_slots")
      .select("slot_index, item_id, is_custom, custom_text, custom_image_url")
      .eq("page_id", nextPageId);
    if (slotRes.error) {
      setNotice(slotRes.error.message);
      return;
    }
    const itemIds = (slotRes.data ?? []).map((row) => Number(row.item_id)).filter((id) => Number.isFinite(id) && id > 0);
    const images = new Map<number, string>();
    if (itemIds.length) {
      const itemRes = await supabase.from("items").select("id, image_url, member, name").in("id", itemIds);
      for (const row of itemRes.data ?? []) {
        images.set(Number(row.id), resolveMockPcImageUrl(row.image_url));
      }
    }
    const bySlot = new Map((slotRes.data ?? []).map((row) => [Number(row.slot_index), row]));
    setPreviews(
      Array.from({ length: count }, (_, index) => {
        const row = bySlot.get(index + 1);
        const image = row?.is_custom
          ? row.custom_image_url
          : row?.item_id
            ? images.get(Number(row.item_id)) ?? null
            : null;
        return { slot: index + 1, image: image || null, label: row?.custom_text || "" };
      }),
    );
    setStep("slot");
  }

  async function clearOwnPlacements(itemIds: number[]) {
    if (!itemIds.length) return;
    const binderRes = await supabase.from("binders").select("id").eq("user_id", userId);
    if (binderRes.error) throw new Error(binderRes.error.message);
    const binderIds = (binderRes.data ?? []).map((row) => Number(row.id));
    if (!binderIds.length) return;
    const pageRes = await supabase.from("binder_pages").select("id").in("binder_id", binderIds);
    if (pageRes.error) throw new Error(pageRes.error.message);
    const ownedPageIds = (pageRes.data ?? []).map((row) => Number(row.id));
    for (let i = 0; i < ownedPageIds.length; i += 100) {
      const chunk = ownedPageIds.slice(i, i + 100);
      const gone = await supabase.from("page_slots").delete().in("item_id", itemIds).in("page_id", chunk);
      if (gone.error) throw new Error(gone.error.message);
    }
  }

  async function insertPagesAfter(after: PageOption, count: number, layout: string) {
    const following = pages
      .filter((page) => page.page_index > after.page_index)
      .sort((a, b) => b.page_index - a.page_index);
    for (const page of following) {
      const upd = await supabase.from("binder_pages").update({ page_index: page.page_index + count }).eq("id", page.id);
      if (upd.error) throw new Error(upd.error.message);
    }
    const created: PageOption[] = [];
    for (let i = 0; i < count; i += 1) {
      const ins = await supabase
        .from("binder_pages")
        .insert({ binder_id: binderId, page_index: after.page_index + 1 + i, layout_type: layout })
        .select("id, page_index, layout_type")
        .single();
      if (ins.error || !ins.data) throw new Error(ins.error?.message || "page");
      created.push({
        id: Number(ins.data.id),
        page_index: Number(ins.data.page_index),
        layout_type: String(ins.data.layout_type || layout),
      });
    }
    setPages((prev) => {
      const shifted = prev.map((page) =>
        page.page_index > after.page_index ? { ...page, page_index: page.page_index + count } : page,
      );
      return [...shifted, ...created].sort((a, b) => a.page_index - b.page_index);
    });
    return created;
  }

  async function placeAtSlot(startSlot: number) {
    if (binderId === "" || pageId === "" || !pieces.length) {
      setNotice(t("binders.photo.save_empty"));
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const selected = pages.find((page) => page.id === pageId && page.layout_type !== "separator");
      if (!selected) {
        setNotice(t("binders.photo.save_empty"));
        return;
      }
      const pageSlots = slotsFor(selected.layout_type);
      const localStart = startSlot - 1;
      if (localStart < 0 || localStart >= pageSlots) {
        setNotice(t("binders.photo.save_empty"));
        return;
      }
      const movingIds = new Set(pieces.flatMap((piece) => (piece.kind === "item" ? [piece.itemId] : [])));
      const rowsRes = await supabase
        .from("page_slots")
        .select("page_id, slot_index, item_id, member_id, rot, flip_h, is_custom, custom_text, custom_image_url")
        .eq("page_id", selected.id);
      if (rowsRes.error) throw new Error(rowsRes.error.message);
      const bySlot = new Map((rowsRes.data ?? []).map((row) => [Number(row.slot_index), row]));
      const line: Array<SlotOcc | null> = [];
      const had: boolean[] = [];
      for (let slot = 1; slot <= pageSlots; slot += 1) {
        const row = bySlot.get(slot);
        const itemId = row?.item_id == null ? null : Number(row.item_id);
        const moving = itemId != null && movingIds.has(itemId);
        had.push(Boolean(row));
        line.push(
          row && !moving
            ? {
                item_id: row.is_custom ? null : itemId,
                member_id: row.member_id == null ? null : Number(row.member_id),
                rot: Number(row.rot ?? 0),
                flip_h: Boolean(row.flip_h),
                is_custom: Boolean(row.is_custom),
                custom_text: row.is_custom ? row.custom_text ?? "" : null,
                custom_image_url: row.is_custom ? row.custom_image_url ?? null : null,
              }
            : null,
        );
      }
      const preview = [...line.slice(0, localStart), ...pieces.map(() => ({}) as SlotOcc), ...line.slice(localStart)];
      while (preview.length && preview[preview.length - 1] == null) preview.pop();
      const spill = Math.max(0, preview.length - pageSlots);
      let created: PageOption[] = [];
      if (spill > 0) {
        const pagesNeeded = Math.ceil(spill / pageSlots);
        const quota = await quotaFor(binderId, pages);
        if (quota.used + pagesNeeded > quota.maxPages) {
          setNotice(t("binders.photo.need_pages"));
          router.push("/shop");
          return;
        }
        const ok = await showConfirm(
          t("binders.picker.extra_pages_title"),
          t("binders.picker.extra_pages_msg", { n: pagesNeeded }),
        );
        if (!ok) {
          setNotice(t("binders.photo.need_confirm"));
          return;
        }
        created = await insertPagesAfter(selected, pagesNeeded, selected.layout_type);
      }
      const incoming: SlotOcc[] = [];
      for (let i = 0; i < pieces.length; i += 1) {
        const piece = pieces[i];
        if (piece.kind === "item") {
          incoming.push({
            item_id: piece.itemId,
            member_id: piece.memberId,
            rot: 0,
            flip_h: false,
            is_custom: false,
            custom_text: null,
            custom_image_url: null,
          });
          continue;
        }
        const path = `${userId}/binder_${binderId}/scan/${Date.now()}_${i}.jpg`;
        const up = await supabase.storage.from("binder_custom").upload(path, piece.blob, {
          contentType: "image/jpeg",
          upsert: true,
        });
        if (up.error) throw new Error(up.error.message);
        incoming.push({
          item_id: null,
          member_id: null,
          rot: 0,
          flip_h: false,
          is_custom: true,
          custom_text: "",
          custom_image_url: supabase.storage.from("binder_custom").getPublicUrl(path).data.publicUrl,
        });
      }
      const merged = [...line.slice(0, localStart), ...incoming, ...line.slice(localStart)];
      while (merged.length && merged[merged.length - 1] == null) merged.pop();
      const cells: Array<{ pageId: number; slot: number; had: boolean }> = [];
      for (let slot = 1; slot <= pageSlots; slot += 1) cells.push({ pageId: selected.id, slot, had: had[slot - 1] });
      for (const page of created) {
        const count = slotsFor(page.layout_type);
        for (let slot = 1; slot <= count; slot += 1) cells.push({ pageId: page.id, slot, had: false });
      }
      while (merged.length < cells.length) merged.push(null);
      if (movingIds.size) await clearOwnPlacements([...movingIds]);
      const writes = [];
      const clears = new Map<number, number[]>();
      for (let i = 0; i < cells.length; i += 1) {
        const occ = merged[i];
        const cell = cells[i];
        if (!cell) continue;
        if (occ) {
          writes.push({ page_id: cell.pageId, slot_index: cell.slot, ...occ });
          continue;
        }
        if (cell.had) {
          const slots = clears.get(cell.pageId) ?? [];
          slots.push(cell.slot);
          clears.set(cell.pageId, slots);
        }
      }
      if (!writes.length) {
        setNotice(t("binders.photo.save_empty"));
        return;
      }
      const saved = await supabase.from("page_slots").upsert(writes, { onConflict: "page_id,slot_index" });
      if (saved.error) throw new Error(saved.error.message);
      for (const [targetPageId, slots] of clears) {
        const cleared = await supabase.from("page_slots").delete().eq("page_id", targetPageId).in("slot_index", slots);
        if (cleared.error) throw new Error(cleared.error.message);
      }
      setNotice(t("binders.photo.placed_done"));
      onPlaced?.();
      onClose();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function writePieces(targetPages: PageOption[], startSlot: number, list: Piece[]) {
    const locs: Array<{ page_id: number; slot_index: number }> = [];
    for (const page of targetPages) {
      const count = slotsFor(page.layout_type);
      const from = page === targetPages[0] ? startSlot : 1;
      for (let slot = from; slot <= count && locs.length < list.length; slot += 1) {
        locs.push({ page_id: page.id, slot_index: slot });
      }
      if (locs.length >= list.length) break;
    }
    const itemIds = list.flatMap((piece) => (piece.kind === "item" ? [piece.itemId] : []));
    if (itemIds.length) await clearOwnPlacements(itemIds);
    const rows = [];
    for (let i = 0; i < list.length && i < locs.length; i += 1) {
      const piece = list[i];
      const loc = locs[i];
      if (piece.kind === "item") {
        rows.push({
          page_id: loc.page_id,
          slot_index: loc.slot_index,
          item_id: piece.itemId,
          member_id: piece.memberId,
          rot: 0,
          flip_h: false,
          is_custom: false,
          custom_text: null,
          custom_image_url: null,
        });
        continue;
      }
      const path = `${userId}/binder_${binderId}/scan/${Date.now()}_${i}.jpg`;
      const up = await supabase.storage.from("binder_custom").upload(path, piece.blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (up.error) throw new Error(up.error.message);
      rows.push({
        page_id: loc.page_id,
        slot_index: loc.slot_index,
        item_id: null,
        member_id: null,
        rot: 0,
        flip_h: false,
        is_custom: true,
        custom_text: "",
        custom_image_url: supabase.storage.from("binder_custom").getPublicUrl(path).data.publicUrl,
      });
    }
    if (!rows.length) throw new Error(t("binders.photo.save_empty"));
    const ins = await supabase.from("page_slots").upsert(rows, { onConflict: "page_id,slot_index" });
    if (ins.error) throw new Error(ins.error.message);
  }

  const fieldStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--color-border)",
    background: "var(--bg-main)",
    color: "var(--text-main)",
  } as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40000,
        background: "var(--overlay-medium)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          maxHeight: "100%",
          overflow: "auto",
          background: "var(--bg-card)",
          color: "var(--text-main)",
          borderRadius: 18,
          border: "1px solid var(--color-primary)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <strong>{step === "scan" ? t("binders.photo.scan") : t("library.bulk_binder_title")}</strong>
          <button type="button" onClick={onClose} style={{ ...fieldStyle, width: "auto", fontWeight: 800 }}>
            {t("binders.photo.close")}
          </button>
        </div>

        {step === "scan" && (
          <>
            <p style={{ lineHeight: 1.45 }}>{t("binders.photo.accuracy")}</p>
            <p style={{ lineHeight: 1.45 }}>{t("binders.photo.camera_ask")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={{ ...fieldStyle, width: "auto", fontWeight: 800 }} onClick={() => void openCamera()}>
                {t("binders.photo.camera")}
              </button>
              <button type="button" style={{ ...fieldStyle, width: "auto", fontWeight: 800 }} onClick={() => fileRef.current?.click()}>
                {t("binders.photo.file")}
              </button>
              <input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => useFile(event.target.files?.[0])} />
            </div>
            {cameraOn && (
              <div style={{ marginTop: 12 }}>
                <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", maxWidth: 520, display: "block", borderRadius: 12, background: "#111" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" style={{ ...fieldStyle, width: "auto", fontWeight: 800 }} onClick={captureFrame}>
                    {t("binders.photo.camera_capture")}
                  </button>
                  <button type="button" style={{ ...fieldStyle, width: "auto" }} onClick={stopCamera}>
                    {t("binders.photo.camera_stop")}
                  </button>
                </div>
              </div>
            )}
            {photoUrl && (
              <>
                <label style={{ display: "block", marginTop: 12 }}>
                  {t("binders.photo.grid")}
                  <select
                    value={gridKey}
                    style={fieldStyle}
                    onChange={(event) => {
                      setGridKey(event.target.value);
                      setChoices([]);
                    }}
                  >
                    {GRIDS.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.key}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ position: "relative", maxWidth: 520, margin: "12px auto" }}>
                  <img ref={photoRef} src={photoUrl} alt="" style={{ width: "100%", display: "block", borderRadius: 12 }} />
                  <div
                    style={{
                      position: "absolute",
                      top: `${inset.top}%`,
                      right: `${inset.right}%`,
                      bottom: `${inset.bottom}%`,
                      left: `${inset.left}%`,
                      display: "grid",
                      gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
                      gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
                      pointerEvents: "none",
                    }}
                  >
                    {Array.from({ length: grid.cols * grid.rows }, (_, index) => (
                      <div key={index} style={{ border: "1px solid rgba(255,255,255,0.85)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.35)" }} />
                    ))}
                  </div>
                </div>
                <p>{t("binders.photo.align")}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                  {(["top", "right", "bottom", "left"] as const).map((edge) => (
                    <label key={edge} style={{ fontSize: 13 }}>
                      {t(`binders.photo.${edge}`)}
                      <input
                        type="range"
                        min={0}
                        max={35}
                        value={inset[edge]}
                        onChange={(event) => {
                          setInset((prev) => ({ ...prev, [edge]: Number(event.target.value) }));
                          setChoices([]);
                        }}
                        style={{ width: "100%" }}
                      />
                    </label>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginTop: 12 }}>
                  <label>
                    {t("binders.photo.group")}
                    <select
                      value={groupId}
                      style={fieldStyle}
                      onChange={(event) => {
                        setGroupId(event.target.value === "" ? "" : Number(event.target.value));
                        setAlbumId("");
                        setVersion("");
                        setChoices([]);
                      }}
                    >
                      <option value="">{t("binders.photo.all")}</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("binders.photo.album")}
                    <select
                      value={albumId}
                      style={fieldStyle}
                      onChange={(event) => {
                        setAlbumId(event.target.value === "" ? "" : Number(event.target.value));
                        setVersion("");
                        setChoices([]);
                      }}
                    >
                      <option value="">{t("binders.photo.all")}</option>
                      {visibleAlbums.map((album) => (
                        <option key={album.id} value={album.id}>
                          {album.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("binders.photo.version")}
                    <select
                      value={version}
                      style={fieldStyle}
                      onChange={(event) => {
                        setVersion(event.target.value);
                        setChoices([]);
                      }}
                    >
                      <option value="">{t("binders.photo.all")}</option>
                      {versions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button type="button" disabled={searching} onClick={() => void search()} style={{ ...fieldStyle, width: "auto", fontWeight: 800, marginTop: 12 }}>
                  {searching ? t("binders.photo.searching") : t("binders.photo.search")}
                </button>
                {progress && <p>{progress}</p>}
              </>
            )}
            <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
              {choices.map((choice) => (
                <div key={choice.slot}>
                  <div style={{ fontWeight: 800 }}>
                    {t("binders.photo.slot", { n: choice.slot })}
                    {choice.unsure ? ` · ${t("binders.photo.unsure")}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", alignItems: "flex-end", marginTop: 6 }}>
                    <img src={choice.cropUrl} alt="" style={{ width: 72, height: 108, objectFit: "cover", borderRadius: 8 }} />
                    {choice.picks.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() =>
                          setChoices((prev) =>
                            prev.map((row) => (row.slot === choice.slot ? { ...row, mode: "item", itemId: card.id } : row)),
                          )
                        }
                        style={{
                          width: 72,
                          borderRadius: 8,
                          border: choice.mode === "item" && choice.itemId === card.id ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                          background: "var(--bg-main)",
                          padding: 4,
                          color: "var(--text-main)",
                        }}
                      >
                        <img src={card.image_url || ""} alt="" style={{ width: "100%", height: 92, objectFit: "contain" }} />
                        <span style={{ display: "block", fontSize: 10 }}>{prettyLabel(card.member) || card.name}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setChoices((prev) => prev.map((row) => (row.slot === choice.slot ? { ...row, mode: "custom", itemId: null } : row)))}
                      style={{ ...fieldStyle, width: "auto", border: choice.mode === "custom" ? "2px solid var(--color-primary)" : fieldStyle.border }}
                    >
                      {t("binders.photo.custom")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChoices((prev) => prev.map((row) => (row.slot === choice.slot ? { ...row, mode: "skip", itemId: null } : row)))}
                      style={{ ...fieldStyle, width: "auto" }}
                    >
                      {t("binders.photo.empty")}
                    </button>
                  </div>
                  <input
                    value={choice.query}
                    placeholder={t("binders.photo.find_ph")}
                    onChange={(event) => void searchManual(choice.slot, event.target.value)}
                    style={{ ...fieldStyle, marginTop: 8 }}
                  />
                  {choice.manual.length > 0 && (
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 8 }}>
                      {choice.manual.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() =>
                            setChoices((prev) =>
                              prev.map((row) => (row.slot === choice.slot ? { ...row, mode: "item", itemId: card.id } : row)),
                            )
                          }
                          style={{ width: 64, border: choice.itemId === card.id ? "2px solid var(--color-primary)" : "1px solid var(--color-border)", borderRadius: 8, background: "var(--bg-main)", color: "var(--text-main)" }}
                        >
                          <img src={card.image_url || ""} alt="" style={{ width: "100%", height: 84, objectFit: "contain" }} />
                          <span style={{ display: "block", fontSize: 10 }}>{prettyLabel(card.member) || card.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {choices.length > 0 && (
              <button type="button" disabled={busy} onClick={() => void confirmStock()} style={{ ...fieldStyle, width: "auto", fontWeight: 800, marginTop: 12 }}>
                {t("binders.photo.confirm_stock")}
              </button>
            )}
          </>
        )}

        {step === "place" && (
          <>
            <p>{t("binders.photo.place_q")}</p>
            {binders.length === 0 && <p>{t("binders.photo.no_binders")}</p>}
            <div style={{ display: "grid", gap: 8 }}>
              {binders.map((binder) => (
                <button
                  key={binder.id}
                  type="button"
                  style={{ ...fieldStyle, textAlign: "left", fontWeight: 800 }}
                  onClick={() => {
                    setBinderId(binder.id);
                    setStep("page");
                    void loadPages(binder.id);
                  }}
                >
                  {binder.title}
                </button>
              ))}
            </div>
            <button type="button" onClick={onClose} style={{ ...fieldStyle, width: "auto", marginTop: 12 }}>
              {t("binders.photo.stock_only")}
            </button>
          </>
        )}

        {step === "page" && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
              <button type="button" disabled={busy} onClick={() => void placeFresh()} style={{ ...fieldStyle, width: "auto", fontWeight: 800 }}>
                {t("binders.photo.fresh")}
              </button>
            </div>
            <p>{t("binders.photo.page")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 12 }}>
              {pages
                .filter((page) => page.layout_type !== "separator")
                .map((page, index) => {
                  const cols = colsFor(page.layout_type);
                  const thumbs = pageThumbs[page.id] ?? Array.from({ length: slotsFor(page.layout_type) }, () => null);
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => void showPage(page.id)}
                      style={{ ...fieldStyle, textAlign: "left", padding: 8 }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 2 }}>
                        {thumbs.map((src, thumbIndex) => (
                          <div key={thumbIndex} style={{ aspectRatio: "2 / 3", background: "var(--bg-main)", overflow: "hidden", borderRadius: 3 }}>
                            {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                          </div>
                        ))}
                      </div>
                      <span style={{ display: "block", marginTop: 6, fontWeight: 800 }}>{t("binders.photo.page_n", { n: index + 1 })}</span>
                    </button>
                  );
                })}
            </div>
          </>
        )}

        {step === "slot" && (
          <>
            <button type="button" onClick={() => setStep("page")} style={{ ...fieldStyle, width: "auto", margin: "12px 0" }}>
              {t("binders.photo.back_pages")}
            </button>
            <p style={{ fontWeight: 800 }}>
              {t("binders.photo.page_n", {
                n: Math.max(1, pages.filter((page) => page.layout_type !== "separator").findIndex((page) => page.id === pageId) + 1),
              })}
            </p>
            <p>{t("binders.photo.slot_help")}</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${colsFor(pages.find((page) => page.id === pageId)?.layout_type || "3x3")}, minmax(0, 1fr))`,
                gap: 8,
              }}
            >
              {previews.map((preview) => (
                <button
                  key={preview.slot}
                  type="button"
                  disabled={busy}
                  onClick={() => void placeAtSlot(preview.slot)}
                  style={{ border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--bg-main)", minHeight: 90, color: "var(--text-main)" }}
                >
                  {preview.image ? (
                    <img src={preview.image} alt="" style={{ width: "100%", height: 110, objectFit: "contain" }} />
                  ) : (
                    <span>{preview.slot}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {notice && <p>{notice}</p>}
        {busy && <p>{t("binders.photo.working")}</p>}
      </div>
    </div>
  );
}
