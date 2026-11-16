import { useMemo } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { useAgentStatus } from "./useAgentStatus";
import { useAgentSession } from "./useAgentSession";
import { useAgentInterjection } from "./useAgentInterjection";
import { useIslandAgentSessions } from "./useIslandAgentSessions";
import { isRemoteSessionReport } from "./remoteSessions";
import { useAgentUsages } from "./useAgentUsages";
import type { AgentSessionSummary } from "./api";

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
    settings.agentRemindSeconds * 1000,
  );
  const agentActivity = useMemo(
    () => [...sessions.agentSessions, ...(others ?? [])],
    [sessions.agentSessions, others],
  );

  const agentUsages = useAgentUsages(settings.agentStatusEnabled && (settings.agentShowUsage || settings.agentQuotaAlertPercent > 0));

  return { agentStatus, ...sessions, agentSession, agentInterjection, agentActivity, agentUsages };
}
