import { useEffect, useMemo, useState } from "react";
import { centerMoodChangesAt, centerMoodFor, type AgentActivity } from "./centerSettings";
import type { CenterMood } from "./patterns";

export function usePetMood(agents: readonly AgentActivity[], enabled: boolean, doze = false): CenterMood {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (enabled) setNow(Date.now());
  }, [agents, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const changesAt = centerMoodChangesAt(agents, now, doze);
    if (changesAt === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, changesAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [agents, enabled, now, doze]);

  return useMemo(() => (enabled ? centerMoodFor(agents, now, doze) : "idle"), [agents, enabled, now, doze]);
}
