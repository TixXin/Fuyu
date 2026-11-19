import { agentsV1 } from "@fuyu/plugin-services";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentUsage } from "../../lib/agent-usage/types";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { windowServices } from "../plugin-kernel/services";
import { getAntigravityUsage, getCursorUsage, getPlanUsage, refreshClaudeUsage } from "./api";
import { isServiceOff, usageFromReport } from "./agentUsage.ts";
import type { UsageProviderId } from "./usageRing";

const REFRESH_MS = 30_000;

const agents = windowServices.get(agentsV1);

type Reading = { usage: AgentUsage | null; agentsOff: boolean };

const fromAgents = (pick: "claude" | "codex") => async (): Promise<Reading> => {
  try {
    const usages = await agents.usage();
    return { usage: usageFromReport(usages[pick]), agentsOff: false };
  } catch (error) {
    if (isServiceOff(error)) return { usage: null, agentsOff: true };
    throw error;
  }
};

const fromPlan = (provider: "glm" | "kimi") => async (refresh: boolean): Promise<Reading> => ({ usage: await getPlanUsage(provider, refresh), agentsOff: false });

const READERS: Record<UsageProviderId, (refresh: boolean) => Promise<Reading>> = {
  claudeCode: async (refresh) => {
    if (refresh) await refreshClaudeUsage().catch((error: unknown) => console.error("Failed to refresh Claude usage", error));
    return fromAgents("claude")();
  },
  codex: fromAgents("codex"),
  antigravity: async (refresh) => ({ usage: await getAntigravityUsage(refresh), agentsOff: false }),
  glm: fromPlan("glm"),
  kimi: fromPlan("kimi"),
  cursor: async (refresh) => ({ usage: await getCursorUsage(refresh), agentsOff: false }),
};

export function useClaudeUsage(provider: UsageProviderId = "claudeCode", enabled = true) {
  const [reading, setReading] = useState<Reading>({ usage: null, agentsOff: false });
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
            setReading(next);
            setNow(Date.now());
          }
        })
        .catch((error: unknown) => console.error(`Failed to read ${provider} usage`, error));
    };
    read(refreshNext.current);
    refreshNext.current = false;
    const stop = visibilityInterval(() => read(false), REFRESH_MS);
    const unwatch = windowServices.watch(() => read(false));
    return () => {
      cancelled = true;
      stop();
      unwatch();
    };
  }, [provider, enabled, nonce]);

  const refresh = useCallback(() => {
    refreshNext.current = true;
    setNonce((value) => value + 1);
  }, []);

  return { usage: reading.usage, agentsOff: reading.agentsOff, now, refresh };
}
