import { useCallback, useEffect, useState } from "react";
import { listenAgentFocusNotFound, type AgentFocusNotFound } from "./api";

export function useFocusNotFoundReason(enabled: boolean) {
  const [missing, setMissing] = useState<AgentFocusNotFound | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    const unlisten = listenAgentFocusNotFound((payload) => {
      if (!disposed) setMissing(payload);
    }).catch(() => undefined);
    return () => {
      disposed = true;
      void unlisten.then((stop) => stop?.());
    };
  }, [enabled]);

  const clear = useCallback(() => setMissing(null), []);
  const reasonFor = (sessionId: string) => (missing?.sessionId === sessionId ? missing.reason : null);
  return { reasonFor, clear };
}
