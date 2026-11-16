import type { AgentStatusSnapshot } from "../../features/agent-status/api";
import { listAgentStatuses } from "../../features/agent-status/status";
import { useHostChangeEvent } from "../../features/plugins/useHostChangeEvent";
import { useLocale } from "../../i18n";
import type { IslandMode } from "./types";

type PluginHostEventSources = {
  agentStatus: AgentStatusSnapshot;
  mode: IslandMode;
};

export function usePluginHostEvents({ agentStatus, mode }: PluginHostEventSources) {
  const { locale } = useLocale();
  useHostChangeEvent("agentStatus.changed", [agentStatus], () => ({
    agents: listAgentStatuses(agentStatus).map(({ key, label, status }) => ({
      id: key,
      name: label,
      phase: status.phase,
      ...(status.title ? { title: status.title } : {}),
    })),
  }));
  useHostChangeEvent(mode === "expanded" ? "island.expanded" : "island.collapsed", [mode === "expanded"], () => ({}));
  useHostChangeEvent("app.locale.changed", [locale], () => ({ locale }));
}
