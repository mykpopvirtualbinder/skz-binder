import { supabase } from "@/lib/supabase";

/** Resuelve qué fila del mercado enlazar (photocard = item_id numérico; merch = uuid de user_merch_statuses). */
async function marketNotificationMetadata(
  miId: string,
  idContenido: string | number
): Promise<Record<string, unknown>> {
  const s = String(idContenido).trim();
  const isNumericId = typeof idContenido === "number" || /^\d+$/.test(s);
  if (isNumericId) {
    const itemNum = typeof idContenido === "number" ? idContenido : parseInt(s, 10);
    const { data: row } = await supabase
      .from("user_item_statuses")
      .select("id")
      .eq("user_id", miId)
      .eq("item_id", itemNum)
      .in("status", ["wtt", "wts"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row?.id) return { market_highlight: `pc-${row.id}` };
    return { market_pc_item_id: itemNum };
  }
  return { market_highlight: `merch-${s}` };
}

/**
 * Función encargada de notificar a los seguidores cuando un artista/vendedor
 * publica contenido nuevo (Post, Fanart o Item en Market).
 */
export const avisarFavoritos = async (
  miId: string,
  tipoContenido: 'post_id' | 'fanart_id' | 'market_id',
  idContenido: string | number
) => {
  if (!miId || !idContenido) return;

  try {
    // Buscamos quién tiene en favoritos al autor del contenido
    const { data: followers, error: errFollow } = await supabase
      .from('user_favorites') 
      .select('follower_id')
      .eq('following_id', miId);

    if (errFollow) throw errFollow;

    if (followers && followers.length > 0) {
      const filtered = followers.filter((f: any) => f.follower_id !== miId);
      if (filtered.length === 0) return;

      const notices = filtered.map((f: any) => ({
        user_id: f.follower_id,
        actor_id: miId,
        type: 'new_publication',
        post_id: tipoContenido === 'post_id' ? idContenido : null,
        fanart_id: tipoContenido === 'fanart_id' ? idContenido : null,
        market_id: tipoContenido === 'market_id' ? idContenido : null,
      }));

      const { error: errInsert } = await supabase.from('fanzone_notifications').insert(notices);
      if (errInsert) throw errInsert;

      const { data: actorProf } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', miId)
        .maybeSingle();

      const authorName = actorProf?.display_name?.trim() || 'Alguien';
      const content =
        tipoContenido === 'market_id'
          ? `${authorName} ha publicado un nuevo anuncio en el mercado.`
          : tipoContenido === 'fanart_id'
            ? `${authorName} ha publicado nuevo fanart.`
            : `${authorName} ha publicado en Fanzone.`;

      const bellType =
        tipoContenido === 'market_id'
          ? 'market_listing'
          : tipoContenido === 'fanart_id'
            ? 'fanart_post'
            : 'fanzone_post';

      let bellMetadata: Record<string, unknown> | undefined;
      if (tipoContenido === "market_id") {
        bellMetadata = await marketNotificationMetadata(miId, idContenido);
      } else if (tipoContenido === "fanart_id") {
        bellMetadata = { fanart_id: String(idContenido) };
      } else if (tipoContenido === "post_id") {
        bellMetadata = { fanzone_post_id: String(idContenido) };
      }

      const bellRows = filtered.map((f: any) => ({
        user_id: f.follower_id,
        sender_id: miId,
        type: bellType,
        content,
        read: false,
        ...(bellMetadata ? { metadata: bellMetadata } : {}),
      }));

      let errBell = (await supabase.from("notifications").insert(bellRows)).error;
      if (
        errBell &&
        String(errBell.message || "").toLowerCase().includes("metadata")
      ) {
        errBell = (
          await supabase.from("notifications").insert(
            bellRows.map(({ metadata: _m, ...rest }: { metadata?: unknown } & Record<string, unknown>) => rest)
          )
        ).error;
      }
      if (errBell) throw errBell;
    }
  } catch (error) {
    // En producción es mejor solo loguear el error real
    console.error("❌ [AVISOS ERROR]:", error);
  }
};