import type { AgentFocus, AgentReportEntry, AgentSessionEntry, AgentSessions, AgentUsageReport, AgentsUsageResult } from "@fuyu/plugin-services";

export type CustomAgentSessionInput = {
  key?: string;
  provider?: string;
  sessionId: string;
  title?: string | null;
  cwd?: string | null;
  phase?: string;
  light?: string;
  updatedAt?: number;
  remoteHost?: string | null;
  listed?: boolean;
  unseen?: boolean;
};

export type CustomAgentSourceSpec = {
  provider: string;
  sessions?(): Promise<CustomAgentSessionInput[]> | CustomAgentSessionInput[];
  others?(): Promise<Partial<AgentReportEntry>[]> | Partial<AgentReportEntry>[];
  focus?(params: { provider: string; sessionId: string | null; cwd: string | null; title: string | null }): Promise<{ found: boolean } | boolean> | { found: boolean } | boolean;
  usage?(): Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
};

export type AgentSourceRegistry = {
  register(spec: CustomAgentSourceSpec): () => void;
  has(provider: unknown): boolean;
  get(provider: unknown): unknown;
  mergeSessions(base: AgentSessions): Promise<AgentSessions>;
  mergeUsage(base: { claude: AgentUsageReport | null; codex: AgentUsageReport | null }): Promise<AgentsUsageResult>;
  tryFocus(params: { provider: string; sessionId: string | null; cwd: string | null; title: string | null }): Promise<AgentFocus | null>;
  subscribe(listener: () => void): () => void;
};

export function normalizeSessionEntry(session: Record<string, unknown>, fallbackProvider?: string): AgentSessionEntry;
export function normalizeReportEntry(report: Record<string, unknown> | null, fallbackId?: string): AgentReportEntry;
export function normalizeUsageReport(usage: unknown): AgentUsageReport | null;
export function createAgentSourceRegistry(): AgentSourceRegistry;
export const agentSources: AgentSourceRegistry;
export function registerAgentSource(spec: CustomAgentSourceSpec): () => void;
export function subscribeAgentSources(listener: () => void): () => void;
