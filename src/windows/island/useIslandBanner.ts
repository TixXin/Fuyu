import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageNotice } from "../../features/appearance/types";
import { BANNER_MS, type BannerMessage } from "../../features/messages/banner/bannerMessages";
import { useMessageBanner } from "../../features/messages/banner/useMessageBanner";
import type { MailMessage } from "../../features/messages/mail/api";
import type { MessagePreview, MessageSource } from "../../features/messages/messagePreview";
import { runPluginNotificationAction } from "../../features/plugins/api";
import { listenIslandBannerHover, setIslandBannerRect } from "./api";
import type { useIslandNotices } from "./useIslandNotices";
import type { IslandMode } from "./types";

type IslandBannerMessage = BannerMessage & { mail?: { message: MailMessage; account: string | null }; pluginId?: string };

type BannerNotices = Pick<ReturnType<typeof useIslandNotices>, "preview" | "hasMessagePreview" | "qqNotifications" | "wechatReminders" | "qqMail" | "pluginNotifications">;

type IslandBannerOptions = {
  messageNotice: MessageNotice;
  notices: BannerNotices;
  mode: IslandMode;
  isTucked: boolean;
  quiet: boolean;
  onOpenMessages: (source: MessageSource) => void;
};

export function useIslandBanner({ messageNotice, notices, mode, isTucked, quiet, onOpenMessages }: IslandBannerOptions) {
  const { preview, qqNotifications, wechatReminders, qqMail, pluginNotifications } = notices;
  const usesBanner = messageNotice === "banner";
  const incoming = usesBanner && preview ? bannerMessage(preview, notices) : null;
  const [hovered, setHovered] = useState(false);
  const { banner, close } = useMessageBanner(usesBanner && !quiet && mode === "collapsed" && !isTucked, incoming, hovered);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const showing = banner !== null;

  useEffect(() => {
    if (!showing) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenIslandBannerHover(setHovered)
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unlisten?.();
      setHovered(false);
    };
  }, [showing]);

  useEffect(() => {
    const element = bannerRef.current;
    if (!showing || !element) return;
    const send = () => {
      const rect = element.getBoundingClientRect();
      void setIslandBannerRect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }).catch(() => undefined);
    };
    send();
    const observer = new ResizeObserver(send);
    observer.observe(element);
    element.addEventListener("animationend", send);
    return () => {
      observer.disconnect();
      element.removeEventListener("animationend", send);
      void setIslandBannerRect(null).catch(() => undefined);
    };
  }, [showing]);

  const open = useCallback(() => {
    const message = banner?.message;
    close();
    if (!message) return;
    if (message.source === "plugin") {
      pluginNotifications.dismiss();
    } else if (message.source === "qqMail" && message.mail) {
      onOpenMessages("qqMail");
      void qqMail.readMail(message.mail.message, message.mail.account);
    } else if (message.source === "qq" || message.source === "wechat") {
      const source = message.source;
      const launch = source === "qq" ? qqNotifications.openQQ() : wechatReminders.openWeChat(message.chat);
      void launch.then((opened) => {
        if (opened === false) onOpenMessages(source);
      });
    }
  }, [banner, close, onOpenMessages, pluginNotifications, qqMail, qqNotifications, wechatReminders]);

  const runAction = useCallback((action: string) => {
    const pluginId = banner?.message.pluginId;
    close();
    pluginNotifications.dismiss();
    if (!pluginId) return;
    void runPluginNotificationAction(pluginId, action).catch((error: unknown) =>
      console.error("Failed to run a plugin notification action", error),
    );
  }, [banner, close, pluginNotifications]);

  return {
    banner,
    bannerRef,
    barPreview: usesBanner || messageNotice === "panel" ? null : preview,
    hasLinePreview: usesBanner || messageNotice === "panel" ? false : notices.hasMessagePreview,
    showing,
    open,
    close,
    runAction,
  };
}

function bannerMessage(preview: MessagePreview, notices: BannerNotices): IslandBannerMessage {
  const base: IslandBannerMessage = { ...preview, durationMs: BANNER_MS, actions: [] };
  const { qqMail, pluginNotifications } = notices;
  if (preview.source === "qqMail" && qqMail.preview) {
    return { ...base, mail: { message: qqMail.preview, account: qqMail.previewAccount } };
  }
  const notification = pluginNotifications.notification;
  if (preview.source === "plugin" && notification) {
    return { ...base, durationMs: notification.durationMs, actions: notification.actions, pluginId: notification.pluginId };
  }
  return base;
}
