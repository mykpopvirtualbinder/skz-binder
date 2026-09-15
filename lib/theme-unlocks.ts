export const VIP_THEME_COSTS: Record<string, number> = {
  dark: 700,
  vibrant: 600,
  minimal: 500,
  k_pride: 800,
};

export const VIP_CURSOR_COSTS: Record<string, number> = {
  wolfchan: 450,
  leebit: 450,
  jiniret: 450,
  hanquokka: 450,
  bbokari: 450,
  puppym: 450,
  foxiny: 450,
  dwaekki: 450,
};

export const VIP_LAYOUT_COSTS: Record<string, number> = {
  "2x2_wide": 900,
  "2x1_wide": 850,
  "3x1_panorama": 950,
};

export function isVipThemeKey(themeId: string): boolean {
  return themeId !== "pastel";
}

export function unlockKeyForTheme(themeId: string): string {
  return `theme:${themeId}`;
}

export function getThemeUnlockCost(themeId: string): number {
  return VIP_THEME_COSTS[themeId] || 0;
}

export function unlockKeyForCursor(cursorId: string): string {
  return `cursor:${cursorId}`;
}

export function getCursorUnlockCost(cursorId: string): number {
  if (cursorId in VIP_CURSOR_COSTS) return VIP_CURSOR_COSTS[cursorId];
  const base = cursorId.replace(/-(regular|evil)$/i, "");
  return VIP_CURSOR_COSTS[base] ?? 0;
}

export function unlockKeyForLayout(layoutId: string): string {
  return `layout:${layoutId}`;
}

export function getLayoutUnlockCost(layoutId: string): number {
  return VIP_LAYOUT_COSTS[layoutId] || 900;
}

