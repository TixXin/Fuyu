import { AgentPushSettings } from "./push/AgentPushSettings";
import { AgentReminderSettings } from "./reminder-settings/AgentReminderSettings";
import type { AlertChannelPage } from "./reminder-settings/EventTable";
import type { IslandSettings } from "../../lib/settings/types";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../plugin-kernel/settingsSlots";

export type AgentAlertsTab = "agentAlerts" | "agentNoticeLook" | "agentPush";

export type AlertsPageLink = AlertChannelPage | "agentAlerts";

type AgentAlertsSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onShowPage?: (page: AlertsPageLink) => void;
};

const sections = settingsSections<AgentAlertsSectionProps, AgentAlertsTab>();

function EventsTab(props: AgentAlertsSectionProps) {
  return <AgentReminderSettings view="events" {...props} />;
}

function LookTab(props: AgentAlertsSectionProps) {
  return <AgentReminderSettings view="look" {...props} />;
}

function PushTab({ onShowPage }: AgentAlertsSectionProps) {
  return <AgentPushSettings onShowPage={onShowPage} />;
}

sections.add({ id: "agentAlerts.alerts", category: "agentAlerts", order: 10, component: EventsTab });
sections.add({ id: "agentNoticeLook.look", category: "agentNoticeLook", order: 10, component: LookTab });
sections.add({ id: "agentPush.push", category: "agentPush", order: 20, component: PushTab });

export function AgentAlertsSettingsPage({ tab, ...props }: AgentAlertsSectionProps & { tab: AgentAlertsTab }) {
  return <SlotView slot={sections} group={tab} props={props} />;
}
