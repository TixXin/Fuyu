import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { AgentHooksSettingsSection } from "./AgentHooksSettingsSection";
import { AgentProviderSwitches } from "./AgentProviderSwitches";
import { useAgentStatusSettings } from "./useAgentStatusSettings";
import type { AgentLightStyle, AgentTitleMode, IslandSettings } from "../../lib/settings/types";
import { useTranslation } from "../../i18n";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../plugin-kernel/settingsSlots";

type AgentSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
};

function SessionTitleSection({ settings, onSettingsChange }: AgentSectionProps) {
  const t = useTranslation();

  return (
    <SettingsGroup title={t.settings.agent.sessionTitleSection}>
      <SettingsToggleRow
        title={t.settings.agent.sessionTitle}
        description={t.settings.agent.sessionTitleHint}
        checked={settings.agentTitleEnabled}
        onChange={(agentTitleEnabled) => onSettingsChange({ ...settings, agentTitleEnabled })}
      />
      {settings.agentTitleEnabled && (
        <SettingsRow
          indent
          title={t.settings.agent.titleMode}
          description={t.settings.agent.titleModeHint}
          control={
            <SettingsChoice<AgentTitleMode>
              value={settings.agentTitleMode}
              ariaLabel={t.settings.agent.titleMode}
              options={[
                { value: "changes", label: t.settings.agent.titleModeOptions.changes },
                { value: "running", label: t.settings.agent.titleModeOptions.running },
              ]}
              onChange={(agentTitleMode) => onSettingsChange({ ...settings, agentTitleMode })}
            />
          }
        />
      )}
      <SettingsRow
        title={t.settings.agent.lightStyle}
        description={t.settings.agent.lightStyleHint}
        control={
          <SettingsChoice<AgentLightStyle>
            value={settings.agentLightStyle}
            ariaLabel={t.settings.agent.lightStyle}
            options={[
              { value: "mark", label: t.settings.agent.lightStyleOptions.mark },
              { value: "dot", label: t.settings.agent.lightStyleOptions.dot },
            ]}
            onChange={(agentLightStyle) => onSettingsChange({ ...settings, agentLightStyle })}
          />
        }
      />
    </SettingsGroup>
  );
}

function HooksAndProvidersSection({ settings, onSettingsChange }: AgentSectionProps) {
  const agentStatus = useAgentStatusSettings();
  return (
    <>
      <AgentHooksSettingsSection {...agentStatus} />
      <AgentProviderSwitches settings={settings} onSettingsChange={onSettingsChange} {...agentStatus} />
    </>
  );
}

export type AgentTab = "agents" | "agentAppearance" | "agentRings";

const sections = settingsSections<AgentSectionProps, AgentTab>();

sections.add({ id: "agents.hooks", category: "agents", order: 10, component: HooksAndProvidersSection });
sections.add({ id: "agentAppearance.session-title", category: "agentAppearance", order: 20, component: SessionTitleSection });

export function AgentSettingsPage({ tab, ...props }: AgentSectionProps & { tab: AgentTab }) {
  return <SlotView slot={sections} group={tab} props={props} />;
}
