import type { SupabaseClient } from "@supabase/supabase-js";

/** Construye fav_groups y bias_by_group a partir de los IDs elegidos en el alta. */
export async function syncProfileBiasesAfterSignup(
  supabase: SupabaseClient,
  userId: string,
  biasMemberIds: number[],
  selectedGroupIds: number[],
): Promise<{ error: Error | null }> {
  try {
    const gids = [...new Set(selectedGroupIds.filter((n) => Number.isFinite(n)))];
    const bids = [...new Set(biasMemberIds.filter((n) => Number.isFinite(n)))];

    if (gids.length === 0 && bids.length === 0) return { error: null };

    const { data: groupRows } =
      gids.length > 0
        ? await supabase.from("groups").select("id, name").in("id", gids)
        : { data: [] as { id: number; name: string }[] };

    const idToGroupName = new Map<number, string>();
    for (const g of groupRows || []) {
      idToGroupName.set(Number(g.id), String(g.name));
    }

    const favGroupNames = gids.map((id) => idToGroupName.get(Number(id))).filter(Boolean) as string[];

    if (bids.length === 0) {
      if (favGroupNames.length > 0) {
        const { error } = await supabase.from("profiles").update({ fav_groups: favGroupNames }).eq("user_id", userId);
        if (error) throw error;
      }
      return { error: null };
    }

    let memRows: Record<string, unknown>[] = [];
    {
      const a = await supabase.from("members").select("*").in("member_id", bids);
      if (!a.error && (a.data?.length ?? 0) > 0) memRows = a.data as Record<string, unknown>[];
      else {
        const b = await supabase.from("members").select("*").in("id", bids);
        if (b.error) throw b.error;
        memRows = (b.data || []) as Record<string, unknown>[];
      }
    }

    const extraGids = [
      ...new Set(
        (memRows || [])
          .map((r) => {
            const gid = r.group_id ?? r.group;
            return gid != null ? Number(gid) : NaN;
          })
          .filter((n) => Number.isFinite(n)),
      ),
    ] as number[];

    const allGids = [...new Set([...gids, ...extraGids])];
    const { data: allGroupRows } =
      allGids.length > 0
        ? await supabase.from("groups").select("id, name").in("id", allGids)
        : { data: groupRows };

    for (const g of allGroupRows || []) {
      idToGroupName.set(Number(g.id), String(g.name));
    }

    const biasByGroup: Record<string, string[]> = {};

    for (const row of memRows || []) {
      const r = row;
      const name = String(r.name || "").trim();
      if (!name) continue;

      const gidRaw = r.group_id ?? r.group;
      const gid = gidRaw != null ? Number(gidRaw) : NaN;
      const gName = Number.isFinite(gid) ? idToGroupName.get(gid) : undefined;
      if (!gName) continue;

      if (!biasByGroup[gName]) biasByGroup[gName] = [];
      if (!biasByGroup[gName].includes(name)) biasByGroup[gName].push(name);
    }

    const fav =
      favGroupNames.length > 0 ? favGroupNames : [...Object.keys(biasByGroup)];

    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        fav_groups: fav,
        bias_by_group: biasByGroup,
      })
      .eq("user_id", userId);

    if (upErr) throw upErr;
    return { error: null };
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    return { error: err };
  }
}
