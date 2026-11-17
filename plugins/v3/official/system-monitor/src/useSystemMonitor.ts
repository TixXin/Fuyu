import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useId, useState } from "react";
import {
  DEFAULT_CONFIG,
  METHODS,
  TOPICS,
  detectLocale,
  type MonitorConfig,
  type MonitorState,
} from "./types.ts";

const INITIAL: MonitorState = {
  config: { ...DEFAULT_CONFIG, locale: detectLocale() },
  sample: null,
  sampling: false,
  updatedAt: 0,
};

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function useSystemMonitor(ctx: Context, watchPage = false) {
  const locale = detectLocale();
  const viewerId = useId();
  const [state, setState] = useState<MonitorState>(INITIAL);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const take = (next: MonitorState) => {
      setState((prev) => (next.updatedAt >= prev.updatedAt ? next : prev));
    };
    const off = ctx.host.on(TOPICS.state, take);
    if (watchPage) {
      ctx.host
        .call<MonitorState>(METHODS.watchPage, { viewerId, active: true, locale })
        .then(take, (reason: unknown) => setError(errorText(reason)));
    } else {
      ctx.host
        .call<MonitorState>(METHODS.getState, { locale })
        .then(take, (reason: unknown) => setError(errorText(reason)));
    }
    return () => {
      void off();
      if (watchPage) {
        void ctx.host.call(METHODS.watchPage, { viewerId, active: false }).catch(() => {});
      }
    };
  }, [ctx, locale, viewerId, watchPage]);

  const updateConfig = useCallback(
    (patch: Partial<MonitorConfig>) => {
      setError(null);
      return ctx.host
        .call<MonitorState>(METHODS.setConfig, { ...patch, locale })
        .then((next) => {
          setState(next);
          return next;
        })
        .catch((reason: unknown) => {
          setError(errorText(reason));
          return null;
        });
    },
    [ctx, locale],
  );

  const refresh = useCallback(() => {
    setError(null);
    ctx.host
      .call<MonitorState>(METHODS.refresh, { locale })
      .then(setState)
      .catch((reason: unknown) => setError(errorText(reason)));
  }, [ctx, locale]);

  return { state, locale, error, updateConfig, refresh };
}
