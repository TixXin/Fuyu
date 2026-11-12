import type { AgentSessionSummary, ReplyMarker } from "./api";
import type { AgentAlertStarted, IslandSettings } from "../appearance/types";
import { sessionKey } from "./unseen.ts";
import { rememberedPhase, replyEnding } from "./sessionLight.ts";

export type AgentAlertKind = "started" | "completed" | "failed" | "waiting";

export type AgentAlert = { kind: AgentAlertKind; session: AgentSessionSummary };

export type AgentAlertKinds = Record<Exclude<AgentAlertKind, "started">, boolean> & { started: AgentAlertStarted };

type Phase = AgentSessionSummary["phase"];

export type SessionPhases = { phases: ReadonlyMap<string, Phase>; worked: ReadonlySet<string> };

const isWorking = (phase: Phase) => phase === "running" || phase === "waiting" || phase === "stale";

export function phasesOf(sessions: AgentSessionSummary[], previous: SessionPhases | null = null): SessionPhases {
  const worked = new Set(previous?.worked);
  for (const session of sessions) {
    if (!previous || isWorking(session.phase)) worked.add(sessionKey(session));
  }
  return { phases: new Map(sessions.map((session) => [sessionKey(session), rememberedPhase(session)])), worked };
}

export function alertKindsOf(settings: Pick<IslandSettings, "agentAlertStarted" | "agentAlertCompleted" | "agentAlertFailed" | "agentAlertWaiting">): AgentAlertKinds {
  return { started: settings.agentAlertStarted, completed: settings.agentAlertCompleted, failed: settings.agentAlertFailed, waiting: settings.agentAlertWaiting };
}

export function alertKind(before: Phase | undefined, after: Phase, marker: ReplyMarker | null = null): AgentAlertKind | null {
  if (after === "waiting" && before !== "waiting") return "waiting";
  if (after === "running" && (before === undefined || before === "completed" || before === "failed")) return "started";
  if (before === undefined) return null;
  if (after === "failed" && before !== "failed") return "failed";
  if (after === "completed" && (before === "running" || before === "waiting" || before === "stale")) {
    return marker === "yourTurn" ? "waiting" : marker === "background" ? null : "completed";
  }
  return null;
}

export function detectAlerts(
  previous: SessionPhases | null,
  sessions: AgentSessionSummary[],
  kinds: AgentAlertKinds,
): AgentAlert[] {
  if (!previous) return [];
  return sessions.flatMap((session) => {
    const key = sessionKey(session);
    const kind = alertKind(previous.phases.get(key), session.phase, replyEnding(session));
    if (!kind) return [];
    const on = kind === "started"
      ? kinds.started === "everyTurn" || (kinds.started === "newSession" && !previous.worked.has(key))
      : kinds[kind];
    return on ? [{ kind, session }] : [];
  });
}

export function isWaitingOnUser(session: AgentSessionSummary) {
  return session.phase === "waiting" || (session.phase === "completed" && session.replyMarker === "yourTurn");
}

export type WaitingReminders = { since: Map<string, number>; reminded: Set<string> };

export function trackWaiting(state: WaitingReminders, sessions: AgentSessionSummary[], now: number) {
  const waiting = new Set<string>();
  for (const session of sessions) {
    if (!isWaitingOnUser(session)) continue;
    const key = sessionKey(session);
    waiting.add(key);
    if (!state.since.has(key)) state.since.set(key, now);
  }
  for (const key of [...state.since.keys()]) {
    if (!waiting.has(key)) {
      state.since.delete(key);
      state.reminded.delete(key);
    }
  }
}

export function takeDueReminders(state: WaitingReminders, sessions: AgentSessionSummary[], now: number, delayMs: number, looked: (session: AgentSessionSummary) => boolean = () => false) {
  trackWaiting(state, sessions, now);
  const due: AgentSessionSummary[] = [];
  for (const session of sessions) {
    const key = sessionKey(session);
    const since = state.since.get(key);
    if (since !== undefined && now - since >= delayMs && !state.reminded.has(key) && !looked(session)) {
      state.reminded.add(key);
      due.push(session);
    }
  }
  return due;
}
