import { useMemo } from "react";
import { getAgentStatusLabel, getAgentVisualState, withoutHiddenProviders } from "../../features/agent-status/status";
import type { AgentStatusSnapshot } from "../../features/agent-status/api";
import type { IslandSettings } from "../../features/appearance/types";
import type { useTranslation } from "../../i18n";

export function useAgentIndicator(
  agentStatus: AgentStatusSnapshot,
  settings: IslandSettings,
  activeAgentSessionCount: number,
  t: ReturnType<typeof useTranslation>,
) {
  const shownAgentStatus = useMemo(
    () => withoutHiddenProviders(agentStatus, { claudeCode: settings.agentShowClaudeCode, codex: settings.agentShowCodex }),
    [agentStatus, settings.agentShowClaudeCode, settings.agentShowCodex],
  );
  const agentVisualState = useMemo(() => (settings.agentStatusEnabled ? getAgentVisualState(shownAgentStatus, activeAgentSessionCount) : "idle"), [shownAgentStatus, activeAgentSessionCount, settings.agentStatusEnabled]);
  const agentStatusLabel = useMemo(() => getAgentStatusLabel(shownAgentStatus, t, activeAgentSessionCount), [shownAgentStatus, activeAgentSessionCount, t]);
  return { agentVisualState, agentStatusLabel };
}
