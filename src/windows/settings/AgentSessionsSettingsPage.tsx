import { AgentSessionFilterSettings } from "../../features/agent-status/AgentSessionFilterSettings";
import { AgentSessionListSettings } from "../../features/agent-status/AgentSessionListSettings";
import type { IslandSettings } from "../../features/appearance/types";

/** Settings → AI Agent → Session list: which sessions the island's Agent page lists, what each card shows, and the rules that hide some. */
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
