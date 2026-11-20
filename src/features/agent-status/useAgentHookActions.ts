import { useCallback, useEffect, useState } from "react";
import { useErrorText } from "../../i18n";
import {
  getAgentHooksState,
  installAgentHooks,
  installAgentStatusHooks,
  uninstallAgentHooks,
  uninstallAgentStatusHooks,
  type AgentHooksState,
  type RemoteResult,
} from "./api";

export type BulkHookFlow = {
  kind: "reinstall" | "remove" | null;
  state: "idle" | "working" | "done" | "error";
  remotes: RemoteResult[];
  error: string;
};

const IDLE_BULK: BulkHookFlow = { kind: null, state: "idle", remotes: [], error: "" };

export function useAgentHookActions(onChanged: () => void) {
  const errorText = useErrorText();
  const [agentHooksState, setAgentHooksState] = useState<AgentHooksState | null>(null);
  const [hookBusy, setHookBusy] = useState<ReadonlySet<string>>(new Set());
  const [hookErrors, setHookErrors] = useState<Record<string, string>>({});
  const [hookDone, setHookDone] = useState<string[]>([]);
  const [dshBridge, setDshBridge] = useState<string | null>(null);
  const [bulk, setBulk] = useState<BulkHookFlow>(IDLE_BULK);

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

  const markBusy = (providers: string[], busy: boolean) =>
    setHookBusy((current) => {
      const next = new Set(current);
      for (const provider of providers) {
        if (busy) next.add(provider);
        else next.delete(provider);
      }
      return next;
    });

  const setErrors = (entries: [string, string | null][]) =>
    setHookErrors((current) => {
      const next = { ...current };
      for (const [provider, error] of entries) {
        if (error) next[provider] = error;
        else delete next[provider];
      }
      return next;
    });

  const after = useCallback(() => {
    void refreshAgentHooksState();
    onChanged();
  }, [onChanged, refreshAgentHooksState]);

  const onInstallHooks = useCallback(async (providers: string[]) => {
    if (providers.length === 0) return;
    markBusy(providers, true);
    setBulk(IDLE_BULK);
    try {
      const result = await installAgentHooks(providers);
      setErrors(result.results.map(({ provider, error }) => [provider, error]));
      setHookDone(result.results.filter(({ error }) => !error).map(({ provider }) => provider));
      if (providers.includes("dsh")) setDshBridge(result.dshBridge);
    } catch (error) {
      console.error("Failed to install agent hooks", error);
      setErrors(providers.map((provider) => [provider, errorText(error)]));
      setHookDone([]);
    } finally {
      markBusy(providers, false);
      after();
    }
  }, [after, errorText]);

  const onUninstallHook = useCallback(async (provider: string) => {
    markBusy([provider], true);
    try {
      await uninstallAgentHooks(provider);
      setErrors([[provider, null]]);
    } catch (error) {
      console.error("Failed to remove agent hooks", error);
      setErrors([[provider, errorText(error)]]);
    } finally {
      markBusy([provider], false);
      after();
    }
  }, [after, errorText]);

  const runBulk = useCallback(async (kind: "reinstall" | "remove") => {
    setBulk({ kind, state: "working", remotes: [], error: "" });
    setHookDone([]);
    try {
      if (kind === "reinstall") {
        const result = await installAgentStatusHooks();
        setDshBridge(result.dshBridge ?? null);
        setBulk({ kind, state: "done", remotes: result.remotes, error: "" });
      } else {
        const result = await uninstallAgentStatusHooks();
        setDshBridge(null);
        setBulk({ kind, state: "done", remotes: result.remotes, error: "" });
      }
      setHookErrors({});
    } catch (error) {
      console.error(`Failed to ${kind} all agent hooks`, error);
      setBulk({ kind, state: "error", remotes: [], error: errorText(error) });
    } finally {
      after();
    }
  }, [after, errorText]);

  return {
    agentHooksState,
    hookBusy,
    hookErrors,
    hookDone,
    dshBridge,
    bulkHooks: bulk,
    onInstallHooks,
    onUninstallHook,
    onReinstallAll: useCallback(() => runBulk("reinstall"), [runBulk]),
    onRemoveAll: useCallback(() => runBulk("remove"), [runBulk]),
  };
}
