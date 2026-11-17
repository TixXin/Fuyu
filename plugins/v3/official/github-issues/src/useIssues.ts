import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_CONFIG, METHODS, TOPICS, detectLocale, type IssuesConfig, type IssuesState } from "./types.ts";

const INITIAL: IssuesState = {
  config: { ...DEFAULT_CONFIG, locale: detectLocale() },
  repos: [],
  invalidRepos: [],
  groups: [],
  rate: null,
  loading: false,
  updatedAt: 0,
};

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function useIssues(ctx: Context) {
  const locale = detectLocale();
  const [state, setState] = useState<IssuesState>(INITIAL);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const take = (next: IssuesState) => {
      setState((prev) => (next.updatedAt >= prev.updatedAt ? next : prev));
    };
    const off = ctx.host.on(TOPICS.state, take);
    ctx.host.call<IssuesState>(METHODS.getState, { locale }).then(take, (reason: unknown) => {
      setError(errorText(reason));
    });
    return () => {
      void off();
    };
  }, [ctx, locale]);

  const saveConfig = useCallback(
    (patch: Partial<IssuesConfig>) => {
      setError(null);
      return ctx.host
        .call<IssuesState>(METHODS.setConfig, { ...patch, locale })
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
      .call<IssuesState>(METHODS.refresh, { locale })
      .then(setState)
      .catch((reason: unknown) => setError(errorText(reason)));
  }, [ctx, locale]);

  return { state, locale, error, saveConfig, refresh };
}
