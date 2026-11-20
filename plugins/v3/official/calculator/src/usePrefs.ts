import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { EMPTY_RATES, METHODS, TOPICS, defaultPrefs, mergePrefs, type CalculatorSettings, type Prefs, type RatesSnapshot } from "./model.ts";

export interface PrefsApi {
  prefs: Prefs;
  update: (patch: Partial<Prefs>) => void;
  field: (key: string, fallback?: string) => string;
  setField: (key: string, value: string) => void;
  setSettings: (patch: Partial<CalculatorSettings>) => void;
}

export function usePrefs(ctx: Context): PrefsApi {
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);

  useEffect(() => {
    let alive = true;
    const off = ctx.host.on(TOPICS.settings, (settings: CalculatorSettings) => setPrefs((current) => ({ ...current, settings })));
    ctx.host.call<Prefs>(METHODS.prefs).then(
      (next) => {
        if (alive) setPrefs(next);
      },
      () => {},
    );
    return () => {
      alive = false;
      void off();
    };
  }, [ctx]);

  const update = useCallback(
    (patch: Partial<Prefs>) => {
      setPrefs((current) => mergePrefs(current, patch));
      ctx.host.call(METHODS.setPrefs, patch).catch(() => {});
    },
    [ctx],
  );

  const field = useCallback((key: string, fallback = "") => prefs.fields[key] ?? fallback, [prefs]);
  const setField = useCallback((key: string, value: string) => update({ fields: { [key]: value } }), [update]);

  const setSettings = useCallback(
    (patch: Partial<CalculatorSettings>) => {
      setPrefs((current) => mergePrefs(current, { settings: patch }));
      ctx.host.call(METHODS.setSettings, patch).catch(() => {});
    },
    [ctx],
  );

  return { prefs, update, field, setField, setSettings };
}

export function useRates(ctx: Context) {
  const [rates, setRates] = useState<RatesSnapshot>(EMPTY_RATES);

  useEffect(() => {
    const off = ctx.host.on(TOPICS.rates, (next: RatesSnapshot) => setRates(next));
    ctx.host.call<RatesSnapshot>(METHODS.rates).then(setRates, () => {});
    return () => {
      void off();
    };
  }, [ctx]);

  const refresh = useCallback(() => {
    ctx.host.call<RatesSnapshot>(METHODS.refreshRates).then(setRates, () => {});
  }, [ctx]);

  return { rates, refresh };
}
