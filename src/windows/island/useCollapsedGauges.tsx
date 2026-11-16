import { useMemo } from "react";
import { usePageHidden } from "../../lib/usePageHidden";
import { isCollapsedItemHidden } from "../../lib/settings/collapsedItems";
import { useCollapsedPlacements } from "../../lib/settings/useCollapsedPlacements";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import type { CollapsedSlots } from "./types";
import "./slots/builtins";
import { listenIslandHover } from "./api";
import { collapsedGaugeSlot, slotWidth, type CollapsedGaugeContext } from "./slots/collapsed";

const EMPTY: CollapsedSlots = {};

export function useCollapsedGauges(paused: boolean): CollapsedSlots {
  const { hints } = useIslandContributed();
  const { placements } = useCollapsedPlacements();
  const hidden = usePageHidden();
  const still = paused || hidden;
  const entries = useSlotEntries(collapsedGaugeSlot);
  const gaugeContext = useMemo<CollapsedGaugeContext>(
    () => ({ paused: still, hints, listenIslandHover }),
    [still, hints],
  );
  const gauges = useMemo(
    () => entries.filter((entry) => entry.group === "gauges" && !(entry.hideable && isCollapsedItemHidden(placements, entry.id)) && (entry.shown?.(gaugeContext) ?? true)),
    [entries, placements, gaugeContext],
  );
  return useMemo(() => {
    if (gauges.length === 0) return EMPTY;
    const slots: CollapsedSlots = {
      gauges: gauges.map(({ id }) => ({
        id,
        node: <SlotView key={id} slot={collapsedGaugeSlot} props={gaugeContext} select={(items) => items.filter((item) => item.id === id)} />,
      })),
    };
    const sideWidth = gauges.reduce((sum, entry) => sum + slotWidth(entry.width, gaugeContext), 0);
    if (sideWidth > 0) slots.sideWidth = sideWidth;
    return slots;
  }, [gauges, gaugeContext]);
}
