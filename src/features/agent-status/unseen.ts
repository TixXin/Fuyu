import { readJson, writeJson } from "../../lib/storage.ts";
import type { AgentSessionSummary } from "./api";
import { sessionLight } from "./sessionLight.ts";

export type SeenTurns = {
  since: number;
  seen: Record<string, number>;
};

export function sessionKey(session: Pick<AgentSessionSummary, "provider" | "sessionId">) {
  return `${session.provider}:${session.sessionId}`;
}

function turnOf(session: AgentSessionSummary) {
  return session.phase === "waiting" ? session.updatedAt : session.turnStartedAt ?? session.updatedAt;
}

export function asksUser(session: AgentSessionSummary) {
  const light = sessionLight(session);
  return light === "needs" || light === "yourTurn" || light === "failed";
}

export function isUnseen(session: AgentSessionSummary, turns: SeenTurns) {
  const ended = session.phase === "completed" || session.phase === "failed";
  if (!ended && session.phase !== "waiting") return false;
  const recent = asksUser(session) || session.updatedAt > turns.since;
  return recent && turns.seen[sessionKey(session)] !== turnOf(session);
}

export const SEEN_TURNS_STORAGE_KEY = "fuyu-agent-seen-turns";
export const MAX_SEEN = 300;

export function normalizeSeen(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]),
  );
  return Object.fromEntries(entries.slice(-MAX_SEEN));
}

export function loadSeenTurns(): SeenTurns {
  return { since: Date.now(), seen: normalizeSeen(readJson(SEEN_TURNS_STORAGE_KEY)) };
}

export function saveSeen(seen: Record<string, number>) {
  writeJson(SEEN_TURNS_STORAGE_KEY, normalizeSeen(seen));
}

export function markSeen(turns: SeenTurns, sessions: AgentSessionSummary[]): SeenTurns {
  const changed = sessions.filter((session) => turns.seen[sessionKey(session)] !== turnOf(session));
  if (changed.length === 0) return turns;
  const keys = new Set(changed.map(sessionKey));
  const kept = Object.entries(turns.seen).filter(([key]) => !keys.has(key));
  const added = changed.map((session) => [sessionKey(session), turnOf(session)] as const);
  return { ...turns, seen: Object.fromEntries([...kept, ...added].slice(-MAX_SEEN)) };
}
