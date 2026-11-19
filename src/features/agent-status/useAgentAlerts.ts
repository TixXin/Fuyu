import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { detectAlerts, phasesOf, takeDueReminders, trackWaiting, type AgentAlert, type AgentAlertKinds, type SessionPhases, type WaitingReminders } from "./alerts";
import { agentSessionsInFront, type AgentSessionSummary } from "./api";
import { addNotices, hoverNotices, pruneNotices, sameNotices, sortNotices, type AlertedNotice, type NoticeDwell, type NoticeEntry } from "./noticeDwell";

export { alertKindsOf } from "./alerts";
export type { AlertedNotice, NoticeDwell } from "./noticeDwell";

const NOTICE_TICK_MS = 200;
const REMIND_CHECK_MS = 5000;

export type AlertedSession = AlertedNotice & {
  rowHeight: number;
  measure: (rowHeight: number) => void;
  openAgentPage?: () => void;
};

export type AgentAlerts = { alerted: AlertedSession | null; stack: readonly AlertedNotice[] };

const DEFAULT_ROW_HEIGHT = 78;
const NO_NOTICES: NoticeEntry[] = [];
const notHovered = () => false;
const notLooked = () => false;

type AgentAlertOptions = {
  sessions: AgentSessionSummary[];
  kinds: AgentAlertKinds;
  dwell: NoticeDwell;
  canAlert: boolean;
  isOpenOnAgents: boolean;
  isCollapsed: boolean;
  onOpen: () => void;
  onClose: () => void;
  remindAfterMs?: number;
  onRemind?: (sessions: AgentSessionSummary[]) => void;
  looked?: (session: AgentSessionSummary) => boolean;
  isHovered?: () => boolean;
};

export function useAgentAlerts({ sessions, kinds, dwell, canAlert, isOpenOnAgents, isCollapsed, onOpen, onClose, remindAfterMs = 0, onRemind, looked = notLooked, isHovered = notHovered }: AgentAlertOptions): AgentAlerts {
  const [notices, setNotices] = useState<NoticeEntry[]>(NO_NOTICES);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
  const noticesRef = useRef<NoticeEntry[]>(NO_NOTICES);
  const phasesRef = useRef<SessionPhases | null>(null);
  const openedByAlertRef = useRef(false);
  const [ticking, setTicking] = useState(false);
  const sessionsRef = useRef(sessions);
  const latest = useRef({ dwell, canAlert, isOpenOnAgents, isCollapsed, onOpen, onClose, onRemind, looked, isHovered });
  useLayoutEffect(() => {
    latest.current = { dwell, canAlert, isOpenOnAgents, isCollapsed, onOpen, onClose, onRemind, looked, isHovered };
    sessionsRef.current = sessions;
  });

  const commit = useCallback((next: NoticeEntry[]) => {
    if (sameNotices(next, noticesRef.current)) return;
    noticesRef.current = next;
    setNotices(next);
  }, []);
  const stopAuto = useCallback(() => {
    openedByAlertRef.current = false;
    setTicking(false);
  }, []);

  useEffect(() => {
    const keepOpen = (event: PointerEvent) => {
      stopAuto();
      if (!(event.target instanceof Element && event.target.closest(".agent-sessions__list"))) commit(NO_NOTICES);
    };
    window.addEventListener("pointerdown", keepOpen, true);
    return () => window.removeEventListener("pointerdown", keepOpen, true);
  }, [commit, stopAuto]);

  const leftAgentPage = !isCollapsed && !isOpenOnAgents;
  const wasExpandedRef = useRef(!isCollapsed);
  useEffect(() => {
    const collapsedNow = isCollapsed && wasExpandedRef.current;
    wasExpandedRef.current = !isCollapsed;
    if (isCollapsed) stopAuto();
    if (collapsedNow || leftAgentPage) commit(NO_NOTICES);
  }, [isCollapsed, leftAgentPage, commit, stopAuto]);

  const refresh = useCallback((entries: NoticeEntry[], now: number) => {
    const current = latest.current;
    const next = pruneNotices(entries, sessionsRef.current, (session) => !current.looked(session), now);
    commit(next);
    if (next.length > 0) return;
    stopAuto();
    if (current.isOpenOnAgents) current.onClose();
  }, [commit, stopAuto]);

  useEffect(() => {
    if (!ticking) return;
    let hovered = false;
    const tick = () => {
      const now = Date.now();
      const hoveredNow = latest.current.isHovered();
      if (hoveredNow === hovered) return refresh(noticesRef.current, now);
      hovered = hoveredNow;
      refresh(hoverNotices(noticesRef.current, hovered, now, latest.current.dwell), now);
    };
    tick();
    const timer = window.setInterval(tick, NOTICE_TICK_MS);
    return () => window.clearInterval(timer);
  }, [ticking, refresh]);

  useEffect(() => {
    if (openedByAlertRef.current) refresh(noticesRef.current, Date.now());
  }, [sessions, refresh]);

  const popUpRef = useRef((alerts: AgentAlert[], onShown?: (shown: AgentAlert[]) => void) => {
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
        const base = openedByAlertRef.current ? noticesRef.current : NO_NOTICES;
        commit(addNotices(base, shown, current.dwell, Date.now()));
        openedByAlertRef.current = true;
        setTicking(true);
        current.onOpen();
      });
  });

  const { started, completed, failed, waiting } = kinds;
  useEffect(() => {
    const alerts = detectAlerts(phasesRef.current, sessions, { started, completed, failed, waiting });
    phasesRef.current = phasesOf(sessions, phasesRef.current);
    if (alerts.length > 0 && latest.current.canAlert) popUpRef.current(alerts);
  }, [sessions, started, completed, failed, waiting]);

  const remindersRef = useRef<WaitingReminders>({ since: new Map(), reminded: new Set() });
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
    return visibilityInterval(check, Math.min(REMIND_CHECK_MS, Math.max(50, remindAfterMs / 4)));
  }, [remindAfterMs, waiting]);

  const openAgentPage = useCallback(() => {
    stopAuto();
    commit(NO_NOTICES);
  }, [commit, stopAuto]);

  return useMemo(() => {
    const stack = sortNotices(notices).map(({ key, kind, session }): AlertedNotice => ({ key, kind, session }));
    const top = stack[0];
    return { alerted: top ? { ...top, rowHeight, measure: setRowHeight, openAgentPage } : null, stack };
  }, [notices, rowHeight, openAgentPage]);
}
