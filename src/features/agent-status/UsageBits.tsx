import type { HoverCardLine } from "../../components/IslandHoverCard";
import { MiniRing } from "../../components/MiniRing";
import { useTranslation, type Translations } from "../../i18n";
import { AgentProviderIcon } from "./AgentProviderIcon";
import type { AgentUsageItem, AgentUsageSource, AgentUsageStyle } from "./agentSettings";
import type { AgentUsage } from "./api";
import { formatCredit, tightestWindow, untilReset, usageLevel, usageSourceLines, usageWindows, USAGE_SOURCE_ICONS, USAGE_SOURCE_LABELS, type CreditFigures, type UsageLine, type UsageWindowCell } from "./usage";

export const LEVEL_COLOR = { low: "var(--mint-text, var(--color-agent-idle))", medium: "var(--color-agent-waiting)", high: "var(--color-warning)" } as const;

const CURRENCY: Record<string, string> = { CNY: "¥", RMB: "¥", USD: "$" };

export type UsageToggle = (item: AgentUsageItem) => void;

export function money(currency: string, total: string): string {
  const symbol = CURRENCY[currency.toUpperCase()];
  return symbol ? `${symbol}${total}` : `${total} ${currency}`;
}

export function creditParts(credit: CreditFigures, text: Translations["agent"]["usage"]) {
  if (credit.kind === "balance") {
    const value = money(credit.currency, credit.total);
    return { value, unit: text.balanceUnit, detail: "", full: text.balance(value) };
  }
  return { value: formatCredit(credit.sevenDay), unit: text.creditsUnit, detail: text.creditsToday(formatCredit(credit.today)), full: text.credits(formatCredit(credit.today), formatCredit(credit.sevenDay)) };
}

export function useWindowCells() {
  const text = useTranslation().agent.usage;
  return (usage: AgentUsage): UsageWindowCell[] => usageWindows(usage, { fiveHour: text.fiveHour, sevenDay: text.sevenDay, names: text.windowNames });
}

export function peakCell(cells: readonly UsageWindowCell[], usage: AgentUsage): UsageWindowCell | null {
  const peak = tightestWindow(usage);
  return cells.find((cell) => cell.window === peak) ?? cells[0] ?? null;
}

export function useLineHover() {
  const t = useTranslation();
  const cellsOf = useWindowCells();
  return (line: UsageLine, now: number): HoverCardLine[] => {
    const name = USAGE_SOURCE_LABELS[line.source];
    if (!line.usage) return [{ text: name }, { text: creditParts(line.credit, t.agent.usage).full, muted: true }];
    const rows = cellsOf(line.usage).map((cell) => {
      const reset = untilReset(cell.window.resetsAt, now);
      return { text: `${cell.label} ${Math.round(cell.window.used)}%${reset ? ` · ${t.agent.usage.resetsIn(reset)}` : ""}`, color: LEVEL_COLOR[usageLevel(cell.window.used)] };
    });
    return [{ text: name }, ...rows, ...usageSourceLines(line.usage, now, t.claudeUsage).map((entry) => ({ ...entry, muted: true }))];
  };
}

export function SourceIcon({ source, size = 14, onToggle }: { source: AgentUsageSource; size?: number; onToggle?: UsageToggle }) {
  const t = useTranslation();
  const icon = <AgentProviderIcon provider={USAGE_SOURCE_ICONS[source]} size={size} />;
  if (!onToggle) return icon;
  const label = t.agent.usage.hide(USAGE_SOURCE_LABELS[source]);
  return (
    <button type="button" className="agent-usage__source" title={label} aria-label={label} onClick={(event) => { event.stopPropagation(); onToggle(source); }}>
      {icon}
    </button>
  );
}

export function UsageMeter({ used, style, size = 14 }: { used: number; style: AgentUsageStyle; size?: number }) {
  const level = usageLevel(used);
  const value = Math.min(100, Math.max(0, used));
  if (style === "ring") return <MiniRing rings={[{ value: value / 100, color: LEVEL_COLOR[level] }]} size={size} strokeWidth={Math.max(2.2, size / 6)} ariaLabel={`${Math.round(value)}%`} />;
  if (style === "bar") {
    return (
      <span className="agent-usage__bar" aria-hidden="true">
        <span style={{ width: `${value}%`, background: LEVEL_COLOR[level] }} />
      </span>
    );
  }
  return null;
}

export function UsageValue({ used }: { used: number }) {
  return <strong className={`agent-usage__value agent-usage__value--${usageLevel(used)}`}>{Math.round(used)}%</strong>;
}
