import type { ReactNode, Ref } from "react";
import { useTranslation } from "../../i18n";
import type { AgentHostDisplay } from "../appearance/types";
import { AgentProviderIcon } from "./AgentProviderIcon";
import type { AgentSessionSummary } from "./api";
import { isActivePhase } from "./sessionList";
import { SessionBody } from "./SessionBody";
import { SessionElapsed } from "./SessionElapsed";
import { SessionHostLabel } from "./SessionHostLabel";
import { getAgentPhaseLabel } from "./status";
import { asksUser, sessionKey } from "./unseen";
import { sessionLight } from "./sessionLight";
import type { UnseenSessions } from "./useUnseenSessions";
import "./AgentSessionRow.css";

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
  const ageInSlot = Boolean(archive) && showAge;
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
    showAge && !ageInSlot && age,
  ]
    .filter(Boolean)
    .flatMap((part, index) => (index === 0 ? [part] : [" · ", part]));
  return (
    <li ref={rowRef} data-session-key={sessionKey(session)}>
      <button
        className={`agent-session agent-session--${session.phase} agent-session--light-${light} agent-session--${full ? "full" : "compact"}${unseen?.keys.has(sessionKey(session)) ? " agent-session--unseen" : unseen && asksUser(session) ? " agent-session--looked" : ""}`}
        type="button"
        onClick={onOpen}
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
      {ageInSlot && <span className="agent-session__age">{age}</span>}
      {archive}
    </li>
  );
}
