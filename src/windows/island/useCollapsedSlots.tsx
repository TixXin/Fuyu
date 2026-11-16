import { useMemo } from "react";
import {
  AGENT_ICON_PET_HEIGHT,
  CENTER_PATTERN_PLUGIN_ID,
  CenterPattern,
  MARK_HEIGHT,
  MARK_WIDTH,
  PetSprite,
  agentIconMarkExtraWidth,
  centerHeight,
  centerPatternChoice,
  centerPatternSize,
  usePageHidden,
  usePetMood,
  usePetSheet,
  type AgentActivity,
} from "../../features/center-pattern";
import { useBuiltinPlugin } from "../../features/plugins/useBuiltinPlugin";
import type { AgentSessionSummary } from "../../features/agent-status/api";
import { SESSION_RING_STYLES, SessionRing, type SessionRingStyle } from "../../features/session-ring/SessionRing";
import { sessionRingCounts } from "../../features/session-ring/ringCounts";
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
import { collapsedCenterSlot, collapsedGaugeSlot, slotWidth, type CollapsedCenterContext, type CollapsedGaugeContext } from "./slots/collapsed";

const EMPTY: CollapsedSlots = {};
const CLAUDE_USAGE_PLUGIN_ID = "focusd.claude-usage";
const SESSION_RING_PLUGIN_ID = "focusd.session-ring";

type CollapsedSlotsOptions = {
  paused: boolean;
  agents: readonly AgentActivity[];
  sessions: readonly AgentSessionSummary[];
  unseen: ReadonlySet<string>;
  agentsOn: boolean;
  onOpenAgents: () => void;
  markLight: boolean;
};

const MARK_LIGHT_EXTRA_WIDTH = MARK_WIDTH - 9;

export function useCollapsedSlots({ paused, agents, sessions, unseen, agentsOn, onOpenAgents, markLight }: CollapsedSlotsOptions): CollapsedSlots {
  const center = useBuiltinPlugin(CENTER_PATTERN_PLUGIN_ID);
  const usage = useBuiltinPlugin(CLAUDE_USAGE_PLUGIN_ID);
  const sessionRing = useBuiltinPlugin(SESSION_RING_PLUGIN_ID);
  const timerOn = useBuiltinEnabled("timer");
  const timerRunning = hasChip(useTimers().timers);
  const showRemaining = usage.settings.show === "remaining";
  const ringStyle = SESSION_RING_STYLES.find((known) => known === sessionRing.settings.style) ?? ("grid" satisfies SessionRingStyle);
  const ringCount = sessionRing.settings.showCount !== false;
  const { placements } = useCollapsedPlacements();
  const lightShown = markLight && !isCollapsedItemHidden(placements, "status-light");
  const mood = usePetMood(agents, center.enabled || lightShown);
  const choice = useMemo(() => centerPatternChoice(center.settings), [center.settings]);
  const size = centerPatternSize(center.settings);
  const sheet = usePetSheet(center.enabled ? choice.petId : null, center);
  const hidden = usePageHidden();
  const still = paused || hidden;
  const entries = useSlotEntries(collapsedGaugeSlot);
  const [centerEntry] = useSlotEntries(collapsedCenterSlot);
  const gaugeContext = useMemo<CollapsedGaugeContext>(
    () => ({ paused: still, usage: { enabled: usage.enabled, settings: usage.settings, showRemaining }, timer: { enabled: timerOn, running: timerRunning }, listenIslandHover }),
    [still, usage.enabled, usage.settings, showRemaining, timerOn, timerRunning],
  );
  const gauges = useMemo(
    () => entries.filter((entry) => entry.group === "gauges" && !(entry.hideable && isCollapsedItemHidden(placements, entry.id)) && (entry.shown?.(gaugeContext) ?? true)),
    [entries, placements, gaugeContext],
  );
  const centerContext = useMemo<CollapsedCenterContext>(
    () => ({ enabled: center.enabled, choice, sheet, mood, paused: still, size }),
    [center.enabled, choice, sheet, mood, still, size],
  );
  return useMemo(() => {
    const slots: CollapsedSlots = {};
    if (centerEntry && (centerEntry.shown?.(centerContext) ?? true)) {
      slots.center = <SlotView slot={collapsedCenterSlot} props={centerContext} />;
      slots.centerWidth = slotWidth(centerEntry.width, centerContext);
    }
    if (center.enabled) {
      const pet = typeof sheet === "string" ? sheet : null;
      if (pet) slots.agentIcon = <PetSprite src={pet} mood={mood} paused={still} height={AGENT_ICON_PET_HEIGHT} />;
      else if (choice.pattern === "mark" && !lightShown) {
        slots.agentIcon = <CenterPattern pattern="mark" mood={mood} paused={still} height={centerHeight("mark", size)} />;
        slots.agentIconWidth = agentIconMarkExtraWidth(size);
      }
    }
    if (sessionRing.enabled && agentsOn) {
      const counts = sessionRingCounts(sessions, unseen);
      if (counts.total > 0) {
        slots.agentCount = (
          <SessionRing sessions={sessions} unseen={unseen} counts={counts} style={ringStyle} showCount={ringCount} paused={still} onOpen={onOpenAgents} />
        );
      }
    }
    if (gauges.length > 0) {
      slots.gauges = gauges.map(({ id }) => ({
        id,
        node: <SlotView key={id} slot={collapsedGaugeSlot} props={gaugeContext} select={(items) => items.filter((item) => item.id === id)} />,
      }));
    }
    const sideWidth = gauges.reduce((sum, entry) => sum + slotWidth(entry.width, gaugeContext), lightShown ? MARK_LIGHT_EXTRA_WIDTH : 0);
    if (sideWidth > 0) slots.sideWidth = sideWidth;
    if (lightShown) slots.statusLight = <CenterPattern pattern="mark" mood={mood} paused={still} height={MARK_HEIGHT} />;
    return Object.keys(slots).length === 0 ? EMPTY : slots;
  }, [centerEntry, centerContext, center.enabled, gauges, gaugeContext, sessionRing.enabled, ringStyle, ringCount, agentsOn, sessions, unseen, onOpenAgents, choice, size, sheet, mood, still, lightShown]);
}
