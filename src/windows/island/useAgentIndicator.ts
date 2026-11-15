import { useMemo } from "react";
import { AGENT_PROVIDERS, getAgentStatusLabel, getAgentVisualState, withoutHiddenProviders } from "../../features/agent-status/status";
import type { AgentStatusSnapshot } from "../../features/agent-status/api";
import type { SessionFilter } from "../../features/agent-status/sessionList";
import type { IslandSettings } from "../../features/appearance/types";
import type { useTranslation } from "../../i18n";

export function useAgentIndicator(
  agentStatus: AgentStatusSnapshot,
  settings: IslandSettings,
  activeAgentSessionCount: number,
  t: ReturnType<typeof useTranslation>,
) {
  const shownAgentStatus = useMemo(
    () => withoutHiddenProviders(agentStatus, shownProviders(settings.agentHiddenProviders)),
    [agentStatus, settings.agentHiddenProviders],
  );
  const agentVisualState = useMemo(() => (settings.agentStatusEnabled ? getAgentVisualState(shownAgentStatus, activeAgentSessionCount) : "idle"), [shownAgentStatus, activeAgentSessionCount, settings.agentStatusEnabled]);
  const agentStatusLabel = useMemo(() => getAgentStatusLabel(shownAgentStatus, t, activeAgentSessionCount), [shownAgentStatus, activeAgentSessionCount, t]);
  return { agentVisualState, agentStatusLabel };
}

function shownProviders(hidden: readonly string[]): SessionFilter {
  return Object.fromEntries(AGENT_PROVIDERS.map((provider) => [provider, !hidden.includes(provider)])) as SessionFilter;
}
