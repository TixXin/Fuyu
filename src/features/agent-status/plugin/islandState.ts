import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { AgentSessionSummary } from "../api";
import type { QuotaAlert } from "../quotaAlerts";
import type { AgentSession } from "../session";
import type { useIslandAgentAlerts } from "../useIslandAgentAlerts";
import type { useIslandAgents } from "../useIslandAgents";

type Agents = ReturnType<typeof useIslandAgents>;
type Alerts = ReturnType<typeof useIslandAgentAlerts>;

export type AgentPage = {
  sessions: Agents["listedAgentSessions"];
  unseen: Agents["unseenAgentSessions"];
  removal: Agents["agentRemoval"];
  usages: Agents["agentUsages"];
  alerted: Alerts["alertedSession"];
  approvals: Alerts["approvals"];
};

export type AgentShell = {
  sessions: readonly AgentSessionSummary[];
  listed: AgentSessionSummary[];
  unseenKeys: ReadonlySet<string>;
  activeCount: number;
  named: AgentSession | null;
  interjection: AgentSession | null;
  activity: Agents["agentActivity"];
};

export const agentPage = createRunnerStore<AgentPage | null>(null);
export const quotaAlertState = createRunnerStore<QuotaAlert | null>(null);
export const agentShell = createRunnerStore<AgentShell>({ sessions: [], listed: [], unseenKeys: new Set(), activeCount: 0, named: null, interjection: null, activity: [] });
