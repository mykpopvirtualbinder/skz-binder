import { isStrayKidsGroupName } from "@/lib/collection-filters";

/**
 * Nombre único para filtros de Merch → Álbumes: fusiona slugs y nombres bonitos
 * (p. ej. "stray-kids" y "Stray Kids" → una sola opción "Stray Kids").
 */
export function canonicalMerchGroupDisplayName(raw: string | null | undefined): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (isStrayKidsGroupName(trimmed)) return "Stray Kids";
  return trimmed
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function albumRowMatchesMerchGroupFilter(
  rowGroup: string | null | undefined,
  filterValue: string,
): boolean {
  if (filterValue === "Todos") return true;
  return canonicalMerchGroupDisplayName(rowGroup) === filterValue;
}
