import type { ComponentProps } from "react";
import { Bell } from "lucide-react";
import { useTranslation, type Translations } from "../../../i18n";
import { useTrackArt } from "../../../lib/now-playing/trackArt";
import { defineSlot, type IslandCollapsedMeta, type IslandHeaderMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { runIslandAction, useIslandContributed } from "../../plugin-kernel/useIslandContributions";
import { MessageArrivalsPanel } from "../arrivals/MessageArrivalsPanel";
import { firstPendingImSource, imUnreadTotal } from "../im-sources/imSourcesState";
import { resolveMessageSource } from "../island/messageSource";
import { MessagesPanel } from "../Messages";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { messagesIsland } from "./islandState";
import { OWNER } from "./owner.ts";
import { islandPage } from "./page.ts";

type Panel = ComponentProps<typeof MessagesPanel>;

type MessagesPageProps = {
  features: Panel["enabledSources"];
  onOpenSettings: (section: "mail") => void;
};

type HeaderContext = {
  page: string;
  withShortcut: (label: string, target: "qq") => string;
  isPageEnabled: (target: "qq") => boolean;
};

const pageSlot = defineSlot<MessagesPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function MessagesPage({ features, onOpenSettings }: MessagesPageProps) {
  const playing = useIslandContributed().hints.has("media.playing");
  const art = useTrackArt();
  const messages = messagesIsland.use();
  if (!messages) return null;
  const { mail: qqMail, qq: qqNotifications, wechat: wechatReminders, im: imSources, enabledSources, source: messageSource, panel: messagePanel, open: openMessages } = messages;
  return (
    <div className="message-panel">
      {messagePanel?.arrivals ? (
        <MessageArrivalsPanel arrivals={messagePanel.arrivals} onOpen={messagePanel.open} onAction={messagePanel.runAction} onMeasure={messagePanel.measure} onShowAll={messagePanel.showAll} onClearAll={messagePanel.clearAll} media={{
          playing,
          cover: art?.cover ?? null,
          sourceIcon: art?.sourceIcon ?? null,
          onPrevious: () => void runIslandAction("media.previous"),
          onPlayPause: () => void runIslandAction("media.play-pause"),
          onNext: () => void runIslandAction("media.next"),
        }} />
      ) : (
        <MessagesPanel
          qqMail={qqMail}
          qqNotifications={qqNotifications}
          wechatReminders={wechatReminders}
          imSources={imSources}
          source={messageSource}
          enabledSources={enabledSources ?? features}
          onSourceChange={openMessages}
          onOpenMailSettings={() => onOpenSettings("mail")}
        />
      )}
    </div>
  );
}

const headerSlot = defineSlot<HeaderContext, IslandHeaderMeta<HeaderContext>>("island.header/v1");

function MessagesButton({ page, withShortcut }: HeaderContext) {
  const t = useTranslation();
  const messages = messagesIsland.use();
  const qqNotificationCount = messages?.qq.snapshot.items.length ?? 0;
  const wechatPending = messages?.wechat.snapshot.pending ?? false;
  const extraCount = messages?.im ? imUnreadTotal(messages.im.snapshots) : 0;
  const pendingIm = messages?.im ? firstPendingImSource(messages.im.snapshots) : null;
  const messageBadgeLabel = t.messages.badge(qqNotificationCount, wechatPending, extraCount);
  const defaultSource = messages?.enabledSources ? resolveMessageSource("qq", messages.enabledSources) : "qq";
  const target = qqNotificationCount > 0 ? "qq" : wechatPending ? "wechat" : pendingIm ?? defaultSource;
  return (
    <button
      className={`icon-button island-message-button${page === "qq" ? " island-message-button--active" : ""}`}
      type="button"
      aria-label={withShortcut(t.messages.label(messageBadgeLabel), "qq")}
      aria-pressed={page === "qq"}
      onClick={() => messages?.open(target)}
    >
      <Bell size={16} strokeWidth={1.5} absoluteStrokeWidth />
      {(qqNotificationCount > 0 || wechatPending || extraCount > 0) && <span className="island-message-button__dot" aria-hidden="true" />}
    </button>
  );
}

pageSlot.add({ ...islandPage, component: MessagesPage }, OWNER);
headerSlot.add({ id: "messages", order: 20, enabled: ({ isPageEnabled }) => isPageEnabled("qq"), component: MessagesButton }, OWNER);

type CollapsedContext = {
  t: Translations;
  hints: ReadonlySet<string>;
};

const collapsedSlot = defineSlot<CollapsedContext, IslandCollapsedMeta<CollapsedContext>>("island.collapsed/v1");

function MailItem({ t }: CollapsedContext) {
  const messages = messagesIsland.use();
  return (
    <button className="island-message-button island-message-button--compact qq-mail-badge" type="button" aria-label={t.messages.newMailLabel} onClick={() => messages?.open("qqMail")}>
      <MessageSourceIcon source="qqMail" size={16} account={messages?.mail.previewAccount} />
      <span className="island-message-button__dot" aria-hidden="true" />
    </button>
  );
}

collapsedSlot.add({ id: "mail", order: 20, shown: ({ hints }) => hints.has("messages.mail"), component: MailItem }, OWNER);
