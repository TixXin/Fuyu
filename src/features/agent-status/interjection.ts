import { detectAlerts, type AgentAlertKinds, type SessionPhases } from "./alerts.ts";
import type { AgentSessionSummary } from "./api";
import { sessionName } from "./session.ts";

export const AGENT_INTERJECTION_MS = 4000;

const INTERJECTING: AgentAlertKinds = { started: "newSession", completed: true, failed: true, waiting: true };

const named = (session: AgentSessionSummary) => sessionName(session).title !== "";
const latest = (sessions: AgentSessionSummary[]) =>
  sessions.reduce<AgentSessionSummary | null>((found, session) => (!found || session.updatedAt > found.updatedAt ? session : found), null);

export function interjectingSession(previous: SessionPhases | null, sessions: AgentSessionSummary[]): AgentSessionSummary | null {
  return latest(detectAlerts(previous, sessions, INTERJECTING).map((alert) => alert.session).filter(named));
}

export function waitingSession(sessions: AgentSessionSummary[]): AgentSessionSummary | null {
  return latest(sessions.filter((session) => session.phase === "waiting" && named(session)));
}
