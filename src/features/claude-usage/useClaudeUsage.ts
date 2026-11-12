import { useCallback, useEffect, useRef, useState } from "react";
import { getAgentUsage, getCodexUsage, getPlanUsage, type AgentUsage } from "../agent-status/api";
import { refreshClaudeUsage } from "./api";
import type { UsageProviderId } from "./usageRing";

const REFRESH_MS = 30_000;

const READERS: Record<UsageProviderId, (refresh: boolean) => Promise<AgentUsage | null>> = {
  claudeCode: async (refresh) => {
    if (refresh) await refreshClaudeUsage().catch((error: unknown) => console.error("Failed to refresh Claude usage", error));
    return getAgentUsage();
  },
  codex: () => getCodexUsage(),
  glm: (refresh) => getPlanUsage("glm", refresh),
  kimi: (refresh) => getPlanUsage("kimi", refresh),
};

export function useClaudeUsage(provider: UsageProviderId = "claudeCode", enabled = true) {
  const [usage, setUsage] = useState<AgentUsage | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [nonce, setNonce] = useState(0);
  const refreshNext = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const read = (refresh: boolean) => {
      void READERS[provider](refresh)
        .then((next) => {
          if (!cancelled) {
            setUsage(next);
            setNow(Date.now());
          }
        })
        .catch((error: unknown) => console.error(`Failed to read ${provider} usage`, error));
    };
    read(refreshNext.current);
    refreshNext.current = false;
    const timer = window.setInterval(() => read(false), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [provider, enabled, nonce]);

  const refresh = useCallback(() => {
    refreshNext.current = true;
    setNonce((value) => value + 1);
  }, []);

  return { usage, now, refresh };
}
