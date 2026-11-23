import { useState } from "react";
import { sessionProject } from "../../lib/agent-sessions/project.ts";
import { useTranslation } from "../../i18n";
import { AgentProviderIcon } from "./AgentProviderIcon";
import { AGENT_SESSION_HOURS, type AgentSettingValues } from "./agentSettings";
import type { AgentSessionSummary } from "./api";
import "./EmptyRecent.css";

const WIDEST = AGENT_SESSION_HOURS[AGENT_SESSION_HOURS.length - 1];

export function EmptyRecent({ sessions, hours, onSettingsChange }: {
  sessions: readonly AgentSessionSummary[];
  hours: number;
  onSettingsChange?: (patch: Partial<AgentSettingValues>) => void;
}) {
  const text = useTranslation().agent.empty;
  const [now] = useState(() => Date.now());
  const last = sessions.reduce<AgentSessionSummary | null>((latest, session) => (latest === null || session.updatedAt > latest.updatedAt ? session : latest), null);
  const title = last ? (last.title ?? sessionProject(last.cwd) ?? last.sessionId).trim() : "";

  return (
    <div className="agent-empty agent-empty--recent">
      <strong>{text.recentTitle(hours)}</strong>
      <span>{last ? text.recentHidden(sessions.length) : text.sleepHint}</span>
      {last && (
        <div className="agent-recent">
          <AgentProviderIcon provider={last.provider} size={16} />
          <span className="agent-recent__text">
            <span className="agent-recent__title">{title}</span>
            <span className="agent-recent__meta">{text.recentEnded(text.ago(Math.floor((now - last.updatedAt) / 60_000)))}</span>
          </span>
        </div>
      )}
      {onSettingsChange && (last || hours < WIDEST) && (
        <div className="agent-empty__actions">
          {last && (
            <button className="agent-empty__button" type="button" onClick={() => onSettingsChange({ agentHideFinished: false, agentHideClosed: false })}>
              {text.showHidden(sessions.length)}
            </button>
          )}
          {hours < WIDEST && (
            <button className="agent-empty__button" type="button" onClick={() => onSettingsChange({ agentSessionHours: WIDEST })}>
              {text.widen(WIDEST)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
