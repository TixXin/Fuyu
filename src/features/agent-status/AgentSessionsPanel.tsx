import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { ArchivedNotice } from "./ArchivedNotice";
import { EditorExtensionHint } from "./EditorExtensionHint";
import { useEditorExtensionHint } from "./useEditorExtensionHint";
import { useArchiveMotion } from "./useArchiveMotion";
import { useListMotion } from "./useListMotion";
import { sessionLight } from "./sessionLight";
import { useTranslation } from "../../i18n";
import { AgentUsageBar } from "./AgentUsageBar";
import type { AgentUsages, UsageView } from "./usage";
import type { UsageViewChange } from "./AgentUsageMenu";
import { focusAgentWindow, listenAgentFocusWindowOnly, type AgentSessionSummary } from "./api";
import { arrangeSessions, modelLabel, sessionProject } from "./sessionList";
import { shownEffort } from "./effortLabels";
import { useEffortLabels } from "./useEffortLabels";
import { useScrollFade } from "./useScrollFade";
import { sessionKey } from "./unseen";
import { isTestSession } from "./testNotice";
import type { UnseenSessions } from "./useUnseenSessions";
import type { SessionRemoval } from "./useHiddenSessions";
import type { AlertedNotice, AlertedSession } from "./useAgentAlerts";
import { AgentApprovalNotice } from "./approvals/AgentApprovalNotice";
import type { AgentApprovals } from "./approvals/useAgentApprovals";
import { AgentSessionNotice } from "./notice/AgentSessionNotice";
import { DEFAULT_AGENT_NOTICE_OPTIONS, type AgentNoticeOptions } from "./notice/noticeOptions";
import { AgentNoticeStack } from "./notice/AgentNoticeStack";
import { AgentNoticeWings } from "./notice/AgentNoticeWings";
import { stackItemOf } from "./notice/noticeStack";
import { useNotchBandLive } from "./notice/useNotchBandLive";
import type { AgentArchiveMotion, AgentCardEffects, AgentHostDisplay, AgentNoticeNotch, AgentNoticeStack as NoticeStackMode, AgentSessionGroup, AgentSessionSort, AgentSessionView } from "./agentSettings";
import { useSessionKeyboard } from "./useSessionKeyboard";
import { useFocusNotFoundReason } from "./useFocusNotFoundReason";
import { listedSubagents } from "./AgentSubagents";
import { nestSessions, type NestedSessions } from "./sessionChildren";
import { useRowExpansion } from "./useRowExpansion";
import { buildSessionItem } from "./views/buildSessionItems";
import { FocusedSessionsView } from "./views/FocusedSessionsView";
import { SplitSessionsView } from "./views/SplitSessionsView";
import { BentoSessionsView } from "./views/BentoSessionsView";
import { ProjectsSessionsView } from "./views/ProjectsSessionsView";
import { MinimalSessionsView } from "./views/MinimalSessionsView";
import type { SessionViewGroup, SessionViewProps } from "./views/types";
import "./AgentSessionsPanel.css";
import "./AgentSessionRow.css";
import "./AgentSessionCard.css";
import "./AgentCardEffects.css";
import "./views/AgentViewsBase.css";

const NOT_FOUND_NOTICE_MS = 3000;
const AGE_REFRESH_MS = 30_000;

export function AgentSessionsPanel({
  sessions: listed,
  view = "focused",
  sort = "status",
  group = "computer",
  archiveMotion = "slide",
  cardEffects = "off",
  hostDisplay,
  showElapsed = true,
  showModel = true,
  showActivity = true,
  expandChildren = false,
  unseen,
  removal,
  reveal,
  stack = [],
  stackMode = "peek",
  notch = "band",
  showUsage: usageOn = false,
  usages,
  usageView,
  empty,
  approvals,
  notice = DEFAULT_AGENT_NOTICE_OPTIONS,
  onOpenAgentPage,
}: {
  sessions: AgentSessionSummary[];
  view?: AgentSessionView;
  sort?: AgentSessionSort;
  group?: AgentSessionGroup;
  archiveMotion?: AgentArchiveMotion;
  cardEffects?: AgentCardEffects;
  hostDisplay: AgentHostDisplay;
  showElapsed?: boolean;
  showModel?: boolean;
  showActivity?: boolean;
  expandChildren?: boolean;
  unseen?: UnseenSessions;
  removal?: SessionRemoval;
  reveal?: AlertedSession | null;
  stack?: readonly AlertedNotice[];
  stackMode?: NoticeStackMode;
  notch?: AgentNoticeNotch;
  showUsage?: boolean;
  usages?: AgentUsages;
  usageView?: UsageView & { onChange?: UsageViewChange };
  empty?: ReactNode;
  approvals?: AgentApprovals;
  notice?: AgentNoticeOptions;
  onOpenAgentPage?: () => void;
}) {
  const t = useTranslation();
  const notchLive = useNotchBandLive();
  const statusInBand = notch === "band" && notchLive;
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const shown = (reveal && stack.find((entry) => entry.key === pickedKey)) || reveal;
  const sessions = shown ? [listed.find((session) => sessionKey(session) === shown.key) ?? shown.session] : listed;
  const showUsage = usageOn && !reveal;
  const [now, setNow] = useState(() => Date.now());
  const effortLabels = useEffortLabels();
  const [notFoundId, setNotFoundId] = useState<string | null>(null);
  const [rowNotice, setRowNotice] = useState<{ key: string; text: string } | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const openSubagents = useRowExpansion(expandChildren);
  const openChildren = useRowExpansion(expandChildren);
  const extensionHint = useEditorExtensionHint();
  const notFoundReason = useFocusNotFoundReason(!reveal);
  const list = useScrollFade<HTMLUListElement>(sessions);
  const motion = useArchiveMotion(list.element, removal, archiveMotion);
  const nested: NestedSessions = !reveal && (view === "focused" || view === "minimal") ? nestSessions(sessions) : { roots: sessions, children: new Map() };
  const childDepth = new Map([...nested.children.values()].flat().map((child) => [sessionKey(child.session), child.depth]));
  const shownChildren = (key: string) => (openChildren.isOpen(key) ? nested.children.get(key) ?? [] : []);
  const arranged = arrangeSessions(nested.roots, sort, group).map((entry, _, groups) => ({
    ...entry,
    heading: !reveal && (group === "project" || (group === "computer" && (groups.length > 1 || entry.host !== null))),
  }));

  const projectMotionEntries = view === "projects"
    ? (() => {
        const seen = new Set<string>();
        return arranged.flatMap(({ sessions: members }) =>
          members.flatMap((session) => {
            const name = sessionProject(session.cwd) ?? t.agent.sessions.noProject;
            const host = session.remoteHost ?? null;
            const projKey = `proj:${host ?? ""}::${name}`;
            const head = seen.has(projKey) ? [] : (seen.add(projKey), [{ key: projKey }]);
            return [...head, { key: sessionKey(session), light: sessionLight(session), open: openSubagents.isOpen(sessionKey(session)) ? listedSubagents(session).length : 0 }];
          }),
        );
      })()
    : arranged.flatMap(({ key, heading, sessions: members }) => [
        ...(heading ? [{ key: `group:${key}` }] : []),
        ...members.flatMap((root) => [root, ...shownChildren(sessionKey(root)).map((child) => child.session)]).map((session) => ({
          key: sessionKey(session),
          light: sessionLight(session),
          open: openSubagents.isOpen(sessionKey(session)) ? listedSubagents(session).length : 0,
        })),
      ]);

  useListMotion(
    list.element,
    projectMotionEntries,
    view,
    !reveal && !approvals?.current,
    motion.returning,
  );

  const cardRef = useRef<HTMLLIElement>(null);
  const measure = reveal?.measure;
  const cardKey = shown?.key;

  useLayoutEffect(() => {
    const row = cardRef.current;
    if (!measure || !row) return;
    const report = () => measure(row.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(row);
    return () => observer.disconnect();
  }, [measure, cardKey]);

  const keepSubagents = openSubagents.keep;
  useEffect(() => {
    keepSubagents(new Set(listed.filter((session) => listedSubagents(session).length > 0).map(sessionKey)));
  }, [listed, keepSubagents]);

  useEffect(() => visibilityInterval(() => setNow(Date.now()), AGE_REFRESH_MS), []);

  useEffect(() => {
    if (!rowNotice) return;
    const timer = window.setTimeout(() => setRowNotice(null), NOT_FOUND_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [rowNotice]);

  useEffect(() => {
    if (!notFoundId) return;
    const timer = window.setTimeout(() => setNotFoundId(null), NOT_FOUND_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notFoundId]);

  const windowOnlyText = t.agent.sessions.windowOnly;
  useEffect(() => {
    if (reveal) return;
    let disposed = false;
    const unlisten = listenAgentFocusWindowOnly((payload) => {
      if (disposed) return;
      setRowNotice({ key: `${payload.provider}:${payload.sessionId}`, text: windowOnlyText });
    }).catch(() => undefined);
    return () => {
      disposed = true;
      void unlisten.then((stop) => stop?.());
    };
  }, [reveal, windowOnlyText]);

  const keyboard = useSessionKeyboard(
    removal && !reveal
      ? (key) => {
          const session = sessions.find((candidate) => sessionKey(candidate) === key);
          if (session) motion.archive(session);
        }
      : null,
  );

  const focus = (session: AgentSessionSummary) => {
    if (isTestSession(session)) return;
    setNotFoundId(null);
    setRowNotice(null);
    notFoundReason.clear();
    unseen?.markSeen(session);
    void focusAgentWindow(session.provider, session.cwd, session.title, session.remoteHost ? "" : session.sessionId)
      .then((found) => {
        if (!found) setNotFoundId(session.sessionId);
      })
      .catch((error) => {
        console.error("Failed to focus the agent window", error);
        setNotFoundId(session.sessionId);
      });
  };

  if (approvals?.current) {
    return <AgentApprovalNotice approvals={approvals} sessions={listed} notice={notice} stackMode={stackMode} notch={notch} statusInBand={statusInBand} />;
  }

  if (shown && sessions[0]) {
    const session = sessions[0];
    const entries = stack.length > 0 ? stack : [shown];
    const items = entries.map((entry) => stackItemOf(entry.key, listed.find((listedSession) => sessionKey(listedSession) === entry.key) ?? entry.session, t.agentNotice.state));
    return (
      <section className="agent-sessions agent-sessions--notice" aria-label={t.agent.sessions.title}>
        <AgentNoticeWings mode={stackMode} notch={notch} items={items} activeKey={shown.key} />
        <ul ref={list.ref} className="agent-sessions__list agent-sessions__list--notice">
          <li ref={cardRef} data-session-key={shown.key}>
            <AgentNoticeStack mode={stackMode} notch={notch} items={items} activeKey={shown.key} onSelect={setPickedKey}>
              {({ count, icon }) => (
                <AgentSessionNotice
                  session={session}
                  options={notice}
                  model={showModel ? modelLabel(session.model, shownEffort(session.provider, session.effort, effortLabels)) : null}
                  count={count}
                  icon={icon}
                  onOpen={() => focus(session)}
                  onOpenAgentPage={onOpenAgentPage}
                  statusInBand={statusInBand}
                />
              )}
            </AgentNoticeStack>
          </li>
        </ul>
      </section>
    );
  }

  const removedNotice = removal && !reveal && <ArchivedNotice removed={removal.removed} onUndo={motion.undo} />;

  if (sessions.length === 0) {
    return (
      <section className="agent-sessions" aria-label={t.agent.sessions.title}>
        {empty ?? <>{showUsage && <div className="agent-sessions__usage"><AgentUsageBar usages={usages} view={usageView} onViewChange={usageView?.onChange} /></div>}<div className="agent-sessions__empty"><strong>{t.agent.sessions.empty}</strong><span>{t.agent.sessions.emptyHint}</span></div></>}
        {removedNotice}
      </section>
    );
  }

  const itemContext = {
    t,
    now,
    effortLabels,
    nested,
    childDepth,
    showElapsed,
    showModel,
    cardEffects,
    unseen,
    removal,
    notFoundId,
    notFoundReasonFor: notFoundReason.reasonFor,
    rowNotice,
    menuKey,
    openSubagents,
    openChildren,
    onFocus: focus,
    onArchiveSession: motion.archive,
    onRowNotice: setRowNotice,
    onMenuOpenChange: (key: string, open: boolean) => setMenuKey((current) => (open ? key : current === key ? null : current)),
  };

  const viewGroups: SessionViewGroup[] = arranged.map(({ key, host, project, heading, sessions: members }) => ({
    key,
    host,
    project,
    heading,
    items: members.flatMap((root) => [root, ...shownChildren(sessionKey(root)).map((child) => child.session)]).map((session) => buildSessionItem(session, itemContext)),
  }));
  const viewProps: SessionViewProps = {
    groups: viewGroups,
    items: viewGroups.flatMap((entry) => entry.items),
    hostDisplay,
    showElapsed,
    showModel,
    showActivity,
    cardEffects,
    hasRemoval: Boolean(removal),
    hasMenu: true,
    listRef: list.ref,
    fade: list.fade,
    onScroll: list.onScroll,
    onKeyDown: keyboard.onKeyDown,
    onContextMenu: keyboard.onContextMenu,
  };

  const renderView = () => {
    switch (view) {
      case "split":
        return <SplitSessionsView {...viewProps} />;
      case "bento":
        return <BentoSessionsView {...viewProps} />;
      case "projects":
        return <ProjectsSessionsView {...viewProps} />;
      case "minimal":
        return <MinimalSessionsView {...viewProps} />;
      default:
        return <FocusedSessionsView {...viewProps} />;
    }
  };

  return (
    <section className="agent-sessions" data-view={view} aria-label={t.agent.sessions.title}>
      {showUsage && (
        <div className="agent-sessions__usage">
          <AgentUsageBar usages={usages} view={usageView} onViewChange={usageView?.onChange} />
        </div>
      )}
      <div key={view} className="agent-sessions__stage">
        {renderView()}
      </div>
      {removedNotice}
      {!removal?.removed && <EditorExtensionHint hint={extensionHint} />}
    </section>
  );
}
