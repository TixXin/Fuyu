import { useEffect, useId, useState, type CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { AgentSessionSummary, AgentSubagent } from "./api";
import { durationParts } from "./sessionList";
import "./AgentSubagents.css";

const MAX_DEPTH_INDENT = 3;

export function listedSubagents(session: AgentSessionSummary) {
  return session.subagentList ?? [];
}

export function AgentSubagents({
  session,
  open,
  onToggle,
}: {
  session: AgentSessionSummary;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslation();
  const listId = useId();
  const agents = listedSubagents(session);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  if (agents.length === 0) return null;
  const label = open ? t.agent.sessions.subagentsHide(agents.length) : t.agent.sessions.subagentsShow(agents.length);
  return (
    <div className={`agent-subagents${open ? " agent-subagents--open" : ""}`}>
      <button
        className="agent-subagents__toggle"
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        title={label}
        onClick={onToggle}
      >
        <ChevronRight className="agent-subagents__chevron" size={12} strokeWidth={2.4} aria-hidden="true" />
        {t.agent.sessions.subagents(agents.length)}
      </button>
      <ul id={listId} className="agent-subagents__list" hidden={!open}>
        {open && agents.map((agent) => <SubagentRow key={agent.id} agent={agent} now={now} />)}
      </ul>
    </div>
  );
}

function SubagentRow({ agent, now }: { agent: AgentSubagent; now: number }) {
  const t = useTranslation();
  const title = agent.description ?? agent.agentType ?? agent.id;
  const tool = agent.currentTool;
  const elapsed = agent.startedAt !== null ? t.agent.sessions.duration(durationParts(Math.max(0, now - agent.startedAt))) : null;
  const depth = Math.min(Math.max(agent.depth, 1), MAX_DEPTH_INDENT) - 1;
  return (
    <li className="agent-subagent" style={depth ? ({ "--subagent-depth": depth } as CSSProperties) : undefined}>
      <span className="agent-subagent__title" title={agent.agentType ? `${title} · ${agent.agentType}` : title}>
        {title}
      </span>
      {agent.background && <span className="agent-subagent__tag">{t.agent.sessions.subagentBackground}</span>}
      <span className="agent-subagent__tool" title={tool?.detail ? `${tool.name}: ${tool.detail}` : undefined}>
        {tool ? (
          <>
            <span className="agent-subagent__tool-name">{tool.name}</span>
            {tool.detail && <span className="agent-subagent__tool-detail">{tool.detail}</span>}
          </>
        ) : (
          <span className="agent-subagent__thinking">{t.agent.sessions.subagentThinking}</span>
        )}
      </span>
      {elapsed && <span className="agent-subagent__time">{elapsed}</span>}
    </li>
  );
}
