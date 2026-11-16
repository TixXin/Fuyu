import { useMemo } from "react";
import { usePageHidden } from "../../lib/usePageHidden";
import { useBuiltinPlugin } from "../../features/plugins/useBuiltinPlugin";
import { isCollapsedItemHidden } from "../../lib/settings/collapsedItems";
import { useCollapsedPlacements } from "../../lib/settings/useCollapsedPlacements";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useTimers } from "../../features/timer/store";
import { useBuiltinEnabled } from "../../features/plugin-kernel/useBuiltinPlugins";
import { hasChip } from "../../features/timer/TimerChip";
import type { CollapsedSlots } from "./types";
import "./slots/builtins";
import { listenIslandHover } from "./api";
import { collapsedGaugeSlot, slotWidth, type CollapsedGaugeContext } from "./slots/collapsed";

const EMPTY: CollapsedSlots = {};
const CLAUDE_USAGE_PLUGIN_ID = "focusd.claude-usage";

export function useCollapsedGauges(paused: boolean): CollapsedSlots {
  const usage = useBuiltinPlugin(CLAUDE_USAGE_PLUGIN_ID);
  const timerOn = useBuiltinEnabled("timer");
  const timerRunning = hasChip(useTimers().timers);
  const showRemaining = usage.settings.show === "remaining";
  const { placements } = useCollapsedPlacements();
  const hidden = usePageHidden();
  const still = paused || hidden;
  const entries = useSlotEntries(collapsedGaugeSlot);
  const gaugeContext = useMemo<CollapsedGaugeContext>(
    () => ({ paused: still, usage: { enabled: usage.enabled, settings: usage.settings, showRemaining }, timer: { enabled: timerOn, running: timerRunning }, listenIslandHover }),
    [still, usage.enabled, usage.settings, showRemaining, timerOn, timerRunning],
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
