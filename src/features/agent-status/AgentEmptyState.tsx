import { JellyfishMark } from "../../components/jellyfish/JellyfishMark";
import { useTranslation } from "../../i18n";
import type { AgentEmptyStyle, AgentSettingValues, AgentUsageSource } from "./agentSettings";
import type { AgentSessionSummary, AgentUsage } from "./api";
import { AgentUsageBar } from "./AgentUsageBar";
import type { UsageViewChange } from "./AgentUsageMenu";
import { EmptyQuota } from "./EmptyQuota";
import { EmptyRecent } from "./EmptyRecent";
import { EmptyStandby } from "./EmptyStandby";
import { EmptyTide } from "./EmptyTide";
import { EMPTY_USAGES, shownUsage, usageLines, type AgentUsages, type UsageView } from "./usage";
import "./AgentEmptyState.css";

export type EmptyStateProps = {
  style: AgentEmptyStyle;
  sessions: readonly AgentSessionSummary[];
  sessionHours: number;
  showUsage: boolean;
  usages?: AgentUsages;
  usageView: UsageView;
  onSettingsChange?: (patch: Partial<AgentSettingValues>) => void;
  onOpenConnect?: () => void;
};

const ZZ = [0, 1, 2];

function Sleep() {
  const text = useTranslation().agent.empty;
  return (
    <div className="agent-empty agent-empty--sleep">
      <span className="agent-empty__jelly">
        <JellyfishMark mood="sleep" height={46} />
        {ZZ.map((index) => (
          <svg key={index} className="agent-empty__zz" style={{ animationDelay: `${index * 1.1}s` }} viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2.5 2.5h5l-5 5h5" />
          </svg>
        ))}
      </span>
      <strong>{text.sleepTitle}</strong>
      <span>{text.sleepHint}</span>
    </div>
  );
}

function Minimal() {
  const text = useTranslation().agent.empty;
  return (
    <div className="agent-empty agent-empty--minimal">
      <span className="agent-empty__waterline" aria-hidden="true">
        <JellyfishMark mood="idle" height={26} />
      </span>
      <span>{text.minimal}</span>
    </div>
  );
}

export function AgentEmptyState({ style, sessions, sessionHours, showUsage, usages, usageView, onSettingsChange, onOpenConnect }: EmptyStateProps) {
  const percentLines = showUsage && style === "quota" ? usageLines(usages ?? EMPTY_USAGES, usageView).flatMap((line) => (line.usage ? [{ source: line.source, usage: line.usage }] : [])) : [];
  const quotaLines: { source: AgentUsageSource; usage: AgentUsage }[] = percentLines.length > 2 ? percentLines.map((line) => ({ ...line, usage: shownUsage(line.usage, { hidden: [], tightest: true }) })) : percentLines;
  const onViewChange: UsageViewChange | undefined = onSettingsChange;
  if (quotaLines.length > 0) return <EmptyQuota lines={quotaLines} now={usages?.readAt ?? 0} />;

  return (
    <>
      {showUsage && <AgentUsageBar usages={usages} view={usageView} onViewChange={onViewChange} />}
      {style === "standby" ? <EmptyStandby sessions={sessions} onConnect={onOpenConnect} />
        : style === "recent" ? <EmptyRecent sessions={sessions} hours={sessionHours} onSettingsChange={onSettingsChange} />
        : style === "tide" ? <EmptyTide />
        : style === "minimal" ? <Minimal />
        : <Sleep />}
    </>
  );
}
