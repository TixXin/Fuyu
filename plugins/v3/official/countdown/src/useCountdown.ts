import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { METHODS, TOPICS, type CountdownSnapshot } from "./model.ts";

const EMPTY: CountdownSnapshot = { items: [], showInBar: true, at: 0 };
const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

export function useCountdown(ctx: Context) {
  const [state, setState] = useState<CountdownSnapshot>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const take = (next: CountdownSnapshot) => setState((prev) => (next.at >= prev.at ? next : prev));
    const off = ctx.host.on(TOPICS.snapshot, take);
    ctx.host.call<CountdownSnapshot>(METHODS.snapshot).then(take, (reason: unknown) => setError(errorText(reason)));
    return () => {
      void off();
    };
  }, [ctx]);

  const invoke = useCallback(
    (method: string, params?: unknown) => {
      setError(null);
      ctx.host
        .call<CountdownSnapshot>(method, params)
        .then((next) => setState(next))
        .catch((reason: unknown) => setError(errorText(reason)));
    },
    [ctx],
  );

  return { state, error, setError, invoke };
}
