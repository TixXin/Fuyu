import type { AgentSessionGroup, AgentSessionSort } from "../appearance/types";
import type { AgentSessionSummary } from "./api";
import { sessionLight, type SessionLight } from "./sessionLight.ts";
import { sessionKey } from "./unseen.ts";

const SHOWN_FIELDS = ["provider", "sessionId", "cwd", "title", "model", "effort", "phase", "lastMessage", "turnStartedAt", "lastPrompt", "permissionMode", "subagents", "replyMarker", "replyAsks", "backgroundTasks", "compacting", "closed", "contextTokens"] as const;

export function sameAgentSessions(a: AgentSessionSummary[], b: AgentSessionSummary[]) {
  return (
    a.length === b.length &&
    a.every((session, index) => {
      const other = b[index];
      return (
        SHOWN_FIELDS.every((field) => session[field] === other[field]) &&
        session.host?.exe === other.host?.exe &&
        session.host?.name === other.host?.name &&
        session.currentTool?.name === other.currentTool?.name &&
        session.currentTool?.detail === other.currentTool?.detail &&
        Math.floor(session.updatedAt / 60_000) === Math.floor(other.updatedAt / 60_000)
      );
    })
  );
}

export function countActiveSessions(sessions: AgentSessionSummary[]) {
  return sessions.filter((session) => isActivePhase(session.phase)).length;
}

export type SessionFilter = { claudeCode: boolean; codex: boolean };

export function filterSessions(sessions: AgentSessionSummary[], filter: SessionFilter) {
  const shown = sessions.filter((session) => (session.provider === "codex" ? filter.codex : filter.claudeCode));
  return shown.length === sessions.length ? sessions : shown;
}

export function isActivePhase(phase: AgentSessionSummary["phase"]) {
  return phase === "running" || phase === "waiting" || phase === "stale";
}

export function turnElapsedMs(session: AgentSessionSummary, now: number) {
  if (session.turnStartedAt === null) return null;
  const end = isActivePhase(session.phase) ? now : session.updatedAt;
  const elapsed = end - session.turnStartedAt;
  return elapsed >= 0 ? elapsed : null;
}

export function durationParts(ms: number) {
  const total = Math.floor(ms / 1000);
  return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

export function sessionProject(cwd: string | null) {
  if (!cwd) return null;
  const parts = cwd.replace(/[\\/]+$/, "").split(/[\\/]/);
  const last = parts[parts.length - 1] || null;
  if (!last) return null;
  const parent = parts[parts.length - 2] ?? "";
  if (/^\d+$/.test(last) && /.-lanes$/.test(parent)) return parent.slice(0, -"-lanes".length);
  const lane = /^(.+)-lane-\d+$/.exec(last);
  if (lane) return lane[1];
  if (parent === "worktrees" && parts[parts.length - 3] === ".claude" && parts[parts.length - 4]) return parts[parts.length - 4];
  return last;
}

export function minutesAgo(updatedAt: number, now: number) {
  return Math.max(0, Math.floor((now - updatedAt) / 60_000));
}

export function modelLabel(model: string | null, effort: string | null) {
  const effortLabel = effort ? effort.charAt(0).toUpperCase() + effort.slice(1) : null;
  return [model, effortLabel].filter(Boolean).join(" · ") || null;
}

const LIGHT_ORDER: Record<SessionLight, number> = { needs: 0, failed: 0, yourTurn: 1, working: 2, stale: 3, done: 4 };

const firstSeenAt = new Map<string, number>();

function firstSeen(session: AgentSessionSummary) {
  const key = sessionKey(session);
  const seen = firstSeenAt.get(key) ?? session.updatedAt;
  firstSeenAt.set(key, seen);
  return seen;
}

export function arrangeSessions(sessions: AgentSessionSummary[], sort: AgentSessionSort, group: AgentSessionGroup) {
  const rank = (session: AgentSessionSummary) => (sort === "status" ? LIGHT_ORDER[sessionLight(session)] : 0);
  const time = sort === "firstSeen" ? firstSeen : (session: AgentSessionSummary) => session.updatedAt;
  const sorted = [...sessions].sort((a, b) => rank(a) - rank(b) || time(b) - time(a));
  const groups = new Map<string, { key: string; host: string | null; project: string | null; sessions: AgentSessionSummary[] }>();
  const local = JSON.stringify([null, null]);
  if (group === "computer") groups.set(local, { key: local, host: null, project: null, sessions: [] });
  for (const session of sorted) {
    const host = group === "none" ? null : session.remoteHost ?? null;
    const project = group === "project" ? sessionProject(session.cwd) : null;
    const key = JSON.stringify([host, project]);
    const found = groups.get(key) ?? { key, host, project, sessions: [] };
    found.sessions.push(session);
    groups.set(key, found);
  }
  return [...groups.values()].filter((found) => found.sessions.length > 0);
}

export function formatTokens(tokens: number) {
  if (tokens < 1000) return String(Math.round(tokens));
  if (tokens < 100_000) return `${(tokens / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (tokens < 1_000_000) return `${Math.round(tokens / 1000)}k`;
  return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}