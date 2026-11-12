import { useCallback, useEffect, useMemo, useState } from "react";
import { agentSessionsInFront, type AgentSessionSummary } from "./api";
import { isUnseen, loadSeenTurns, markSeen, saveSeen, sessionKey, type SeenTurns } from "./unseen";

const IN_FRONT_CHECK_MS = 2000;

export type UnseenSessions = {
  keys: ReadonlySet<string>;
  markSeen: (session: AgentSessionSummary) => void;
};

export function useUnseenSessions(sessions: AgentSessionSummary[], enabled: boolean): UnseenSessions {
  const [turns, setTurns] = useState<SeenTurns>(loadSeenTurns);
  useEffect(() => saveSeen(turns.seen), [turns.seen]);
  const unseen = useMemo(
    () => (enabled ? sessions.filter((session) => isUnseen(session, turns)) : []),
    [enabled, sessions, turns],
  );

  useEffect(() => {
    if (unseen.length === 0) return;
    let cancelled = false;
    const check = async () => {
      try {
        const inFront = new Set(await agentSessionsInFront(unseen));
        const seen = unseen.filter((session) => inFront.has(session.sessionId));
        if (!cancelled && seen.length > 0) setTurns((current) => markSeen(current, seen));
      } catch (error) {
        console.error("Failed to check which agent windows are in front", error);
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), IN_FRONT_CHECK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [unseen]);

  const keys = useMemo(() => new Set(unseen.map(sessionKey)), [unseen]);
  const markSessionSeen = useCallback((session: AgentSessionSummary) => setTurns((current) => markSeen(current, [session])), []);
  return useMemo(() => ({ keys, markSeen: markSessionSeen }), [keys, markSessionSeen]);
}
