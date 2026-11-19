import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { msUntilNextTick } from "./clock.ts";
import { DEFAULT_SETTINGS, METHODS, TOPICS, type WorldClockSnapshot } from "./model.ts";

const EMPTY: WorldClockSnapshot = { cities: [], settings: DEFAULT_SETTINGS, at: 0 };
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
        .then((next) => setState((prev) => (next.at >= prev.at ? next : prev)))
        .catch((reason: unknown) => setError(errorText(reason)));
    },
    [ctx],
  );

  return { state, error, setError, invoke };
}

export function useNow(seconds: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      timer = setTimeout(tick, msUntilNextTick(at, seconds));
    };
    tick();
    return () => clearTimeout(timer);
  }, [seconds]);
  return now;
}
