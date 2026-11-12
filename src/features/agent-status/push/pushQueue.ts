import type { AgentAlert } from "../alerts";
import type { AgentSessionSummary } from "../api";
import { rememberedPhase } from "../sessionLight.ts";
import { sessionKey } from "../unseen.ts";

export const MAX_PUSHES = 3;

type Pending = AgentAlert & { phase: AgentSessionSummary["phase"] };

export type PushQueue = Map<string, Pending>;

export function queuePushes(queue: PushQueue, alerts: AgentAlert[]) {
  for (const alert of alerts) {
    const key = sessionKey(alert.session);
    queue.delete(key);
    queue.set(key, { ...alert, phase: rememberedPhase(alert.session) });
  }
}

export function takeDuePushes(
  queue: PushQueue,
  sessions: AgentSessionSummary[],
  away: boolean,
  looked: (session: AgentSessionSummary) => boolean,
): AgentAlert[] {
  const current = new Map(sessions.map((session) => [sessionKey(session), session]));
  for (const [key, pending] of queue) {
    const session = current.get(key);
    if (!session || rememberedPhase(session) !== pending.phase || looked(session)) queue.delete(key);
  }
  if (!away) return [];
  const due = [...queue.entries()].map(([key, { kind, session }]) => ({ kind, session: current.get(key) ?? session }));
  queue.clear();
  return due.slice(-MAX_PUSHES);
}
