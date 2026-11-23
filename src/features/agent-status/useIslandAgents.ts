import { useMemo } from "react";
import { lyricsBeforeAgent, useTextOrder } from "../../lib/settings/collapsedText";
import type { IslandSettings } from "../../lib/settings/types";
import { useAgentStatus } from "./useAgentStatus";
import { useAgentSession } from "./useAgentSession";
import { useAgentInterjection } from "./useAgentInterjection";
import { useIslandAgentSessions } from "./useIslandAgentSessions";
import { isRemoteSessionReport } from "./remoteSessions";
import { useAgentUsages } from "./useAgentUsages";
import { AGENT_USAGE_SOURCES, type AgentUsageSource } from "./agentSettings";
import type { AgentSessionSummary } from "./api";

const QUOTA_SOURCES: readonly AgentUsageSource[] = ["claudeCode", "codex"];
const NO_SESSIONS: AgentSessionSummary[] = [];

export function useIslandAgents(settings: IslandSettings, demoSessions: AgentSessionSummary[] = NO_SESSIONS) {
  const agentStatus = useAgentStatus(settings.agentStatusEnabled);
  const sessions = useIslandAgentSessions(settings, agentStatus.others, demoSessions);
  const others = useMemo(() => agentStatus.others?.filter((report) => !isRemoteSessionReport(report)), [agentStatus.others]);
  const titlesOn = settings.agentStatusEnabled && settings.agentTitleEnabled;
  const whileRunning = settings.agentTitleMode === "running";
  const { order, hidden } = useTextOrder(settings.lyricsIslandPriority);
  const agentSession = useAgentSession(sessions.agentSessions, others, titlesOn && whileRunning);
  const agentInterjection = useAgentInterjection(
    sessions.agentSessions,
    titlesOn && (!whileRunning || (settings.musicEnabled && settings.lyricsOnIsland && lyricsBeforeAgent(order) && !hidden.includes("lyrics"))),
    settings.agentRemindSeconds * 1000,
    settings.agentAlertStarted,
  );
  const agentActivity = useMemo(
    () => [...sessions.agentSessions, ...(others ?? [])],
    [sessions.agentSessions, others],
  );

  const usageSources = settings.agentShowUsage
    ? AGENT_USAGE_SOURCES.filter((source) => QUOTA_SOURCES.includes(source) || !settings.agentHiddenProviders.includes(source))
    : QUOTA_SOURCES;
  const agentUsages = useAgentUsages(settings.agentStatusEnabled && (settings.agentShowUsage || settings.agentQuotaAlertPercent > 0), usageSources);

  return { agentStatus, ...sessions, agentSession, agentInterjection, agentActivity, agentOthers: others, agentUsages };
}
