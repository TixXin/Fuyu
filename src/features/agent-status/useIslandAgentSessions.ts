import { useMemo } from "react";
import type { IslandSettings } from "../appearance/types";
import type { AgentSessionSummary, ExternalAgentStatus } from "./api";
import { remoteSessions, withRemoteSessions } from "./remoteSessions";
import { countActiveSessions, filterSessions, isActivePhase } from "./sessionList";
import { useAgentSessions } from "./useAgentSessions";
import { useHiddenSessions } from "./useHiddenSessions";
import { applySessionFilters } from "./sessionFilters";
import { useSessionFilters } from "./useSessionFilters";
import { useUnseenSessions } from "./useUnseenSessions";

const NO_DEMO: AgentSessionSummary[] = [];

type AgentSessionSettings = Pick<
  IslandSettings,
  "agentStatusEnabled" | "agentSessionHours" | "agentShowClaudeCode" | "agentShowCodex" | "agentHideFinished" | "agentHideClosed"
>;

export function useIslandAgentSessions(settings: AgentSessionSettings, others?: ExternalAgentStatus[], demo: AgentSessionSummary[] = NO_DEMO) {
  const readSessions = useAgentSessions(settings.agentStatusEnabled, 1000, settings.agentSessionHours);
  const localAgentSessions = useMemo(
    () => (settings.agentStatusEnabled && demo.length > 0 ? [...demo, ...readSessions] : readSessions),
    [demo, readSessions, settings.agentStatusEnabled],
  );
  const allAgentSessions = useMemo(
    () => withRemoteSessions(localAgentSessions, settings.agentStatusEnabled ? remoteSessions(others) : []),
    [localAgentSessions, others, settings.agentStatusEnabled],
  );
  const [sessionFilters] = useSessionFilters();
  const shownAgentSessions = useMemo(
    () => applySessionFilters(filterSessions(allAgentSessions, { claudeCode: settings.agentShowClaudeCode, codex: settings.agentShowCodex }), sessionFilters),
    [allAgentSessions, settings.agentShowClaudeCode, settings.agentShowCodex, sessionFilters],
  );
  const { visible: agentSessions, removal: agentRemoval } = useHiddenSessions(shownAgentSessions);
  const listedAgentSessions = useMemo(
    () =>
      agentSessions.filter(
        (session) => (!settings.agentHideFinished || isActivePhase(session.phase)) && !(settings.agentHideClosed && session.closed),
      ),
    [agentSessions, settings.agentHideFinished, settings.agentHideClosed],
  );
  const activeAgentSessionCount = countActiveSessions(agentSessions);
  const unseenAgentSessions = useUnseenSessions(agentSessions, settings.agentStatusEnabled);
  return { agentSessions, listedAgentSessions, activeAgentSessionCount, unseenAgentSessions, agentRemoval };
}
