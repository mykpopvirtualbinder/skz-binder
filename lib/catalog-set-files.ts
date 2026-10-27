/** Pair a dropped set the same way `scripts/build-items-csv.mjs` pairs fronts and backs. */

const IMAGE_RE = /\.(apng|png|jpe?g|jfif|pjpeg|webp|gif|bmp|avif|svg|ico|tiff?|hei[cf])$/i;

export type CatalogSetInput = { name: string; url: string };

export type CatalogSetCard = {
  member: string;
  frontName: string;
  backName: string | null;
  frontUrl: string;
  backUrl: string | null;
};

function basename(path: string): string {
  const parts = String(path || "").split(/[/\\]/);
  return (parts[parts.length - 1] || "").trim();
}

function stripExt(file: string): string {
  return file.replace(IMAGE_RE, "");
}

function numPrefix(file: string): number {
  const m = file.match(/^(\d+)-/);
  return m ? Number(m[1]) : 999999;
}

function isBackFile(file: string): boolean {
  const base = stripExt(file);
  if (/-front-/i.test(base)) return false;
  return /(?:^|[-_ ])back(?:[-_ ]|$)/i.test(base);
}

function memberTokenKey(token: string): string {
  return String(token ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

function registerBackToken(map: Map<string, string>, token: string, file: string) {
  const raw = String(token ?? "").trim();
  if (!raw) return;
  map.set(raw, file);
  const key = memberTokenKey(raw);
  if (key) map.set(key, file);
}

function parseMemberTokensFromFront(file: string): string {
  const base = stripExt(file);
  const m = base.match(/-front-(.+)$/i);
  if (!m) return "";
  const tail = m[1].trim();
  if (!tail) return "";
  if (tail.toLowerCase() === "ot8") return "ot8";
  if (tail.includes("_")) return tail.split("_").map((x) => x.trim()).filter(Boolean).join(" ");
  if (tail.includes("+")) return tail.split("+").map((x) => x.trim()).filter(Boolean).join(" ");
  return tail;
}

function indexBacks(files: string[]) {
  const byToken = new Map<string, string>();
  let common: string | null = null;

  for (const f of files) {
    if (!IMAGE_RE.test(f)) continue;
    const base = stripExt(f).toLowerCase();
    const norm = base.replace(/\s+/g, "-");
    if (/(?:^|-)back-ot8$/.test(norm)) {
      common = f;
      registerBackToken(byToken, "ot8", f);
      continue;
    }
    const m = norm.match(/-back-(.+)$/i);
    if (m?.[1]) registerBackToken(byToken, m[1].trim(), f);
    if (/(^|-)back$/.test(base) && !common) common = f;
  }

  return { byToken, commonBack: common };
}

function looseMember(file: string): string {
  const stem = stripExt(basename(file)).replace(/^\d+[-_]/, "").trim();
  return stem || stripExt(basename(file)).trim() || basename(file);
}

function pushCard(
  cards: CatalogSetCard[],
  seen: Set<string>,
  byName: Map<string, string>,
  member: string,
  frontName: string,
  backName: string | null,
) {
  const key = memberTokenKey(member) || memberTokenKey(frontName);
  if (!key || seen.has(key)) return;
  const frontUrl = byName.get(frontName) || "";
  if (!frontUrl) return;
  seen.add(key);
  cards.push({
    member,
    frontName,
    backName,
    frontUrl,
    backUrl: backName ? byName.get(backName) || null : null,
  });
}

export function pairCatalogSet(files: CatalogSetInput[]): { cards: CatalogSetCard[]; orphanBacks: string[] } {
  const byName = new Map<string, string>();
  const names: string[] = [];
  for (const file of files) {
    const name = basename(file.name);
    if (!name || !IMAGE_RE.test(name) || !file.url) continue;
    if (!byName.has(name)) names.push(name);
    byName.set(name, file.url);
  }

  const fronts = names
    .filter((f) => /-front-/.test(f))
    .sort((a, b) => numPrefix(a) - numPrefix(b) || a.localeCompare(b, "en", { numeric: true }));
  const { byToken, commonBack } = indexBacks(names);
  const usedBacks = new Set<string>();
  const cards: CatalogSetCard[] = [];
  const seen = new Set<string>();

  const pickBack = (key: string) => byToken.get(key) || byToken.get(memberTokenKey(key)) || "";

  if (fronts.length > 0) {
    for (const frontName of fronts) {
      const member = parseMemberTokensFromFront(frontName);
      if (!member) continue;
      const tokens = member.split(/\s+/).filter(Boolean);
      let backName = "";
      if (tokens.includes("ot8")) {
        backName = pickBack("ot8") || commonBack || "";
      } else if (tokens.length === 1) {
        backName = pickBack(tokens[0]) || commonBack || pickBack("ot8") || "";
      } else {
        const norm = tokens.map((t) => t.toLowerCase());
        const rev = [...norm].reverse();
        const sorted = [...norm].sort();
        const candidates = [
          norm.join("+"), rev.join("+"), sorted.join("+"),
          norm.join("_"), rev.join("_"), sorted.join("_"),
          norm.join(" "), rev.join(" "), sorted.join(" "),
        ];
        backName = candidates.map((k) => pickBack(k)).find(Boolean) || pickBack("ot8") || commonBack || "";
      }
      if (backName) usedBacks.add(backName);
      pushCard(cards, seen, byName, member, frontName, backName || null);
    }
  }

  const loose = names
    .filter((f) => IMAGE_RE.test(f) && !isBackFile(f) && !/-front-/.test(f))
    .sort((a, b) => numPrefix(a) - numPrefix(b) || a.localeCompare(b, "en", { numeric: true }));
  for (const frontName of loose) {
    pushCard(cards, seen, byName, looseMember(frontName), frontName, null);
  }

  const orphanBacks = names.filter((f) => isBackFile(f) && !usedBacks.has(f));
  return { cards, orphanBacks };
}
