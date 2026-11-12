import { useMemo } from "react";
import type { IslandSettings } from "../../features/appearance/types";
import { useAgentStatus } from "../../features/agent-status/useAgentStatus";
import { useAgentSession } from "../../features/agent-status/useAgentSession";
import { useAgentInterjection } from "../../features/agent-status/useAgentInterjection";
import { useIslandAgentSessions } from "../../features/agent-status/useIslandAgentSessions";
import { isRemoteSessionReport } from "../../features/agent-status/remoteSessions";
import { useAgentUsages } from "../../features/agent-status/useAgentUsages";
import type { AgentSessionSummary } from "../../features/agent-status/api";

const NO_SESSIONS: AgentSessionSummary[] = [];

export function useIslandAgents(settings: IslandSettings, demoSessions: AgentSessionSummary[] = NO_SESSIONS) {
  const agentStatus = useAgentStatus(settings.agentStatusEnabled);
  const sessions = useIslandAgentSessions(settings, agentStatus.others, demoSessions);
  const others = useMemo(() => agentStatus.others?.filter((report) => !isRemoteSessionReport(report)), [agentStatus.others]);
  const titlesOn = settings.agentStatusEnabled && settings.agentTitleEnabled;
  const whileRunning = settings.agentTitleMode === "running";
  const agentSession = useAgentSession(sessions.agentSessions, others, titlesOn && whileRunning);
  const agentInterjection = useAgentInterjection(
    sessions.agentSessions,
    titlesOn && (!whileRunning || (settings.musicEnabled && settings.lyricsOnIsland && settings.lyricsIslandPriority === "lyrics")),
  );
  const agentActivity = useMemo(
    () => [...sessions.agentSessions, ...(others ?? [])],
    [sessions.agentSessions, others],
  );

  const agentUsages = useAgentUsages(settings.agentStatusEnabled && (settings.agentShowUsage || settings.agentQuotaAlertPercent > 0));

  return { agentStatus, ...sessions, agentSession, agentInterjection, agentActivity, agentUsages };
}
