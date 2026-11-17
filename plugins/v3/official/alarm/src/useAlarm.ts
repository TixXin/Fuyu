import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { METHODS, TOPICS, type AlarmSnapshot } from "./model.ts";

const EMPTY: AlarmSnapshot = { alarms: [], ringing: null, defaultTone: "chime", showInBar: true, at: 0 };
const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

export function useAlarm(ctx: Context) {
  const [state, setState] = useState<AlarmSnapshot>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const take = (next: AlarmSnapshot) => setState((prev) => (next.at >= prev.at ? next : prev));
    const off = ctx.host.on(TOPICS.snapshot, take);
    ctx.host.call<AlarmSnapshot>(METHODS.snapshot).then(take, (reason: unknown) => setError(errorText(reason)));
    return () => {
      void off();
    };
  }, [ctx]);

  const invoke = useCallback(
    (method: string, params?: unknown) => {
      setError(null);
      ctx.host
        .call<AlarmSnapshot>(method, params)
        .then((next) => setState(next))
        .catch((reason: unknown) => setError(errorText(reason)));
    },
    [ctx],
  );

  return { state, error, invoke };
}
