import { useEffect, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { AGENT_USAGE_SOURCES, type AgentUsageSource } from "./agentSettings";
import { getAgentUsage, getAntigravityUsage, getCodexUsage, getCursorUsage, getHoverUsage, getPlanUsage, type AgentUsage, type HoverUsage } from "./api";
import { EMPTY_USAGES, type AgentUsages, type CreditSource, type OtherSource } from "./usage";

const REFRESH_MS = 30_000;

const OTHER_READERS: Record<OtherSource, () => Promise<AgentUsage>> = {
  antigravity: getAntigravityUsage,
  cursor: getCursorUsage,
  glm: () => getPlanUsage("glm"),
  kimi: () => getPlanUsage("kimi"),
};

const CREDIT_SOURCES: readonly CreditSource[] = ["workbuddy", "dsh"];

function logged<T>(what: string, read: () => Promise<T>): Promise<T | null> {
  return read().catch((error: unknown) => {
    console.error(`Failed to read the ${what} usage`, error);
    return null;
  });
}

async function readUsages(sources: readonly AgentUsageSource[]): Promise<AgentUsages> {
  const others = (Object.keys(OTHER_READERS) as OtherSource[]).filter((source) => sources.includes(source));
  const credits = CREDIT_SOURCES.filter((source) => sources.includes(source));
  const [claude, codex, otherValues, creditValues] = await Promise.all([
    sources.includes("claudeCode") ? logged("Claude", getAgentUsage) : null,
    sources.includes("codex") ? logged("Codex", getCodexUsage) : null,
    Promise.all(others.map((source) => logged(source, OTHER_READERS[source]))),
    Promise.all(credits.map((source) => logged<HoverUsage>(source, () => getHoverUsage(source)))),
  ]);
  const result: AgentUsages = { claude: claude ?? null, codex: codex ?? null, others: {}, credits: {}, readAt: Date.now() };
  others.forEach((source, index) => {
    const usage = otherValues[index];
    if (usage) result.others[source] = usage;
  });
  credits.forEach((source, index) => {
    const usage = creditValues[index];
    if (usage) result.credits[source] = usage;
  });
  return result;
}

export function useAgentUsages(enabled: boolean, sources: readonly AgentUsageSource[] = AGENT_USAGE_SOURCES): AgentUsages {
  const [usages, setUsages] = useState<AgentUsages>(EMPTY_USAGES);
  const key = sources.join(",");

  useEffect(() => {
    if (!enabled || !key) {
      setUsages(EMPTY_USAGES);
      return;
    }
    let cancelled = false;
    const wanted = key.split(",") as AgentUsageSource[];
    const refresh = () => {
      void readUsages(wanted).then((next) => {
        if (!cancelled) setUsages(next);
      });
    };
    refresh();
    const stop = visibilityInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, key]);

  return usages;
}
