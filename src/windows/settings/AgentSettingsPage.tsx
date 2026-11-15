import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { AgentHooksNotice } from "../../features/agent-status/AgentHooksNotice";
import { AgentProviderIcon } from "../../features/agent-status/AgentProviderIcon";
import type { SessionProvider } from "../../features/agent-status/api";
import { AGENT_PROVIDER_LABELS } from "../../features/agent-status/status";
import "../../features/agent-status/AgentHooksSettingsSection.css";
import type { AgentLightStyle, AgentTitleMode, IslandSettings } from "../../features/appearance/types";
import { useTranslation } from "../../i18n";
import { FeatureHeader } from "./FeatureHeader";

const SHOWN_PROVIDERS = Object.keys(AGENT_PROVIDER_LABELS) as SessionProvider[];

export function AgentSettingsPage({
  settings,
  onSettingsChange,
  onOpenConnect,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenConnect: () => void;
}) {
  const t = useTranslation();

  return (
    <>
      <FeatureHeader feature="agents" />
      <AgentHooksNotice onOpenConnect={onOpenConnect} />
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
      <SettingsGroup title={t.settings.agent.agentsSection} footer={t.settings.agent.showAgentsHint}>
        {SHOWN_PROVIDERS.map((provider) => (
          <SettingsToggleRow
            key={provider}
            title={
              <span className="agent-settings-provider">
                <AgentProviderIcon provider={provider} />
                {AGENT_PROVIDER_LABELS[provider]}
              </span>
            }
            checked={!settings.agentHiddenProviders.includes(provider)}
            onChange={(shown) =>
              onSettingsChange({
                ...settings,
                agentHiddenProviders: shown
                  ? settings.agentHiddenProviders.filter((hidden) => hidden !== provider)
                  : [...settings.agentHiddenProviders, provider],
              })
            }
          />
        ))}
      </SettingsGroup>
    </>
  );
}
