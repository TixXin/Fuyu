import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, EMPTY_PROGRESS, METHODS, TOPICS, type RingSnapshot } from "./model.ts";

const EMPTY: RingSnapshot = { ...EMPTY_PROGRESS, error: null, settings: DEFAULT_SETTINGS, at: 0 };

export function useRing(ctx: Context) {
  const [state, setState] = useState<RingSnapshot>(EMPTY);
  const [failed, setFailed] = useState<string | null>(null);

  const take = useCallback((next: RingSnapshot) => setState((prev) => (next.at >= prev.at ? next : prev)), []);

  useEffect(() => {
    const off = ctx.host.on(TOPICS.snapshot, take);
    ctx.host.call<RingSnapshot>(METHODS.snapshot).then(take, () => setState((prev) => ({ ...prev, error: "unavailable" })));
    return () => {
      void off();
    };
  }, [ctx, take]);

  const invoke = useCallback(
    (method: string, params: unknown, failText: string) => {
      setFailed(null);
      return ctx.host.call<RingSnapshot>(method, params).then(
        (next) => {
          take(next);
          return true;
        },
        () => {
          setFailed(failText);
          return false;
        },
      );
    },
    [ctx, take],
  );

  return { state, failed, invoke };
}
