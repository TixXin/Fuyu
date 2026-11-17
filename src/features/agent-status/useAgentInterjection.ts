import { useEffect, useMemo, useRef, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval.ts";
import { phasesOf, trackWaiting, type SessionPhases, type WaitingReminders } from "./alerts.ts";
import type { AgentSessionSummary } from "./api";
import { AGENT_INTERJECTION_MS, interjectingSession, remindingSession } from "./interjection.ts";
import { sessionName, type AgentSession } from "./session.ts";
import { sessionKey } from "./unseen.ts";

const REMIND_CHECK_MS = 1000;

export function useAgentInterjection(sessions: AgentSessionSummary[], enabled: boolean, remindAfterMs = 0): AgentSession | null {
  const previous = useRef<SessionPhases | null>(null);
  const reminders = useRef<WaitingReminders>({ since: new Map(), reminded: new Set() });
  const latest = useRef(sessions);
  const [flash, setFlash] = useState<{ key: string; until: number } | null>(null);
  const waiting = enabled && remindAfterMs > 0 && sessions.some((session) => session.phase === "waiting");

  useEffect(() => {
    latest.current = sessions;
    if (!enabled) {
      previous.current = null;
      return;
    }
    trackWaiting(reminders.current, sessions, Date.now());
    const changed = interjectingSession(previous.current, sessions);
    previous.current = phasesOf(sessions, previous.current);
    if (changed) setFlash({ key: sessionKey(changed), until: Date.now() + AGENT_INTERJECTION_MS });
  }, [enabled, sessions]);

  useEffect(() => {
    if (!waiting) return;
    const check = () => {
      const due = remindingSession(reminders.current, latest.current, Date.now(), remindAfterMs);
      if (due) setFlash({ key: sessionKey(due), until: Date.now() + AGENT_INTERJECTION_MS });
    };
    return visibilityInterval(check, Math.min(REMIND_CHECK_MS, Math.max(50, remindAfterMs / 4)));
  }, [waiting, remindAfterMs]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), Math.max(0, flash.until - Date.now()));
    return () => window.clearTimeout(timer);
  }, [flash]);

  return useMemo(() => {
    if (!enabled || !flash) return null;
    const shown = sessions.find((session) => sessionKey(session) === flash.key);
    return shown ? sessionName(shown) : null;
  }, [enabled, flash, sessions]);
}
