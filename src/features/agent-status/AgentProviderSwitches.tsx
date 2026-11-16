import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import type { IslandSettings } from "../../lib/settings/types";
import { useTranslation } from "../../i18n";
import { AgentProviderIcon } from "./AgentProviderIcon";
import type { SessionProvider } from "./api";
import { AGENT_PROVIDER_LABELS } from "./status";
import "./AgentHooksSettingsSection.css";

const SHOWN_PROVIDERS = Object.keys(AGENT_PROVIDER_LABELS) as SessionProvider[];

export function AgentProviderSwitches({ settings, onSettingsChange }: { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void }) {
  const text = useTranslation().settings.agent;
  return (
    <SettingsGroup title={text.agentsSection} footer={text.showAgentsHint}>
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
  );
}
