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

  const invoke = useCallback(
    (method: string, params?: unknown) => {
      setError(null);
      ctx.host
        .call<PomodoroSnapshot>(method, params)
        .then((next) => setState((prev) => (next.at >= prev.at ? next : prev)))
        .catch((reason: unknown) => setError(errorText(reason)));
    },
    [ctx],
  );

  return { state, error, invoke };
}

export function useNow(active: boolean, fallback: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      timer = setTimeout(tick, 1000 - (at % 1000) + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, [active]);
  return active ? now : fallback;
}
