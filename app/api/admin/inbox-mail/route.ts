import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { SITE_ADMIN_EMAIL } from "@/lib/admin-emails";

const KINDS = {
  denuncia: { table: "denuncias", title: "Nueva denuncia" },
  aportacion: { table: "aportaciones_pcs", title: "Nueva aportación de photocard" },
  buzon: { table: "buzon_colaboraciones", title: "Nuevo mensaje en el buzón" },
} as const;

type Kind = keyof typeof KINDS;

async function callerId(req: Request) {
  const token = req.headers.get("authorization")?.startsWith("Bearer ")
    ? req.headers.get("authorization")!.slice(7).trim()
    : "";
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await auth.auth.getUser(token);
  return data.user?.id || null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { kind?: Kind; id?: string };
    const kind = body.kind;
    const id = String(body.id || "");
    if (!kind || !KINDS[kind] || !id) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const spec = KINDS[kind];
    const { data: row } = await admin.from(spec.table).select("*").eq("id", id).maybeSingle();
    if (!row) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const created = new Date(row.created_at || 0).getTime();
    if (!created || Date.now() - created > 15 * 60 * 1000) {
      return NextResponse.json({ error: "Fuera de plazo" }, { status: 400 });
    }

    const userId = await callerId(req);
    const owner = row.user_id || row.reporter_id || null;
    if (owner && owner !== userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ ok: true, mailed: false });

    const who = row.email || row.user_id || row.reporter_id || "anónimo";
    const detail = String(row.motivo || row.asunto || row.mensaje || `PC #${row.item_id || ""} ${row.face || ""}`).slice(0, 500);
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: `MyKpopBinder <${SITE_ADMIN_EMAIL}>`,
      to: [SITE_ADMIN_EMAIL],
      subject: `${spec.title}`,
      html: `<div style="font-family:sans-serif;color:#2F2740;background:#FFF9FB;padding:20px;border-radius:16px">
        <h2 style="color:#8C659C;margin-top:0">${spec.title}</h2>
        <p><strong>De:</strong> ${who}</p>
        <p style="white-space:pre-wrap">${detail}</p>
        <p style="font-size:12px;color:#8C659C">Está en el panel de admin para marcarla como leída y gestionarla.</p>
      </div>`,
    });
    if (error) return NextResponse.json({ ok: true, mailed: false, warning: error.message });
    return NextResponse.json({ ok: true, mailed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
