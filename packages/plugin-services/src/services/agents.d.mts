import type { ServiceDefinition } from "../define.mjs";
import type { AgentFocus, AgentRemoteHosts, AgentSessions, AgentUsageReport, AgentUsages } from "../generated/rust.mjs";

export type {
  AgentFocus,
  AgentRemoteHosts,
  AgentReportEntry,
  AgentSessionEntry,
  AgentSessions,
  AgentUsageReport,
  AgentUsages,
  AgentUsageWindow,
  RemoteHostStatus,
} from "../generated/rust.mjs";

export type AgentsUsageResult = AgentUsages & {
  extra?: Record<string, AgentUsageReport | null>;
};

export type AgentsMethods = {
  sessions(): AgentSessions;
  usage(): AgentsUsageResult;
  focus(params: { provider: string; sessionId?: string; cwd?: string; title?: string }): AgentFocus;
  remoteHosts(): AgentRemoteHosts;
};

export type AgentsEvents = { changed: { count: number } };

export const agentsV1: ServiceDefinition<AgentsMethods, AgentsEvents, {}>;
