import { AgentEditorExtensionSettings } from "./AgentEditorExtensionSettings";
import { AgentReplyMarkerSettings } from "./AgentReplyMarkerSettings";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../plugin-kernel/settingsSlots";

const sections = settingsSections<Record<never, never>, "agentConnect">();

sections.add({ id: "agentConnect.reply-marker", category: "agentConnect", order: 20, component: AgentReplyMarkerSettings });
sections.add({ id: "agentConnect.editor-extension", category: "agentConnect", order: 30, component: AgentEditorExtensionSettings });

export function AgentConnectSettingsPage() {
  return <SlotView slot={sections} group="agentConnect" />;
}
