import type { Context } from "@fuyu/plugin-base";
import type { AgentReportEntry, AgentSessionEntry, AgentUsageReport, ServiceErrorCode } from "@fuyu/plugin-services";

export const name: "agents";
export function fromRust(error: unknown): Error & { code: ServiceErrorCode; data: { reason: string; args?: Record<string, unknown>; detail?: string } };
export function focusParams(params: unknown): { provider: string; sessionId: string | null; cwd: string | null; title: string | null };
export function sessionEntry(session: unknown, flags: { listed: boolean; unseen: boolean; light?: string }): AgentSessionEntry;
export function reportEntry(report: unknown): AgentReportEntry;
export function usageReport(usage: unknown): AgentUsageReport | null;
export function apply(ctx: Context): void;
