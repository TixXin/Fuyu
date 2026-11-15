import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { METHODS, TOPICS, type TimerList } from "./timers.ts";

const message = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

export function useTimers(ctx: Context) {
  const [list, setList] = useState<TimerList>({ timers: [], at: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const take = (next: TimerList) => setList((current) => (next.at >= current.at ? next : current));
    const off = ctx.host.on(TOPICS.timers, take);
    ctx.host.call<TimerList>(METHODS.list).then(take, (reason: unknown) => setError(message(reason)));
    return () => {
      void off();
    };
  }, [ctx]);

  const call = useCallback(
    (method: string) => {
      setError(null);
      ctx.host.call(method).catch((reason: unknown) => setError(message(reason)));
    },
    [ctx],
  );

  return { list, error, call };
}
