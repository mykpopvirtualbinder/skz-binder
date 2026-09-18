import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { looksUntranslated } from "@/lib/fanfic-translation";

type Body = {
  capituloId?: string;
  idioma?: string;
  titulo?: string;
  contenido?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const capituloId = String(body.capituloId || "").trim();
  const idioma = String(body.idioma || "").trim().toLowerCase();
  const titulo = String(body.titulo || "").trim();
  const contenido = String(body.contenido || "").trim();
  if (!capituloId || !idioma || idioma === "es" || !titulo || !contenido) {
    return NextResponse.json({ error: "Missing translation fields" }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const { data: original } = await admin
      .from("traducciones")
      .select("titulo, contenido")
      .eq("capitulo_id", capituloId)
      .eq("idioma", "es")
      .maybeSingle();

    if (looksUntranslated({ titulo, contenido }, original)) {
      return NextResponse.json({ error: "Translation still matches source" }, { status: 400 });
    }

    const { data: existing } = await admin
      .from("traducciones")
      .select("capitulo_id")
      .eq("capitulo_id", capituloId)
      .eq("idioma", idioma)
      .maybeSingle();

    const row = { capitulo_id: capituloId, idioma, titulo, contenido };
    const result = existing
      ? await admin.from("traducciones").update({ titulo, contenido }).eq("capitulo_id", capituloId).eq("idioma", idioma)
      : await admin.from("traducciones").insert(row);

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error || "Save failed") }, { status: 500 });
  }
}
