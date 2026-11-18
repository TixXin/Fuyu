import { useEffect, useRef, useSyncExternalStore, type WheelEvent } from "react";
import { useLocale, useTranslation } from "../../i18n";
import { ImNotificationPanel } from "./im-sources/ImNotificationPanel";
import { IM_SOURCE_IDS, imSourceBadge, isImSource } from "./im-sources/imSourcesState";
import type { ImSourcesController } from "./im-sources/useImSources";
import { MailPanel, type MailController } from "./mail/MailPanel";
import { sharedMailProvider } from "./mail/mailProvider";
import { MessageSourceIcon } from "./MessageSourceIcon";
import { getMessageSourcesSnapshot, subscribeMessageSources } from "./host/sources.mjs";
import { mailBadgeCount, type MessageSource } from "./messagePreview";
import { QQNotificationPanel, type QQNotificationsController } from "./qq-notifications/QQNotifications";
import { WeChatReminderPanel, type WeChatRemindersController } from "./wechat/WeChatReminders";

export type MessageView = MessageSource;

type EnabledSourceMap = Pick<Record<MessageSource, boolean>, "qq" | "wechat" | "qqMail"> &
  Partial<Readonly<Record<MessageSource, boolean>>>;

type MessagesProps = {
  qqMail: MailController;
  qqNotifications: QQNotificationsController;
  wechatReminders: WeChatRemindersController;
  imSources?: ImSourcesController;
  source: MessageView;
  enabledSources: EnabledSourceMap;
  onSourceChange: (source: MessageView) => void;
  onOpenMailSettings?: () => void;
};

export function messagePanelHeight(source: MessageView, readingMail = false) {
  return source === "qqMail" && readingMail ? 450 : 350;
}

export function MessagesPanel({
  qqMail,
  qqNotifications,
  wechatReminders,
  imSources,
  source,
  enabledSources,
  onSourceChange,
  onOpenMailSettings,
}: MessagesProps) {
  const t = useTranslation();
  const locale = useLocale().locale === "en" ? "en" : "zh";
  const navRef = useRef<HTMLDivElement | null>(null);
  const { snapshot: qq } = qqNotifications;
  const extraSources = useSyncExternalStore(subscribeMessageSources, getMessageSourcesSnapshot).filter((item) => !item.builtin && item.enabled);
  const enabledImIds = IM_SOURCE_IDS.filter((id) => enabledSources[id] ?? imSources?.snapshots[id].enabled ?? false);
  const totalTabs = Number(enabledSources.qq) + Number(enabledSources.wechat) + Number(enabledSources.qqMail) + enabledImIds.length + extraSources.length;
  const crowded = totalTabs > 3;

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    const active = nav.querySelector<HTMLElement>("[aria-pressed='true']");
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [source, totalTabs]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      nav.scrollLeft += event.deltaY;
    }
  };

  const navigate = (next: MessageView) => onSourceChange(next);
  const navigation = (
    <div
      ref={navRef}
      className={crowded ? "message-sources message-sources--crowded" : "message-sources"}
      role="group"
      aria-label={t.messages.sources}
      onWheel={handleWheel}
    >
      {enabledSources.qq && (
        <button type="button" aria-label={t.messages.qqNotifications} aria-pressed={source === "qq"} onClick={() => navigate("qq")}>
          <MessageSourceIcon source="qq" />
          <span>QQ</span>
          {qq.items.length > 0 && <span className="message-source-count">{mailBadgeCount(qq.items.length)}</span>}
        </button>
      )}
      {enabledSources.wechat && (
        <button type="button" aria-label={t.messages.wechatReminders} aria-pressed={source === "wechat"} onClick={() => navigate("wechat")}>
          <MessageSourceIcon source="wechat" />
          <span>{t.messages.wechat}</span>
          {wechatReminders.snapshot.pending && <span className="message-source-dot" aria-label={t.messages.newReminder} />}
        </button>
      )}
      {enabledSources.qqMail && (
        <button type="button" aria-label={t.messages.qqMail} aria-pressed={source === "qqMail"} onClick={() => navigate("qqMail")}>
          <MessageSourceIcon source="qqMail" mailProvider={sharedMailProvider(qqMail.mailboxes.map((mailbox) => mailbox.email))} />
          <span>{t.messages.mail}</span>
          {qqMail.unreadTotal > 0 && <span className="message-source-count">{mailBadgeCount(qqMail.unreadTotal)}</span>}
        </button>
      )}
      {enabledImIds.map((id) => {
        const name = t.messages.sourceLabels[id];
        const snap = imSources?.snapshots[id];
        const badge = snap ? imSourceBadge(snap) : { count: 0, dot: false };
        return (
          <button key={id} type="button" aria-label={t.messages.im.navLabel(name)} aria-pressed={source === id} onClick={() => navigate(id)}>
            <MessageSourceIcon source={id} />
            <span>{name}</span>
            {badge.count > 0
              ? <span className="message-source-count">{mailBadgeCount(badge.count)}</span>
              : badge.dot
                ? <span className="message-source-dot" aria-label={t.messages.newReminder} />
                : null}
          </button>
        );
      })}
      {extraSources.map((entry) => {
        const label = typeof entry.label === "string" ? entry.label : entry.label[locale] ?? entry.label.zh;
        return (
          <button key={entry.id} type="button" aria-label={label} aria-pressed={false}>
            <MessageSourceIcon source="plugin" />
            <span>{label}</span>
            {entry.unreadCount > 0 ? <span className="message-source-count">{mailBadgeCount(entry.unreadCount)}</span> : entry.pending ? <span className="message-source-dot" aria-label={t.messages.newReminder} /> : null}
          </button>
        );
      })}
    </div>
  );

  if (source === "qqMail") return <MailPanel controller={qqMail} navigation={navigation} onOpenSettings={onOpenMailSettings} />;
  if (source === "wechat") return <WeChatReminderPanel controller={wechatReminders} navigation={navigation} />;
  if (isImSource(source) && imSources) {
    const snapshot = imSources.snapshots[source];
    const busy = imSources.busySource === "all" || imSources.busySource === source;
    return (
      <ImNotificationPanel
        source={source}
        controller={{
          snapshot,
          busy,
          actionError: imSources.actionErrors[source] ?? null,
          setEnabled: (enabled) => imSources.setEnabled(source, enabled),
          requestAccess: () => imSources.requestAccess(source),
          openSettings: () => imSources.openSettings(source),
          refresh: () => imSources.refresh(source),
          clear: () => imSources.clear(source),
          openApp: () => imSources.openSource(source),
        }}
        navigation={navigation}
      />
    );
  }
  return <QQNotificationPanel controller={qqNotifications} navigation={navigation} />;
}
