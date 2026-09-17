/** Display names for SKZ members stored as slugs (`bang-chan` → `Bang Chan`). */

function toNiceTitle(s: string) {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function prettyMemberLabel(memberRaw: string | null | undefined): string {
  const raw = String(memberRaw ?? "").trim();
  if (!raw) return "";

  const cleaned = raw
    .replace(/[|]/g, " ")
    .replace(/[,_]/g, " ")
    .replace(/[+/]/g, " ")
    .replace(/-/g, " ")
    .trim();

  const tokens = cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const map: Record<string, string> = {
    bang: "Bang",
    chan: "Chan",
    bangchan: "Bang Chan",
    bangchanfelix: "Bang Chan · Felix",
    lee: "Lee",
    know: "Know",
    leeknow: "Lee Know",
    changbin: "Changbin",
    hyunjin: "Hyunjin",
    han: "Han",
    felix: "Felix",
    seungmin: "Seungmin",
    in: "I.N",
    "i.n": "I.N",
    jeongin: "I.N",
  };

  const joined = tokens.join("");
  if (map[joined]) return map[joined];

  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];

    if (a === "bang" && b === "chan") {
      out.push("Bang Chan");
      i++;
      continue;
    }
    if (a === "lee" && b === "know") {
      out.push("Lee Know");
      i++;
      continue;
    }
    if (a === "in") {
      out.push("I.N");
      continue;
    }

    out.push(map[a] ?? toNiceTitle(a));
  }

  return Array.from(new Set(out.filter(Boolean))).join(" · ");
}

export function prettyVersionLabel(raw: string | null | undefined): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  return toNiceTitle(t.replace(/[-_]+/g, " "));
}

/** Normalized tokens of a search string (`I.N` → `["i","n"]`, `in` → `["in"]`). */
export function memberQueryTokens(query: string): string[] {
  return String(query || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** True when the typed query is I.N (`in`, `i.n`, `i n`, `jeongin`). */
export function queryLooksLikeIn(query: string): boolean {
  const squish = memberQueryTokens(query).join("");
  return squish === "in" || squish === "jeongin";
}

export function memberIsIn(memberRaw: string | null | undefined): boolean {
  const words = memberQueryTokens(String(memberRaw ?? ""));
  if (words.some((w) => w === "in" || w === "jeongin")) return true;
  return words.join("") === "in" || words.join("") === "jeongin";
}

/** Extra DB values to match a member typed with spaces, dots or hyphens. */
export function memberSearchAliases(query: string): string[] {
  const squish = memberQueryTokens(query).join("");
  const aliases: Record<string, string[]> = {
    bangchan: ["bang-chan", "bang chan", "bangchan"],
    leeknow: ["lee-know", "lee know", "leeknow"],
    changbin: ["changbin"],
    hyunjin: ["hyunjin"],
    han: ["han"],
    felix: ["felix"],
    seungmin: ["seungmin"],
    in: ["in", "i.n", "i-n", "jeongin"],
    jeongin: ["in", "i.n", "i-n", "jeongin"],
  };
  const found = aliases[squish];
  if (found) return found;
  const raw = String(query || "").trim();
  return raw ? [raw] : [];
}
