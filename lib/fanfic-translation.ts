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
