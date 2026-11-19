import type { AgentUsage, AgentUsageErrorKind } from "../../lib/agent-usage/types";

type UsageReportWindow = { name: string; used: number; resetsAt: number | null };

export type UsageReport = {
  updatedAt: number | null;
  fiveHour: UsageReportWindow | null;
  sevenDay: UsageReportWindow | null;
  models: UsageReportWindow[];
  plan: string | null;
  source: string;
  error: string | null;
};

const SOURCES = new Set(["hud", "api", "magpie", "codex", "glm", "kimi", "antigravity", "antigravityCloud", "cursor"]);
const ERRORS = new Set([
  "noCredentials",
  "tokenExpired",
  "loginRequired",
  "forbidden",
  "rateLimited",
  "noProxy",
  "network",
  "http",
  "invalidResponse",
  "endpointChanged",
  "noSessions",
  "customEndpoint",
]);

export function usageFromReport(report: UsageReport | null): AgentUsage | null {
  if (!report) return null;
  const source = SOURCES.has(report.source) ? (report.source as AgentUsage["source"]) : "hud";
  const error = report.error && ERRORS.has(report.error) ? { kind: report.error as AgentUsageErrorKind, message: "" } : null;
  return { updatedAt: report.updatedAt, fiveHour: report.fiveHour, sevenDay: report.sevenDay, models: report.models, plan: report.plan, source, error };
}

export function isServiceOff(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "not-ready";
}
