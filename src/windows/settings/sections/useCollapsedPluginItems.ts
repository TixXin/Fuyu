import { useMemo } from "react";
import { usePluginBarUsage } from "../usePluginBarUsage";

export function useCollapsedPluginItems(): readonly (readonly [string, string])[] {
  const { usage } = usePluginBarUsage(true);
  const items = usage?.report?.items;
  return useMemo(() => (items ?? []).filter((item) => item.hideable).map((item) => [item.id, item.name ?? item.owner] as const), [items]);
}
