import { Fragment } from "react";
import { RotateCcw } from "lucide-react";
import { MiniRing } from "../../components/MiniRing";
import { useTranslation } from "../../i18n";
import { AgentProviderIcon } from "./AgentProviderIcon";
import type { AgentProvider, AgentUsage } from "./api";
import { untilReset, usageLevel, usageWindows } from "./usage";
import "./EmptyQuota.css";

const LEVEL_COLOR = { low: "var(--mint-text, var(--color-agent-idle))", medium: "var(--color-agent-waiting)", high: "var(--color-warning)" } as const;

export function EmptyQuota({ lines, now }: { lines: readonly [AgentProvider, AgentUsage][]; now: number }) {
  const t = useTranslation();
  const labels = { fiveHour: t.agent.usage.fiveHour, sevenDay: t.agent.usage.sevenDay };

  return (
    <div className="agent-empty agent-empty--quota">
      <div className="agent-quota-hero">
        {lines.map(([provider, usage], index) => (
          <Fragment key={provider}>
            {index > 0 && <span className="agent-quota-hero__divider" aria-hidden="true" />}
            {usageWindows(usage, labels).map(({ key, label, window }) => {
              const used = Math.round(window.used);
              const level = usageLevel(window.used);
              const reset = untilReset(window.resetsAt, now);
              return (
                <div key={key} className="agent-quota-gauge">
                  <span className="agent-quota-gauge__ring">
                    <MiniRing rings={[{ value: Math.min(100, used) / 100, color: LEVEL_COLOR[level] }]} size={68} strokeWidth={4} ariaLabel={`${label} ${used}%`} />
                    <span className={`agent-quota-gauge__value agent-usage__value--${level}`} aria-hidden="true">{used}%</span>
                  </span>
                  <span className="agent-quota-gauge__label">
                    <AgentProviderIcon provider={provider} size={12} />
                    {label}
                  </span>
                  {reset && (
                    <span className="agent-quota-gauge__reset" aria-label={t.agent.usage.resetsIn(reset)}>
                      <RotateCcw size={10} strokeWidth={2.2} aria-hidden="true" />
                      {t.agent.usage.resetShort(reset)}
                    </span>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <span>{t.agent.empty.quotaNone}</span>
    </div>
  );
}
