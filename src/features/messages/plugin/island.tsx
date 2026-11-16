import type { ComponentProps } from "react";
import { Bell } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandCollapsedMeta, type IslandHeaderMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import type { Translations } from "../../../i18n";
import { MessageSourceIcon } from "../MessageSourceIcon";
import type { MailController } from "../mail/MailPanel";
import { MessageArrivalsPanel } from "../arrivals/MessageArrivalsPanel";
import { MessagesPanel } from "../Messages";
import { islandPage } from "./page.ts";

type Panel = ComponentProps<typeof MessagesPanel>;
type Arrivals = ComponentProps<typeof MessageArrivalsPanel>;
type MediaCommand = "media_previous" | "media_play_pause" | "media_next";

type MessagesPageProps = {
  features: Panel["enabledSources"];
  qqMail: Panel["qqMail"];
  qqNotifications: Panel["qqNotifications"];
  wechatReminders: Panel["wechatReminders"];
  messageSource: Panel["source"];
  messagePanel?: {
    arrivals: Arrivals["arrivals"] | null;
    open: Arrivals["onOpen"];
    runAction: Arrivals["onAction"];
    measure: Arrivals["onMeasure"];
    showAll: Arrivals["onShowAll"];
    clearAll: Arrivals["onClearAll"];
  };
  openMessages: Panel["onSourceChange"];
  media: {
    mediaState: { playbackStatus: string };
    runMediaCommand: (command: MediaCommand) => Promise<void> | void;
  };
  onOpenSettings: (section: "mail") => void;
};

type HeaderContext = {
  page: string;
  withShortcut: (label: string, target: "qq") => string;
  isPageEnabled: (target: "qq") => boolean;
  qqNotificationCount: number;
  wechatPending: boolean;
  onOpenMessages: (source: "qq" | "wechat") => void;
};

const pageSlot = defineSlot<MessagesPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function MessagesPage({ features, qqMail, qqNotifications, wechatReminders, messageSource, messagePanel, openMessages, media, onOpenSettings }: MessagesPageProps) {
  const { mediaState, runMediaCommand } = media;
  return (
    <div className="message-panel">
      {messagePanel?.arrivals ? (
        <MessageArrivalsPanel arrivals={messagePanel.arrivals} onOpen={messagePanel.open} onAction={messagePanel.runAction} onMeasure={messagePanel.measure} onShowAll={messagePanel.showAll} onClearAll={messagePanel.clearAll} media={{
          playing: mediaState.playbackStatus === "playing",
          onPrevious: () => void runMediaCommand("media_previous"),
          onPlayPause: () => void runMediaCommand("media_play_pause"),
          onNext: () => void runMediaCommand("media_next"),
        }} />
      ) : <MessagesPanel qqMail={qqMail} qqNotifications={qqNotifications} wechatReminders={wechatReminders} source={messageSource} enabledSources={features} onSourceChange={openMessages} onOpenMailSettings={() => onOpenSettings("mail")} />}
    </div>
  );
}

const headerSlot = defineSlot<HeaderContext, IslandHeaderMeta<HeaderContext>>("island.header/v1");

function MessagesButton({ page, withShortcut, qqNotificationCount, wechatPending, onOpenMessages }: HeaderContext) {
  const t = useTranslation();
  const messageBadgeLabel = t.messages.badge(qqNotificationCount, wechatPending);
  return <button className={`icon-button island-message-button${page === "qq" ? " island-message-button--active" : ""}`} type="button" aria-label={withShortcut(t.messages.label(messageBadgeLabel), "qq")} aria-pressed={page === "qq"} onClick={() => onOpenMessages(wechatPending ? "wechat" : "qq")}>
    <Bell size={16} strokeWidth={1.5} absoluteStrokeWidth />
    {(qqNotificationCount > 0 || wechatPending) && <span className="island-message-button__dot" aria-hidden="true" />}
  </button>;
}

pageSlot.add({ ...islandPage, component: MessagesPage });
headerSlot.add({ id: "messages", order: 20, enabled: ({ isPageEnabled }) => isPageEnabled("qq"), component: MessagesButton });

type CollapsedContext = {
  t: Translations;
  qqMail: MailController;
  onOpenMessages: (source: "qqMail") => void;
};

const collapsedSlot = defineSlot<CollapsedContext, IslandCollapsedMeta<CollapsedContext>>("island.collapsed/v1");

function MailItem({ t, qqMail, onOpenMessages }: CollapsedContext) {
  return (
    <button className="island-message-button island-message-button--compact qq-mail-badge" type="button" aria-label={t.messages.newMailLabel} onClick={() => onOpenMessages("qqMail")}>
      <MessageSourceIcon source="qqMail" size={16} account={qqMail.previewAccount} />
      <span className="island-message-button__dot" aria-hidden="true" />
    </button>
  );
}

collapsedSlot.add({ id: "mail", order: 20, shown: ({ qqMail }) => qqMail.preview !== null, component: MailItem });
