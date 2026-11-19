import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { EMPTY_STATE, METHODS, TOPICS, type LauncherState } from "./model.ts";
import type { LauncherSettings } from "./settingsModel.ts";

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function useLauncher(ctx: Context) {
  const [state, setState] = useState<LauncherState>(EMPTY_STATE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const applyNext = (next: LauncherState) => {
      setState((prev) => (next.updatedAt >= prev.updatedAt ? next : prev));
    };
    const off = ctx.host.on(TOPICS.state, applyNext);
    ctx.host
      .call<LauncherState>(METHODS.getState)
      .then(applyNext, (reason: unknown) => setError(errorText(reason)));
    return () => {
      void off();
    };
  }, [ctx]);

  const invoke = useCallback(
    (method: string, params?: unknown, quiet = false): Promise<LauncherState | null> => {
      setError(null);
      if (!quiet) setBusy(true);
      return ctx.host
        .call<LauncherState>(method, params)
        .then((next) => {
          setState(next);
          return next;
        })
        .catch((reason: unknown) => {
          setError(errorText(reason));
          return null;
        })
        .finally(() => {
          if (!quiet) setBusy(false);
        });
    },
    [ctx],
  );

  const launch = useCallback((appPath: string) => invoke(METHODS.launch, { path: appPath }, true), [invoke]);
  const rescan = useCallback(() => invoke(METHODS.rescan), [invoke]);
  const clearRecent = useCallback(() => invoke(METHODS.clearRecent), [invoke]);
  const setSettings = useCallback(
    (patch: Partial<LauncherSettings>) => invoke(METHODS.setSettings, patch, true),
    [invoke],
  );

  return { state, busy, error, setError, invoke, launch, rescan, clearRecent, setSettings };
}
