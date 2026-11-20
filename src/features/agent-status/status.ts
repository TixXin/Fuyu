import type { Translations } from "../../i18n";
import type { AgentHooksState, AgentProvider, AgentStatusSnapshot, AgentTaskPhase, AgentTaskStatus, SessionProvider } from "./api";
import { AGENTS, AGENT_PROVIDERS, SESSION_PROVIDERS } from "./agents.ts";
import type { SessionFilter } from "./sessionList";

export { AGENT_PROVIDERS } from "./agents.ts";

export type AgentVisualState = "idle" | "running" | "attention";

export const DEFAULT_AGENT_TASK_STATUS: AgentTaskStatus = {
  phase: "idle",
  updatedAt: 0,
};
export const DEFAULT_AGENT_STATUS: AgentStatusSnapshot = {
  ...(Object.fromEntries(AGENT_PROVIDERS.map((provider) => [provider, DEFAULT_AGENT_TASK_STATUS])) as Record<AgentProvider, AgentTaskStatus>),
  updatedAt: 0,
  statusPath: "",
  others: [],
};
export const AGENT_PROVIDER_LABELS = Object.fromEntries(
  SESSION_PROVIDERS.map((provider) => [provider, AGENTS[provider].label]),
) as Record<SessionProvider, string>;

export function getAgentProviderLabel(provider: SessionProvider | string): string {
  return AGENT_PROVIDER_LABELS[provider as SessionProvider] ?? provider;
}
export type AgentStatusEntry = {
  key: string;
  label: string;
  provider: AgentProvider | null;
  status: AgentTaskStatus;
};

export function listAgentStatuses(snapshot: AgentStatusSnapshot): AgentStatusEntry[] {
  return [
    ...AGENT_PROVIDERS.map((provider) => ({
      key: provider,
      label: AGENT_PROVIDER_LABELS[provider],
      provider,
      status: snapshot[provider] ?? DEFAULT_AGENT_TASK_STATUS,
    })),
    ...(snapshot.others ?? []).map((other) => ({ key: other.id, label: other.name, provider: null, status: other })),
  ];
}

export function isAgentProviderDetected(
  provider: SessionProvider,
  snapshot: AgentStatusSnapshot,
  hooksState: AgentHooksState | null,
): boolean {
  const status = (snapshot as Partial<Record<SessionProvider, AgentTaskStatus>>)[provider];
  if (status && status.phase !== "idle") return true;
  const hook = (hooksState as Partial<Record<SessionProvider, string>> | null)?.[provider];
  return hook !== undefined && hook !== "absent";
}

export function partitionAgentProviders(
  providers: readonly SessionProvider[],
  snapshot: AgentStatusSnapshot,
  hooksState: AgentHooksState | null,
): { primary: SessionProvider[]; more: SessionProvider[] } {
  const detected = providers.filter((provider) => isAgentProviderDetected(provider, snapshot, hooksState));
  if (detected.length === 0) {
    return {
      primary: providers.filter((provider) => provider === "codex" || provider === "claudeCode"),
      more: providers.filter((provider) => provider !== "codex" && provider !== "claudeCode"),
    };
  }
  const detectedSet = new Set(detected);
  return {
    primary: detected,
    more: providers.filter((provider) => !detectedSet.has(provider)),
  };
}

export function withoutHiddenProviders(snapshot: AgentStatusSnapshot, shown: SessionFilter): AgentStatusSnapshot {
  const hidden = SESSION_PROVIDERS.filter((provider) => shown[provider] === false && provider in snapshot);
  if (hidden.length === 0) return snapshot;
  return { ...snapshot, ...Object.fromEntries(hidden.map((provider) => [provider, DEFAULT_AGENT_TASK_STATUS])) };
}

export function isAgentAttentionPhase(phase: AgentTaskPhase) {
  return phase === "failed" || phase === "stale";
}

export function getAgentVisualState(snapshot: AgentStatusSnapshot, activeSessions = 0): AgentVisualState {
  const statuses = listAgentStatuses(snapshot).map((entry) => entry.status);

  if (statuses.some((status) => isAgentAttentionPhase(status.phase))) {
    return "attention";
  }

  if (activeSessions > 0 || statuses.some((status) => status.phase === "running")) {
    return "running";
  }

  return "idle";
}

export function getAgentStatusLabel(snapshot: AgentStatusSnapshot, t: Translations, activeSessions = 0) {
  const entries = listAgentStatuses(snapshot);
  const attention = entries.find((entry) => isAgentAttentionPhase(entry.status.phase));

  if (attention) {
    return attention.status.phase === "stale"
      ? t.agent.stale(attention.label)
      : t.agent.failed(attention.label);
  }

  const running = entries.find((entry) => entry.status.phase === "running");

  if (running) {
    return t.agent.running(running.label);
  }

  return activeSessions > 0 ? t.agent.running("AI Agent") : t.agent.idleOrDone;
}

export function getAgentPhaseLabel(phase: AgentTaskPhase, t: Translations) {
  switch (phase) {
    case "running":
      return t.agent.phase.running;
    case "completed":
      return t.agent.phase.completed;
    case "failed":
      return t.agent.phase.failed;
    case "stale":
      return t.agent.phase.stale;
    case "waiting":
      return t.agent.phase.waiting;
    case "idle":
    default:
      return t.agent.phase.idle;
  }
}
