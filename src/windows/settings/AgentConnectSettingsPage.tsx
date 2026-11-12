import { AgentEditorExtensionSettings } from "../../features/agent-status/AgentEditorExtensionSettings";
import { AgentHooksSettingsSection } from "../../features/agent-status/AgentHooksSettingsSection";
import { AgentReplyMarkerSettings } from "../../features/agent-status/AgentReplyMarkerSettings";
import { useAgentStatusSettings } from "../../features/agent-status/useAgentStatusSettings";

export function AgentConnectSettingsPage() {
  const agentStatus = useAgentStatusSettings();
  return (
    <>
      <AgentHooksSettingsSection {...agentStatus} />
      <AgentReplyMarkerSettings />
      <AgentEditorExtensionSettings />
    </>
  );
}
