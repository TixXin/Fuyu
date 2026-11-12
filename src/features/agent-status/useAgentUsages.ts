import { useEffect, useState } from "react";
import { getAgentUsage, getCodexUsage } from "./api";
import { EMPTY_USAGES, type AgentUsages } from "./usage";

const REFRESH_MS = 30_000;

export function useAgentUsages(enabled: boolean): AgentUsages {
  const [usages, setUsages] = useState<AgentUsages>(EMPTY_USAGES);

  useEffect(() => {
    if (!enabled) {
      setUsages(EMPTY_USAGES);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      const log = (what: string) => (error: unknown) => {
        console.error(`Failed to read the ${what} usage`, error);
        return null;
      };
      void Promise.all([getAgentUsage().catch(log("Claude")), getCodexUsage().catch(log("Codex"))]).then(([claude, codex]) => {
        if (!cancelled) setUsages({ claude: claude ?? null, codex: codex ?? null, readAt: Date.now() });
      });
    };
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return usages;
}
