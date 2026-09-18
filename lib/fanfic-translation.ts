export function splitTitleBody(
  raw: string,
  fallbackTitle: string,
  fallbackBody: string
): { title: string; body: string } {
  let text = String(raw || "").trim();
  text = text.replace(/^```(?:json|text)?\s*/i, "").replace(/\s*```$/, "").trim();

  if (text.includes("|||")) {
    const [head, ...rest] = text.split("|||");
    const title = head.replace(/^["'\s]+|["'\s]+$/g, "").trim().split("\n")[0]?.trim() || "";
    const body = rest.join("|||").trim();
    if (title && body) return { title, body };
  }

  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const title = obj?.title || obj?.titulo;
    const body = obj?.body || obj?.contenido || obj?.content;
    if (title && body) {
      return { title: String(title).trim(), body: String(body).trim() };
    }
  } catch {
    /* not JSON */
  }

  return { title: fallbackTitle, body: text || fallbackBody };
}

export function getUiLanguage(profileLang?: string | null): string {
  if (typeof window !== "undefined") {
    const raw = sessionStorage.getItem("ui:language_override")?.trim().toLowerCase();
    if (raw) return raw;
  }
  return String(profileLang || "es").trim().toLowerCase() || "es";
}

export function looksUntranslated(
  row: { titulo?: string | null; contenido?: string | null } | null | undefined,
  original: { titulo?: string | null; contenido?: string | null } | null | undefined
): boolean {
  if (!row) return true;
  const t1 = String(row.titulo || "").trim();
  const t0 = String(original?.titulo || "").trim();
  const b1 = String(row.contenido || "").trim();
  const b0 = String(original?.contenido || "").trim();
  if (!t1 && !b1) return true;
  if (t0 && t1 === t0 && (!b1 || !b0 || b1 === b0)) return true;
  if (t0 && t1 === t0 && b0 && b1.slice(0, 480) === b0.slice(0, 480)) return true;
  return false;
}

export function isUsableTranslation(
  parsed: { title: string; body: string },
  sourceTitle: string,
  sourceBody: string
): boolean {
  return !looksUntranslated(
    { titulo: parsed.title, contenido: parsed.body },
    { titulo: sourceTitle, contenido: sourceBody }
  );
}

export function chunkFanficBody(text: string, maxLen = 2800): string[] {
  const parts = String(text || "").split(/\n+/);
  const chunks: string[] = [];
  let buf = "";
  const pushBuf = () => {
    if (buf) chunks.push(buf);
    buf = "";
  };
  for (const part of parts) {
    if (part.length > maxLen) {
      pushBuf();
      for (let i = 0; i < part.length; i += maxLen) {
        chunks.push(part.slice(i, i + maxLen));
      }
      continue;
    }
    const next = buf ? `${buf}\n${part}` : part;
    if (next.length > maxLen) {
      pushBuf();
      buf = part;
    } else {
      buf = next;
    }
  }
  pushBuf();
  return chunks.length ? chunks : [""];
}

async function translateOnce(text: string, targetLang: string): Promise<string> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "single", text, targetLang }),
  });
  const json = (await res.json().catch(() => ({}))) as { translation?: string; error?: string };
  if (!res.ok) throw new Error(json.error || "TRANSLATION_REQUEST_FAILED");
  return String(json.translation || "").trim();
}

export async function translateFanficLive(
  title: string,
  body: string,
  targetLang: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ title: string; body: string }> {
  const chunks = chunkFanficBody(body);
  const total = chunks.length + 1;
  onProgress?.(0, total);
  const translatedTitle = (await translateOnce(title, targetLang)) || title;
  onProgress?.(1, total);
  const translatedChunks: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    translatedChunks.push((await translateOnce(chunks[i], targetLang)) || chunks[i]);
    onProgress?.(i + 2, total);
  }
  return { title: translatedTitle, body: translatedChunks.join("\n") };
}

export async function persistFanficTranslation(payload: {
  capituloId: string;
  idioma: string;
  titulo: string;
  contenido: string;
}): Promise<void> {
  await fetch("/api/fanfic-translations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);
}
