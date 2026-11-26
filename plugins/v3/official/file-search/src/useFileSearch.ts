import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useRef, useState } from "react";
import { METHODS, emptyResult, type SearchResult } from "./model.ts";

const DEBOUNCE_MS = 140;

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function useFileSearch(ctx: Context, query: string) {
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
  }, [ctx, query, nonce]);

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
