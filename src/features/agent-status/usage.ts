import { liveUsage } from "../../lib/agent-usage/usage.ts";
import type { AgentUsage, HoverUsage, UsageWindow } from "./api";
import { AGENT_USAGE_SOURCES, type AgentUsageItem, type AgentUsageLayout, type AgentUsageReset, type AgentUsageSource, type AgentUsageStyle } from "./agentSettings.ts";

export { isStale, liveUsage, untilReset, USAGE_STALE_MS, usageSourceLines } from "../../lib/agent-usage/usage.ts";

export type UsageLevel = "low" | "medium" | "high";

export function usageLevel(used: number): UsageLevel {
  return used >= 85 ? "high" : used >= 50 ? "medium" : "low";
}

export function tightestWindow(usage: AgentUsage): UsageWindow | null {
  const windows = [usage.fiveHour, usage.sevenDay, ...usage.models].filter((window): window is UsageWindow => window !== null);
  return windows.reduce<UsageWindow | null>((tightest, window) => (tightest === null || window.used > tightest.used ? window : tightest), null);
}

export type CreditSource = "workbuddy" | "dsh";
export type OtherSource = "antigravity" | "cursor" | "glm" | "kimi";

export type AgentUsages = {
  claude: AgentUsage | null;
  codex: AgentUsage | null;
  others: Partial<Record<OtherSource, AgentUsage>>;
  credits: Partial<Record<CreditSource, HoverUsage>>;
  readAt: number;
};

export const EMPTY_USAGES: AgentUsages = { claude: null, codex: null, others: {}, credits: {}, readAt: 0 };

export const USAGE_SOURCE_LABELS: Record<AgentUsageSource, string> = {
  claudeCode: "Claude Code",
  codex: "Codex",
  antigravity: "Antigravity",
  cursor: "Cursor",
  glm: "GLM",
  kimi: "Kimi",
  workbuddy: "WorkBuddy",
  dsh: "DeepSeek Harness",
};

export const USAGE_SOURCE_ICONS: Record<AgentUsageSource, string> = { ...Object.fromEntries(AGENT_USAGE_SOURCES.map((source) => [source, source])), glm: "zcode", kimi: "kimiCode" } as Record<AgentUsageSource, string>;

export const PLAN_SOURCES: readonly AgentUsageSource[] = ["glm", "kimi"];

export type CreditFigures = { kind: "credits"; today: number; sevenDay: number } | { kind: "balance"; currency: string; total: string };

export type UsageLine = { source: AgentUsageSource; usage: AgentUsage; credit?: undefined } | { source: CreditSource; credit: CreditFigures; usage?: undefined };

export function creditFigures(usage: HoverUsage | undefined): CreditFigures | null {
  if (!usage) return null;
  if (usage.credits) return { kind: "credits", today: usage.credits.today, sevenDay: usage.credits.sevenDay };
  const wallet = usage.wallets[0];
  return wallet ? { kind: "balance", currency: wallet.currency, total: wallet.total } : null;
}

function percentOf(usages: AgentUsages, source: AgentUsageSource): AgentUsage | null {
  if (source === "claudeCode") return usages.claude;
  if (source === "codex") return usages.codex;
  if (source === "workbuddy" || source === "dsh") return null;
  return usages.others[source] ?? null;
}

export function availableLines(usages: AgentUsages, agentsOff: readonly string[] = []): UsageLine[] {
  const lines: UsageLine[] = [];
  for (const source of AGENT_USAGE_SOURCES) {
    if (agentsOff.includes(source)) continue;
    if (source === "workbuddy" || source === "dsh") {
      const credit = creditFigures(usages.credits[source]);
      if (credit) lines.push({ source, credit });
      continue;
    }
    const usage = percentOf(usages, source);
    if (usage && hasUsageNumbers(liveUsage(usage, usages.readAt))) lines.push({ source, usage: liveUsage(usage, usages.readAt) });
  }
  return lines;
}

export function usageLines(usages: AgentUsages, view: UsageView): UsageLine[] {
  return availableLines(usages, view.agentsOff)
    .filter((line) => !view.hidden.includes(line.source))
    .map((line) => (line.usage ? { source: line.source, usage: shownUsage(line.usage, view) } : line))
    .filter((line) => !line.usage || hasUsageNumbers(line.usage));
}

export function hasUsageNumbers(usage: AgentUsage | null): boolean {
  return Boolean(usage && (usage.fiveHour || usage.sevenDay || usage.models.length > 0));
}

export function usageLineCount(usages: AgentUsages): number {
  return availableLines(usages).length;
}

export type UsageWindowCell = { key: string; label: string; window: UsageWindow };

export function usageWindows(usage: AgentUsage, labels: { fiveHour: string; sevenDay: string; names?: Readonly<Record<string, string>> }): UsageWindowCell[] {
  return [
    ...(usage.fiveHour ? [{ key: "fiveHour", label: labels.fiveHour, window: usage.fiveHour }] : []),
    ...(usage.sevenDay ? [{ key: "sevenDay", label: labels.sevenDay, window: usage.sevenDay }] : []),
    ...usage.models.map((model, index) => ({ key: `model:${index}`, label: labels.names?.[model.name] ?? model.name, window: model })),
  ];
}

export type UsageColumns = { template: string; of: (key: string) => number; reset: number; stale: number };

export function usageColumns(usages: readonly AgentUsage[]): UsageColumns {
  const keys = [
    ...(usages.some((usage) => usage.fiveHour) ? ["fiveHour"] : []),
    ...(usages.some((usage) => usage.sevenDay) ? ["sevenDay"] : []),
    ...Array.from({ length: Math.max(0, ...usages.map((usage) => usage.models.length)) }, (_, index) => `model:${index}`),
  ];
  return {
    template: ["14px", ...keys.map(() => "auto"), "minmax(0, 1fr)", "auto"].join(" "),
    of: (key) => keys.indexOf(key) + 2,
    reset: keys.length + 2,
    stale: keys.length + 3,
  };
}

export type UsageView = { hidden: readonly AgentUsageItem[]; tightest: boolean; reset: AgentUsageReset; style: AgentUsageStyle; layout?: AgentUsageLayout; agentsOff?: readonly string[] };

export const DEFAULT_USAGE_VIEW: UsageView = { hidden: [], tightest: false, reset: "tightest", style: "number", layout: "chips" };

export const LAYOUT_CONTROLS: Record<AgentUsageLayout, { style: boolean; reset: boolean; tightest: boolean }> = {
  chips: { style: true, reset: false, tightest: false },
  tiles: { style: false, reset: true, tightest: false },
  lead: { style: false, reset: true, tightest: false },
  ruler: { style: false, reset: false, tightest: false },
  table: { style: true, reset: true, tightest: true },
};

export function formatCredit(value: number): string {
  const digits = Math.abs(value) >= 100 ? 0 : 2;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function rulerSpots(values: readonly number[], gap = 13): number[] {
  const order = values.map((value, index) => ({ value: Math.max(0, Math.min(100, value)), index })).sort((a, b) => a.value - b.value || a.index - b.index);
  const spots: number[] = Array.from({ length: values.length }, () => 0);
  let last = -Infinity;
  for (const { value, index } of order) {
    const spot = Math.max(value, last + gap);
    spots[index] = spot;
    last = spot;
  }
  const over = Math.max(0, last - 100);
  if (over === 0) return spots;
  const shifted = order.map(({ index }) => spots[index] - over);
  let floor = -Infinity;
  order.forEach(({ index }, at) => {
    spots[index] = Math.max(shifted[at], floor === -Infinity ? 0 : floor + gap, 0);
    floor = spots[index];
  });
  return spots;
}

export function shownUsage(usage: AgentUsage, view: Pick<UsageView, "hidden" | "tightest">): AgentUsage {
  const picked: AgentUsage = {
    ...usage,
    fiveHour: view.hidden.includes("fiveHour") ? null : usage.fiveHour,
    sevenDay: view.hidden.includes("sevenDay") ? null : usage.sevenDay,
    models: view.hidden.includes("models") ? [] : usage.models,
  };
  if (!view.tightest) return picked;
  const top = tightestWindow(picked);
  return {
    ...picked,
    fiveHour: picked.fiveHour === top ? top : null,
    sevenDay: picked.sevenDay === top ? top : null,
    models: picked.models.filter((model) => model === top),
  };
}
