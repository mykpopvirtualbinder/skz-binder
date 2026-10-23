export type LineEnds = { a: number; b: number };
export type GridPoint = { x: number; y: number };

const LINE_GAP = 3.5;

export function evenLines(count: number, margin = 8): LineEnds[] {
  const cells = Math.max(1, count - 1);
  const span = 100 - margin * 2;
  return Array.from({ length: count }, (_, index) => {
    const at = margin + (span * index) / cells;
    return { a: at, b: at };
  });
}

export function clampLine(lines: LineEnds[], index: number, next: LineEnds): LineEnds {
  const prev = lines[index - 1];
  const after = lines[index + 1];
  let a = next.a;
  let b = next.b;
  if (prev) {
    a = Math.max(a, prev.a + LINE_GAP);
    b = Math.max(b, prev.b + LINE_GAP);
  } else {
    a = Math.max(0, a);
    b = Math.max(0, b);
  }
  if (after) {
    a = Math.min(a, after.a - LINE_GAP);
    b = Math.min(b, after.b - LINE_GAP);
  } else {
    a = Math.min(100, a);
    b = Math.min(100, b);
  }
  return { a, b };
}

/** Where a vertical line (x at top / x at bottom) crosses a horizontal line (y at left / y at right). Percents. */
export function crossPoint(vertical: LineEnds, horizontal: LineEnds): GridPoint {
  const vx = vertical.b - vertical.a;
  const hy = horizontal.b - horizontal.a;
  const coeff = 100 - (vx * hy) / 100;
  if (Math.abs(coeff) < 0.5) {
    return { x: (vertical.a + vertical.b) / 2, y: (horizontal.a + horizontal.b) / 2 };
  }
  const u = (vertical.a + (vx * horizontal.a) / 100) / coeff;
  const y = horizontal.a + hy * u;
  const x = vertical.a + (vx * y) / 100;
  return { x, y };
}

/** TL, TR, BR, BL in image percents. */
export function cellQuad(vLines: LineEnds[], hLines: LineEnds[], col: number, row: number): [GridPoint, GridPoint, GridPoint, GridPoint] {
  return [
    crossPoint(vLines[col], hLines[row]),
    crossPoint(vLines[col + 1], hLines[row]),
    crossPoint(vLines[col + 1], hLines[row + 1]),
    crossPoint(vLines[col], hLines[row + 1]),
  ];
}

export function insetQuad(quad: [GridPoint, GridPoint, GridPoint, GridPoint], amount = 0.08): [GridPoint, GridPoint, GridPoint, GridPoint] {
  const cx = quad.reduce((sum, point) => sum + point.x, 0) / 4;
  const cy = quad.reduce((sum, point) => sum + point.y, 0) / 4;
  return quad.map((point) => ({
    x: point.x + (cx - point.x) * amount,
    y: point.y + (cy - point.y) * amount,
  })) as [GridPoint, GridPoint, GridPoint, GridPoint];
}

export function affineFromTriangles(
  s0: GridPoint,
  s1: GridPoint,
  s2: GridPoint,
  d0: GridPoint,
  d1: GridPoint,
  d2: GridPoint,
): { a: number; b: number; c: number; d: number; e: number; f: number } | null {
  const denom = s0.x * (s1.y - s2.y) - s0.y * (s1.x - s2.x) + (s1.x * s2.y - s2.x * s1.y);
  if (Math.abs(denom) < 1e-4) return null;
  const map = (dx0: number, dx1: number, dx2: number) => ({
    a: (dx0 * (s1.y - s2.y) - s0.y * (dx1 - dx2) + (dx1 * s2.y - dx2 * s1.y)) / denom,
    c: (s0.x * (dx1 - dx2) - dx0 * (s1.x - s2.x) + (s1.x * dx2 - s2.x * dx1)) / denom,
    e: (s0.x * (s1.y * dx2 - s2.y * dx1) - s0.y * (s1.x * dx2 - s2.x * dx1) + dx0 * (s1.x * s2.y - s2.x * s1.y)) / denom,
  });
  const x = map(d0.x, d1.x, d2.x);
  const y = map(d0.y, d1.y, d2.y);
  return { a: x.a, b: y.a, c: x.c, d: y.c, e: x.e, f: y.e };
}
