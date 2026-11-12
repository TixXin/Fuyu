import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentSessionSummary } from "./api";
import { forgetReturned, hideSession, isHidden, loadHiddenSessions, saveHiddenSessions, unhideSession } from "./hiddenSessions";
import { sessionKey } from "./unseen";

export const UNDO_MS = 5000;

export type SessionRemoval = {
  remove: (session: AgentSessionSummary) => void;
  removed: AgentSessionSummary | null;
  undo: () => void;
};

export function useHiddenSessions(sessions: AgentSessionSummary[]) {
  const [hidden, setHidden] = useState(loadHiddenSessions);
  const [removed, setRemoved] = useState<AgentSessionSummary | null>(null);

  useEffect(() => saveHiddenSessions(hidden), [hidden]);
  useEffect(() => setHidden((current) => forgetReturned(current, sessions)), [sessions]);

  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [removed]);

  const visible = useMemo(() => {
    const shown = sessions.filter((session) => !isHidden(session, hidden));
    return shown.length === sessions.length ? sessions : shown;
  }, [hidden, sessions]);

  const remove = useCallback((session: AgentSessionSummary) => {
    setHidden((current) => hideSession(current, session));
    setRemoved(session);
  }, []);
  const undo = useCallback(() => {
    if (removed) setHidden((current) => unhideSession(current, sessionKey(removed)));
    setRemoved(null);
  }, [removed]);

  const removal = useMemo<SessionRemoval>(() => ({ remove, removed, undo }), [remove, removed, undo]);
  return { visible, removal };
}
