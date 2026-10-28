import { supabase } from "@/lib/supabase";
import type { AdminRemovalBody } from "@/lib/admin-moderate-content";

export async function adminRemoveContent(body: AdminRemovalBody): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: "login" };
  const res = await fetch("/api/admin/users-overview", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { ok: false, message: json.error || "failed" };
  return { ok: true };
}
