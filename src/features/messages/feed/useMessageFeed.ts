import { useCallback, useMemo } from "react";
import { useTranslation } from "../../../i18n";
import { copyMessageText } from "../../../lib/api";
import { IM_SOURCE_IDS, isImSource, type ImNotificationItem, type ImSourceId } from "../im-sources/imSourcesState";
import type { MessageSource } from "../messagePreview";
import { extractVerificationCode } from "../otp";
import { useMessageOtpCopyEnabled } from "../plugin/useSourceSwitches";
import { buildFeed, type FeedItem } from "./feedModel";
import type { FeedActions, FeedControllers, MessageFeed } from "./types";
import { useFeedHandled } from "./useFeedHandled";
import { useFeedSources } from "./useFeedSources";
import { useNow } from "./useNow";

const noOtp = () => null;

export function useMessageFeed(controllers: FeedControllers): MessageFeed {
  const t = useTranslation();
  const now = useNow();
  const otpEnabled = useMessageOtpCopyEnabled();
  const { handled, mark } = useFeedHandled();
  const { qqNotifications: qq, wechatReminders: wechat, qqMail: mail, imSources, enabledSources, onOpenMailSettings } = controllers;

  const items = useMemo(() => {
    const im: Partial<Record<ImSourceId, readonly ImNotificationItem[]>> = {};
    if (imSources) for (const id of IM_SOURCE_IDS) if (enabledSources[id] ?? imSources.snapshots[id].enabled) im[id] = imSources.snapshots[id].items;
    return buildFeed({
      qq: enabledSources.qq ? qq.snapshot.items : null,
      wechat: enabledSources.wechat ? wechat.snapshot : null,
      mailboxes: enabledSources.qqMail ? mail.mailboxes : [],
      im,
      handled: new Set(handled),
      findOtp: otpEnabled ? (text) => extractVerificationCode(text) : noOtp,
      now,
      text: {
        wechat: t.messages.wechat,
        newReminder: t.messages.newReminder,
        plainReason: (reason) => (reason ? t.wechat.plainReason[reason] : t.messages.newReminder),
        flashBody: t.messages.im.flashBody,
        noSubject: t.messages.feed.noSubject,
      },
    });
  }, [enabledSources, handled, imSources, mail.mailboxes, now, otpEnabled, qq.snapshot.items, t, wechat.snapshot]);

  const sources = useFeedSources(controllers, items);

  const markChats = useCallback((list: readonly FeedItem[]) => {
    const keys = list.filter((item) => item.source !== "qqMail" && item.unread > 0).map((item) => item.key);
    if (keys.length > 0) mark(keys, new Set(items.map((item) => item.key)));
  }, [items, mark]);

  const actions = useMemo<FeedActions>(() => ({
    open: (item) => {
      if (item.source === "qqMail") { if (item.mail) void mail.readMail(item.mail, item.account); return; }
      markChats([item]);
      if (item.source === "qq") void qq.openQQ();
      else if (item.source === "wechat") void wechat.openWeChat(item.chat);
      else if (isImSource(item.source)) void imSources?.openSource(item.source);
    },
    read: (list) => {
      markChats(list);
      for (const item of list) if (item.source === "qqMail" && item.unread > 0 && item.account) void mail.markRead(item.account, item.id);
    },
    readAll: (source) => {
      markChats(items.filter((item) => !source || item.source === source));
      if (!source || source === "qqMail") for (const box of mail.mailboxes) if (box.email && box.items.some((item) => item.unread)) void mail.markAllRead(box.email);
    },
    copy: (text) => copyMessageText(text).then(() => true, () => false),
    openApp: (source) => {
      if (source === "qq") void qq.openQQ();
      else if (source === "wechat") void wechat.openWeChat();
      else if (source === "qqMail") void mail.openMail();
      else if (isImSource(source)) void imSources?.openSource(source);
    },
    clear: (source) => {
      if (!source || source === "qq") void qq.clear();
      if (!source || source === "wechat") void wechat.clear();
      if (!source) imSources?.clearAll();
      else if (isImSource(source)) void imSources?.clear(source);
    },
    refresh: (source) => {
      if (!source || source === "qq") void qq.refresh();
      if (!source || source === "qqMail") void mail.refresh();
      if (!source) void imSources?.refresh();
      else if (isImSource(source)) void imSources?.refresh(source);
    },
    enable: (source: MessageSource) => {
      if (source === "qq") void qq.setEnabled(true);
      else if (source === "wechat") void wechat.setEnabled(true);
      else if (source === "qqMail") void mail.setAllEnabled(true);
      else if (isImSource(source)) void imSources?.setEnabled(source, true);
    },
    fix: (source) => {
      if (source === "qq") void (qq.snapshot.status === "permissionRequired" ? qq.requestAccess() : qq.openSettings());
      else if (source === "qqMail") onOpenMailSettings?.();
      else if (isImSource(source)) void (imSources?.snapshots[source].status === "permissionRequired" ? imSources.requestAccess(source) : imSources?.openSettings(source));
    },
    compose: mail.mailboxes.some((box) => box.configured && box.status !== "authRequired") ? mail.startCompose : null,
  }), [imSources, items, mail, markChats, onOpenMailSettings, qq, wechat]);

  return { items, sources, now, actions };
}
