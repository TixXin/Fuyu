import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_STATE,
  METHODS,
  TOPICS,
  detectLocale,
  type LauncherState,
} from "./model.ts";

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function useLauncher(ctx: Context) {
  const locale = detectLocale();
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

  const launch = useCallback(
    (appPath: string) => {
      setError(null);
      return ctx.host
        .call<LauncherState>(METHODS.launch, { path: appPath })
        .then((next) => {
          setState(next);
          return next;
        })
        .catch((reason: unknown) => {
          setError(errorText(reason));
          return null;
        });
    },
    [ctx],
  );

  const rescan = useCallback(() => {
    setError(null);
    setBusy(true);
    return ctx.host
      .call<LauncherState>(METHODS.rescan)
      .then((next) => {
        setState(next);
        return next;
      })
      .catch((reason: unknown) => {
        setError(errorText(reason));
        return null;
      })
      .finally(() => {
        setBusy(false);
      });
  }, [ctx]);

  const clearRecent = useCallback(() => {
    setError(null);
    setBusy(true);
    return ctx.host
      .call<LauncherState>(METHODS.clearRecent)
      .then((next) => {
        setState(next);
        return next;
      })
      .catch((reason: unknown) => {
        setError(errorText(reason));
        return null;
      })
      .finally(() => {
        setBusy(false);
      });
  }, [ctx]);

  return { state, locale, busy, error, launch, rescan, clearRecent };
}
