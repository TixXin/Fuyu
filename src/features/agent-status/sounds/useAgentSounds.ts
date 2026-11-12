import { useEffect, useLayoutEffect, useRef } from "react";
import { agentSessionsInFront, type AgentSessionSummary } from "../api";
import { sessionKey } from "../unseen";
import { rememberedPhase } from "../sessionLight";
import { soundFor, type AgentSoundEvent } from "./events";
import { compactStarted, emptyIdleSessions, takeIdleSessions } from "./idle";
import { playAgentSound } from "./player";
import type { AgentSoundSettings } from "./storage";
import { useAgentSoundSettings } from "./useAgentSoundSettings";

const PRIORITY: AgentSoundEvent[] = ["error", "approval", "question", "complete", "compact", "idle", "start", "ack"];

const IDLE_CHECK_MS = 30_000;

type Seen = { phase: AgentSessionSummary["phase"]; compacting: boolean };
type Change = { event: AgentSoundEvent; session: AgentSessionSummary };

export function useAgentSounds(sessions: AgentSessionSummary[], canPlay: boolean, unseen: ReadonlySet<string> = new Set()) {
  const [settings] = useAgentSoundSettings();
  const seenRef = useRef<Map<string, Seen> | null>(null);
  const idleRef = useRef(emptyIdleSessions());
  const latest = useRef({ settings, canPlay, sessions, unseen });
  useLayoutEffect(() => {
    latest.current = { settings, canPlay, sessions, unseen };
  });

  useEffect(() => {
    const previous = seenRef.current;
    seenRef.current = new Map(sessions.map((session) => [sessionKey(session), { phase: rememberedPhase(session), compacting: session.compacting === true }]));
    if (!previous) return;
    const changes = sessions.flatMap((session): Change[] => {
      const before = previous.get(sessionKey(session));
      const event = soundFor(before?.phase, session.phase, session);
      if (event) return [{ event, session }];
      return compactStarted(before?.compacting, session) ? [{ event: "compact", session }] : [];
    });
    playOne(changes, latest.current);
  }, [sessions]);

  useEffect(() => {
    const check = () => {
      const { sessions: current, unseen: unread } = latest.current;
      const due = takeIdleSessions(idleRef.current, current, unread, Date.now());
      playOne(due.map((session) => ({ event: "idle", session })), latest.current);
    };
    const timer = window.setInterval(check, IDLE_CHECK_MS);
    return () => window.clearInterval(timer);
  }, []);
}

function playOne(candidates: Change[], { settings, canPlay }: { settings: AgentSoundSettings; canPlay: boolean }) {
  if (!canPlay || !settings.enabled) return;
  const changes = candidates.filter((change) => settings.events[change.event]);
  if (changes.length === 0) return;
  const pick = (from: Change[]) => PRIORITY.map((event) => from.find((change) => change.event === event)).find(Boolean);
  const needsCheck = changes.filter((change) => change.event !== "start" && change.event !== "ack");
  if (!settings.quietWhenInFront || needsCheck.length === 0) {
    const chosen = pick(changes);
    if (chosen) playAgentSound(chosen.event, settings);
    return;
  }
  void agentSessionsInFront(needsCheck.map((change) => change.session))
    .catch((error: unknown) => {
      console.error("Failed to check which agent windows are in front", error);
      return [] as string[];
    })
    .then((inFront) => {
      const chosen = pick(changes.filter((change) => !inFront.includes(change.session.sessionId)));
      if (chosen) playAgentSound(chosen.event, settings);
    });
}
