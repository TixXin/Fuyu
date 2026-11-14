import { useEffect, useMemo, useState } from "react";
import {
  AGENT_ICON_PET_HEIGHT,
  CENTER_PATTERN_PLUGIN_ID,
  CenterPattern,
  CollapsedCenter,
  MARK_HEIGHT,
  MARK_WIDTH,
  PetSprite,
  agentIconMarkExtraWidth,
  centerHeight,
  centerPatternChoice,
  centerPatternSize,
  centerWidth,
  usePageHidden,
  usePetMood,
  usePetSheet,
  type AgentActivity,
} from "../../features/center-pattern";
import { ClaudeUsageGauge } from "../../features/claude-usage/ClaudeUsageGauge";
import { CLAUDE_USAGE_GAUGE_WIDTH, shownUsageProviders, usageItemId, type UsageProvider } from "../../features/claude-usage/usageRing";
import { useBuiltinPlugin } from "../../features/plugins/useBuiltinPlugin";
import type { AgentSessionSummary } from "../../features/agent-status/api";
import { SESSION_RING_STYLES, SessionRing, type SessionRingStyle } from "../../features/session-ring/SessionRing";
import { sessionRingCounts } from "../../features/session-ring/ringCounts";
import { isCollapsedItemHidden } from "../../features/appearance/collapsedItems";
import { useCollapsedPlacements } from "../../features/appearance/useCollapsedPlacements";
import { listenIslandHover } from "./api";
import { TIMER_PLUGIN_ID, useTimers } from "../../features/timer/store";
import { hasChip, TimerChip, TIMER_CHIP_WIDTH } from "../../features/timer/TimerChip";
import type { CollapsedSlots } from "./types";

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
  const timerPlugin = useBuiltinPlugin(TIMER_PLUGIN_ID);
  const timers = useTimers().timers;
  const showRemaining = usage.settings.show === "remaining";
  const ringStyle = SESSION_RING_STYLES.find((known) => known === sessionRing.settings.style) ?? ("ring" satisfies SessionRingStyle);
  const ringCount = sessionRing.settings.showCount !== false;
  const { placements } = useCollapsedPlacements();
  const providers = useMemo(
    () => shownUsageProviders(usage.settings).filter((provider) => !isCollapsedItemHidden(placements, usageItemId(provider))),
    [usage.settings, placements],
  );
  const timerShown = timerPlugin.enabled && hasChip(timers) && !isCollapsedItemHidden(placements, "timer");
  const lightShown = markLight && !isCollapsedItemHidden(placements, "status-light");
  const mood = usePetMood(agents, center.enabled || lightShown);
  const choice = useMemo(() => centerPatternChoice(center.settings), [center.settings]);
  const size = centerPatternSize(center.settings);
  const sheet = usePetSheet(center.enabled ? choice.petId : null, center);
  const hidden = usePageHidden();
  const still = paused || hidden;
  return useMemo(() => {
    const slots: CollapsedSlots = {};
    if (center.enabled) {
      const pet = typeof sheet === "string" ? sheet : null;
      slots.center = <CollapsedCenter choice={choice} sheet={sheet} mood={mood} paused={still} size={size} />;
      const mark = choice.pattern === "mark";
      slots.centerWidth = centerWidth(pet ? "pet" : choice.pattern === "pet" ? "eyes" : choice.pattern, size);
      if (pet) slots.agentIcon = <PetSprite src={pet} mood={mood} paused={still} height={AGENT_ICON_PET_HEIGHT} />;
      else if (mark && !lightShown) {
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
    if (usage.enabled && providers.length > 0) {
      slots.gauges = providers.map((provider) => ({ id: usageItemId(provider), node: <UsageGaugeSlot key={provider.id} providers={[provider]} showRemaining={showRemaining} /> }));
      slots.sideWidth = providers.length * CLAUDE_USAGE_GAUGE_WIDTH;
    }
    if (timerShown) {
      slots.gauges = [...(slots.gauges ?? []), { id: "timer", node: <TimerChip key="timer" paused={still} /> }];
      slots.sideWidth = (slots.sideWidth ?? 0) + TIMER_CHIP_WIDTH;
    }
    if (lightShown) {
      slots.statusLight = <CenterPattern pattern="mark" mood={mood} paused={still} height={MARK_HEIGHT} />;
      slots.sideWidth = (slots.sideWidth ?? 0) + MARK_LIGHT_EXTRA_WIDTH;
    }
    return Object.keys(slots).length === 0 ? EMPTY : slots;
  }, [center.enabled, usage.enabled, providers, showRemaining, sessionRing.enabled, timerShown, ringStyle, ringCount, agentsOn, sessions, unseen, onOpenAgents, choice, size, sheet, mood, still, lightShown]);
}

function UsageGaugeSlot({ providers, showRemaining }: { providers: readonly UsageProvider[]; showRemaining: boolean }) {
  const [hovered, setHovered] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    listenIslandHover(setHovered)
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for island hover", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
  return providers.map((provider) => <ClaudeUsageGauge key={provider.id} provider={provider} islandHovered={hovered} showRemaining={showRemaining} />);
}
