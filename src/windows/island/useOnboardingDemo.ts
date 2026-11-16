import { useEffect, useMemo, useRef, useState } from "react";
import { ONBOARDING_DEMO_STORAGE_KEY, islandDemoUntil } from "../onboarding/storage";

export type OnboardingDemo = {
  active: boolean;
  startedAt: number;
};

const OFF: OnboardingDemo = { active: false, startedAt: 0 };

export function useOnboardingDemo(): OnboardingDemo {
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
    };
  }, [active, startedAt]);
}
