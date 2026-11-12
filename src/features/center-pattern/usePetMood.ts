import { useEffect, useMemo, useState } from "react";
import { petMoodChangesAt, petMoodFor, type AgentActivity } from "./centerSettings";
import type { PetMood } from "./patterns";

export function usePetMood(agents: readonly AgentActivity[], enabled: boolean): PetMood {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (enabled) setNow(Date.now());
  }, [agents, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const changesAt = petMoodChangesAt(agents, now);
    if (changesAt === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, changesAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [agents, enabled, now]);

  return useMemo(() => (enabled ? petMoodFor(agents, now) : "idle"), [agents, enabled, now]);
}
