import { Bot, ChevronRight } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { TrayAgents } from "./trayCard";
import type { TrayCardHandlers } from "./types";

export function AgentBlock({ agents, handlers }: { agents: TrayAgents; handlers: TrayCardHandlers }) {
  const text = useTranslation().trayMenu;
  return (
    <div className="tray-card__block">
      <span className="tray-card__block-icon" aria-hidden="true">
        <Bot size={16} />
      </span>
      <span className="tray-card__block-text">
        <b>{text.agents}</b>
        <span className="tray-card__chips">
          {agents.running > 0 ? (
            <span>
              <i className="tray-card__dot tray-card__dot--running" />
              {text.running(agents.running)}
            </span>
          ) : null}
          {agents.waiting > 0 ? (
            <span>
              <i className="tray-card__dot tray-card__dot--waiting" />
              {text.waiting(agents.waiting)}
            </span>
          ) : null}
        </span>
      </span>
      <button
        type="button"
        className="tray-card__icon-button"
        aria-label={text.viewAgents}
        title={text.viewAgents}
        onClick={() => handlers.onAction("open_page", "agent")}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
