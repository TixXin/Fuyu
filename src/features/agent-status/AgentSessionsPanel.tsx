import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Archive } from "lucide-react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { ArchivedNotice } from "./ArchivedNotice";
import { EditorExtensionHint } from "./EditorExtensionHint";
import { useEditorExtensionHint } from "./useEditorExtensionHint";
import { useArchiveMotion } from "./useArchiveMotion";
import { useListMotion } from "./useListMotion";
import { sessionLight } from "./sessionLight";
import { useTranslation } from "../../i18n";
import { AgentSessionCard } from "./AgentSessionCard";
import { AgentUsageBar } from "./AgentUsageBar";
import type { AgentUsages } from "./usage";
import { focusAgentWindow, listenAgentFocusWindowOnly, type AgentSessionSummary } from "./api";
import { arrangeSessions, isActivePhase, modelLabel, sessionAge, sessionProject } from "./sessionList";
import { shownEffort } from "./effortLabels";
import { useEffortLabels } from "./useEffortLabels";
import { getAgentProviderLabel } from "./status";
import { useScrollFade } from "./useScrollFade";
import { asksUser, sessionKey } from "./unseen";
import type { UnseenSessions } from "./useUnseenSessions";
import type { SessionRemoval } from "./useHiddenSessions";
import type { AlertedSession } from "./useAgentAlerts";
import { AgentApprovalCard } from "./approvals/AgentApprovalCard";
import { AgentQuestionCard } from "./approvals/AgentQuestionCard";
import type { AgentApprovals } from "./approvals/useAgentApprovals";
import { AgentSessionRow } from "./AgentSessionRow";
import { AgentSessionRowMenu } from "./AgentSessionRowMenu";
import { AgentSessionHoverCard } from "./AgentSessionHoverCard";
import { useSessionKeyboard } from "./useSessionKeyboard";
import { AgentSubagents, listedSubagents } from "./AgentSubagents";
import { AgentSessionChildren } from "./AgentSessionChildren";
import { nestSessions, type NestedSessions } from "./sessionChildren";
import { useRowExpansion } from "./useRowExpansion";
import "./AgentSessionsPanel.css";
import type { AgentArchiveMotion, AgentCardEffects, AgentHostDisplay, AgentSessionGroup, AgentSessionSort, AgentSessionView } from "./agentSettings";

const NOT_FOUND_NOTICE_MS = 3000;
const MAX_CHILD_DEPTH = 3;
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
  expandChildren = false,
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
  expandChildren?: boolean;
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
  const [rowNotice, setRowNotice] = useState<{ key: string; text: string } | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const openSubagents = useRowExpansion(expandChildren);
  const openChildren = useRowExpansion(expandChildren);
  const extensionHint = useEditorExtensionHint();
  const list = useScrollFade<HTMLUListElement>(sessions);
  const motion = useArchiveMotion(list.element, removal, archiveMotion);
  const nested: NestedSessions = view === "list" && !reveal ? nestSessions(sessions) : { roots: sessions, children: new Map() };
  const childDepth = new Map([...nested.children.values()].flat().map((child) => [sessionKey(child.session), child.depth]));
  const shownChildren = (key: string) => (openChildren.isOpen(key) ? nested.children.get(key) ?? [] : []);
  const arranged = arrangeSessions(nested.roots, sort, group).map((entry, _, groups) => ({
    ...entry,
    heading: !reveal && (group === "project" || (group === "computer" && (groups.length > 1 || entry.host !== null))),
  }));
  useListMotion(
    list.element,
    arranged.flatMap(({ key, heading, sessions: members }) => [
      ...(heading ? [{ key: `group:${key}` }] : []),
      ...members.flatMap((root) => [root, ...shownChildren(sessionKey(root)).map((child) => child.session)]).map((session) => ({
        key: sessionKey(session),
        light: sessionLight(session),
        open: openSubagents.isOpen(sessionKey(session)) ? listedSubagents(session).length : 0,
      })),
    ]),
    view,
    !reveal && !approvals?.current,
    motion.returning,
  );
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
    setNotFoundId(null);
    setRowNotice(null);
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

  const ageOf = (session: AgentSessionSummary) => sessionAge(session.updatedAt, now);
  const showsAge = (session: AgentSessionSummary) => session.phase !== "running" || !(showElapsed && session.turnStartedAt !== null);

  return (
    <section className="agent-sessions" aria-label={t.agent.sessions.title}>
      {showUsage && <AgentUsageBar usages={usages} />}
      <ul
        ref={list.ref}
        className={`agent-sessions__list${view === "list" ? "" : ` agent-sessions__list--${view}`}${removal && !reveal ? " agent-sessions__list--archivable" : ""}${reveal ? "" : " agent-sessions__list--menu"}`}
        data-fade-top={list.fade.top || undefined}
        data-fade-bottom={list.fade.bottom || undefined}
        onScroll={list.onScroll}
        onKeyDown={keyboard.onKeyDown}
        onContextMenu={keyboard.onContextMenu}
      >
        {arranged.flatMap(({ key: groupKey, host, project, sessions: members, heading }) => [
          heading ? (
            <li key={`group:${groupKey}`} className="agent-sessions__computer" aria-hidden="true" data-session-key={`group:${groupKey}`}>
              {group === "project"
                ? [project ?? t.agent.sessions.noProject, host].filter(Boolean).join(" · ")
                : host ?? t.agent.sessions.thisComputer}
            </li>
          ) : null,
          ...members.flatMap((root) => [root, ...shownChildren(sessionKey(root)).map((child) => child.session)]).map((session) => {
          const depth = Math.min(childDepth.get(sessionKey(session)) ?? 0, MAX_CHILD_DEPTH);
          const project = sessionProject(session.cwd);
          const title = session.title ?? project ?? getAgentProviderLabel(session.provider);
          const model = modelLabel(session.model, shownEffort(session.provider, session.effort, effortLabels));
          const key = sessionKey(session);
          const notFound = notFoundId === session.sessionId
            ? session.remoteHost ? t.agent.sessions.remoteOnly(session.remoteHost) : isActivePhase(session.phase) ? t.agent.sessions.notFound : t.agent.sessions.notFoundEnded
            : rowNotice?.key === key ? rowNotice.text : null;
          const menu = !reveal && (
            <AgentSessionRowMenu
              session={session}
              title={title}
              onFocusWindow={() => focus(session)}
              onArchive={removal ? () => motion.archive(session) : undefined}
              onNotice={(text) => setRowNotice({ key, text })}
              onOpenChange={(open) => setMenuKey((current) => (open ? key : current === key ? null : current))}
            />
          );
          const hoverSuppressed = menuKey !== null;
          const archive = removal && !reveal && (
            <button className="agent-session__archive" type="button" aria-label={t.agent.sessions.remove(title)} title={t.agent.sessions.remove(title)} onClick={() => motion.archive(session)}>
              <Archive size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          );
          if (view !== "list") {
            const subagents = !reveal && listedSubagents(session).length > 0;
            const card = (
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
                subagentsListed={subagents}
                onOpen={() => focus(session)}
              />
            );
            return (
              <li key={`${session.provider}:${session.sessionId}`} ref={reveal ? cardRef : undefined} data-session-key={key}>
                {reveal ? card : (
                  <AgentSessionHoverCard session={session} title={project && project !== title ? `${project} · ${title}` : title} suppressed={hoverSuppressed}>
                    {card}
                  </AgentSessionHoverCard>
                )}
                {subagents && <AgentSubagents session={session} open={openSubagents.isOpen(key)} onToggle={() => openSubagents.toggle(key)} />}
                {menu}
                {archive}
              </li>
            );
          }
          return (
            <AgentSessionRow
              key={`${session.provider}:${session.sessionId}`}
              session={session}
              title={title}
              project={project}
              model={model}
              notFound={notFound}
              archive={archive}
              age={ageOf(session)}
              showAge={showsAge(session)}
              reveal={Boolean(reveal)}
              rowRef={reveal ? cardRef : undefined}
              hostDisplay={hostDisplay}
              showElapsed={showElapsed}
              showModel={showModel}
              showActivity={showActivity}
              effects={cardEffects}
              unseen={unseen}
              subagents={
                reveal || (listedSubagents(session).length === 0 && !nested.children.has(key)) ? undefined : (
                  <>
                    {listedSubagents(session).length > 0 && (
                      <AgentSubagents session={session} open={openSubagents.isOpen(key)} onToggle={() => openSubagents.toggle(key)} />
                    )}
                    {nested.children.has(key) && (
                      <AgentSessionChildren
                        sessions={nested.children.get(key) ?? []}
                        open={openChildren.isOpen(key)}
                        unseen={unseen?.keys}
                        onToggle={() => openChildren.toggle(key)}
                      />
                    )}
                  </>
                )
              }
              depth={depth}
              menu={menu}
              hoverCard={reveal ? undefined : { suppressed: hoverSuppressed }}
              onOpen={() => focus(session)}
            />
          );
          }),
        ])}
      </ul>
      {removedNotice}
      {!removal?.removed && <EditorExtensionHint hint={extensionHint} />}
    </section>
  );
}
