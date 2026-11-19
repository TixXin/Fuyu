import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, METHODS, TOPICS, type CountdownSnapshot } from "./model.ts";

const EMPTY: CountdownSnapshot = { items: [], settings: DEFAULT_SETTINGS, at: 0 };
const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

export function useCountdown(ctx: Context) {
  const [state, setState] = useState<CountdownSnapshot>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const take = (next: CountdownSnapshot) => setState((prev) => (next.at >= prev.at ? next : prev));
    const off = ctx.host.on(TOPICS.snapshot, take);
    ctx.host.call<CountdownSnapshot>(METHODS.snapshot).then(take, (reason: unknown) => setError(errorText(reason)));
    return () => {
      void off();
    };
  }, [ctx]);

  const invoke = useCallback(
    (method: string, params?: unknown) => {
      setError(null);
      ctx.host
        .call<CountdownSnapshot>(method, params)
        .then((next) => setState((prev) => (next.at >= prev.at ? next : prev)))
        .catch((reason: unknown) => setError(errorText(reason)));
    },
    [ctx],
  );

  return { state, error, setError, invoke };
}

function msUntilTomorrow(at: number): number {
  const dt = new Date(at);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 1).getTime() - at + 1_000;
}

export function useToday(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, Math.min(msUntilTomorrow(Date.now()), 3_600_000));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return now;
}

const backgrounds = new Map<string, Promise<string | null>>();

export function useBackground(ctx: Context, id: string | null, rev: number | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id || rev === null) {
      setUrl(null);
      return;
    }
    const key = `${id}:${rev}`;
    let request = backgrounds.get(key);
    if (!request) {
      request = ctx.host.call<{ dataUrl: string | null }>(METHODS.background, { id }).then(
        (result) => result?.dataUrl ?? null,
        () => {
          backgrounds.delete(key);
          return null;
        },
      );
      backgrounds.set(key, request);
    }
    let alive = true;
    request.then((value) => {
      if (alive) setUrl(value);
    });
    return () => {
      alive = false;
    };
  }, [ctx, id, rev]);
  return url;
}
