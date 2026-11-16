import { AgentHooksSettingsSection } from "../../features/agent-status/AgentHooksSettingsSection";
import { AgentProviderSwitches } from "../../features/agent-status/AgentProviderSwitches";
import { AgentRemoteHostsSettings } from "../../features/agent-status/AgentRemoteHostsSettings";
import { AgentReplyMarkerSettings } from "../../features/agent-status/AgentReplyMarkerSettings";
import { useAgentStatusSettings } from "../../features/agent-status/useAgentStatusSettings";
import type { IslandSettings } from "../../lib/settings/types";
import { useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";

export function AgentConnectAct({ settings, onSettingsChange }: { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void }) {
  const text = useTranslation().onboarding.agentConnect;
  const agentStatus = useAgentStatusSettings();

  return (
    <>
      <ActHeading title={text.title} lead={text.lead} />
      <h2 className="onboarding__step">{text.remote}</h2>
      <AgentRemoteHostsSettings />
      <h2 className="onboarding__step">{text.agents}</h2>
      <AgentProviderSwitches settings={settings} onSettingsChange={onSettingsChange} />
      <AgentHooksSettingsSection {...agentStatus} />
      <h2 className="onboarding__step">{text.marker}</h2>
      <AgentReplyMarkerSettings />
    </>
  );
}
