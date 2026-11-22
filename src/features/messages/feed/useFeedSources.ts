import { useMemo } from "react";
import { useTranslation } from "../../../i18n";
import { IM_SOURCE_IDS, type ImSourceStatus } from "../im-sources/imSourcesState";
import type { MessageSource } from "../messagePreview";
import { unreadTotal, type FeedItem } from "./feedModel";
import type { FeedControllers, FeedSourceState, FeedSourceStatus } from "./types";

function chatStatus(enabled: boolean, status: ImSourceStatus | "permissionRequired"): FeedSourceStatus {
  if (!enabled || status === "disabled") return "off";
  if (status === "permissionRequired" || status === "permissionDenied") return "access";
  if (status === "error") return "error";
  if (status === "waiting") return "waiting";
  return "ok";
}

export function useFeedSources(controllers: FeedControllers, items: readonly FeedItem[]): FeedSourceState[] {
  const t = useTranslation();
  const { qqNotifications: qq, wechatReminders: wechat, qqMail: mail, imSources, enabledSources } = controllers;
  return useMemo(() => {
    const list: FeedSourceState[] = [];
    const push = (id: MessageSource, status: FeedSourceStatus, error: string | null, busy: boolean) => {
      list.push({ id, label: t.messages.sourceLabels[id], status, unread: unreadTotal(items, id), error, busy });
    };
    if (enabledSources.qq) push("qq", chatStatus(qq.snapshot.enabled, qq.snapshot.status), qq.actionError ?? qq.snapshot.error, qq.busy);
    if (enabledSources.wechat) push("wechat", chatStatus(wechat.snapshot.enabled, wechat.snapshot.status), wechat.actionError ?? wechat.snapshot.error, wechat.busy);
    if (enabledSources.qqMail) {
      const boxes = mail.mailboxes.filter((box) => box.configured);
      const status: FeedSourceStatus = boxes.length === 0 ? "setup"
        : boxes.some((box) => box.status === "authRequired") ? "auth"
          : !boxes.some((box) => box.enabled) ? "off"
            : boxes.some((box) => box.enabled && box.status === "error") ? "error" : "ok";
      const boxError = boxes.find((box) => box.error)?.error;
      push("qqMail", status, mail.actionError ?? (typeof boxError === "string" ? boxError : null), mail.busy);
    }
    if (imSources) {
      for (const id of IM_SOURCE_IDS) {
        const snap = imSources.snapshots[id];
        if (!(enabledSources[id] ?? snap.enabled)) continue;
        const busy = imSources.busySource === "all" || imSources.busySource === id;
        push(id, chatStatus(snap.enabled, snap.status), imSources.actionErrors[id] ?? snap.error, busy);
      }
    }
    return list;
  }, [enabledSources, imSources, items, mail.actionError, mail.busy, mail.mailboxes, qq.actionError, qq.busy, qq.snapshot, t, wechat.actionError, wechat.busy, wechat.snapshot]);
}
