import { AgentSessionFilterSettings } from "./AgentSessionFilterSettings";
import { AgentSessionListSettings } from "./AgentSessionListSettings";
import type { IslandSettings } from "../../lib/settings/types";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../../windows/settings/slots/sectionSlot";

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
