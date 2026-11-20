import { useCallback, useEffect, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { clearAgentProviderStatus, getAgentStatus, type AgentStatusSnapshot } from "./api";
import { AGENT_PROVIDERS, DEFAULT_AGENT_STATUS } from "./status";
import { useAgentHookActions } from "./useAgentHookActions";

const AGENT_STATUS_POLL_MS = 1_000;

export function useAgentStatusSettings() {
  const [agentStatus, setAgentStatus] = useState<AgentStatusSnapshot>(DEFAULT_AGENT_STATUS);
  const [clearingAgentProvider, setClearingAgentProvider] = useState<string | null>(null);

  const refreshAgentStatus = useCallback(async () => {
    try {
      const snapshot = await getAgentStatus();
      setAgentStatus((current) =>
        current.statusPath === snapshot.statusPath &&
        AGENT_PROVIDERS.every(
          (provider) =>
            current[provider]?.phase === snapshot[provider]?.phase &&
            current[provider]?.taskId === snapshot[provider]?.taskId,
        )
          ? current
          : snapshot,
      );
    } catch (error) {
      console.error("Failed to read agent status", error);
    }
  }, []);

  useEffect(() => {
    void refreshAgentStatus();
    return visibilityInterval(() => {
      void refreshAgentStatus();
    }, AGENT_STATUS_POLL_MS);
  }, [refreshAgentStatus]);

  const clearAgentStatus = useCallback(async (provider: string) => {
    setClearingAgentProvider(provider);
    try {
      setAgentStatus(await clearAgentProviderStatus(provider));
    } catch (error) {
      console.error("Failed to clear agent status", error);
    } finally {
      setClearingAgentProvider(null);
    }
  }, []);

  const hooks = useAgentHookActions(useCallback(() => void refreshAgentStatus(), [refreshAgentStatus]));

  return {
    agentStatus,
    clearingAgentProvider,
    onClearAgentStatus: clearAgentStatus,
    ...hooks,
  };
}

export type AgentStatusSettings = ReturnType<typeof useAgentStatusSettings>;
