import { ChevronRight } from "lucide-react";
import { useTranslation } from "../../i18n";
import { childrenAlert, type ChildSession } from "./sessionChildren";
import "./AgentSubagents.css";
import "./AgentSessionChildren.css";

export function AgentSessionChildren({
  sessions,
  open,
  unseen,
  onToggle,
}: {
  sessions: ChildSession[];
  open: boolean;
  unseen?: ReadonlySet<string>;
  onToggle: () => void;
}) {
  const t = useTranslation();
  const alert = open ? null : childrenAlert(sessions, unseen);
  const ask = alert ? t.agent.sessions.childSessionsAsk(alert.count) : null;
  const action = open ? t.agent.sessions.childSessionsHide(sessions.length) : t.agent.sessions.childSessionsShow(sessions.length);
  const label = ask ? `${action} · ${ask}` : action;
  return (
    <div className={`agent-subagents agent-session-children${open ? " agent-subagents--open" : ""}`}>
      <button className="agent-subagents__toggle" type="button" aria-expanded={open} aria-label={label} title={label} onClick={onToggle}>
        <ChevronRight className="agent-subagents__chevron" size={12} strokeWidth={2.4} aria-hidden="true" />
        {t.agent.sessions.childSessions(sessions.length)}
        {alert && (
          <span className={`agent-session-children__ask agent-session-children__ask--${alert.light}`}>
            <span className="agent-session-children__ask-dot" aria-hidden="true" />
            {ask}
          </span>
        )}
      </button>
    </div>
  );
}
