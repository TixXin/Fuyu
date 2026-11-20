import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsChoiceCards } from "../../components/settings/SettingsChoiceCards";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { LightStyleArt } from "./AgentAppearanceGlyphs";
import { AgentHooksOptions } from "./AgentHooksOptions";
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
  const text = useTranslation().settings.agent;

  return (
    <>
      <SettingsGroup title={text.lightSectionTitle} footer={<SettingsFootnote text={text.lightStyleHint} />}>
        <SettingsRow title={text.lightStyle}>
          <SettingsChoiceCards<AgentLightStyle>
            value={settings.agentLightStyle}
            ariaLabel={text.lightStyle}
            options={[
              {
                value: "mark",
                label: text.lightStyleOptions.mark,
                hint: text.lightStyleHints.mark,
                art: <LightStyleArt style="mark" />,
              },
              {
                value: "dot",
                label: text.lightStyleOptions.dot,
                hint: text.lightStyleHints.dot,
                art: <LightStyleArt style="dot" />,
              },
            ]}
            onChange={(agentLightStyle) => onSettingsChange({ ...settings, agentLightStyle })}
          />
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title={text.sessionTitleSection}>
        <SettingsToggleRow
          title={text.sessionTitle}
          description={text.sessionTitleHint}
          checked={settings.agentTitleEnabled}
          onChange={(agentTitleEnabled) => onSettingsChange({ ...settings, agentTitleEnabled })}
        />
        {settings.agentTitleEnabled && (
          <SettingsRow
            indent
            title={text.titleMode}
            description={text.titleModeHint}
            control={
              <SettingsChoice<AgentTitleMode>
                value={settings.agentTitleMode}
                ariaLabel={text.titleMode}
                options={[
                  { value: "changes", label: text.titleModeOptions.changes },
                  { value: "running", label: text.titleModeOptions.running },
                ]}
                onChange={(agentTitleMode) => onSettingsChange({ ...settings, agentTitleMode })}
              />
            }
          />
        )}
      </SettingsGroup>
    </>
  );
}

function HooksAndProvidersSection({ settings, onSettingsChange }: AgentSectionProps) {
  const agentStatus = useAgentStatusSettings();
  return (
    <>
      <AgentProviderSwitches settings={settings} onSettingsChange={onSettingsChange} {...agentStatus} />
      <AgentHooksOptions settings={settings} onSettingsChange={onSettingsChange} {...agentStatus} />
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
