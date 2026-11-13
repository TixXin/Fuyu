import type { AgentSessionSummary, AgentTaskStatus, ExternalAgentStatus, SessionProvider } from "./api";
import { sessionProject } from "./sessionList.ts";
import { AGENT_PROVIDER_LABELS } from "./status.ts";

export const COMPLETED_TITLE_HOLD_MS = 3000;

export type AgentSession = {
  provider: SessionProvider | null;
  label: string;
  title: string;
};

type Candidate = { session: AgentSession; phase: AgentTaskStatus["phase"]; updatedAt: number };

export function sessionName(summary: AgentSessionSummary): AgentSession {
  return {
    provider: summary.provider,
    label: AGENT_PROVIDER_LABELS[summary.provider],
    title: (summary.title ?? sessionProject(summary.cwd) ?? "").trim(),
  };
}

function candidates(sessions: AgentSessionSummary[], others: ExternalAgentStatus[] | undefined): Candidate[] {
  const fromSessions = sessions.map((summary) => ({
    session: sessionName(summary),
    phase: summary.phase,
    updatedAt: summary.updatedAt,
  }));
  const fromOthers = (others ?? []).map((other) => ({
    session: { provider: null, label: other.name, title: (other.title ?? "").trim() },
    phase: other.phase,
    updatedAt: other.updatedAt,
  }));
  return [...fromSessions, ...fromOthers].filter((candidate) => candidate.session.title);
}

function isVisible({ phase, updatedAt }: Candidate, now: number) {
  return (
    phase === "running" ||
    phase === "waiting" ||
    phase === "failed" ||
    phase === "stale" ||
    (phase === "completed" && now - updatedAt < COMPLETED_TITLE_HOLD_MS)
  );
}

export function pickAgentSession(
  sessions: AgentSessionSummary[],
  others: ExternalAgentStatus[] | undefined,
  now: number,
): AgentSession | null {
  let picked: Candidate | null = null;
  for (const candidate of candidates(sessions, others)) {
    if (isVisible(candidate, now) && (!picked || candidate.updatedAt > picked.updatedAt)) {
      picked = candidate;
    }
  }
  return picked?.session ?? null;
}

export function agentSessionExpiresAt(
  sessions: AgentSessionSummary[],
  others: ExternalAgentStatus[] | undefined,
  now: number,
): number | null {
  const expiries = candidates(sessions, others)
    .filter((candidate) => candidate.phase === "completed")
    .map((candidate) => candidate.updatedAt + COMPLETED_TITLE_HOLD_MS)
    .filter((expiresAt) => expiresAt > now);
  return expiries.length > 0 ? Math.min(...expiries) : null;
}
