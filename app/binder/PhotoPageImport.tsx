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
  group_id: number | null;
  album_id: number | null;
  version: string | null;
  member: string | null;
  member_id: number | null;
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

const fingerprintCache = new Map<string, Float32Array>();
const UNCERTAIN = 16;

function slotsFor(layout: string) {
  return GRIDS.find((grid) => grid.key === layout)?.slots ?? 9;
}

function prettyLabel(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprintRegion(source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number) {
  if (sw < 2 || sh < 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 6;
  canvas.height = 9;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, 6, 9);
  const data = ctx.getImageData(0, 0, 6, 9).data;
  const out = new Float32Array(6 * 9 * 3);
  for (let i = 0; i < 6 * 9; i += 1) {
    out[i * 3] = data[i * 4] / 255;
    out[i * 3 + 1] = data[i * 4 + 1] / 255;
    out[i * 3 + 2] = data[i * 4 + 2] / 255;
  }
  return out;
}

function distance(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

async function fingerprintUrl(url: string) {
  const cached = fingerprintCache.get(url);
  if (cached) return cached;
  const img = await loadImage(url);
  const mx = img.naturalWidth * 0.08;
  const my = img.naturalHeight * 0.08;
  const fp = fingerprintRegion(img, mx, my, img.naturalWidth - mx * 2, img.naturalHeight - my * 2);
  if (fp) fingerprintCache.set(url, fp);
  return fp;
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
  onClose,
  onPlaced,
}: {
  userId: string;
  isAdmin?: boolean;
  initialGrid?: string;
  onClose: () => void;
  onPlaced?: () => void;
}) {
  const { t, showConfirm } = useGlobal();
  const router = useRouter();
  const photoRef = useRef<HTMLImageElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
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
  const [step, setStep] = useState<"scan" | "place" | "page" | "slot">("scan");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [binders, setBinders] = useState<BinderOption[]>([]);
  const [binderId, setBinderId] = useState<number | "">("");
  const [pages, setPages] = useState<PageOption[]>([]);
  const [pageId, setPageId] = useState<number | "">("");
  const [previews, setPreviews] = useState<SlotPreview[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

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
    setProgress("");
    try {
      const pool = await fetchPool();
      const ranked: Array<{ card: CardRow; fp: Float32Array }> = [];
      for (let i = 0; i < pool.length; i += 6) {
        setProgress(t("binders.photo.progress", { n: Math.min(i + 6, pool.length), total: pool.length }));
        const part = await Promise.all(
          pool.slice(i, i + 6).map(async (card) => {
            try {
              const fp = card.image_url ? await fingerprintUrl(card.image_url) : null;
              return fp ? { card, fp } : null;
            } catch {
              return null;
            }
          }),
        );
        for (const row of part) if (row) ranked.push(row);
      }
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
          const padX = cellW * 0.06;
          const padY = cellH * 0.06;
          const fp = fingerprintRegion(photo, sx + padX, sy + padY, cellW - padX * 2, cellH - padY * 2);
          const scored = fp
            ? ranked
                .map((entry) => ({ card: entry.card, score: distance(fp, entry.fp) }))
                .sort((a, b) => a.score - b.score)
                .slice(0, 6)
            : [];
          const unsure = !scored.length || scored[0].score > UNCERTAIN;
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
        }
      }
      setChoices(next);
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
    return list;
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

  async function placeAtSlot(startSlot: number) {
    if (binderId === "" || pageId === "" || !pieces.length) return;
    setBusy(true);
    setNotice(null);
    try {
      const content = pages.filter((page) => page.layout_type !== "separator").sort((a, b) => a.page_index - b.page_index);
      const start = content.find((page) => page.id === pageId);
      if (!start) return;
      let affected = content.filter((page) => page.page_index >= start.page_index);
      const counts = affected.map((page) => slotsFor(page.layout_type));
      const total = counts.reduce((sum, n) => sum + n, 0);
      const pageIds = affected.map((page) => page.id);
      const rowsRes = await supabase
        .from("page_slots")
        .select("page_id, slot_index, item_id, member_id, rot, flip_h, is_custom, custom_text, custom_image_url")
        .in("page_id", pageIds);
      if (rowsRes.error) throw new Error(rowsRes.error.message);
      const occ = new Map<number, (typeof rowsRes.data)[number]>();
      for (const row of rowsRes.data ?? []) {
        let acc = 0;
        for (let i = 0; i < affected.length; i += 1) {
          if (affected[i].id === Number(row.page_id)) {
            occ.set(acc + Number(row.slot_index), row);
            break;
          }
          acc += counts[i];
        }
      }
      const steps = pieces.length;
      let blocked = 0;
      for (let g = Math.max(1, total - steps + 1); g <= total; g += 1) if (occ.get(g)) blocked += 1;
      const perPage = slotsFor(gridKey);
      const pagesNeeded = blocked > 0 ? Math.ceil(blocked / perPage) : 0;
      if (pagesNeeded > 0) {
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
        if (!ok) return;
        const created = await createPages(binderId, pagesNeeded, gridKey);
        affected = [...affected, ...created];
        setPages((prev) => [...prev, ...created].sort((a, b) => a.page_index - b.page_index));
      }
      const pageSlotCounts = affected.map((page) => slotsFor(page.layout_type));
      const totalSlots = pageSlotCounts.reduce((sum, n) => sum + n, 0);
      const localOf = (g: number) => {
        let acc = 0;
        for (let i = 0; i < affected.length; i += 1) {
          if (g <= acc + pageSlotCounts[i]) return { page_id: affected[i].id, slot_index: g - acc };
          acc += pageSlotCounts[i];
        }
        const last = affected[affected.length - 1];
        return { page_id: last.id, slot_index: slotsFor(last.layout_type) };
      };
      for (let g = totalSlots; g >= startSlot; g -= 1) {
        const from = g - steps;
        if (from < startSlot) continue;
        const moving = occ.get(from);
        if (moving) {
          occ.set(g, moving);
          occ.delete(from);
        }
      }
      const del = await supabase.from("page_slots").delete().in(
        "page_id",
        affected.map((page) => page.id),
      );
      if (del.error) throw new Error(del.error.message);
      const moved = [...occ.entries()].map(([g, row]) => {
        const loc = localOf(g);
        return {
          page_id: loc.page_id,
          slot_index: loc.slot_index,
          item_id: row.is_custom ? null : row.item_id,
          member_id: row.member_id ?? null,
          rot: Number(row.rot ?? 0),
          flip_h: Boolean(row.flip_h),
          is_custom: Boolean(row.is_custom),
          custom_text: row.is_custom ? row.custom_text ?? "" : null,
          custom_image_url: row.is_custom ? row.custom_image_url ?? null : null,
        };
      });
      if (moved.length) {
        const ins = await supabase.from("page_slots").insert(moved);
        if (ins.error) throw new Error(ins.error.message);
      }
      await writePieces(affected, startSlot, pieces);
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
    let cursor = startSlot;
    for (const page of targetPages) {
      const count = slotsFor(page.layout_type);
      const from = page === targetPages[0] ? cursor : 1;
      for (let slot = from; slot <= count && locs.length < list.length; slot += 1) {
        locs.push({ page_id: page.id, slot_index: slot });
      }
      if (locs.length >= list.length) break;
      cursor = 1;
    }
    const already = await supabase
      .from("page_slots")
      .select("item_id")
      .in(
        "item_id",
        list.flatMap((piece) => (piece.kind === "item" ? [piece.itemId] : [])),
      );
    const taken = new Set((already.data ?? []).map((row) => Number(row.item_id)));
    const rows = [];
    for (let i = 0; i < list.length && i < locs.length; i += 1) {
      const piece = list[i];
      const loc = locs[i];
      if (piece.kind === "item") {
        if (taken.has(piece.itemId)) continue;
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
      const path = `${userId}/scan/${Date.now()}_${i}.jpg`;
      const up = await supabase.storage.from("binder_custom").upload(path, piece.blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (up.error) throw new Error(up.error.message);
      const publicUrl = supabase.storage.from("binder_custom").getPublicUrl(path).data.publicUrl;
      rows.push({
        page_id: loc.page_id,
        slot_index: loc.slot_index,
        item_id: null,
        member_id: null,
        rot: 0,
        flip_h: false,
        is_custom: true,
        custom_text: "",
        custom_image_url: publicUrl,
      });
    }
    if (!rows.length) return;
    const ins = await supabase.from("page_slots").upsert(rows, { onConflict: "page_id,slot_index" });
    if (ins.error) throw new Error(ins.error.message);
    if (taken.size) setNotice(t("binders.photo.already"));
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
          <strong>{t("binders.photo.scan")}</strong>
          <button type="button" onClick={onClose} style={{ ...fieldStyle, width: "auto", fontWeight: 800 }}>
            {t("binders.photo.close")}
          </button>
        </div>

        {step === "scan" && (
          <>
            <p style={{ lineHeight: 1.45 }}>{t("binders.photo.accuracy")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={{ ...fieldStyle, width: "auto", fontWeight: 800 }} onClick={() => cameraRef.current?.click()}>
                {t("binders.photo.camera")}
              </button>
              <button type="button" style={{ ...fieldStyle, width: "auto", fontWeight: 800 }} onClick={() => fileRef.current?.click()}>
                {t("binders.photo.file")}
              </button>
              <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => useFile(event.target.files?.[0])} />
              <input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => useFile(event.target.files?.[0])} />
            </div>
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
            <div style={{ display: "grid", gap: 8 }}>
              {pages
                .filter((page) => page.layout_type !== "separator")
                .map((page, index) => (
                  <button key={page.id} type="button" style={{ ...fieldStyle, textAlign: "left" }} onClick={() => void showPage(page.id)}>
                    {t("binders.photo.page_n", { n: index + 1 })} · {page.layout_type}
                  </button>
                ))}
            </div>
          </>
        )}

        {step === "slot" && (
          <>
            <p>{t("binders.photo.slot_help")}</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${GRIDS.find((item) => item.key === pages.find((page) => page.id === pageId)?.layout_type)?.cols ?? 3}, minmax(0, 1fr))`,
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
