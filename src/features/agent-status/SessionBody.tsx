import { useTranslation } from "../../i18n";
import type { AgentSessionSummary } from "./api";

export function SessionBody({ session, showActivity }: { session: AgentSessionSummary; showActivity: boolean }) {
  const t = useTranslation();
  const prompt = showActivity ? session.lastPrompt : null;
  const tool = showActivity ? session.currentTool : null;
  if (!prompt && !tool && !session.lastMessage) return null;

  return (
    <>
      {prompt && <span className="agent-session__prompt">{t.agent.sessions.yourPrompt(prompt)}</span>}
      {tool ? (
        <span className="agent-session__tool">
          <span className="agent-session__tool-name">{tool.name}</span>
          {tool.detail && <span className="agent-session__tool-detail">{tool.detail}</span>}
        </span>
      ) : (
        session.lastMessage && (
          <span className={`agent-session__message${prompt ? " agent-session__message--one-line" : ""}`}>{session.lastMessage}</span>
        )
      )}
    </>
  );
}
