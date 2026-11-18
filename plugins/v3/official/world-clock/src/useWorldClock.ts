import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { METHODS, TOPICS, type WorldClockSnapshot } from "./model.ts";

const EMPTY: WorldClockSnapshot = { cities: [], showInBar: true, at: 0 };
const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

export function useWorldClock(ctx: Context) {
  const [state, setState] = useState<WorldClockSnapshot>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const take = (next: WorldClockSnapshot) => setState((prev) => (next.at >= prev.at ? next : prev));
    const off = ctx.host.on(TOPICS.snapshot, take);
    ctx.host.call<WorldClockSnapshot>(METHODS.snapshot).then(take, (reason: unknown) => setError(errorText(reason)));
    return () => {
      void off();
    };
  }, [ctx]);

  const invoke = useCallback(
    (method: string, params?: unknown) => {
      setError(null);
      ctx.host
        .call<WorldClockSnapshot>(method, params)
        .then((next) => setState(next))
        .catch((reason: unknown) => setError(errorText(reason)));
    },
    [ctx],
  );

  return { state, error, setError, invoke };
}
