import { AgentEditorExtensionSettings } from "../../features/agent-status/AgentEditorExtensionSettings";
import { AgentHooksSettingsSection } from "../../features/agent-status/AgentHooksSettingsSection";
import { AgentReplyMarkerSettings } from "../../features/agent-status/AgentReplyMarkerSettings";
import { useAgentStatusSettings } from "../../features/agent-status/useAgentStatusSettings";

function HooksSection() {
  const agentStatus = useAgentStatusSettings();
  return <AgentHooksSettingsSection {...agentStatus} />;
}

export function AgentConnectSettingsPage() {
  return (
    <>
      <HooksSection />
      <AgentReplyMarkerSettings />
      <AgentEditorExtensionSettings />
    </>
  );
}
