import { useMemo } from "react";
import { usePageHidden } from "../../lib/usePageHidden";
import type { IslandDecor } from "../plugin-kernel/islandDecor";
import { sessionRingCounts, type RingSession } from "./ringCounts";
import type { RingConfig } from "./ringConfig";
import { SessionRing } from "./SessionRing";

type SessionRingDecorOptions = {
  paused: boolean;
  sessions: readonly RingSession[];
  config: RingConfig;
  agentsOn: boolean;
  onOpenAgents: () => void;
};

export function useSessionRingDecor({ paused, sessions, config, agentsOn, onOpenAgents }: SessionRingDecorOptions): IslandDecor {
  const hidden = usePageHidden();
  const still = paused || hidden;
  const { style, showCount } = config;
  return useMemo(() => {
    if (!agentsOn) return {};
    const counts = sessionRingCounts(sessions);
    if (counts.total === 0) return {};
    return { agentCount: <SessionRing sessions={sessions} counts={counts} style={style} showCount={showCount} paused={still} onOpen={onOpenAgents} /> };
  }, [agentsOn, sessions, style, showCount, still, onOpenAgents]);
}
