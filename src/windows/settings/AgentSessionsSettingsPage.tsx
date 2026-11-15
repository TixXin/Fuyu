import { AgentSessionFilterSettings } from "../../features/agent-status/AgentSessionFilterSettings";
import { AgentSessionListSettings } from "../../features/agent-status/AgentSessionListSettings";
import type { IslandSettings } from "../../features/appearance/types";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

type AgentSessionsSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
};

const sections = settingsSections<AgentSessionsSectionProps, "agentSessions">();

sections.add({ id: "agentSessions.list", category: "agentSessions", order: 10, component: AgentSessionListSettings });
sections.add({ id: "agentSessions.filter", category: "agentSessions", order: 20, component: AgentSessionFilterSettings });

export function AgentSessionsSettingsPage(props: AgentSessionsSectionProps) {
  return <SlotView slot={sections} group="agentSessions" props={props} />;
}
