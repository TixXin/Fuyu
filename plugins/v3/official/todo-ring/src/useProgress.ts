import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { EMPTY_PROGRESS, METHODS, TOPICS, type RingProgress } from "./model.ts";

const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

export function useProgress(ctx: Context) {
  const [progress, setProgress] = useState<RingProgress>(EMPTY_PROGRESS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const take = (next: RingProgress) => setProgress((prev) => (next.at >= prev.at ? next : prev));
    const off = ctx.host.on(TOPICS.progress, take);
    ctx.host.call<RingProgress>(METHODS.progress).then(take, (reason: unknown) => setError(errorText(reason)));
    return () => {
      void off();
    };
  }, [ctx]);

  const refresh = useCallback(() => {
    setError(null);
    ctx.host.call<RingProgress>(METHODS.refresh).then(setProgress, (reason: unknown) => setError(errorText(reason)));
  }, [ctx]);

  const complete = useCallback(
    (id: string) => {
      setError(null);
      ctx.host.call<RingProgress>(METHODS.complete, { id }).then(setProgress, (reason: unknown) => setError(errorText(reason)));
    },
    [ctx],
  );

  return { progress, error, refresh, complete };
}
