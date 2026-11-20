import { useMemo } from "react";
import type { BarUsagePage } from "../../../features/plugin-kernel/barUsage";
import { usePluginBarUsage } from "../usePluginBarUsage";

const NO_PAGES: readonly BarUsagePage[] = [];

export function useCollapsedPluginItems(): { items: readonly (readonly [string, string])[]; pages: readonly BarUsagePage[] | null } {
  const { usage } = usePluginBarUsage(true);
  const report = usage?.report;
  const items = report?.items;
  const pages = usage === undefined ? null : report?.pages ?? NO_PAGES;
  return useMemo(() => ({ items: (items ?? []).filter((item) => item.hideable).map((item) => [item.id, item.name ?? item.owner] as const), pages }), [items, pages]);
}
