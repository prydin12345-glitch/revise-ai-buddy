export interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
  height?: number;
}

export const MAX_LAYOUT_ITEMS = 6000;
const streamText = (items: PdfTextItem[]) => items
  .map((item) => (item.str ?? "") + (item.hasEOL ? "\n" : " "))
  .join("");
const heading = /^(?:paper|unit|component)\s*\d+[a-z]?\b/i;
const qualification = /^(?:AS\b|A(?:[\s\u2010-\u2015-]*level\b|[\s\u2010-\u2015-]*$)|Advanced\b)/i;
type Positioned = PdfTextItem & { str: string; x: number; y: number; w: number; h: number; order: number };

/**
 * Reorder only a demonstrable pair of assessment/qualification columns. Never
 * drop a visible item or change its wording. Missing/rotated geometry, tables,
 * unbounded work and uncertain gutters retain the parser's original stream.
 * Full-width lines delimit bands so AS/A-level sections cannot cross them.
 */
export function readablePdfText(items: PdfTextItem[]): string {
  const fallback = () => streamText(items);
  if (items.length > MAX_LAYOUT_ITEMS) return fallback();
  const visible = items.filter((item) => item.str?.trim());
  if (visible.length < 4) return fallback();
  const positioned: Positioned[] = [];
  for (const [order, item] of visible.entries()) {
    const t = item.transform;
    if (!t || t.length !== 6 || !t.every(Number.isFinite) ||
      Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01 || t[0] <= 0 || t[3] <= 0 ||
      !Number.isFinite(item.width) || !Number.isFinite(item.height) ||
      item.width! <= 0 || item.height! <= 0) return fallback();
    positioned.push({ ...item, str: item.str!, x: t[4], y: t[5], w: item.width!, h: item.height!, order });
  }
  // Bound pairing independently of the number of words in a page.
  const anchors = positioned.filter((item) => heading.test(item.str.trim()));
  if (anchors.length > 40) return fallback();
  const bands: Array<{ top: number; bottom: number; split: number }> = [];
  for (const left of anchors) for (const right of anchors) {
    if (right.x - left.x < 120 || Math.abs(left.y - right.y) > Math.max(left.h, right.h) * 1.5 ||
      left.x + left.w + 8 >= right.x || left.str.trim() === right.str.trim()) continue;
    const split = right.x - 4;
    const crossing = positioned.filter((item) => item.x < split && item.x + item.w > split);
    const y = (left.y + right.y) / 2;
    if (crossing.some((item) => Math.abs(item.y - y) <= Math.max(item.h, left.h))) continue;
    const top = Math.min(Infinity, ...crossing.filter((item) => item.y > y).map((item) => item.y));
    const bottom = Math.max(-Infinity, ...crossing.filter((item) => item.y < y).map((item) => item.y));
    const band = positioned.filter((item) => item.y < top && item.y > bottom);
    // A fragmented full-width qualification boundary may not cross the
    // gutter in any one item. Preserve the original stream rather than move
    // evidence across AS/A-level sections. A separate row-label column also
    // establishes a table, even when all its values contain words.
    if (band.some((item) => qualification.test(item.str.trim()) || item.x < left.x - 24)) continue;
    // Numeric grids are tables, not prose columns. Leave their row association
    // intact; a later source-boundary check may ask for a clearer page.
    if (band.filter((item) => /^[\d\s.,%+−–/-]+$/.test(item.str)).length > band.length / 4) continue;
    const rhs = band.filter((item) => item.x >= split);
    const lhs = band.filter((item) => item.x < split);
    if (lhs.length < 2 || rhs.length < 2 || lhs.some((item) => item.x + item.w >= split)) continue;
    if (!bands.some((b) => b.top === top && b.bottom === bottom)) bands.push({ top, bottom, split });
    if (bands.length > 8) return fallback();
  }
  if (!bands.length || bands.some((b, i) => bands.some((c, j) => j !== i && b.bottom < c.top && c.bottom < b.top))) return fallback();
  const ordered = [...positioned].sort((a, b) => b.y - a.y || a.x - b.x || a.order - b.order);
  const emitted = new Set<Positioned>();
  const result: string[] = [];
  const lines = (group: Positioned[]): string | null => {
    const rows: Positioned[][] = [];
    const heights = group.map((item) => item.h).sort((a, b) => a - b);
    const normalHeight = heights[Math.floor(heights.length / 2)];
    // Scientific notation and mixed-size fragments need richer font semantics
    // than this bounded layout pass has. Preserve their original parser order.
    if (group.some((item) => Math.abs(item.h - normalHeight) > normalHeight * 0.1)) return null;
    if (group.some((a) => group.some((b) => {
      const dy = Math.abs(a.y - b.y), h = Math.max(a.h, b.h);
      return dy > h * 0.25 && dy < h * 0.9 && Math.abs(b.x - (a.x + a.w)) <= h * 0.8;
    }))) return null;
    for (const item of group.sort((a, b) => b.y - a.y || a.x - b.x)) {
      const row = rows.at(-1);
      const baseline = row?.reduce((a, b) => a.h >= b.h ? a : b);
      if (row && baseline && Math.abs(baseline.y - item.y) <= Math.max(baseline.h, item.h) * 0.25) row.push(item);
      else rows.push([item]);
    }
    return rows.map((row) => {
      row.sort((a, b) => a.x - b.x || a.order - b.order);
      return row.map((item, index) => {
        const prev = row[index - 1];
        return (prev && item.x - (prev.x + prev.w) > 1 ? " " : "") + item.str;
      }).join("");
    }).join("\n");
  };
  for (const item of ordered) {
    if (emitted.has(item)) continue;
    const band = bands.find((b) => item.y < b.top && item.y > b.bottom);
    if (band) {
      const group = positioned.filter((p) => p.y < band.top && p.y > band.bottom);
      const leftText = lines(group.filter((p) => p.x < band.split));
      const rightText = lines(group.filter((p) => p.x >= band.split));
      if (leftText === null || rightText === null) return fallback();
      result.push(leftText, rightText);
      group.forEach((p) => emitted.add(p));
    } else {
      // Keep unproven regions in their original text order, including tables.
      const group = positioned.filter((p) => !emitted.has(p) && !bands.some((b) => p.y < b.top && p.y > b.bottom) &&
        bands.every((b) => (p.y >= b.top) === (item.y >= b.top) && (p.y <= b.bottom) === (item.y <= b.bottom)));
      result.push(streamText(group.sort((a, b) => a.order - b.order)));
      group.forEach((p) => emitted.add(p));
    }
  }
  return result.join("\n");
}
