import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../i18n";
import { copyMessageText } from "../../../lib/api";
import type { MessageNotice } from "../../../lib/settings/types";
import { BANNER_MS, type BannerMessage } from "../banner/bannerMessages";
import { useMessageBanner } from "../banner/useMessageBanner";
import { isImSource } from "../im-sources/imSourcesState";
import type { ImSourcesController } from "../im-sources/useImSources";
import type { MailMessage } from "../mail/api";
import type { MessagePreview, MessageSource } from "../messagePreview";
import { extractVerificationCode, otpActionId, parseOtpAction } from "../otp";
import type { IslandHost } from "../../plugin-kernel/islandHost";
import { runNoticeAction } from "../plugin/notices";
import { useMessageOtpCopyEnabled } from "../plugin/useSourceSwitches";
import type { useIslandNotices } from "./useIslandNotices";

type IslandBannerMessage = BannerMessage & { mail?: { message: MailMessage; account: string | null }; pluginId?: string };

type BannerNotices = Pick<ReturnType<typeof useIslandNotices>, "preview" | "hasMessagePreview" | "qqNotifications" | "wechatReminders" | "qqMail" | "pluginNotifications"> & {
  imSources?: ImSourcesController;
};

type IslandBannerOptions = {
  messageNotice: MessageNotice;
  notices: BannerNotices;
  mode: string;
  isTucked: boolean;
  quiet: boolean;
  onOpenMessages: (source: MessageSource) => void;
  host: IslandHost;
};

export function useIslandBanner({ messageNotice, notices, mode, isTucked, quiet, onOpenMessages, host }: IslandBannerOptions) {
  const { preview, qqNotifications, wechatReminders, qqMail, pluginNotifications, imSources } = notices;
  const t = useTranslation().messages;
  const otpEnabled = useMessageOtpCopyEnabled();
  const usesBanner = messageNotice === "banner";
  const incoming = usesBanner && preview && !preview.mediaControls ? bannerMessage(preview, notices, otpEnabled, t.copyCode) : null;
  const [hovered, setHovered] = useState(false);
  const { banner, close } = useMessageBanner(usesBanner && !quiet && mode === "collapsed" && !isTucked, incoming, hovered);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const showing = banner !== null;

  useEffect(() => {
    if (!showing) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void host.listenBannerHover(setHovered)
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
  }, [showing, host]);

  useEffect(() => {
    const element = bannerRef.current;
    if (!showing || !element) return;
    const send = () => {
      const rect = element.getBoundingClientRect();
      void host.setBannerRect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }).catch(() => undefined);
    };
    send();
    const observer = new ResizeObserver(send);
    observer.observe(element);
    element.addEventListener("animationend", send);
    return () => {
      observer.disconnect();
      element.removeEventListener("animationend", send);
      void host.setBannerRect(null).catch(() => undefined);
    };
  }, [showing, host]);

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
    } else if (isImSource(message.source)) {
      const source = message.source;
      void imSources?.openSource(source).then((opened) => {
        if (opened === false) onOpenMessages(source);
      });
    }
  }, [banner, close, imSources, onOpenMessages, pluginNotifications, qqMail, qqNotifications, wechatReminders]);

  const runAction = useCallback((action: string) => {
    const otp = parseOtpAction(action);
    if (otp) {
      const source = banner?.message.source;
      close();
      if (source === "qqMail") qqMail.dismissPreview();
      else if (source === "qq") qqNotifications.dismissPreview();
      else if (source === "wechat") wechatReminders.dismissPreview();
      else if (source && isImSource(source)) imSources?.dismissPreview(source);
      void copyMessageText(otp).catch(() => undefined);
      return;
    }
    const pluginId = banner?.message.pluginId;
    close();
    pluginNotifications.dismiss();
    if (pluginId) runNoticeAction(pluginId, action);
  }, [banner, close, imSources, pluginNotifications, qqMail, qqNotifications, wechatReminders]);

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

function bannerMessage(
  preview: MessagePreview,
  notices: BannerNotices,
  otpEnabled: boolean,
  copyCodeLabel: (code: string) => string,
): IslandBannerMessage {
  const { qqMail, pluginNotifications } = notices;
  const notification = pluginNotifications.notification;
  if (preview.source === "plugin" && notification) {
    return { ...preview, durationMs: notification.durationMs, actions: notification.actions, pluginId: notification.pluginId };
  }
  const richIm = preview.source !== "plugin" && isImSource(preview.source) && preview.kind !== "flash" && preview.kind !== "badge";
  const otp = !otpEnabled ? null
    : preview.source === "qqMail" ? qqMail.previewOtp
      : preview.source === "qq" || richIm || (preview.source === "wechat" && preview.chat) ? extractVerificationCode(preview.title, preview.body)
        : null;
  const actions = otp ? [{ id: otpActionId(otp), title: copyCodeLabel(otp) }] : [];
  const base: IslandBannerMessage = { ...preview, durationMs: BANNER_MS, actions };
  if (preview.source === "qqMail" && qqMail.preview) {
    return { ...base, mail: { message: qqMail.preview, account: qqMail.previewAccount } };
  }
  return base;
}
