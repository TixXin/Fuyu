import { useMemo } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import type { AgentSessionSummary, ExternalAgentStatus } from "./api";
import { remoteSessions, withRemoteSessions } from "./remoteSessions";
import { countActiveSessions, isActivePhase } from "./sessionList";
import { useAgentSessions } from "./useAgentSessions";
import { useHiddenSessions } from "./useHiddenSessions";
import { applySessionFilters } from "./sessionFilters";
import { useSessionFilters } from "./useSessionFilters";
import { useUnseenSessions } from "./useUnseenSessions";

const NO_DEMO: AgentSessionSummary[] = [];

type AgentSessionSettings = Pick<
  IslandSettings,
  "agentStatusEnabled" | "agentSessionHours" | "agentHiddenProviders" | "agentHideFinished" | "agentHideClosed"
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
  const hiddenProviders = settings.agentHiddenProviders;
  const shownAgentSessions = useMemo(() => {
    const shown = hiddenProviders.length > 0 ? allAgentSessions.filter((session) => !hiddenProviders.includes(session.provider)) : allAgentSessions;
    return applySessionFilters(shown, sessionFilters);
  }, [allAgentSessions, hiddenProviders, sessionFilters]);
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
