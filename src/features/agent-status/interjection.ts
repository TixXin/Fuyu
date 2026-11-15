import { detectAlerts, takeDueReminders, type AgentAlertKinds, type SessionPhases, type WaitingReminders } from "./alerts.ts";
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

export function remindingSession(state: WaitingReminders, sessions: AgentSessionSummary[], now: number, delayMs: number): AgentSessionSummary | null {
  if (delayMs <= 0) return null;
  return latest(takeDueReminders(state, sessions, now, delayMs).filter(named));
}
