import { useMemo } from "react";
import type { BarUsagePage, BarUsageWidget } from "../../../features/plugin-kernel/barUsage";
import { usePluginBarUsage } from "../usePluginBarUsage";

const NO_PAGES: readonly BarUsagePage[] = [];
const NO_WIDGETS: readonly BarUsageWidget[] = [];

export function useCollapsedPluginItems(): { items: readonly (readonly [string, string])[]; pages: readonly BarUsagePage[] | null; widgets: readonly BarUsageWidget[] } {
  const { usage } = usePluginBarUsage(true);
  const report = usage?.report;
  const items = report?.items;
  const pages = usage === undefined ? null : report?.pages ?? NO_PAGES;
  const widgets = report?.widgets ?? NO_WIDGETS;
  return useMemo(() => ({ items: (items ?? []).filter((item) => item.hideable).map((item) => [item.id, item.name ?? item.owner] as const), pages, widgets }), [items, pages, widgets]);
}
