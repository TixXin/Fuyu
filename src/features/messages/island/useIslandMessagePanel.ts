import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "../../../i18n";
import { copyMessageText } from "../../../lib/api";
import { addArrival, arrivalKey, estimateArrivalsHeight, removeArrival, type ArrivalMessage } from "../arrivals/messageArrivals";
import { isImSource } from "../im-sources/imSourcesState";
import type { ImSourcesController } from "../im-sources/useImSources";
import type { MailMessage } from "../mail/api";
import type { MessageSource } from "../messagePreview";
import { extractVerificationCode, otpActionId, parseOtpAction } from "../otp";
import { runNoticeAction } from "../plugin/notices";
import { useMessageOtpCopyEnabled } from "../plugin/useSourceSwitches";
import type { useIslandNotices } from "./useIslandNotices";
import { HOVER_HOLD_RETRY_MS } from "../../plugin-kernel/hoverHold";
import { runIslandAction } from "../../plugin-kernel/useIslandContributions";
import { useHoverHold } from "../../plugin-kernel/useHoverHold";
import { useOutsideClick } from "../../plugin-kernel/useOutsideClick";
import type { IslandHost } from "../../plugin-kernel/islandHost";

export type PanelArrival = ArrivalMessage & { mail?: { message: MailMessage; account: string | null }; pluginId?: string };

type PanelNotices = Pick<ReturnType<typeof useIslandNotices>, "preview" | "qqNotifications" | "wechatReminders" | "qqMail" | "pluginNotifications" | "setMessagePanelOpen"> & {
  imSources?: ImSourcesController;
};

type MessagePanelOptions = {
  enabled: boolean;
  mediaOnly?: boolean;
  durationMs: number;
  notices: PanelNotices;
  mode: string;
  page: string;
  openIslandPage: (page: "qq") => void;
  collapseIsland: () => void;
  onOpenMessages: (source: MessageSource) => void;
  host: IslandHost;
};

export function useIslandMessagePanel({ enabled, mediaOnly = false, durationMs, notices, mode, page, openIslandPage, collapseIsland, onOpenMessages, host }: MessagePanelOptions) {
  const { preview, qqNotifications, wechatReminders, qqMail, pluginNotifications, imSources, setMessagePanelOpen } = notices;
  const t = useTranslation().messages;
  const otpEnabled = useMessageOtpCopyEnabled();
  const [arrivals, setArrivals] = useState<PanelArrival[] | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const autoOpenedRef = useRef(false);
  const pendingOpenRef = useRef(false);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const closeAtRef = useRef(0);
  const handledKeyRef = useRef<string | null>(null);
  const isOnMessages = mode === "expanded" && page === "qq";
  const holdsOpen = useHoverHold(host);
  const latest = useRef({ mode, isOnMessages, durationMs, collapseIsland, openIslandPage, holdsOpen });
  useLayoutEffect(() => {
    latest.current = { mode, isOnMessages, durationMs, collapseIsland, openIslandPage, holdsOpen };
  });

  const end = useCallback(() => {
    autoOpenedRef.current = false;
    pendingOpenRef.current = false;
    window.clearTimeout(closeTimerRef.current);
    setArrivals(null);
    setMeasuredHeight(null);
    setMessagePanelOpen(false);
  }, [setMessagePanelOpen]);

  const close = useCallback(() => {
    const wasOpen = latest.current.isOnMessages;
    end();
    if (wasOpen) latest.current.collapseIsland();
  }, [end]);

  const incoming = enabled && preview && (!mediaOnly || preview.mediaControls === true) ? toArrival(preview, notices, otpEnabled, t.copyCode) : null;
  const incomingKey = incoming ? `${arrivalKey(incoming)}:${incoming.receivedAt}` : null;
  const incomingActionsKey = incoming ? incoming.actions.map((item) => `${item.id}:${item.title}`).join("|") : "";
  const incomingRef = useRef(incoming);
  incomingRef.current = incoming;
  useEffect(() => {
    const message = incomingRef.current;
    if (!message || !incomingKey || handledKeyRef.current === incomingKey) return;
    handledKeyRef.current = incomingKey;
    const current = latest.current;
    if (current.mode !== "collapsed" && !autoOpenedRef.current) return;
    setArrivals((list) => addArrival((list ?? []).filter((item) => !(message.mediaControls && item.mediaControls && item.pluginId === message.pluginId)), message));
    setMessagePanelOpen(true);
    const until = Date.now() + (message.durationMs ?? current.durationMs);
    closeAtRef.current = autoOpenedRef.current ? Math.max(closeAtRef.current, until) : until;
    autoOpenedRef.current = true;
    if (current.mode === "collapsed") pendingOpenRef.current = true;
    const closeLater = (heldSince: number) => {
      if (!autoOpenedRef.current) return;
      if (latest.current.holdsOpen(heldSince)) {
        closeTimerRef.current = window.setTimeout(() => closeLater(heldSince), HOVER_HOLD_RETRY_MS);
        return;
      }
      close();
    };
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => closeLater(Date.now()), Math.max(0, closeAtRef.current - Date.now()));
  }, [incomingKey, close, setMessagePanelOpen]);

  const showing = arrivals !== null;
  useLayoutEffect(() => {
    if (!pendingOpenRef.current) return;
    pendingOpenRef.current = false;
    if (arrivals !== null && latest.current.mode === "collapsed") {
      latest.current.openIslandPage("qq");
    }
  }, [arrivals]);
  useEffect(() => {
    const message = incomingRef.current;
    if (!showing || !message) return;
    setArrivals((list) => {
      if (!list || !list.some((item) => arrivalKey(item) === arrivalKey(message) && item.receivedAt === message.receivedAt)) return list;
      return addArrival(list, message);
    });
  }, [incomingActionsKey, showing]);
  const showAll = useCallback(() => {
    autoOpenedRef.current = false;
    pendingOpenRef.current = false;
    window.clearTimeout(closeTimerRef.current);
    setArrivals(null);
    setMeasuredHeight(null);
    setMessagePanelOpen(false);
  }, [setMessagePanelOpen]);
  useEffect(() => {
    if (!showing) return;
    const takeOver = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".message-arrivals__media, .message-arrivals__clear")) return;
      autoOpenedRef.current = false;
      window.clearTimeout(closeTimerRef.current);
      if (!(event.target instanceof Element && event.target.closest(".message-arrivals__list"))) showAll();
    };
    window.addEventListener("pointerdown", takeOver, true);
    return () => window.removeEventListener("pointerdown", takeOver, true);
  }, [showing, showAll]);

  const wasExpandedRef = useRef(mode === "expanded");
  useEffect(() => {
    const collapsedNow = mode === "collapsed" && wasExpandedRef.current;
    wasExpandedRef.current = mode === "expanded";
    if (showing && (collapsedNow || (mode === "expanded" && page !== "qq"))) end();
  }, [mode, page, showing, end]);
  useEffect(() => {
    if (!enabled && showing) close();
  }, [enabled, showing, close]);
  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  useOutsideClick(showing && isOnMessages, close, host);

  const open = useCallback((message: PanelArrival) => {
    if (message.source === "plugin" && message.mediaControls) {
      pluginNotifications.dismiss();
      end();
      if (!runIslandAction("media.open-page")) latest.current.collapseIsland();
      return;
    }
    if (message.source === "plugin") {
      pluginNotifications.dismiss();
      const rest = removeArrival(arrivals ?? [], arrivalKey(message));
      if (rest.length === 0) close();
      else setArrivals(rest);
      return;
    }
    end();
    if (message.source === "qqMail" && message.mail) {
      onOpenMessages("qqMail");
      void qqMail.readMail(message.mail.message, message.mail.account);
      return;
    }
    if (isImSource(message.source)) {
      const source = message.source;
      void imSources?.openSource(source).then((opened) => {
        if (opened === false) onOpenMessages(source);
        else latest.current.collapseIsland();
      });
      return;
    }
    const source = message.source;
    const launch = source === "qq" ? qqNotifications.openQQ() : wechatReminders.openWeChat(message.chat);
    void launch.then((opened) => {
      if (opened === false) onOpenMessages(source);
      else latest.current.collapseIsland();
    });
  }, [arrivals, close, end, imSources, onOpenMessages, pluginNotifications, qqMail, qqNotifications, wechatReminders]);

  const runAction = useCallback((message: PanelArrival, action: string) => {
    const otp = parseOtpAction(action);
    if (otp) {
      void copyMessageText(otp).catch(() => undefined);
      if (message.source === "qqMail") qqMail.dismissPreview();
      else if (message.source === "qq") qqNotifications.dismissPreview();
      else if (message.source === "wechat") wechatReminders.dismissPreview();
      else if (isImSource(message.source)) imSources?.dismissPreview(message.source);
      const rest = removeArrival(arrivals ?? [], arrivalKey(message));
      if (rest.length === 0) close();
      else setArrivals(rest);
      return;
    }
    if (message.pluginId) runNoticeAction(message.pluginId, action);
    pluginNotifications.dismiss();
    const rest = removeArrival(arrivals ?? [], arrivalKey(message));
    if (rest.length === 0) close();
    else setArrivals(rest);
  }, [arrivals, close, imSources, pluginNotifications, qqMail, qqNotifications, wechatReminders]);

  const clearAll = useCallback(() => {
    const mails = (arrivals ?? []).flatMap((item) => item.mail?.account && item.mail.message.unread ? [{ account: item.mail.account, id: item.mail.message.id }] : []);
    void (async () => { for (const mail of mails) await qqMail.markRead(mail.account, mail.id); })();
    void qqNotifications.clear();
    void wechatReminders.clear();
    imSources?.clearAll();
    qqNotifications.dismissPreview();
    wechatReminders.dismissPreview();
    imSources?.dismissAllPreviews();
    qqMail.dismissPreview();
    pluginNotifications.dismiss();
    close();
  }, [arrivals, close, imSources, pluginNotifications, qqMail, qqNotifications, wechatReminders]);

  const visibleArrivals = showing && (mode === "collapsed" || page === "qq") ? arrivals : null;
  const height = visibleArrivals ? (measuredHeight ?? estimateArrivalsHeight(visibleArrivals)) : 0;

  return {
    clearAll,
    arrivals: visibleArrivals,
    height,
    measure: setMeasuredHeight,
    open,
    runAction,
    showAll,
  };
}

function toArrival(
  preview: NonNullable<PanelNotices["preview"]>,
  notices: PanelNotices,
  otpEnabled: boolean,
  copyCodeLabel: (code: string) => string,
): PanelArrival {
  const { qqMail, pluginNotifications } = notices;
  const notification = pluginNotifications.notification;
  if (preview.source === "plugin" && notification) {
    return { ...preview, actions: notification.actions, pluginId: notification.pluginId, durationMs: notification.durationMs };
  }
  const richIm = preview.source !== "plugin" && isImSource(preview.source) && preview.kind !== "flash" && preview.kind !== "badge";
  const otp = !otpEnabled ? null
    : preview.source === "qqMail" ? qqMail.previewOtp
      : preview.source === "qq" || richIm || (preview.source === "wechat" && preview.chat) ? extractVerificationCode(preview.title, preview.body)
        : null;
  const actions = otp ? [{ id: otpActionId(otp), title: copyCodeLabel(otp) }] : [];
  const base: PanelArrival = { ...preview, actions };
  if (preview.source === "qqMail" && qqMail.preview) {
    return { ...base, mail: { message: qqMail.preview, account: qqMail.previewAccount } };
  }
  return base;
}
