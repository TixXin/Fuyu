import { Bell, Bot, MessageCircle, Music, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { IslandPopupContribution } from "../../features/plugin-kernel/islandContributions";
import type { IslandPage } from "./types";

const HEADING_ICONS = { music: Music, bell: Bell } as const;

export function NotchPopupBand({ page, heading, agentVisualState, onCollapse }: {
  page: IslandPage;
  heading?: Pick<IslandPopupContribution, "label" | "icon" | "iconUrl">;
  agentVisualState: string;
  onCollapse: () => void;
}) {
  const t = useTranslation();
  const agents = page === "agents";
  const custom = !agents && heading?.label ? heading : null;
  const Icon = agents ? Bot : custom?.icon ? HEADING_ICONS[custom.icon] : MessageCircle;
  return (
    <div className="island__notch-band">
      <span className="island__notch-band-start">
        {custom?.iconUrl ? (
          <img className="island__notch-band-logo" src={custom.iconUrl} alt="" aria-hidden="true" width={16} height={16} draggable={false} />
        ) : (
          <Icon
            className={agents ? `island__agent-status-icon island__agent-status-icon--${agentVisualState}` : "island__notch-band-icon"}
            size={16}
            strokeWidth={1.8}
            absoluteStrokeWidth
            aria-hidden="true"
          />
        )}
        <span className="island__notch-band-label">{agents ? "AI Agent" : custom?.label ?? t.messages.title}</span>
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
