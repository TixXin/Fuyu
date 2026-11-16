import { useMemo } from "react";
import { useUnsupportedFeatures } from "../../../lib/platform";
import type { IslandSettings } from "../../../lib/settings/types";
import type { IslandHost } from "../../plugin-kernel/islandHost";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandBanner } from "../island/useIslandBanner";
import { useIslandMessagePanel } from "../island/useIslandMessagePanel";
import { useIslandNotices } from "../island/useIslandNotices";
import { useMailSwitch, useSourceFallback } from "../island/useMessageSwitches";
import { useMessageView } from "../island/useMessageView";
import { useTuckHold } from "../island/useTuckHold";
import { useMessagesIsland } from "./islandMessages";
import { OWNER } from "./owner.ts";
import { useSourceReconcile } from "./useSourceSwitches";

type RunnerProps = {
  settings: IslandSettings;
  mode: string;
  page: string;
  isTucked: boolean;
  quiet: boolean;
  host: IslandHost;
  openIslandPage: (page: "qq") => void;
  collapseIsland: () => void;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function MessagesRunner({ settings, mode, page, isTucked, quiet, host, openIslandPage, collapseIsland }: RunnerProps) {
  const unsupported = useUnsupportedFeatures();
  const notices = useIslandNotices({ mode, isTucked, quiet, revealOnMessage: settings.revealOnMessage });
  const { qqNotifications, wechatReminders, qqMail, pluginNotifications, hasMessagePreview } = notices;
  const { messageSource, setMessageSource, openMessages } = useMessageView(qqMail.closeReader, openIslandPage);
  const banner = useIslandBanner({ messageNotice: settings.messageNotice, notices, mode, isTucked, quiet, onOpenMessages: openMessages, host });
  const panel = useIslandMessagePanel({
    enabled: settings.messageNotice === "panel" && !quiet,
    durationMs: settings.messagePanelSeconds * 1000,
    notices, mode, page, openIslandPage, collapseIsland, onOpenMessages: openMessages, host,
  });
  const hold = useTuckHold(settings, { messagesOpen: mode === "expanded" && page === "qq", notices });
  useSourceReconcile();
  useMailSwitch(settings.mailEnabled, qqMail);
  const qq = qqNotifications.snapshot.enabled && !unsupported.has("qq");
  const wechat = wechatReminders.snapshot.enabled && !unsupported.has("wechat");
  useSourceFallback(messageSource, { qq, wechat, qqMail: settings.mailEnabled }, setMessageSource);
  const { banner: shown, bannerRef, open, close, runAction } = banner;
  const bannerView = useMemo(() => shown && { banner: shown, bannerRef, onOpen: open, onClose: close, onAction: runAction }, [shown, bannerRef, open, close, runAction]);
  useMessagesIsland({
    qq: qqNotifications,
    wechat: wechatReminders,
    mail: qqMail,
    plugin: pluginNotifications,
    preview: banner.barPreview,
    source: messageSource,
    open: openMessages,
    panel,
    banner: bannerView,
  }, {
    showsMessage: hasMessagePreview || banner.showing,
    hold,
    arrivalsHeight: panel.arrivals ? panel.height : null,
    maxPanelHeight: settings.maxPanelHeight,
    pages: { qq, wechat },
  });
  return null;
}

runnerSlot.add({ id: "messages.runner", component: MessagesRunner }, OWNER);
