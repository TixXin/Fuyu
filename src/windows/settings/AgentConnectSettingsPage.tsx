import { AgentEditorExtensionSettings } from "../../features/agent-status/AgentEditorExtensionSettings";
import { AgentHooksSettingsSection } from "../../features/agent-status/AgentHooksSettingsSection";
import { AgentReplyMarkerSettings } from "../../features/agent-status/AgentReplyMarkerSettings";
import { useAgentStatusSettings } from "../../features/agent-status/useAgentStatusSettings";

/**
 * Settings → AI Agent → Connection: installing and repairing the Claude Code and Codex hooks, each
 * agent's state, and right below them the reply status marker, the other thing that tells the island
 * what a session waits on (recommended); last, the extension that lets a click reach a session's
 * terminal inside VS Code.
 */
export function AgentConnectSettingsPage() {
  // Owned by the page so agent status is only polled while it is open.
  const agentStatus = useAgentStatusSettings();
  return (
    <>
      <AgentHooksSettingsSection {...agentStatus} />
      <AgentReplyMarkerSettings />
      <AgentEditorExtensionSettings />
    </>
  );
}
