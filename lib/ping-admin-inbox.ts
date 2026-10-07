import { supabase } from "@/lib/supabase";

export type AdminInboxKind = "denuncia" | "aportacion" | "buzon";

/** Avisa a info@ de que ha entrado algo en el panel. No bloquea el alta si el correo falla. */
export async function pingAdminInbox(kind: AdminInboxKind, id: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    await fetch("/api/admin/inbox-mail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ kind, id }),
    });
  } catch {
    /* el registro ya está guardado */
  }
}
