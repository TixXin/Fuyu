import { AgentEditorExtensionSettings } from "../../features/agent-status/AgentEditorExtensionSettings";
import { AgentHooksSettingsSection } from "../../features/agent-status/AgentHooksSettingsSection";
import { AgentReplyMarkerSettings } from "../../features/agent-status/AgentReplyMarkerSettings";
import { useAgentStatusSettings } from "../../features/agent-status/useAgentStatusSettings";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

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
