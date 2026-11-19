import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_CONFIG, type WeatherConfig } from "./config.ts";
import { METHODS, TOPICS, type WeatherState } from "./types.ts";

const INITIAL: WeatherState = {
  config: { ...DEFAULT_CONFIG },
  place: null,
  forecast: null,
  fetchedAt: null,
  loading: false,
  problem: null,
  updatedAt: 0,
};

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function useWeather(ctx: Context) {
  const [state, setState] = useState<WeatherState>(INITIAL);
  const [error, setError] = useState<string | null>(null);

  const take = useCallback((next: WeatherState) => {
    setState((prev) => (next.updatedAt >= prev.updatedAt ? next : prev));
  }, []);

  useEffect(() => {
    let alive = true;
    let retry: (() => unknown) | null = null;
    const off = ctx.host.on(TOPICS.state, take);
    const load = (left: number) => {
      ctx.host.call<WeatherState>(METHODS.getState).then(
        (next) => {
          if (!alive) return;
          setError(null);
          take(next);
        },
        (reason: unknown) => {
          if (!alive) return;
          if (left > 0) retry = ctx.setTimeout(() => load(left - 1), 2000);
          else setError(errorText(reason));
        },
      );
    };
    load(5);
    return () => {
      alive = false;
      retry?.();
      void off();
    };
  }, [ctx, take]);

  const saveConfig = useCallback(
    (patch: Partial<WeatherConfig>) => {
      setError(null);
      setState((prev) => ({ ...prev, config: { ...prev.config, ...patch } }));
      ctx.host.call<WeatherState>(METHODS.setConfig, patch).then(take, (reason: unknown) => setError(errorText(reason)));
    },
    [ctx, take],
  );

  const refresh = useCallback(() => {
    setError(null);
    ctx.host.call<WeatherState>(METHODS.refresh).then(take, (reason: unknown) => setError(errorText(reason)));
  }, [ctx, take]);

  return { state, error, saveConfig, refresh };
}
