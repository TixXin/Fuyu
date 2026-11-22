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
  name?: string;
}

export interface BarUsagePage {
  id: string;
  owner: string;
  name: string;
}

export interface BarUsageWidget {
  id: string;
  owner: string;
  name: string;
  plugin: string;
  sizes: string[];
  icon?: string;
}

export interface BarUsageWings {
  left: string[];
  right: string[];
}

export interface BarUsageReport {
  id: number;
  collapsed: boolean;
  barWidth: number | null;
  items: BarUsageItem[];
  pages?: BarUsagePage[];
  widgets?: BarUsageWidget[];
  wings?: BarUsageWings;
}

export type BarUsageCandidate = { id: string; owner: string; external: boolean; group?: unknown; hideable?: unknown; label?: unknown };

const NAME_LIMIT = 80;

const readName = (value: unknown): string | null => {
  const text = typeof value === "string" ? value.trim().slice(0, NAME_LIMIT) : "";
  return text === "" ? null : text;
};

export function barItemName(item: { id: string; owner: string }, siblings: number, label: string | null | undefined, plugin: string | null | undefined): string {
  if (label) return label;
  const name = plugin || item.owner;
  return siblings > 1 ? `${name} · ${item.id}` : name;
}

const px = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null);

function readBox(value: unknown): BarUsageBox | null {
  if (!value || typeof value !== "object") return null;
  const { left, width, wanted, clipped } = value as Record<string, unknown>;
  const [x, w, want] = [px(left), px(width), px(wanted)];
  if (x === null || w === null || want === null || want === 0) return null;
  return { left: x, width: w, wanted: Math.max(w, want), clipped: clipped === true };
}

export function barUsageReport(
  id: number,
  candidates: readonly BarUsageCandidate[],
  barWidth: number | null,
  boxOf: (id: string) => unknown,
  nameOf?: (candidate: BarUsageCandidate, siblings: number) => unknown,
): BarUsageReport {
  const width = px(barWidth);
  const collapsed = width !== null && width > 0;
  const seen = new Set<string>();
  const listed = candidates
    .filter((item) => item.external && !seen.has(item.id) && Boolean(seen.add(item.id)))
    .map((candidate) => ({ candidate, hideable: candidate.group !== "gauges" || candidate.hideable === true }));
  const siblings = (owner: string) => listed.filter((other) => other.hideable && other.candidate.owner === owner).length;
  const items = listed.map(({ candidate, hideable }): BarUsageItem => {
    const name = nameOf ? readName(nameOf(candidate, siblings(candidate.owner))) : null;
    return { id: candidate.id, owner: candidate.owner, hideable, box: collapsed ? readBox(boxOf(candidate.id)) : null, ...(name ? { name } : {}) };
  });
  return { id, collapsed, barWidth: collapsed ? width : null, items };
}

export function readBarUsageReport(payload: unknown): BarUsageReport | null {
  if (!payload || typeof payload !== "object") return null;
  const { id, collapsed, barWidth, items, pages, widgets, wings } = payload as Record<string, unknown>;
  if (typeof id !== "number" || !Array.isArray(items)) return null;
  const width = px(barWidth);
  const read = items.flatMap((item): BarUsageItem[] => {
    if (!item || typeof item !== "object") return [];
    const { id: itemId, owner, hideable, box, name } = item as Record<string, unknown>;
    if (typeof itemId !== "string" || itemId === "" || typeof owner !== "string" || owner === "") return [];
    const label = readName(name);
    return [{ id: itemId, owner, hideable: hideable !== false, box: readBox(box), ...(label ? { name: label } : {}) }];
  });
  const report: BarUsageReport = { id, collapsed: collapsed === true && width !== null && width > 0, barWidth: width, items: read };
  const sides = readWings(wings);
  return { ...report, ...(Array.isArray(pages) ? { pages: readPages(pages) } : {}), ...(Array.isArray(widgets) ? { widgets: readWidgets(widgets) } : {}), ...(sides ? { wings: sides } : {}) };
}

const WING_LIMIT = 64;

function readWings(value: unknown): BarUsageWings | null {
  if (!value || typeof value !== "object") return null;
  const { left, right } = value as Record<string, unknown>;
  const side = (list: unknown) => Array.isArray(list) ? list.filter((id): id is string => typeof id === "string" && id !== "").slice(0, WING_LIMIT) : null;
  const [l, r] = [side(left), side(right)];
  return l && r ? { left: l, right: r } : null;
}

const WIDGET_SIZES = ["bar", "s", "m", "l", "w"];
const ICON_LIMIT = 8000;

function readWidgets(widgets: readonly unknown[]): BarUsageWidget[] {
  return widgets.flatMap((widget): BarUsageWidget[] => {
    if (!widget || typeof widget !== "object") return [];
    const { id, owner, name, plugin, sizes, icon } = widget as Record<string, unknown>;
    if (typeof id !== "string" || id === "" || typeof owner !== "string" || owner === "" || !Array.isArray(sizes)) return [];
    const kept = WIDGET_SIZES.filter((size) => sizes.includes(size));
    if (kept.length === 0) return [];
    const svg = typeof icon === "string" && icon.length <= ICON_LIMIT && icon.trimStart().startsWith("<svg") ? icon : null;
    return [{ id, owner, name: readName(name) ?? owner, plugin: readName(plugin) ?? owner, sizes: kept, ...(svg ? { icon: svg } : {}) }];
  });
}

function readPages(pages: readonly unknown[]): BarUsagePage[] {
  return pages.flatMap((page): BarUsagePage[] => {
    if (!page || typeof page !== "object") return [];
    const { id, owner, name } = page as Record<string, unknown>;
    if (typeof id !== "string" || id === "" || typeof owner !== "string" || owner === "") return [];
    return [{ id, owner, name: readName(name) ?? owner }];
  });
}
