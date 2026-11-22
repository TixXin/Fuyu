import { useEffect, useRef, useState } from "react";
import { GLOW_PRIORITY, type IslandGlowContribution } from "../../plugin-kernel/islandContributions.ts";
import type { AgentSessionSummary } from "../api";

export const AGENT_WAITING_GLOW = "#ff9f43";
export const AGENT_DONE_GLOW = "#30d158";
export const AGENT_DONE_GLOW_MS = 2600;

type Phases = ReadonlyMap<string, AgentSessionSummary["phase"]>;

export function sessionPhases(sessions: readonly AgentSessionSummary[]): Map<string, AgentSessionSummary["phase"]> {
  return new Map(sessions.map((session) => [`${session.provider}:${session.sessionId}`, session.phase]));
}

export function justCompleted(before: Phases, after: Phases): boolean {
  for (const [key, phase] of after) {
    const previous = before.get(key);
    if (phase === "completed" && (previous === "running" || previous === "waiting")) return true;
  }
  return false;
}

export function agentGlow(waiting: boolean, done: boolean): IslandGlowContribution | null {
  if (waiting) return { kind: "glow", color: AGENT_WAITING_GLOW, priority: GLOW_PRIORITY.agentWaiting, reason: "agent-status.waiting", pulse: true };
  if (done) return { kind: "glow", color: AGENT_DONE_GLOW, priority: GLOW_PRIORITY.agentDone, reason: "agent-status.done" };
  return null;
}

export function useAgentGlow(sessions: readonly AgentSessionSummary[], enabled: boolean): IslandGlowContribution | null {
  const phases = useRef<Phases>(new Map());
  const [doneAt, setDoneAt] = useState(0);
  useEffect(() => {
    const next = sessionPhases(sessions);
    if (enabled && justCompleted(phases.current, next)) setDoneAt(Date.now());
    phases.current = next;
  }, [sessions, enabled]);
  useEffect(() => {
    if (doneAt === 0) return;
    const timer = window.setTimeout(() => setDoneAt(0), AGENT_DONE_GLOW_MS);
    return () => window.clearTimeout(timer);
  }, [doneAt]);
  const waiting = enabled && sessions.some((session) => session.phase === "waiting");
  return agentGlow(waiting, enabled && doneAt !== 0);
}
