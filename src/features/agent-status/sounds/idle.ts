import type { AgentSessionSummary } from "../api";
import { sessionKey } from "../unseen.ts";

export const IDLE_SOUND_MS = 5 * 60_000;

export type IdleSessions = { since: Map<string, number>; played: Map<string, number> };

export function emptyIdleSessions(): IdleSessions {
  return { since: new Map(), played: new Map() };
}

export function takeIdleSessions(
  state: IdleSessions,
  sessions: AgentSessionSummary[],
  unseen: ReadonlySet<string>,
  now: number,
  delayMs = IDLE_SOUND_MS,
): AgentSessionSummary[] {
  const due: AgentSessionSummary[] = [];
  const present = new Set<string>();
  for (const session of sessions) {
    const key = sessionKey(session);
    if (session.phase !== "completed" || !unseen.has(key)) continue;
    present.add(key);
    const since = state.since.get(key) ?? now;
    state.since.set(key, since);
    if (now - since >= delayMs && state.played.get(key) !== session.updatedAt) {
      state.played.set(key, session.updatedAt);
      due.push(session);
    }
  }
  for (const key of state.since.keys()) {
    if (!present.has(key)) {
      state.since.delete(key);
      state.played.delete(key);
    }
  }
  return due;
}

export function compactStarted(wasCompacting: boolean | undefined, session: Pick<AgentSessionSummary, "compacting">): boolean {
  return wasCompacting === false && session.compacting === true;
}
