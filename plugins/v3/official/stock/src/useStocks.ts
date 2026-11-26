import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, METHODS, TOPICS, type AddResult, type StockItem, type StockState } from "./model.ts";

const EMPTY: StockState = {
  settings: DEFAULT_SETTINGS,
  quotes: {},
  status: "idle",
  source: null,
  updatedAt: null,
  nextAt: null,
  loading: false,
  at: 0,
};

const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

export function useStocks(ctx: Context) {
  const [state, setState] = useState<StockState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = useCallback((next: StockState) => {
    setState((prev) => (next.at >= prev.at ? next : prev));
  }, []);

  useEffect(() => {
    const off = ctx.host.on(TOPICS.state, take);
    ctx.host.call<StockState>(METHODS.getState).then(
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
        .call<StockState>(method, params)
        .then(take)
        .catch((reason: unknown) => setError(errorText(reason)));
    },
    [ctx, take],
  );

  const search = useCallback((keyword: string) => ctx.host.call<StockItem[]>(METHODS.search, { keyword }), [ctx]);
  const addStock = useCallback((stock: StockItem) => ctx.host.call<AddResult>(METHODS.addStock, { stock }), [ctx]);

  return { state, ready, error, invoke, search, addStock };
}
