import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Archive } from "lucide-react";
import { ArchivedNotice } from "./ArchivedNotice";
import { EditorExtensionHint } from "./EditorExtensionHint";
import { useEditorExtensionHint } from "./useEditorExtensionHint";
import { useArchiveMotion } from "./useArchiveMotion";
import { useTranslation } from "../../i18n";
import type { AgentArchiveMotion, AgentCardEffects, AgentHostDisplay, AgentSessionGroup, AgentSessionSort, AgentSessionView } from "../appearance/types";
import { AgentSessionCard } from "./AgentSessionCard";
import { AgentProviderIcon } from "./AgentProviderIcon";
import { AgentUsageBar } from "./AgentUsageBar";
import type { AgentUsages } from "./usage";
import { focusAgentWindow, type AgentSessionSummary } from "./api";
import { arrangeSessions, isActivePhase, minutesAgo, modelLabel, sessionProject } from "./sessionList";
import { shownEffort } from "./effortLabels";
import { useEffortLabels } from "./useEffortLabels";
import { SessionBody } from "./SessionBody";
import { SessionElapsed } from "./SessionElapsed";
import { SessionHostLabel } from "./SessionHostLabel";
import { AGENT_PROVIDER_LABELS, getAgentPhaseLabel } from "./status";
import { useScrollFade } from "./useScrollFade";
import { asksUser, sessionKey } from "./unseen";
import { sessionLight } from "./sessionLight";
import type { UnseenSessions } from "./useUnseenSessions";
import type { SessionRemoval } from "./useHiddenSessions";
import type { AlertedSession } from "./useAgentAlerts";
import { AgentApprovalCard } from "./approvals/AgentApprovalCard";
import { AgentQuestionCard } from "./approvals/AgentQuestionCard";
import type { AgentApprovals } from "./approvals/useAgentApprovals";
import "./AgentSessionsPanel.css";

const NOT_FOUND_NOTICE_MS = 3000;
const AGE_REFRESH_MS = 30_000;

export function AgentSessionsPanel({
  sessions: listed,
  view = "list",
  sort = "status",
  group = "computer",
  archiveMotion = "slide",
  cardEffects = "off",
  hostDisplay,
  showElapsed = true,
  showModel = true,
  showActivity = true,
  unseen,
  removal,
  reveal,
  showUsage: usageOn = false,
  usages,
  approvals,
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
  unseen?: UnseenSessions;
  removal?: SessionRemoval;
  reveal?: AlertedSession | null;
  showUsage?: boolean;
  usages?: AgentUsages;
  approvals?: AgentApprovals;
}) {
  const t = useTranslation();
  const sessions = reveal ? [listed.find((session) => sessionKey(session) === reveal.key) ?? reveal.session] : listed;
  const showUsage = usageOn && !reveal;
  const [now, setNow] = useState(() => Date.now());
  const effortLabels = useEffortLabels();
  const [notFoundId, setNotFoundId] = useState<string | null>(null);
  const extensionHint = useEditorExtensionHint();
  const list = useScrollFade<HTMLUListElement>(sessions);
  const motion = useArchiveMotion(list.element, removal, archiveMotion);
  const cardRef = useRef<HTMLLIElement>(null);
  const measure = reveal?.measure;
  const cardKey = reveal?.key;

  useLayoutEffect(() => {
    const row = cardRef.current;
    if (!measure || !row) return;
    const report = () => measure(row.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(row);
    return () => observer.disconnect();
  }, [measure, cardKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), AGE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notFoundId) return;
    const timer = window.setTimeout(() => setNotFoundId(null), NOT_FOUND_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notFoundId]);

  const focus = (session: AgentSessionSummary) => {
    setNotFoundId(null);
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
    return (
      <section className="agent-sessions" aria-label={t.agent.sessions.title}>
        {approvals.current.kind === "question" ? (
          <AgentQuestionCard approvals={approvals} sessions={listed} />
        ) : (
          <AgentApprovalCard approvals={approvals} sessions={listed} />
        )}
      </section>
    );
  }

  const removedNotice = removal && !reveal && <ArchivedNotice removed={removal.removed} onUndo={motion.undo} />;

  if (sessions.length === 0) {
    return (
      <section className="agent-sessions" aria-label={t.agent.sessions.title}>
        {showUsage && <AgentUsageBar usages={usages} />}
        <div className="agent-sessions__empty">
          <strong>{t.agent.sessions.empty}</strong>
          <span>{t.agent.sessions.emptyHint}</span>
        </div>
        {removedNotice}
      </section>
    );
  }

  return (
    <section className="agent-sessions" aria-label={t.agent.sessions.title}>
      {showUsage && <AgentUsageBar usages={usages} />}
      <ul
        ref={list.ref}
        className={`agent-sessions__list${view === "list" ? "" : ` agent-sessions__list--${view}`}${removal && !reveal ? " agent-sessions__list--archivable" : ""}`}
        data-fade-top={list.fade.top || undefined}
        data-fade-bottom={list.fade.bottom || undefined}
        onScroll={list.onScroll}
      >
        {arrangeSessions(sessions, sort, group).flatMap(({ key: groupKey, host, project, sessions: members }, _, groups) => [
          !reveal && (group === "project" || (group === "computer" && (groups.length > 1 || host !== null))) ? (
            <li key={`group:${groupKey}`} className="agent-sessions__computer" aria-hidden="true">
              {group === "project"
                ? [project ?? t.agent.sessions.noProject, host].filter(Boolean).join(" · ")
                : host ?? t.agent.sessions.thisComputer}
            </li>
          ) : null,
          ...members.map((session) => {
          const project = sessionProject(session.cwd);
          const title = session.title ?? project ?? AGENT_PROVIDER_LABELS[session.provider];
          const model = modelLabel(session.model, shownEffort(session.provider, session.effort, effortLabels));
          const mode = session.permissionMode && session.permissionMode !== "default" ? t.agent.sessions.permissionModes[session.permissionMode] : null;
          const key = sessionKey(session);
          const notFound = notFoundId === session.sessionId
            ? session.remoteHost ? t.agent.sessions.remoteOnly(session.remoteHost) : isActivePhase(session.phase) ? t.agent.sessions.notFound : t.agent.sessions.notFoundEnded
            : null;
          const archive = removal && !reveal && (
            <button className="agent-session__archive" type="button" aria-label={t.agent.sessions.remove(title)} title={t.agent.sessions.remove(title)} onClick={() => motion.archive(session)}>
              <Archive size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          );
          if (view !== "list") {
            return (
              <li key={`${session.provider}:${session.sessionId}`} ref={reveal ? cardRef : undefined} data-session-key={key}>
                <AgentSessionCard
                  session={session}
                  now={now}
                  compact={view === "compact"}
                  hostDisplay={hostDisplay}
                  showElapsed={showElapsed}
                  showActivity={showActivity}
                  model={showModel ? model : null}
                  unseen={Boolean(unseen?.keys.has(key))}
                  looked={Boolean(unseen && !unseen.keys.has(key) && asksUser(session))}
                  notFound={notFound}
                  cardReply={reveal && !isActivePhase(session.phase) ? session.lastMessage : null}
                  effects={cardEffects}
                  onOpen={() => focus(session)}
                />
                {archive}
              </li>
            );
          }
          const minutes = minutesAgo(session.updatedAt, now);
          const active = isActivePhase(session.phase);
          const cardReply = reveal && !active ? session.lastMessage : null;
          const full = Boolean(cardReply) || (active && Boolean(session.lastMessage || (showActivity && (session.lastPrompt || session.currentTool))));
          const light = sessionLight(session);
          const yourTurn = light === "yourTurn";
          const phaseLabel = session.compacting ? t.agent.sessions.compacting : yourTurn ? t.agent.sessions.yourTurn : getAgentPhaseLabel(session.phase, t);
          const showPhase = session.compacting || yourTurn || (session.phase !== "running" && session.phase !== "completed");
          const elapsed = showElapsed && session.turnStartedAt !== null;
          const showAge = session.phase !== "running" || !elapsed;
          const status = [
            showPhase && phaseLabel,
            elapsed && <SessionElapsed key="elapsed" session={session} />,
            active && session.subagents ? t.agent.sessions.subagents(session.subagents) : null,
            session.todos && (
              <span key="todos" className="agent-session__todos" title={session.todos.current ? t.agent.sessions.todosCurrent(session.todos.current) : undefined}>
                {t.agent.sessions.todos(session.todos.done, session.todos.total)}
              </span>
            ),
            session.backgroundTasks ? t.agent.sessions.backgroundTasks(session.backgroundTasks) : null,
            showAge && (minutes === 0 ? t.agent.sessions.justNow : t.agent.sessions.minutesAgo(minutes)),
          ]
            .filter(Boolean)
            .flatMap((part, index) => (index === 0 ? [part] : [" · ", part]));
          return (
            <li key={`${session.provider}:${session.sessionId}`} ref={reveal ? cardRef : undefined} data-session-key={sessionKey(session)}>
              <button
                className={`agent-session agent-session--${session.phase} agent-session--light-${light} agent-session--${full ? "full" : "compact"}${unseen?.keys.has(sessionKey(session)) ? " agent-session--unseen" : unseen && asksUser(session) ? " agent-session--looked" : ""}`}
                type="button"
                onClick={() => focus(session)}
              >
                <span className="agent-session__dot" aria-hidden="true" />
                <span className="agent-session__main">
                  <span className="agent-session__heading">
                    <span className="agent-session__title">
                      {project && project !== title ? <span className="agent-session__project">{project} · </span> : null}
                      {title}
                    </span>
                    {active && showModel && model && <span className="agent-session__model">{model}</span>}
                    {active && mode && (
                      <span className={`agent-session__mode agent-session__mode--${session.permissionMode}`}>
                        {mode}
                      </span>
                    )}
                    {notFound ? (
                      <span className="agent-session__not-found" role="status">{notFound}</span>
                    ) : (
                      <span className="agent-session__meta">{status}</span>
                    )}
                    {session.host && hostDisplay !== "off" && <SessionHostLabel host={session.host} display={hostDisplay} />}
                    {!session.host && hostDisplay === "icon" && (
                      <span className="agent-session__host agent-session__host--unknown" aria-hidden="true" />
                    )}
                    <AgentProviderIcon provider={session.provider} size={14} />
                  </span>
                  {cardReply ? (
                    <span className="agent-session__message agent-session__message--card">{cardReply}</span>
                  ) : (
                    full && <SessionBody session={session} showActivity={showActivity} />
                  )}
                </span>
              </button>
              {archive}
            </li>
          );
          }),
        ])}
      </ul>
      {removedNotice}
      {!removal?.removed && <EditorExtensionHint hint={extensionHint} />}
    </section>
  );
}
