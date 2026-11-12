import { AgentSessionFilterSettings } from "../../features/agent-status/AgentSessionFilterSettings";
import { AgentSessionListSettings } from "../../features/agent-status/AgentSessionListSettings";
import type { IslandSettings } from "../../features/appearance/types";

export function AgentSessionsSettingsPage({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  return (
    <>
      <AgentSessionListSettings settings={settings} onSettingsChange={onSettingsChange} />
      <AgentSessionFilterSettings />
    </>
  );
}
