import dictionary from "./admin-en.json";

let bound = "es";

/** El admin sigue el idioma del header. Español se queda en el texto de origen; el resto usa inglés, igual que el resto de la web cuando falta una clave. */
export function bindAdminLang(lang: string | null | undefined) {
  const code = (lang || "es").trim().toLowerCase();
  bound = code === "es" ? "es" : "en";
}

export function tr(text: string, vars?: Record<string, string | number>): string {
  if (!text) return text;
  const table = dictionary as Record<string, string>;
  let out = bound === "es" ? text : table[text] || text;
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined || vars[key] === null ? `{${key}}` : String(vars[key]),
  );
}
