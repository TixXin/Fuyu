import { AgentEditorExtensionSettings } from "./AgentEditorExtensionSettings";
import { AgentHooksSettingsSection } from "./AgentHooksSettingsSection";
import { AgentReplyMarkerSettings } from "./AgentReplyMarkerSettings";
import { useAgentStatusSettings } from "./useAgentStatusSettings";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../plugin-kernel/settingsSlots";

function HooksSection() {
  const agentStatus = useAgentStatusSettings();
  return <AgentHooksSettingsSection {...agentStatus} />;
}

const sections = settingsSections<Record<never, never>, "agentConnect">();

sections.add({ id: "agentConnect.hooks", category: "agentConnect", order: 10, component: HooksSection });
sections.add({ id: "agentConnect.reply-marker", category: "agentConnect", order: 20, component: AgentReplyMarkerSettings });
sections.add({ id: "agentConnect.editor-extension", category: "agentConnect", order: 30, component: AgentEditorExtensionSettings });

export function AgentConnectSettingsPage() {
  return <SlotView slot={sections} group="agentConnect" />;
}
