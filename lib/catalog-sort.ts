export function stockStatusRank(inv?: {
  wts?: number;
  wtt?: number;
  have?: number;
  on_its_way?: number;
  otw?: number;
  wish?: number;
  wishlist?: number;
} | null): number {
  if (!inv) return 5;
  if ((inv.wts ?? 0) > 0) return 0;
  if ((inv.wtt ?? 0) > 0) return 1;
  if ((inv.have ?? 0) > 0) return 2;
  if ((inv.on_its_way ?? inv.otw ?? 0) > 0) return 3;
  if ((inv.wish ?? inv.wishlist ?? 0) > 0) return 4;
  return 5;
}
