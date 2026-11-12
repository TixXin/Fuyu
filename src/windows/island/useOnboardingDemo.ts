import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentSessionSummary } from "../../features/agent-status/api";
import type { MediaState } from "../../features/media/api";
import { DEFAULT_MEDIA_STATE } from "../../features/media/mediaState";
import { useTranslation } from "../../i18n";
import { ONBOARDING_DEMO_STORAGE_KEY, islandDemoUntil } from "../onboarding/storage";

export type OnboardingDemo = {
  active: boolean;
  mediaState: MediaState | null;
  sessions: AgentSessionSummary[];
};

const OFF: OnboardingDemo = { active: false, mediaState: null, sessions: [] };

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
      mediaState: {
        ...DEFAULT_MEDIA_STATE,
        available: true,
        audioActive: true,
        audioPeak: 0.55,
        playbackStatus: "playing",
        title: text.song,
        artist: text.artist,
        positionMs: 42_000,
        durationMs: 214_000,
        sourceApp: text.source,
        updatedAt: startedAt,
      },
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

export function withDemoMedia<T extends { mediaState: MediaState }>(media: T, demo: OnboardingDemo): T {
  if (!demo.mediaState || media.mediaState.playbackStatus === "playing") return media;
  return { ...media, mediaState: demo.mediaState };
}
