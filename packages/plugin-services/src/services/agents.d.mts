import type { ServiceDefinition } from "../define.mjs";
import type { AgentFocus, AgentRemoteHosts, AgentSessions, AgentUsages } from "../generated/rust.mjs";

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

export type AgentsMethods = {
  sessions(): AgentSessions;
  usage(): AgentUsages;
  focus(params: { provider: string; sessionId?: string; cwd?: string; title?: string }): AgentFocus;
  remoteHosts(): AgentRemoteHosts;
};

export type AgentsEvents = { changed: { count: number } };

export const agentsV1: ServiceDefinition<AgentsMethods, AgentsEvents, {}>;
