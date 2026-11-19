export const PLUGIN_BAR_USAGE_REQUEST = "plugin-bar-usage-request";
export const PLUGIN_BAR_USAGE_REPORT = "plugin-bar-usage-report";

export interface BarUsageBox {
  left: number;
  width: number;
  wanted: number;
  clipped: boolean;
}

export interface BarUsageItem {
  id: string;
  owner: string;
  hideable: boolean;
  box: BarUsageBox | null;
}

export interface BarUsageReport {
  id: number;
  collapsed: boolean;
  barWidth: number | null;
  items: BarUsageItem[];
}

export type BarUsageCandidate = { id: string; owner: string; external: boolean; group?: unknown; hideable?: unknown };

const px = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null);

function readBox(value: unknown): BarUsageBox | null {
  if (!value || typeof value !== "object") return null;
  const { left, width, wanted, clipped } = value as Record<string, unknown>;
  const [x, w, want] = [px(left), px(width), px(wanted)];
  if (x === null || w === null || want === null || want === 0) return null;
  return { left: x, width: w, wanted: Math.max(w, want), clipped: clipped === true };
}

export function barUsageReport(id: number, candidates: readonly BarUsageCandidate[], barWidth: number | null, boxOf: (id: string) => unknown): BarUsageReport {
  const width = px(barWidth);
  const collapsed = width !== null && width > 0;
  const seen = new Set<string>();
  const items = candidates
    .filter((item) => item.external && !seen.has(item.id) && Boolean(seen.add(item.id)))
    .map(({ id: item, owner, group, hideable }) => ({ id: item, owner, hideable: group !== "gauges" || hideable === true, box: collapsed ? readBox(boxOf(item)) : null }));
  return { id, collapsed, barWidth: collapsed ? width : null, items };
}

export function readBarUsageReport(payload: unknown): BarUsageReport | null {
  if (!payload || typeof payload !== "object") return null;
  const { id, collapsed, barWidth, items } = payload as Record<string, unknown>;
  if (typeof id !== "number" || !Array.isArray(items)) return null;
  const width = px(barWidth);
  const read = items.flatMap((item): BarUsageItem[] => {
    if (!item || typeof item !== "object") return [];
    const { id: itemId, owner, hideable, box } = item as Record<string, unknown>;
    return typeof itemId === "string" && itemId !== "" && typeof owner === "string" && owner !== "" ? [{ id: itemId, owner, hideable: hideable !== false, box: readBox(box) }] : [];
  });
  return { id, collapsed: collapsed === true && width !== null && width > 0, barWidth: width, items: read };
}
