import { useEffect, useId, useState } from "react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsChoiceCards } from "../../components/settings/SettingsChoiceCards";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import { AgentProviderIcon } from "./AgentProviderIcon";
import { AgentStageIsland } from "./AgentStageIsland";
import { AgentUsageBar } from "./AgentUsageBar";
import { AgentUsageLayoutArt } from "./AgentUsageLayoutArt";
import { AGENTS } from "./agents";
import { AGENT_USAGE_COLUMNS, AGENT_USAGE_LAYOUTS, AGENT_USAGE_RESETS, AGENT_USAGE_SOURCES, AGENT_USAGE_STYLES, type AgentUsageItem, type AgentUsageLayout, type AgentUsageReset, type AgentUsageStyle } from "./agentSettings";
import { getAgentHooksState, type AgentHooksState, type SessionProvider } from "./api";
import { LAYOUT_CONTROLS, PLAN_SOURCES, USAGE_SOURCE_ICONS, USAGE_SOURCE_LABELS, usageSources, type UsageView } from "./usage";
import { useAgentUsages } from "./useAgentUsages";

type Props = { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void };

function useHooksState(): AgentHooksState | null {
  const [state, setState] = useState<AgentHooksState | null>(null);
  useEffect(() => {
    let alive = true;
    getAgentHooksState().then(
      (next) => alive && setState(next),
      (error) => console.error("Failed to read agent hooks state for the usage settings", error),
    );
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export function AgentUsagePageSettings({ settings, onSettingsChange }: Props) {
  const t = useTranslation();
  const text = t.settings.agent;
  const switchId = useId();
  const tightestId = useId();
  const on = settings.agentShowUsage;
  const update = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  const agentsOff = settings.agentHiddenProviders;
  const usages = useAgentUsages(on, AGENT_USAGE_SOURCES.filter((source) => !agentsOff.includes(source)));
  const hooks = useHooksState();
  const view: UsageView = { hidden: settings.agentUsageHidden, tightest: settings.agentUsageTightest, reset: settings.agentUsageReset, style: settings.agentUsageStyle, layout: settings.agentUsageLayout, agentsOff };
  const controls = LAYOUT_CONTROLS[settings.agentUsageLayout];
  const sources = usageSources(usages, agentsOff);
  const hidden = settings.agentUsageHidden;
  const shown = (item: AgentUsageItem) => !hidden.includes(item);
  const toggle = (item: AgentUsageItem) => {
    const group: readonly AgentUsageItem[] = (AGENT_USAGE_COLUMNS as readonly AgentUsageItem[]).includes(item) ? AGENT_USAGE_COLUMNS : sources;
    if (shown(item) && group.filter(shown).length <= 1) return;
    update({ agentUsageHidden: shown(item) ? [...hidden, item] : hidden.filter((entry) => entry !== item) });
  };
  const noRead = (Object.keys(AGENTS) as SessionProvider[])
    .filter((provider) => !agentsOff.includes(provider) && !sources.some((source) => source === provider))
    .filter((provider) => hooks?.[provider] === "current" || hooks?.[provider] === "outdated")
    .map((provider) => AGENTS[provider].label);
  const lastOf = (group: readonly AgentUsageItem[], item: AgentUsageItem) => shown(item) && group.filter(shown).length <= 1;

  return (
    <SettingsGroup
      title={text.usagePageTitle}
      action={<SettingsSwitch id={switchId} ariaLabel={text.usagePageTitle} checked={on} onChange={(agentShowUsage) => update({ agentShowUsage })} />}
      footer={<SettingsFootnote text={text.usagePageHint} />}
    >
      {on && (
        <SettingsRow title={text.usageShowTitle} description={text.usageShowHint}>
          <div className="agent-stage">
            <SettingsChoiceCards<AgentUsageLayout>
              value={settings.agentUsageLayout}
              ariaLabel={text.usageLayout}
              columns={3}
              options={AGENT_USAGE_LAYOUTS.map((value) => ({ value, label: t.agent.usage.layouts[value], hint: text.usageLayoutHints[value], art: <AgentUsageLayoutArt layout={value} /> }))}
              onChange={(agentUsageLayout) => update({ agentUsageLayout })}
            />
            <div className="agent-stage__toolbar">
              {controls.style && <span className="agent-stage__tool">
                {text.usageStyle}
                <SettingsChoice<AgentUsageStyle> value={settings.agentUsageStyle} ariaLabel={text.usageStyle} options={AGENT_USAGE_STYLES.map((value) => ({ value, label: text.usageStyleOptions[value] }))} onChange={(agentUsageStyle) => update({ agentUsageStyle })} />
              </span>}
              {controls.reset && <span className="agent-stage__tool">
                {text.usageReset}
                <SettingsChoice<AgentUsageReset> value={settings.agentUsageReset} ariaLabel={text.usageReset} options={AGENT_USAGE_RESETS.map((value) => ({ value, label: text.usageResetOptions[value] }))} onChange={(agentUsageReset) => update({ agentUsageReset })} />
              </span>}
              {controls.tightest && <label className="agent-stage__tool" htmlFor={tightestId}>
                {text.usageTightest}
                <SettingsSwitch id={tightestId} checked={settings.agentUsageTightest} onChange={(agentUsageTightest) => update({ agentUsageTightest })} />
              </label>}
            </div>
            <AgentStageIsland settings={settings} label={text.usagePreview}>
              {usages.readAt === 0 ? (
                <p className="agent-stage-island__note">{text.usageReading}</p>
              ) : sources.length === 0 ? (
                <p className="agent-stage-island__note">{text.usageNone}</p>
              ) : (
                <AgentUsageBar usages={usages} view={view} onToggle={toggle} />
              )}
            </AgentStageIsland>
            {sources.length > 0 && (
              <div className="agent-stage__chips" role="group" aria-label={text.usageProviders}>
                {sources.map((source) => (
                  <button key={source} type="button" className="agent-stage__chip" aria-pressed={shown(source)} disabled={lastOf(sources, source)} onClick={() => toggle(source)}>
                    <AgentProviderIcon provider={USAGE_SOURCE_ICONS[source]} size={14} />
                    {USAGE_SOURCE_LABELS[source]}
                    {PLAN_SOURCES.includes(source) ? <small>{text.usagePlanTag}</small> : source === "workbuddy" || source === "dsh" ? <small>{text.usageCreditTag}</small> : null}
                  </button>
                ))}
              </div>
            )}
            <div className="agent-stage__chips" role="group" aria-label={text.usageWindows}>
              {AGENT_USAGE_COLUMNS.map((column) => (
                <button key={column} type="button" className="agent-stage__chip" aria-pressed={shown(column)} disabled={lastOf(AGENT_USAGE_COLUMNS, column)} onClick={() => toggle(column)}>
                  {text.usageWindowOptions[column]}
                </button>
              ))}
            </div>
            {noRead.length > 0 && <p className="agent-stage__note">{text.usageNoRead(noRead)}</p>}
          </div>
        </SettingsRow>
      )}
    </SettingsGroup>
  );
}
