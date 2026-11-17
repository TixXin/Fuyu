import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { EMPTY_SNAPSHOT, METHODS, TOPICS, type PomodoroSnapshot } from "./model.ts";

const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

export function usePomodoro(ctx: Context) {
  const [state, setState] = useState<PomodoroSnapshot>(EMPTY_SNAPSHOT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const take = (next: PomodoroSnapshot) => setState((prev) => (next.at >= prev.at ? next : prev));
    const off = ctx.host.on(TOPICS.snapshot, take);
    ctx.host.call<PomodoroSnapshot>(METHODS.snapshot).then(take, (reason: unknown) => setError(errorText(reason)));
    return () => {
      void off();
    };
  }, [ctx]);

  const start = useCallback(
    (todoId: string | null) => {
      setError(null);
      ctx.host.call<PomodoroSnapshot>(METHODS.start, { todoId }).then(setState, (reason: unknown) => setError(errorText(reason)));
    },
    [ctx],
  );

  const stop = useCallback(() => {
    setError(null);
    ctx.host.call<PomodoroSnapshot>(METHODS.stop).then(setState, (reason: unknown) => setError(errorText(reason)));
  }, [ctx]);

  return { state, error, start, stop };
}
