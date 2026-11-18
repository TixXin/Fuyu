import { useMemo } from "react";
import { useUnsupportedFeatures } from "../../../lib/platform";
import type { IslandSettings } from "../../../lib/settings/types";
import type { IslandHost } from "../../plugin-kernel/islandHost";
import { defineSlot } from "../../plugin-kernel/slots";
import { IM_SOURCE_IDS } from "../im-sources/imSourcesState";
import { useIslandBanner } from "../island/useIslandBanner";
import { useIslandMessagePanel } from "../island/useIslandMessagePanel";
import { useIslandNotices } from "../island/useIslandNotices";
import { useMailSwitch, useSourceFallback } from "../island/useMessageSwitches";
import { useMessageView } from "../island/useMessageView";
import { useTuckHold } from "../island/useTuckHold";
import type { MessageSource } from "../messagePreview";
import { useMessagesIsland } from "./islandMessages";
import { OWNER } from "./owner.ts";
import { useBuiltinSourcesSync } from "./useBuiltinSourcesSync";
import { useMailEnabled, useSourceReconcile } from "./useSourceSwitches";

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
  const { qqNotifications, wechatReminders, qqMail, pluginNotifications, imSources, hasMessagePreview } = notices;
  const { messageSource, setMessageSource, openMessages } = useMessageView(qqMail.closeReader, openIslandPage);
  const banner = useIslandBanner({ messageNotice: settings.messageNotice, notices, mode, isTucked, quiet, onOpenMessages: openMessages, host });
  const panel = useIslandMessagePanel({
    enabled: settings.messageNotice === "panel" && !quiet,
    durationMs: settings.messagePanelSeconds * 1000,
    notices, mode, page, openIslandPage, collapseIsland, onOpenMessages: openMessages, host,
  });
  const mailOn = useMailEnabled(settings.mailEnabled);
  const hold = useTuckHold({ ...settings, mailEnabled: mailOn }, { messagesOpen: mode === "expanded" && page === "qq", notices });
  useSourceReconcile(settings.mailEnabled);
  useMailSwitch(mailOn, qqMail);
  const qq = qqNotifications.snapshot.enabled && !unsupported.has("qq");
  const wechat = wechatReminders.snapshot.enabled && !unsupported.has("wechat");
  const enabledSources = useMemo<Record<MessageSource, boolean>>(() => ({
    qq,
    wechat,
    qqMail: mailOn,
    telegram: imSources.snapshots.telegram.enabled,
    discord: imSources.snapshots.discord.enabled,
    whatsapp: imSources.snapshots.whatsapp.enabled,
    tim: imSources.snapshots.tim.enabled,
    feishu: imSources.snapshots.feishu.enabled,
    dingtalk: imSources.snapshots.dingtalk.enabled,
    wecom: imSources.snapshots.wecom.enabled,
  }), [qq, wechat, mailOn, imSources.snapshots]);
  const anyImEnabled = IM_SOURCE_IDS.some((id) => enabledSources[id]);
  useSourceFallback(messageSource, enabledSources, setMessageSource);
  useBuiltinSourcesSync({ qqNotifications, wechatReminders, qqMail, imSources, enabledSources });
  const { banner: shown, bannerRef, open, close, runAction } = banner;
  const bannerView = useMemo(() => shown && { banner: shown, bannerRef, onOpen: open, onClose: close, onAction: runAction }, [shown, bannerRef, open, close, runAction]);
  useMessagesIsland({
    qq: qqNotifications,
    wechat: wechatReminders,
    mail: qqMail,
    plugin: pluginNotifications,
    im: imSources,
    enabledSources,
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
    pages: { qq: qq || anyImEnabled, wechat },
  });
  return null;
}

runnerSlot.add({ id: "messages.runner", component: MessagesRunner }, OWNER);
