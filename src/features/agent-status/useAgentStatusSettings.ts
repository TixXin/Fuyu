import { useCallback, useEffect, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { useErrorText } from "../../i18n";
import {
  clearAgentProviderStatus,
  getAgentHooksState,
  getAgentStatus,
  installAgentStatusHooks,
  uninstallAgentStatusHooks,
  type AgentHooksInstallResult,
  type AgentHooksState,
  type AgentHooksUninstallResult,
  type AgentStatusSnapshot,
} from "./api";
import {
  AGENT_PROVIDERS,
  DEFAULT_AGENT_STATUS,
  type AgentHooksInstallState,
  type AgentHooksUninstallState,
} from "./status";

const AGENT_STATUS_POLL_MS = 1_000;

type HooksInstallFlow = {
  state: AgentHooksInstallState;
  result: AgentHooksInstallResult | null;
  error: string;
};

type HooksUninstallFlow = {
  state: AgentHooksUninstallState;
  result: AgentHooksUninstallResult | null;
  error: string;
};

const IDLE_INSTALL_FLOW: HooksInstallFlow = { state: "idle", result: null, error: "" };
const IDLE_UNINSTALL_FLOW: HooksUninstallFlow = { state: "idle", result: null, error: "" };

export function useAgentStatusSettings() {
  const errorText = useErrorText();
  const [agentStatus, setAgentStatus] =
    useState<AgentStatusSnapshot>(DEFAULT_AGENT_STATUS);
  const [clearingAgentProvider, setClearingAgentProvider] =
    useState<string | null>(null);
  const [installFlow, setInstallFlow] = useState<HooksInstallFlow>(IDLE_INSTALL_FLOW);
  const [uninstallFlow, setUninstallFlow] = useState<HooksUninstallFlow>(IDLE_UNINSTALL_FLOW);
  const [agentHooksState, setAgentHooksState] = useState<AgentHooksState | null>(null);

  const refreshAgentHooksState = useCallback(async () => {
    try {
      setAgentHooksState(await getAgentHooksState());
    } catch (error) {
      console.error("Failed to read agent hooks state", error);
    }
  }, []);

  useEffect(() => {
    void refreshAgentHooksState();
  }, [refreshAgentHooksState]);

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
      const snapshot = await clearAgentProviderStatus(provider);
      setAgentStatus(snapshot);
    } catch (error) {
      console.error("Failed to clear agent status", error);
    } finally {
      setClearingAgentProvider(null);
    }
  }, []);

  const installAgentHooks = useCallback(async () => {
    setUninstallFlow(IDLE_UNINSTALL_FLOW);
    setInstallFlow({ state: "installing", result: null, error: "" });

    try {
      const result = await installAgentStatusHooks();
      setInstallFlow({ state: "installed", result, error: "" });
      void refreshAgentStatus();
      void refreshAgentHooksState();
    } catch (error) {
      console.error("Failed to install agent status hooks", error);
      setInstallFlow({ state: "error", result: null, error: errorText(error) });
    }
  }, [errorText, refreshAgentHooksState, refreshAgentStatus]);

  const uninstallAgentHooks = useCallback(async () => {
    setInstallFlow(IDLE_INSTALL_FLOW);
    setUninstallFlow({ state: "uninstalling", result: null, error: "" });

    try {
      const result = await uninstallAgentStatusHooks();
      setUninstallFlow({ state: "uninstalled", result, error: "" });
      void refreshAgentStatus();
      void refreshAgentHooksState();
    } catch (error) {
      console.error("Failed to uninstall agent status hooks", error);
      setUninstallFlow({ state: "error", result: null, error: errorText(error) });
    }
  }, [errorText, refreshAgentHooksState, refreshAgentStatus]);

  return {
    agentStatus,
    clearingAgentProvider,
    agentHooksInstallState: installFlow.state,
    agentHooksInstallResult: installFlow.result,
    agentHooksInstallError: installFlow.error,
    agentHooksUninstallState: uninstallFlow.state,
    agentHooksUninstallResult: uninstallFlow.result,
    agentHooksUninstallError: uninstallFlow.error,
    agentHooksState,
    onClearAgentStatus: clearAgentStatus,
    onInstallAgentHooks: installAgentHooks,
    onUninstallAgentHooks: uninstallAgentHooks,
  };
}
