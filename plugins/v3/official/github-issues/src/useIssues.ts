import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, METHODS, TOPICS, type AddRepoResult, type IssuesState } from "./model.ts";

const EMPTY: IssuesState = { settings: DEFAULT_SETTINGS, groups: [], loading: false, at: 0 };

const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

export function useIssues(ctx: Context) {
  const [state, setState] = useState<IssuesState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = useCallback((next: IssuesState) => {
    setState((prev) => (next.at >= prev.at ? next : prev));
  }, []);

  useEffect(() => {
    const off = ctx.host.on(TOPICS.state, take);
    ctx.host.call<IssuesState>(METHODS.getState).then(
      (next) => {
        take(next);
        setReady(true);
      },
      (reason: unknown) => setError(errorText(reason)),
    );
    return () => {
      void off();
    };
  }, [ctx, take]);

  const invoke = useCallback(
    (method: string, params?: unknown) => {
      setError(null);
      ctx.host
        .call<IssuesState>(method, params)
        .then(take)
        .catch((reason: unknown) => setError(errorText(reason)));
    },
    [ctx, take],
  );

  const addRepo = useCallback(
    (repo: string) => ctx.host.call<AddRepoResult>(METHODS.addRepo, { repo }),
    [ctx],
  );

  return { state, ready, error, invoke, addRepo };
}
