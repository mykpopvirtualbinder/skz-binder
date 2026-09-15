/** Precio medio de referencia en USD (no confundir con `binder:market:*`, usado para país WTS). */
export function marketRefUsdStorageKey(itemId: number): string {
  return `mkb:marketRefUsd:${itemId}`;
}
