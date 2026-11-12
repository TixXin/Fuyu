import { useEffect, useMemo, useState } from "react";
import type { AgentSessionSummary, ExternalAgentStatus } from "./api";
import { agentSessionExpiresAt, pickAgentSession, type AgentSession } from "./session";

export function useAgentSession(
  sessions: AgentSessionSummary[],
  others: ExternalAgentStatus[] | undefined,
  enabled: boolean,
): AgentSession | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
  }, [sessions, others]);

  useEffect(() => {
    if (!enabled) return;
    const expiresAt = agentSessionExpiresAt(sessions, others, now);
    if (expiresAt === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [enabled, now, others, sessions]);

  return useMemo(
    () => (enabled ? pickAgentSession(sessions, others, now) : null),
    [enabled, now, others, sessions],
  );
}
