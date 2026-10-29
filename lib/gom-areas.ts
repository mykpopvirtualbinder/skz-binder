export const GOM_COUNTRIES = [
  { code: "ES", name: "Spain", flag: "🇪🇸", continent: "europe" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", continent: "asia" },
  { code: "JP", name: "Japan", flag: "🇯🇵", continent: "asia" },
  { code: "CN", name: "China", flag: "🇨🇳", continent: "asia" },
  { code: "US", name: "United States", flag: "🇺🇸", continent: "north-america" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", continent: "europe" },
  { code: "FR", name: "France", flag: "🇫🇷", continent: "europe" },
  { code: "DE", name: "Germany", flag: "🇩🇪", continent: "europe" },
  { code: "IT", name: "Italy", flag: "🇮🇹", continent: "europe" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", continent: "europe" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", continent: "europe" },
  { code: "BE", name: "Belgium", flag: "🇧🇪", continent: "europe" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", continent: "europe" },
  { code: "SE", name: "Sweden", flag: "🇸🇪", continent: "europe" },
  { code: "NO", name: "Norway", flag: "🇳🇴", continent: "europe" },
  { code: "DK", name: "Denmark", flag: "🇩🇰", continent: "europe" },
  { code: "FI", name: "Finland", flag: "🇫🇮", continent: "europe" },
  { code: "PL", name: "Poland", flag: "🇵🇱", continent: "europe" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿", continent: "europe" },
  { code: "AT", name: "Austria", flag: "🇦🇹", continent: "europe" },
  { code: "HU", name: "Hungary", flag: "🇭🇺", continent: "europe" },
  { code: "RO", name: "Romania", flag: "🇷🇴", continent: "europe" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬", continent: "europe" },
  { code: "GR", name: "Greece", flag: "🇬🇷", continent: "europe" },
  { code: "TR", name: "Turkey", flag: "🇹🇷", continent: "asia" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", continent: "asia" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", continent: "asia" },
  { code: "TH", name: "Thailand", flag: "🇹🇭", continent: "asia" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", continent: "asia" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", continent: "asia" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", continent: "asia" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", continent: "asia" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", continent: "asia" },
  { code: "AU", name: "Australia", flag: "🇦🇺", continent: "oceania" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", continent: "oceania" },
  { code: "CA", name: "Canada", flag: "🇨🇦", continent: "north-america" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", continent: "north-america" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", continent: "south-america" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", continent: "south-america" },
  { code: "CL", name: "Chile", flag: "🇨🇱", continent: "south-america" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", continent: "africa" },
] as const;

export const GOM_CONTINENTS = ["europe", "asia", "africa", "north-america", "south-america", "oceania"] as const;

const CONTINENT_IDS = new Set<string>(GOM_CONTINENTS);

export function cleanGomArea(raw: unknown) {
  const id = String(raw || "").trim().toLowerCase();
  if (id === "worldwide") return "worldwide";
  if (CONTINENT_IDS.has(id)) return id;
  const country = GOM_COUNTRIES.find((item) => item.code.toLowerCase() === id);
  return country ? country.code : "";
}

export function cleanGomAreas(value: unknown, max = 20) {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const id = cleanGomArea(item);
    if (!id || out.includes(id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export function cleanGomGroup(raw: unknown) {
  const name = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (name.length < 2) return "";
  if (!/^[\p{L}\p{N}][\p{L}\p{N}&.'’()+\- ]*$/u.test(name)) return "";
  return name;
}

export function cleanGomGroups(value: unknown, max = 20) {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const name = cleanGomGroup(item);
    if (!name || out.some((have) => have.toLowerCase() === name.toLowerCase())) continue;
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

export function gomAreaMatches(selected: string[], filter: string) {
  if (!filter) return true;
  if (selected.includes("worldwide")) return true;
  if (filter === "worldwide") return selected.includes("worldwide");
  if (CONTINENT_IDS.has(filter)) {
    if (selected.includes(filter)) return true;
    return selected.some((id) => GOM_COUNTRIES.some((country) => country.code === id && country.continent === filter));
  }
  if (selected.includes(filter)) return true;
  const country = GOM_COUNTRIES.find((item) => item.code === filter);
  return Boolean(country && selected.includes(country.continent));
}
