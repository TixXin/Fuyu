import { AgentAlertSettings } from "./AgentAlertSettings";
import { AgentPushSettings } from "./push/AgentPushSettings";
import type { IslandSettings } from "../../lib/settings/types";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../plugin-kernel/settingsSlots";

type AgentAlertsSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
};

const sections = settingsSections<AgentAlertsSectionProps, "agentAlerts">();

sections.add({ id: "agentAlerts.alerts", category: "agentAlerts", order: 10, component: AgentAlertSettings });
sections.add({ id: "agentAlerts.push", category: "agentAlerts", order: 20, component: AgentPushSettings });

export function AgentAlertsSettingsPage(props: AgentAlertsSectionProps) {
  return <SlotView slot={sections} group="agentAlerts" props={props} />;
}
