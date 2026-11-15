import { useTranslation } from "../../i18n";
import type { AgentSessionSummary } from "./api";
import { splitToolDetail } from "./toolDetail";

export function SessionBody({ session, showActivity }: { session: AgentSessionSummary; showActivity: boolean }) {
  const t = useTranslation();
  const prompt = showActivity ? session.lastPrompt : null;
  const tool = showActivity ? session.currentTool : null;
  if (!prompt && !tool && !session.lastMessage) return null;
  const detail = tool?.detail ? splitToolDetail(tool.detail) : null;

  return (
    <>
      {prompt && <span className="agent-session__prompt">{t.agent.sessions.yourPrompt(prompt)}</span>}
      {tool ? (
        <span className="agent-session__tool" title={tool.detail ? `${t.agent.sessions.toolCall(tool.name)}: ${tool.detail}` : t.agent.sessions.toolCall(tool.name)}>
          <span className="agent-session__tool-name">{tool.name}</span>
          {detail && (
            <span className="agent-session__tool-detail">
              <span className="agent-session__tool-head">{detail.head}</span>
              {detail.tail && <span className="agent-session__tool-tail">{detail.tail}</span>}
            </span>
          )}
        </span>
      ) : (
        session.lastMessage && (
          <span className={`agent-session__message${prompt ? " agent-session__message--one-line" : ""}`}>{session.lastMessage}</span>
        )
      )}
    </>
  );
}
