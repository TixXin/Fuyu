import type { AgentSessionSummary, ReplyMarker } from "./api";
import type { IslandSettings } from "../../lib/settings/types";
import { sessionKey } from "./unseen.ts";
import { rememberedPhase, replyEnding } from "./sessionLight.ts";
import type { AgentAlertStarted } from "./agentSettings";

export type AgentAlertKind = "started" | "completed" | "failed" | "waiting";

export type AgentAlert = { kind: AgentAlertKind; session: AgentSessionSummary };

export type AgentAlertKinds = Record<Exclude<AgentAlertKind, "started">, boolean> & { started: AgentAlertStarted };

type Phase = AgentSessionSummary["phase"];

type Turn = { startedAt: number | null; endedAt: number; reply: string | null };

export type SessionPhases = { phases: ReadonlyMap<string, Phase>; worked: ReadonlySet<string>; turns: ReadonlyMap<string, Turn> };

export const RECENT_COMPLETION_MS = 15_000;

const isWorking = (phase: Phase) => phase === "running" || phase === "waiting" || phase === "stale";

const turnOf = (session: AgentSessionSummary): Turn => ({ startedAt: session.turnStartedAt, endedAt: session.updatedAt, reply: session.lastMessage });

export function endedBetweenLooks(before: Turn | undefined, session: AgentSessionSummary, now: number) {
  if (session.phase !== "completed" || !Number.isFinite(session.updatedAt)) return false;
  if (!before) return Math.abs(now - session.updatedAt) <= RECENT_COMPLETION_MS;
  if (session.turnStartedAt != null && before.startedAt != null) return session.turnStartedAt > before.startedAt;
  return session.updatedAt > before.endedAt && session.lastMessage !== before.reply;
}

export function phasesOf(sessions: AgentSessionSummary[], previous: SessionPhases | null = null, now = Date.now()): SessionPhases {
  const worked = new Set(previous?.worked);
  const turns = new Map(previous?.turns);
  for (const session of sessions) {
    const key = sessionKey(session);
    if (!previous || isWorking(session.phase) || endedBetweenLooks(previous.turns.get(key), session, now)) worked.add(key);
    turns.set(key, turnOf(session));
  }
  return { phases: new Map(sessions.map((session) => [sessionKey(session), rememberedPhase(session)])), worked, turns };
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
  now = Date.now(),
): AgentAlert[] {
  return sessions.flatMap((session) => {
    const key = sessionKey(session);
    const ended = endedBetweenLooks(previous?.turns.get(key), session, now);
    if (!previous && !ended) return [];
    const kind = alertKind(ended ? "running" : previous?.phases.get(key), session.phase, replyEnding(session));
    if (!kind) return [];
    const on = kind === "started"
      ? kinds.started === "everyTurn" || (kinds.started === "newSession" && !previous?.worked.has(key))
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
