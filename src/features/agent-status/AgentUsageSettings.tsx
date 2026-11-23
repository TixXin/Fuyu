import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsMultiChoice } from "../../components/settings/SettingsMultiChoice";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import { AGENTS } from "./agents";
import { AGENT_EMPTY_STYLES, AGENT_USAGE_RESETS, AGENT_USAGE_STYLES, type AgentEmptyStyle, type AgentUsageItem, type AgentUsageReset, type AgentUsageStyle } from "./agentSettings";

const PROVIDERS = ["claudeCode", "codex"] as const;
const WINDOWS = ["fiveHour", "sevenDay", "models"] as const;

export function AgentUsageSettings({ settings, update }: { settings: IslandSettings; update: (patch: Partial<IslandSettings>) => void }) {
  const text = useTranslation().settings.agent;
  const hidden = settings.agentUsageHidden;
  const shownOf = (group: readonly AgentUsageItem[]) => group.filter((item) => !hidden.includes(item));
  const toggle = (group: readonly AgentUsageItem[]) => (item: AgentUsageItem, selected: boolean) => {
    if (!selected && shownOf(group).length <= 1) return;
    update({ agentUsageHidden: selected ? hidden.filter((entry) => entry !== item) : [...hidden, item] });
  };

  return (
    <>
      {settings.agentShowUsage && (
        <>
          <SettingsRow
            title={text.usageProviders}
            control={
              <SettingsMultiChoice<AgentUsageItem>
                values={shownOf(PROVIDERS)}
                options={PROVIDERS.map((value) => ({ value, label: AGENTS[value].label }))}
                ariaLabel={text.usageProviders}
                onToggle={toggle(PROVIDERS)}
              />
            }
          />
          <SettingsRow
            title={text.usageWindows}
            description={text.usageWindowsHint}
            control={
              <SettingsMultiChoice<AgentUsageItem>
                values={shownOf(WINDOWS)}
                options={WINDOWS.map((value) => ({ value, label: text.usageWindowOptions[value] }))}
                ariaLabel={text.usageWindows}
                onToggle={toggle(WINDOWS)}
              />
            }
          />
          <SettingsToggleRow title={text.usageTightest} description={text.usageTightestHint} checked={settings.agentUsageTightest} onChange={(agentUsageTightest) => update({ agentUsageTightest })} />
          <SettingsRow
            title={text.usageReset}
            control={
              <SettingsSelect<AgentUsageReset>
                value={settings.agentUsageReset}
                options={AGENT_USAGE_RESETS.map((value) => ({ value, label: text.usageResetOptions[value] }))}
                ariaLabel={text.usageReset}
                onChange={(agentUsageReset) => update({ agentUsageReset })}
              />
            }
          />
          <SettingsRow
            title={text.usageStyle}
            control={
              <SettingsChoice<AgentUsageStyle>
                value={settings.agentUsageStyle}
                options={AGENT_USAGE_STYLES.map((value) => ({ value, label: text.usageStyleOptions[value] }))}
                ariaLabel={text.usageStyle}
                onChange={(agentUsageStyle) => update({ agentUsageStyle })}
              />
            }
          />
        </>
      )}
      <SettingsRow
        title={text.emptyStyle}
        description={text.emptyStyleHint}
        control={
          <SettingsSelect<AgentEmptyStyle>
            value={settings.agentEmptyStyle}
            options={AGENT_EMPTY_STYLES.map((value) => ({ value, label: text.emptyStyleOptions[value] }))}
            ariaLabel={text.emptyStyle}
            onChange={(agentEmptyStyle) => update({ agentEmptyStyle })}
          />
        }
      />
    </>
  );
}
