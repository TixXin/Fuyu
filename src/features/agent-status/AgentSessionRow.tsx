import type { CSSProperties, ReactNode, Ref } from "react";
import { useTranslation } from "../../i18n";
import { AgentProviderIcon } from "./AgentProviderIcon";
import { AgentSessionHoverCard } from "./AgentSessionHoverCard";
import type { AgentSessionSummary } from "./api";
import { isActivePhase } from "./sessionList";
import { SessionBody } from "./SessionBody";
import { SessionElapsed } from "./SessionElapsed";
import { SessionHostLabel } from "./SessionHostLabel";
import { getAgentPhaseLabel } from "./status";
import { asksUser, sessionKey } from "./unseen";
import { sessionLight } from "./sessionLight";
import { pillParts } from "./sessionPill";
import type { UnseenSessions } from "./useUnseenSessions";
import "./AgentSessionRow.css";
import type { AgentHostDisplay } from "./agentSettings";

export function AgentSessionRow({
  session,
  title,
  project,
  model,
  notFound,
  archive,
  age,
  showAge,
  reveal,
  rowRef,
  hostDisplay,
  showElapsed,
  showModel,
  showActivity,
  unseen,
  subagents,
  menu,
  hoverCard,
  depth = 0,
  onOpen,
}: {
  session: AgentSessionSummary;
  title: string;
  project: string | null;
  model: string | null;
  notFound: string | null;
  archive: ReactNode;
  age: string;
  showAge: boolean;
  reveal: boolean;
  rowRef?: Ref<HTMLLIElement>;
  hostDisplay: AgentHostDisplay;
  showElapsed: boolean;
  showModel: boolean;
  showActivity: boolean;
  unseen?: UnseenSessions;
  subagents?: ReactNode;
  menu?: ReactNode;
  hoverCard?: { suppressed: boolean };
  depth?: number;
  onOpen: () => void;
}) {
  const t = useTranslation();
  const mode = session.permissionMode && session.permissionMode !== "default" ? t.agent.sessions.permissionModes[session.permissionMode] : null;
  const active = isActivePhase(session.phase);
  const cardReply = reveal && !active ? session.lastMessage : null;
  const full = Boolean(cardReply) || (active && Boolean(session.lastMessage || (showActivity && (session.lastPrompt || session.currentTool))));
  const light = sessionLight(session);
  const yourTurn = light === "yourTurn";
  const phaseLabel = session.compacting ? t.agent.sessions.compacting : yourTurn ? t.agent.sessions.yourTurn : getAgentPhaseLabel(session.phase, t);
  const showPhase = session.compacting || yourTurn || (session.phase !== "running" && session.phase !== "completed");
  const elapsed = showElapsed && session.turnStartedAt !== null;
  const lightText = t.agent.sessions.lights[light];
  const pill = pillParts(active && showModel ? model : null, session.model);
  const pillMode = active ? mode : null;
  const pillTitle = [model && active && showModel ? model : null, pillMode].filter(Boolean).join(" · ");
  const status = [
    showPhase && phaseLabel,
    elapsed && <SessionElapsed key="elapsed" session={session} />,
    active && session.subagents && !subagents ? t.agent.sessions.subagents(session.subagents) : null,
    session.todos && (
      <span key="todos" className="agent-session__todos" title={session.todos.current ? t.agent.sessions.todosCurrent(session.todos.current) : undefined}>
        {t.agent.sessions.todos(session.todos.done, session.todos.total)}
      </span>
    ),
    session.backgroundTasks ? t.agent.sessions.backgroundTasks(session.backgroundTasks) : null,
  ]
    .filter(Boolean)
    .flatMap((part, index) => (index === 0 ? [part] : [" · ", part]));
  const button = (
    <button
      className={`agent-session agent-session--${session.phase} agent-session--light-${light} agent-session--${full ? "full" : "compact"}${unseen?.keys.has(sessionKey(session)) ? " agent-session--unseen" : unseen && asksUser(session) ? " agent-session--looked" : ""}`}
      type="button"
      onClick={onOpen}
    >
      <span className="agent-session__dot" role="img" aria-label={lightText} title={lightText} />
      <span className="agent-session__main">
        <span className="agent-session__heading">
          <span className="agent-session__title">
            {project && project !== title ? <span className="agent-session__project">{project} · </span> : null}
            {title}
          </span>
          {(pill.model || pill.effort || pillMode) && (
            <span className="agent-session__pill" title={pillTitle}>
              {pill.model && <span className="agent-session__pill-model">{pill.model}</span>}
              {pill.effort && <span className="agent-session__pill-effort">{pill.effort}</span>}
              {pillMode && <span className={`agent-session__pill-mode agent-session__pill-mode--${session.permissionMode}`}>{pillMode}</span>}
            </span>
          )}
          {notFound ? (
            <span className="agent-session__not-found" role="status">{notFound}</span>
          ) : (
            status.length > 0 && <span className="agent-session__meta">{status}</span>
          )}
          {session.host && (hostDisplay === "name" || hostDisplay === "both") && <SessionHostLabel host={session.host} display="name" />}
          <span className="agent-session__agent">
            <AgentProviderIcon provider={session.provider} size={14} />
            {session.host && <SessionHostLabel host={session.host} display={hostDisplay} badge />}
          </span>
          <span className="agent-session__time">{showAge && <span className="agent-session__age">{age}</span>}</span>
        </span>
        {cardReply ? (
          <span className="agent-session__message agent-session__message--card">{cardReply}</span>
        ) : (
          full && <SessionBody session={session} showActivity={showActivity} />
        )}
      </span>
    </button>
  );
  return (
    <li
      ref={rowRef}
      data-session-key={sessionKey(session)}
      className={depth ? "agent-session-child" : undefined}
      style={depth ? ({ "--child-depth": depth } as CSSProperties) : undefined}
    >
      {hoverCard ? (
        <AgentSessionHoverCard session={session} title={project && project !== title ? `${project} · ${title}` : title} suppressed={hoverCard.suppressed}>
          {button}
        </AgentSessionHoverCard>
      ) : button}
      {subagents}
      {menu}
      {archive}
    </li>
  );
}
