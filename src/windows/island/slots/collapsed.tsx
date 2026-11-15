import { useEffect, useState, type ReactNode } from "react";
import { CircleArrowUp, Inbox } from "lucide-react";
import { ClaudeUsageGauge } from "../../../features/claude-usage/ClaudeUsageGauge";
import type { UsageProvider } from "../../../features/claude-usage/usageRing";
import type { DeviceUse } from "../../../features/device-use/api";
import type { MediaState } from "../../../features/media/api";
import { MusicWaveButton } from "../../../features/media/MusicWaveButton";
import type { MailController } from "../../../features/messages/mail/MailPanel";
import { MessageSourceIcon } from "../../../features/messages/MessageSourceIcon";
import type { MessageSource } from "../../../features/messages/messagePreview";
import type { Translations } from "../../../i18n";
import { openSettingsWindow } from "../../settings/api";
import { listenIslandHover } from "../api";
import type { CollapsedSlots, IslandPage } from "../types";

export type CollapsedBarContext = {
  t: Translations;
  qqMail: MailController;
  updateVersion: string | null;
  statusLight: ReactNode;
  deviceUse: DeviceUse;
  shelfCount: number | null;
  showMusic: boolean;
  mediaState: MediaState;
  agentSessionCount: number | null;
  slots: CollapsedSlots;
  onOpenPage: (page: IslandPage) => void;
  onOpenMessages: (source: MessageSource) => void;
};

export function StatusLightItem({ statusLight }: CollapsedBarContext) {
  return statusLight;
}

export function MailItem({ t, qqMail, onOpenMessages }: CollapsedBarContext) {
  return (
    <button className="island-message-button island-message-button--compact qq-mail-badge" type="button" aria-label={t.messages.newMailLabel} onClick={() => onOpenMessages("qqMail")}>
      <MessageSourceIcon source="qqMail" size={16} account={qqMail.previewAccount} />
      <span className="island-message-button__dot" aria-hidden="true" />
    </button>
  );
}

export function UpdateItem({ t, updateVersion }: CollapsedBarContext) {
  return (
    <button
      className="island-message-button island-message-button--compact island-update-badge"
      type="button"
      aria-label={t.settings.project.update.islandReminder(updateVersion ?? "")}
      onClick={(event) => {
        event.stopPropagation();
        openSettingsWindow("updates");
      }}
    >
      <CircleArrowUp size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      <span className="island-message-button__dot island-update-badge__dot" aria-hidden="true" />
    </button>
  );
}

export function ShelfItem({ t, shelfCount, onOpenPage }: CollapsedBarContext) {
  return (
    <button className="island-shelf-count" type="button" aria-label={t.island.shelfCount(shelfCount ?? 0)} onClick={() => onOpenPage("shelf")}>
      <Inbox size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      <span>{shelfCount}</span>
    </button>
  );
}

export function MusicItem({ t, mediaState, onOpenPage }: CollapsedBarContext) {
  return (
    <MusicWaveButton
      isAvailable={mediaState.available || mediaState.audioActive}
      isPlaying={mediaState.playbackStatus === "playing"}
      audioPeak={mediaState.audioPeak}
      label={t.island.openMusic}
      onClick={() => onOpenPage("music")}
    />
  );
}

export function SessionCountItem({ t, agentSessionCount, slots, onOpenPage }: CollapsedBarContext) {
  if (slots.agentCount) return slots.agentCount;
  return (
    <button
      className="island-agent-count"
      type="button"
      aria-label={t.agent.sessions.activeCount(agentSessionCount ?? 0)}
      onClick={(event) => {
        event.stopPropagation();
        onOpenPage("agents");
      }}
    >
      {agentSessionCount}
    </button>
  );
}

export function UsageGaugeSlot({ providers, showRemaining }: { providers: readonly UsageProvider[]; showRemaining: boolean }) {
  const [hovered, setHovered] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    listenIslandHover(setHovered)
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for island hover", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
  return providers.map((provider) => <ClaudeUsageGauge key={provider.id} provider={provider} islandHovered={hovered} showRemaining={showRemaining} />);
}
