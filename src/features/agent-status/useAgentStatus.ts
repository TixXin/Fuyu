import { useCallback, useEffect, useRef, useState } from "react";
import { getAgentStatus, type AgentStatusSnapshot } from "./api";
import { DEFAULT_AGENT_STATUS, listAgentStatuses } from "./status";

export function useAgentStatus(enabled = true) {
  const [agentStatus, setAgentStatus] =
    useState<AgentStatusSnapshot>(DEFAULT_AGENT_STATUS);
  const isRefreshingAgentStatus = useRef(false);

  const refreshAgentStatus = useCallback(async () => {
    if (isRefreshingAgentStatus.current) {
      return;
    }

    isRefreshingAgentStatus.current = true;
    try {
      const snapshot = await getAgentStatus();
      setAgentStatus((currentState) => {
        const current = listAgentStatuses(currentState);
        const next = listAgentStatuses(snapshot);
        const unchanged =
          currentState.statusPath === snapshot.statusPath &&
          current.length === next.length &&
          next.every((entry, index) =>
            current[index].key === entry.key &&
            current[index].label === entry.label &&
            current[index].status.phase === entry.status.phase &&
            current[index].status.taskId === entry.status.taskId &&
            current[index].status.title === entry.status.title,
          );
        return unchanged ? currentState : snapshot;
      });
    } catch (error) {
      console.error("Failed to read agent status", error);
      setAgentStatus(DEFAULT_AGENT_STATUS);
    } finally {
      isRefreshingAgentStatus.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAgentStatus(DEFAULT_AGENT_STATUS);
      return;
    }

    void refreshAgentStatus();

    const interval = window.setInterval(() => {
      void refreshAgentStatus();
    }, 200);

    return () => window.clearInterval(interval);
  }, [enabled, refreshAgentStatus]);

  return agentStatus;
}
