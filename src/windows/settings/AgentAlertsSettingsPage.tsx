import { AgentAlertSettings } from "../../features/agent-status/AgentAlertSettings";
import { AgentPushSettings } from "../../features/agent-status/push/AgentPushSettings";
import type { IslandSettings } from "../../features/appearance/types";

export function AgentAlertsSettingsPage({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  return (
    <>
      <AgentAlertSettings settings={settings} onSettingsChange={onSettingsChange} />
      <AgentPushSettings />
    </>
  );
}
