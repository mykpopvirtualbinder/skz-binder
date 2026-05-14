/**
 * Codifica segmentos de rutas bajo `/mock-pcs/` para que el navegador cargue bien
 * nombres con espacios, tildes, etc. (p. ej. capturas de pantalla en `public/`).
 */
export function encodeMockPcPathUrl(url: string): string {
  const s = String(url ?? "").trim();
  if (!s) return s;
  if (!/^\/mock-pcs\//i.test(s)) return s;

  const q = s.indexOf("?");
  const pathPart = q >= 0 ? s.slice(0, q) : s;
  const query = q >= 0 ? s.slice(q) : "";

  const segments = pathPart.split("/");
  const encoded = segments.map((seg) => {
    if (seg === "") return "";
    try {
      return encodeURIComponent(decodeURIComponent(seg));
    } catch {
      return encodeURIComponent(seg);
    }
  });
  return encoded.join("/") + query;
}
