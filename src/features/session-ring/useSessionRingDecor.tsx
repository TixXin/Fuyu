import { useMemo } from "react";
import { usePageHidden } from "../../lib/usePageHidden";
import type { AgentSessionSummary } from "../agent-status/api";
import type { IslandDecor } from "../plugin-kernel/islandDecor";
import { useBuiltinPlugin } from "../plugins/useBuiltinPlugin";
import { sessionRingCounts } from "./ringCounts";
import { SESSION_RING_STYLES, SessionRing, type SessionRingStyle } from "./SessionRing";

const SESSION_RING_PLUGIN_ID = "focusd.session-ring";

type SessionRingDecorOptions = {
  paused: boolean;
  sessions: readonly AgentSessionSummary[];
  unseen: ReadonlySet<string>;
  agentsOn: boolean;
  onOpenAgents: () => void;
};

export function useSessionRingDecor({ paused, sessions, unseen, agentsOn, onOpenAgents }: SessionRingDecorOptions): IslandDecor {
  const sessionRing = useBuiltinPlugin(SESSION_RING_PLUGIN_ID);
  const ringStyle = SESSION_RING_STYLES.find((known) => known === sessionRing.settings.style) ?? ("grid" satisfies SessionRingStyle);
  const ringCount = sessionRing.settings.showCount !== false;
  const hidden = usePageHidden();
  const still = paused || hidden;
  return useMemo(() => {
    if (!sessionRing.enabled || !agentsOn) return {};
    const counts = sessionRingCounts(sessions, unseen);
    if (counts.total === 0) return {};
    return { agentCount: <SessionRing sessions={sessions} unseen={unseen} counts={counts} style={ringStyle} showCount={ringCount} paused={still} onOpen={onOpenAgents} /> };
  }, [sessionRing.enabled, agentsOn, sessions, unseen, ringStyle, ringCount, still, onOpenAgents]);
}
