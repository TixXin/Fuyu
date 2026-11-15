import type { ReactNode } from "react";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { collapsedBarSlot, PLUGIN_STATUS_ORDER, type CollapsedBarContext } from "./slots/collapsed";

export type CollapsedBarItem = { id: string; node: ReactNode; group?: "gauges" };

export function useCollapsedBarItems(context: CollapsedBarContext, pluginStatus: readonly CollapsedBarItem[]): CollapsedBarItem[] {
  const entries = useSlotEntries(collapsedBarSlot);
  const items: CollapsedBarItem[] = [];
  let statusPlaced = false;
  let gaugesPlaced = false;
  for (const entry of entries) {
    if (!statusPlaced && entry.order > PLUGIN_STATUS_ORDER) {
      items.push(...pluginStatus);
      statusPlaced = true;
    }
    if (entry.group === "gauges") {
      if (!gaugesPlaced) for (const gauge of context.slots.gauges ?? []) items.push({ ...gauge, group: "gauges" });
      gaugesPlaced = true;
    } else if (entry.shown?.(context) ?? true) {
      const node = <SlotView slot={collapsedBarSlot} props={context} select={(all) => all.filter((item) => item.id === entry.id)} />;
      items.push({ id: entry.id, node });
    }
  }
  if (!statusPlaced) items.push(...pluginStatus);
  return items;
}
