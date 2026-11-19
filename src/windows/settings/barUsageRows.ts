import type { BarUsageReport } from "../../features/plugin-kernel/barUsage.ts";
import { arrangeCollapsedItems, isCollapsedItemHidden, type CollapsedPlacement, type CollapsedZone } from "../../lib/settings/collapsedItems.ts";

export type BarRowState = "shown" | "clipped" | "hidden" | "idle" | "off" | "unmeasured";

export interface BarUsageEntry {
  id: string;
  title: string;
  running: boolean;
  declaresBar: boolean;
  settings: boolean;
}

export interface BarUsageRow {
  key: string;
  item: string | null;
  plugin: string;
  title: string;
  state: BarRowState;
  left: number | null;
  width: number | null;
  cut: number;
  zone: CollapsedZone | null;
  hideable: boolean;
  settings: boolean;
  before: string | null;
  after: string | null;
}

export interface BarUsageModel {
  rows: BarUsageRow[];
  measured: boolean;
  barWidth: number | null;
  used: number;
  plugins: number;
  clipped: number;
  placements: CollapsedPlacement[];
}

const VISIBLE: readonly BarRowState[] = ["shown", "clipped"];
const REST_ORDER: readonly BarRowState[] = ["hidden", "idle", "unmeasured", "off"];

export const isOnBar = (row: Pick<BarUsageRow, "state">) => VISIBLE.includes(row.state);

export function barUsageModel(entries: readonly BarUsageEntry[], report: BarUsageReport | null, saved: readonly CollapsedPlacement[]): BarUsageModel {
  const measured = report?.collapsed === true;
  const known = new Map(entries.map((entry) => [entry.id, entry]));
  const reported = (report?.items ?? []).filter((item) => known.has(item.owner));
  const placements = arrangeCollapsedItems(reported.map(({ id }) => id), saved);
  const zoneOf = new Map(placements.map((placement) => [placement.id, placement.zone]));
  const owners = new Set(reported.map(({ owner }) => owner));
  const rows: BarUsageRow[] = [];
  for (const item of reported) {
    const entry = known.get(item.owner)!;
    const hidden = item.hideable && isCollapsedItemHidden(placements, item.id);
    const cut = item.box ? Math.max(0, item.box.wanted - item.box.width) : 0;
    const state: BarRowState = hidden ? "hidden" : !measured ? "unmeasured" : !item.box ? "idle" : cut > 0 ? "clipped" : "shown";
    const onBar = VISIBLE.includes(state);
    rows.push({
      key: item.id,
      item: item.id,
      plugin: entry.id,
      title: entry.title,
      state,
      left: onBar ? item.box!.left : null,
      width: onBar ? item.box!.width : null,
      cut: onBar ? cut : 0,
      zone: zoneOf.get(item.id) ?? null,
      hideable: item.hideable,
      settings: entry.settings,
      before: null,
      after: null,
    });
  }
  for (const entry of entries) {
    if (!entry.declaresBar || owners.has(entry.id)) continue;
    rows.push({
      key: `plugin:${entry.id}`,
      item: null,
      plugin: entry.id,
      title: entry.title,
      state: !entry.running ? "off" : measured ? "idle" : "unmeasured",
      left: null,
      width: null,
      cut: 0,
      zone: null,
      hideable: false,
      settings: entry.settings,
      before: null,
      after: null,
    });
  }
  const rank = new Map(placements.map((placement, index) => [placement.id, index]));
  for (const zone of ["left", "right"] as const) {
    const line = rows
      .filter((row) => row.item !== null && row.zone === zone && (measured ? VISIBLE.includes(row.state) : row.state === "unmeasured"))
      .sort((a, b) => (rank.get(a.item!) ?? 0) - (rank.get(b.item!) ?? 0));
    line.forEach((row, index) => {
      row.before = line[index - 1]?.item ?? null;
      row.after = line[index + 1]?.item ?? null;
    });
  }
  const order = (row: BarUsageRow) => (VISIBLE.includes(row.state) ? -1 : REST_ORDER.indexOf(row.state));
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => order(a.row) - order(b.row) || (a.row.left ?? 0) - (b.row.left ?? 0) || a.index - b.index)
    .map(({ row }) => row);
  const onBar = sorted.filter(isOnBar);
  return {
    rows: sorted,
    measured,
    barWidth: measured ? report!.barWidth : null,
    used: onBar.reduce((sum, row) => sum + (row.width ?? 0), 0),
    plugins: new Set(onBar.map((row) => row.plugin)).size,
    clipped: onBar.filter((row) => row.state === "clipped").length,
    placements,
  };
}

export function swapBarItems(placements: readonly CollapsedPlacement[], a: string, b: string): CollapsedPlacement[] {
  const [from, to] = [placements.findIndex((placement) => placement.id === a), placements.findIndex((placement) => placement.id === b)];
  if (from < 0 || to < 0 || from === to) return [...placements];
  const next = [...placements];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
