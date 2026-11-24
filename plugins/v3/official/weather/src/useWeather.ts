import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_CONFIG, type WeatherConfig } from "./config.ts";
import { METHODS, TOPICS, type WeatherPlace, type WeatherState } from "./types.ts";

const INITIAL: WeatherState = {
  config: { ...DEFAULT_CONFIG, cities: [] },
  activeCityId: "",
  place: null,
  forecast: null,
  aqi: null,
  fetchedAt: null,
  primaryPlace: null,
  primaryForecast: null,
  primaryAqi: null,
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
    let retry: ReturnType<typeof globalThis.setTimeout> | null = null;
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
          if (left > 0) {
            // eslint-disable-next-line no-restricted-globals
            retry = setTimeout(() => load(left - 1), 2000);
          } else {
            setError(errorText(reason));
          }
        },
      );
    };
    load(5);
    return () => {
      alive = false;
      if (retry !== null) clearTimeout(retry);
      void off();
    };
  }, [ctx, take]);

  const callState = useCallback(
    (method: string, params?: unknown) => {
      setError(null);
      ctx.host.call<WeatherState>(method, params).then(take, (reason: unknown) => setError(errorText(reason)));
    },
    [ctx, take],
  );

  const saveConfig = useCallback(
    (patch: Partial<WeatherConfig>) => {
      setError(null);
      setState((prev) => ({ ...prev, config: { ...prev.config, ...patch } }));
      ctx.host.call<WeatherState>(METHODS.setConfig, patch).then(take, (reason: unknown) => setError(errorText(reason)));
    },
    [ctx, take],
  );

  const refresh = useCallback(() => callState(METHODS.refresh), [callState]);

  const searchCities = useCallback(async (query: string): Promise<WeatherPlace[]> => {
    const res = await ctx.host.call<{ results?: WeatherPlace[] }>(METHODS.searchCities, { query });
    return Array.isArray(res?.results) ? res.results : [];
  }, [ctx]);

  const addCity = useCallback((place: WeatherPlace) => callState(METHODS.addCity, { place }), [callState]);
  const removeCity = useCallback((id: string) => callState(METHODS.removeCity, { id }), [callState]);
  const setPrimaryCity = useCallback((id: string) => callState(METHODS.setPrimaryCity, { id }), [callState]);
  const selectCity = useCallback((id: string) => callState(METHODS.selectCity, { id }), [callState]);

  return {
    state,
    error,
    saveConfig,
    refresh,
    searchCities,
    addCity,
    removeCity,
    setPrimaryCity,
    selectCity,
  };
}
