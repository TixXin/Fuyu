import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { detectAlerts, phasesOf, takeDueReminders, trackWaiting, type AgentAlert, type AgentAlertKind, type AgentAlertKinds, type SessionPhases, type WaitingReminders } from "./alerts";
import { agentSessionsInFront, type AgentSessionSummary } from "./api";
import { sessionKey } from "./unseen";

export { alertKindsOf } from "./alerts";

const HOVER_RETRY_MS = 1000;
const REMIND_CHECK_MS = 5000;

export type AlertedSession = {
  key: string;
  kind: AgentAlertKind;
  session: AgentSessionSummary;
  rowHeight: number;
  measure: (rowHeight: number) => void;
};

const DEFAULT_ROW_HEIGHT = 78;

type AgentAlertOptions = {
  sessions: AgentSessionSummary[];
  kinds: AgentAlertKinds;
  durationMs: number;
  canAlert: boolean;
  isOpenOnAgents: boolean;
  isCollapsed: boolean;
  onOpen: () => void;
  onClose: () => void;
  remindAfterMs?: number;
  onRemind?: (sessions: AgentSessionSummary[]) => void;
  looked?: (session: AgentSessionSummary) => boolean;
};

export function useAgentAlerts({ sessions, kinds, durationMs, canAlert, isOpenOnAgents, isCollapsed, onOpen, onClose, remindAfterMs = 0, onRemind, looked }: AgentAlertOptions) {
  const [alerted, setAlerted] = useState<Pick<AlertedSession, "key" | "kind" | "session"> | null>(null);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
  const phasesRef = useRef<SessionPhases | null>(null);
  const openedByAlertRef = useRef(false);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const latest = useRef({ durationMs, canAlert, isOpenOnAgents, isCollapsed, onOpen, onClose, onRemind, looked });
  useLayoutEffect(() => {
    latest.current = { durationMs, canAlert, isOpenOnAgents, isCollapsed, onOpen, onClose, onRemind, looked };
  });

  useEffect(() => {
    const keepOpen = (event: PointerEvent) => {
      openedByAlertRef.current = false;
      window.clearTimeout(closeTimerRef.current);
      if (!(event.target instanceof Element && event.target.closest(".agent-sessions__list"))) setAlerted(null);
    };
    window.addEventListener("pointerdown", keepOpen, true);
    return () => {
      window.removeEventListener("pointerdown", keepOpen, true);
      window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isCollapsed) {
      openedByAlertRef.current = false;
      window.clearTimeout(closeTimerRef.current);
    }
  }, [isCollapsed]);

  const leftAgentPage = !isCollapsed && !isOpenOnAgents;
  const wasExpandedRef = useRef(!isCollapsed);
  useEffect(() => {
    const collapsedNow = isCollapsed && wasExpandedRef.current;
    wasExpandedRef.current = !isCollapsed;
    if (collapsedNow || leftAgentPage) setAlerted(null);
  }, [isCollapsed, leftAgentPage]);

  const popUpRef = useRef((alerts: AgentAlert[], onShown?: (shown: AgentAlert[]) => void) => {
    const close = () => {
      if (!openedByAlertRef.current) return;
      if (document.hasFocus()) {
        closeTimerRef.current = window.setTimeout(close, HOVER_RETRY_MS);
        return;
      }
      openedByAlertRef.current = false;
      if (latest.current.isOpenOnAgents) latest.current.onClose();
    };

    void agentSessionsInFront(alerts.map((alert) => alert.session))
      .catch((error: unknown) => {
        console.error("Failed to check which agent windows are in front", error);
        return [] as string[];
      })
      .then((inFront) => {
        const shown = alerts.filter((alert) => !inFront.includes(alert.session.sessionId));
        const current = latest.current;
        if (shown.length === 0 || !current.canAlert) return;
        onShown?.(shown);
        if (!(current.isCollapsed || openedByAlertRef.current)) return;
        const newest = shown[shown.length - 1];
        setAlerted({ key: sessionKey(newest.session), kind: newest.kind, session: newest.session });
        openedByAlertRef.current = true;
        current.onOpen();
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = window.setTimeout(close, current.durationMs);
      });
  });

  const { started, completed, failed, waiting } = kinds;
  useEffect(() => {
    const alerts = detectAlerts(phasesRef.current, sessions, { started, completed, failed, waiting });
    phasesRef.current = phasesOf(sessions, phasesRef.current);
    if (alerts.length > 0 && latest.current.canAlert) popUpRef.current(alerts);
  }, [sessions, started, completed, failed, waiting]);

  const remindersRef = useRef<WaitingReminders>({ since: new Map(), reminded: new Set() });
  const sessionsRef = useRef(sessions);
  useLayoutEffect(() => {
    sessionsRef.current = sessions;
  });
  useEffect(() => {
    if (remindAfterMs > 0) trackWaiting(remindersRef.current, sessions, Date.now());
  }, [sessions, remindAfterMs]);
  useEffect(() => {
    if (remindAfterMs <= 0 || !waiting) return;
    const check = () => {
      const due = takeDueReminders(remindersRef.current, sessionsRef.current, Date.now(), remindAfterMs, latest.current.looked);
      if (due.length > 0 && latest.current.canAlert) {
        popUpRef.current(due.map((session) => ({ kind: "waiting", session })), (shown) => latest.current.onRemind?.(shown.map((alert) => alert.session)));
      }
    };
    check();
    const timer = window.setInterval(check, Math.min(REMIND_CHECK_MS, Math.max(50, remindAfterMs / 4)));
    return () => window.clearInterval(timer);
  }, [remindAfterMs, waiting]);

  return useMemo(
    () => (alerted ? { ...alerted, rowHeight, measure: setRowHeight } : null),
    [alerted, rowHeight],
  );
}
