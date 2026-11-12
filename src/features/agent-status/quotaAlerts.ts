import type { AgentUsage } from "./api";
import { isStale, type AgentUsages } from "./usage.ts";

export type QuotaAgent = "claude" | "codex";
export type QuotaWindow = "fiveHour" | "sevenDay";

export type QuotaAlert = { kind: "low" | "reset"; agent: QuotaAgent; window: QuotaWindow; used: number; resetsAt: number | null };

export type QuotaState = { seen: Set<string>; reached: Set<string> };

export function emptyQuotaState(): QuotaState {
  return { seen: new Set(), reached: new Set() };
}

const RESET_DROP = 30;

const WINDOWS: QuotaWindow[] = ["fiveHour", "sevenDay"];

export function takeQuotaAlerts(state: QuotaState, usages: AgentUsages, percent: number, now: number): QuotaAlert[] {
  if (percent <= 0) return [];
  const alerts: QuotaAlert[] = [];
  const read: [QuotaAgent, AgentUsage | null][] = [["claude", usages.claude], ["codex", usages.codex]];
  for (const [agent, usage] of read) {
    if (!usage || isStale(usage, now)) continue;
    for (const window of WINDOWS) {
      const limit = usage[window];
      if (!limit) continue;
      const key = `${agent}:${window}`;
      const base = { agent, window, used: limit.used, resetsAt: limit.resetsAt };
      const firstLook = !state.seen.has(key);
      state.seen.add(key);
      if (!state.reached.has(key) && limit.used >= percent) {
        state.reached.add(key);
        if (!firstLook) alerts.push({ kind: "low", ...base });
      } else if (state.reached.has(key) && limit.used <= Math.max(0, percent - RESET_DROP)) {
        state.reached.delete(key);
        alerts.push({ kind: "reset", ...base });
      }
    }
  }
  return alerts;
}
