import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, METHODS, TOPICS, emptyResult, type FileSearchState, type SearchResult } from "./model.ts";

const DEBOUNCE_MS = 140;

const EMPTY_STATE: FileSearchState = {
  settings: DEFAULT_SETTINGS,
  backend: "none",
  recent: [],
  lastQuery: "",
  homeDir: "",
  at: 0,
};

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function useFileSearchState(ctx: Context) {
  const [state, setState] = useState<FileSearchState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = useCallback((next: FileSearchState) => {
    setState((prev) => (next.at >= prev.at ? next : prev));
  }, []);

  useEffect(() => {
    const off = ctx.host.on(TOPICS.state, take);
    ctx.host.call<FileSearchState>(METHODS.getState).then(
      (next) => {
        if (next && typeof next === "object" && next.settings) take(next);
        setReady(true);
      },
      () => {
        setReady(true);
      },
    );
    return () => {
      void off();
    };
  }, [ctx, take]);

  const setSettings = useCallback(
    (patch: Partial<FileSearchState["settings"]>) => {
      setError(null);
      ctx.host
        .call<FileSearchState>(METHODS.setSettings, patch)
        .then(take)
        .catch((reason: unknown) => setError(errorText(reason)));
    },
    [ctx, take],
  );

  return { state, ready, error, setSettings };
}

export function useFileSearch(ctx: Context, query: string, scopeKey: string) {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    const id = ++seq.current;
    if (!trimmed) {
      setResult(null);
      setLoading(false);
      setError(null);
      return undefined;
    }
    setLoading(true);
    // eslint-disable-next-line no-restricted-globals
    const timer = setTimeout(() => {
      ctx.host
        .call<SearchResult>(METHODS.search, { query: trimmed })
        .then(
          (next) => {
            if (id !== seq.current) return;
            setResult(next);
            setError(null);
          },
          (reason: unknown) => {
            if (id !== seq.current) return;
            setResult(emptyResult(trimmed, "none", "error"));
            setError(errorText(reason));
          },
        )
        .finally(() => {
          if (id === seq.current) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ctx, query, nonce, scopeKey]);

  const retry = useCallback(() => setNonce((value) => value + 1), []);

  const call = useCallback(
    (method: string, params?: unknown) =>
      ctx.host.call<unknown>(method, params).then(
        () => true,
        (reason: unknown) => {
          setError(errorText(reason));
          return false;
        },
      ),
    [ctx],
  );

  return { result, loading, error, retry, call };
}
