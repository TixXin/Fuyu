import { AgentQuotaAlertSettings } from "./AgentQuotaAlertSettings";
import { AgentPushSettings } from "./push/AgentPushSettings";
import { AgentReminderSettings } from "./reminder-settings/AgentReminderSettings";
import type { IslandSettings } from "../../lib/settings/types";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../plugin-kernel/settingsSlots";

type AgentAlertsSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
};

export type AgentAlertsTab = "agentAlerts" | "agentPush";

const sections = settingsSections<AgentAlertsSectionProps, AgentAlertsTab>();

sections.add({ id: "agentAlerts.alerts", category: "agentAlerts", order: 10, component: AgentReminderSettings });
sections.add({ id: "agentAlerts.quota", category: "agentAlerts", order: 17, component: AgentQuotaAlertSettings });
sections.add({ id: "agentPush.push", category: "agentPush", order: 20, component: AgentPushSettings });

export function AgentAlertsSettingsPage({ tab, ...props }: AgentAlertsSectionProps & { tab: AgentAlertsTab }) {
  return <SlotView slot={sections} group={tab} props={props} />;
}
