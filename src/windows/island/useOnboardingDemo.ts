import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentSessionSummary } from "../../features/agent-status/api";
import { useTranslation } from "../../i18n";
import { ONBOARDING_DEMO_STORAGE_KEY, islandDemoUntil } from "../onboarding/storage";

export type OnboardingDemo = {
  active: boolean;
  startedAt: number;
  sessions: AgentSessionSummary[];
};

const OFF: OnboardingDemo = { active: false, startedAt: 0, sessions: [] };

export function useOnboardingDemo(): OnboardingDemo {
  const text = useTranslation().onboarding.demo;
  const [until, setUntil] = useState(() => islandDemoUntil());
  const [now, setNow] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const untilRef = useRef(until);
  const active = until > now;

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== ONBOARDING_DEMO_STORAGE_KEY) return;
      const next = islandDemoUntil(event.newValue);
      const at = Date.now();
      if (untilRef.current <= at && next > at) setStartedAt(at);
      untilRef.current = next;
      setUntil(next);
      setNow(at);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setNow(Date.now()), until - now + 50);
    return () => window.clearTimeout(timer);
  }, [active, until, now]);

  return useMemo(() => {
    if (!active) return OFF;
    return {
      active,
      startedAt,
      sessions: [{
        provider: "claudeCode",
        sessionId: "fuyu-onboarding-demo",
        cwd: null,
        title: text.agentTitle,
        model: "Opus 5.5",
        effort: null,
        phase: "running",
        lastMessage: null,
        updatedAt: startedAt,
        host: null,
        turnStartedAt: startedAt,
        lastPrompt: text.agentPrompt,
      }],
    };
  }, [active, startedAt, text]);
}
