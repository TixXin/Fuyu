import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import { AgentEmptyState } from "./AgentEmptyState";
import { AgentStageIsland } from "./AgentStageIsland";
import { AGENT_EMPTY_STYLES, AGENT_USAGE_SOURCES } from "./agentSettings";
import type { UsageView } from "./usage";
import { useAgentUsages } from "./useAgentUsages";
import "./AgentEmptyStylePicker.css";

const NO_SESSIONS: never[] = [];

export function AgentEmptyStylePicker({ settings, onSettingsChange }: { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void }) {
  const text = useTranslation().settings.agent;
  const [index, setIndex] = useState(() => Math.max(0, AGENT_EMPTY_STYLES.indexOf(settings.agentEmptyStyle)));
  const agentsOff = settings.agentHiddenProviders;
  const usages = useAgentUsages(settings.agentShowUsage, AGENT_USAGE_SOURCES.filter((source) => !agentsOff.includes(source)));
  const style = AGENT_EMPTY_STYLES[index];
  const inUse = settings.agentEmptyStyle === style;
  const view: UsageView = { hidden: settings.agentUsageHidden, tightest: settings.agentUsageTightest, reset: settings.agentUsageReset, style: settings.agentUsageStyle, layout: settings.agentUsageLayout, agentsOff };
  const step = (by: number) => setIndex((current) => (current + by + AGENT_EMPTY_STYLES.length) % AGENT_EMPTY_STYLES.length);

  return (
    <SettingsGroup title={text.emptyGroup}>
      <SettingsRow
        title={text.emptyStyle}
        description={text.emptyStyleHint}
        control={inUse ? <span className="agent-empty-picker__using"><Check size={13} strokeWidth={2.4} aria-hidden="true" />{text.emptyInUse}</span> : undefined}
      >
        <div className="agent-stage agent-empty-picker">
          <div className="agent-empty-picker__carousel">
            <button type="button" className="agent-empty-picker__arrow" aria-label={text.emptyPrevious} onClick={() => step(-1)}>
              <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <AgentStageIsland settings={settings} label={text.emptyStyleOptions[style]}>
              <div className="agent-empty-picker__page">
                <AgentEmptyState style={style} sessions={NO_SESSIONS} sessionHours={settings.agentSessionHours} showUsage={settings.agentShowUsage} usages={usages} usageView={view} />
              </div>
            </AgentStageIsland>
            <button type="button" className="agent-empty-picker__arrow" aria-label={text.emptyNext} onClick={() => step(1)}>
              <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
          <div className="agent-empty-picker__caption">
            <strong>{`${index + 1} / ${AGENT_EMPTY_STYLES.length} · ${text.emptyStyleOptions[style]}`}</strong>
            <span>{text.emptyStyleHints[style]}</span>
          </div>
          <div className="agent-empty-picker__dots" role="group" aria-label={text.emptyStyle}>
            {AGENT_EMPTY_STYLES.map((value, at) => (
              <button key={value} type="button" className="agent-empty-picker__dot" aria-label={text.emptyStyleOptions[value]} aria-current={at === index} onClick={() => setIndex(at)} />
            ))}
          </div>
          <button type="button" className="agent-empty-picker__use" disabled={inUse} onClick={() => onSettingsChange({ ...settings, agentEmptyStyle: style })}>
            {inUse ? text.emptyInUse : text.emptyUse}
          </button>
        </div>
      </SettingsRow>
    </SettingsGroup>
  );
}
