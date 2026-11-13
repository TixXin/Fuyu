import { Bot, MessageCircle, X } from "lucide-react";
import type { AgentVisualState } from "../../features/agent-status/status";
import { useTranslation } from "../../i18n";
import type { IslandPage } from "./types";

export function NotchPopupBand({ page, agentVisualState, onCollapse }: {
  page: IslandPage;
  agentVisualState: AgentVisualState;
  onCollapse: () => void;
}) {
  const t = useTranslation();
  const agents = page === "agents";
  const Icon = agents ? Bot : MessageCircle;
  return (
    <div className="island__notch-band">
      <span className="island__notch-band-start">
        <Icon
          className={agents ? `island__agent-status-icon island__agent-status-icon--${agentVisualState}` : "island__notch-band-icon"}
          size={16}
          strokeWidth={1.8}
          absoluteStrokeWidth
          aria-hidden="true"
        />
        <span className="island__notch-band-label">{agents ? "AI Agent" : t.messages.title}</span>
      </span>
      <span className="island__notch-band-gap" aria-hidden="true" />
      <button
        className="icon-button island__notch-band-close"
        type="button"
        aria-label={t.island.collapseIsland}
        onClick={(event) => {
          event.stopPropagation();
          onCollapse();
        }}
      >
        <X size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
