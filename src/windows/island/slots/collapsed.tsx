import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { CircleArrowUp, Inbox } from "lucide-react";
import { CollapsedCenter, centerWidth } from "../../../features/center-pattern";
import { ClaudeUsageGauge } from "../../../features/claude-usage/ClaudeUsageGauge";
import { CLAUDE_USAGE_GAUGE_WIDTH, USAGE_PROVIDERS, shownUsageProviders, usageItemId, type UsageProvider } from "../../../features/claude-usage/usageRing";
import type { DeviceUse } from "../../../features/device-use/api";
import { DeviceUseIndicator } from "../../../features/device-use/DeviceUseIndicator";
import type { MediaState } from "../../../features/media/api";
import { MusicWaveButton } from "../../../features/media/MusicWaveButton";
import type { MailController } from "../../../features/messages/mail/MailPanel";
import { MessageSourceIcon } from "../../../features/messages/MessageSourceIcon";
import type { MessageSource } from "../../../features/messages/messagePreview";
import { defineSlot, type IslandCollapsedCenterMeta, type IslandCollapsedMeta, type SlotWidth } from "../../../features/plugin-kernel/slots";
import { TIMER_CHIP_WIDTH, TimerChip } from "../../../features/timer/TimerChip";
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

export type CollapsedGaugeContext = {
  paused: boolean;
  usage: { enabled: boolean; settings: Record<string, unknown>; showRemaining: boolean };
  timer: { enabled: boolean; running: boolean };
};

export type CollapsedCenterContext = ComponentProps<typeof CollapsedCenter> & { enabled: boolean };

export const collapsedBarSlot = defineSlot<CollapsedBarContext, IslandCollapsedMeta<CollapsedBarContext>>("island.collapsed/v1");
export const collapsedGaugeSlot = defineSlot<CollapsedGaugeContext, IslandCollapsedMeta<CollapsedGaugeContext>>("island.collapsed/v1");
export const collapsedCenterSlot = defineSlot<CollapsedCenterContext, IslandCollapsedCenterMeta<CollapsedCenterContext>>("island.collapsed-center/v1");

export const PLUGIN_STATUS_ORDER = 35;

export function slotWidth<Context>(width: SlotWidth<Context> | undefined, context: Context) {
  return typeof width === "function" ? width(context) : width ?? 0;
}

function StatusLightItem({ statusLight }: CollapsedBarContext) {
  return statusLight;
}

function MailItem({ t, qqMail, onOpenMessages }: CollapsedBarContext) {
  return (
    <button className="island-message-button island-message-button--compact qq-mail-badge" type="button" aria-label={t.messages.newMailLabel} onClick={() => onOpenMessages("qqMail")}>
      <MessageSourceIcon source="qqMail" size={16} account={qqMail.previewAccount} />
      <span className="island-message-button__dot" aria-hidden="true" />
    </button>
  );
}

function UpdateItem({ t, updateVersion }: CollapsedBarContext) {
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

function ShelfItem({ t, shelfCount, onOpenPage }: CollapsedBarContext) {
  return (
    <button className="island-shelf-count" type="button" aria-label={t.island.shelfCount(shelfCount ?? 0)} onClick={() => onOpenPage("shelf")}>
      <Inbox size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      <span>{shelfCount}</span>
    </button>
  );
}

function MusicItem({ t, mediaState, onOpenPage }: CollapsedBarContext) {
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

function SessionCountItem({ t, agentSessionCount, slots, onOpenPage }: CollapsedBarContext) {
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

function UsageGaugeSlot({ providers, showRemaining }: { providers: readonly UsageProvider[]; showRemaining: boolean }) {
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

function usageGauge(provider: UsageProvider) {
  return function UsageGauge({ usage }: CollapsedGaugeContext) {
    return <UsageGaugeSlot providers={[provider]} showRemaining={usage.showRemaining} />;
  };
}

collapsedBarSlot.add({ id: "status-light", order: 10, component: StatusLightItem });
collapsedBarSlot.add({ id: "mail", order: 20, shown: ({ qqMail }) => qqMail.preview !== null, component: MailItem });
collapsedBarSlot.add({ id: "update", order: 30, shown: ({ updateVersion }) => Boolean(updateVersion), component: UpdateItem });
collapsedBarSlot.add({ id: "device-use", order: 40, component: DeviceUseIndicator });
collapsedBarSlot.add({ id: "shelf", order: 50, shown: ({ shelfCount }) => shelfCount !== null && shelfCount > 0, component: ShelfItem });
collapsedBarSlot.add({ id: "music", order: 60, shown: ({ showMusic }) => showMusic, component: MusicItem });
for (const provider of USAGE_PROVIDERS) {
  collapsedGaugeSlot.add({
    id: usageItemId(provider),
    order: 70,
    group: "gauges",
    width: CLAUDE_USAGE_GAUGE_WIDTH,
    hideable: true,
    shown: ({ usage }) => usage.enabled && shownUsageProviders(usage.settings).includes(provider),
    component: usageGauge(provider),
  });
}
collapsedGaugeSlot.add({ id: "timer", order: 70, group: "gauges", width: TIMER_CHIP_WIDTH, hideable: true, shown: ({ timer }) => timer.enabled && timer.running, component: TimerChip });
collapsedBarSlot.add({
  id: "session-count",
  order: 80,
  shown: ({ agentSessionCount, slots }) => agentSessionCount !== null && (Boolean(slots.agentCount) || agentSessionCount > 0),
  component: SessionCountItem,
});
collapsedCenterSlot.add({
  id: "center-pattern",
  shown: ({ enabled }) => enabled,
  width: ({ choice, sheet, size }) => centerWidth(typeof sheet === "string" && sheet ? "pet" : choice.pattern === "pet" ? "eyes" : choice.pattern, size),
  component: CollapsedCenter,
});
