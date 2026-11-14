import { useCallback, useEffect, useMemo, useRef } from "react";
import type { IslandSettings } from "../../features/appearance/types";
import type { MessageView } from "../../features/messages/Messages";
import type { MailController } from "../../features/messages/mail/MailPanel";
import { useUnsupportedFeatures } from "../../lib/platform";
import { resolveIslandPage, resolveMessageSource, withoutUnsupported, type IslandFeatures } from "./features";
import type { IslandPage, PluginPageId } from "./types";
import { usePluginOpenView } from "./usePluginOpenView";
import { useTimerPlugin } from "../../features/timer/useIslandTimer";

const NO_PLUGIN_PAGES: readonly PluginPageId[] = [];

type IslandFeatureOptions = {
  settings: IslandSettings;
  clipboardEnabled: boolean;
  qqEnabled: boolean;
  wechatEnabled: boolean;
  qqMail: MailController;
  page: IslandPage;
  messageSource: MessageView;
  setPage: (page: IslandPage) => void;
  setMessageSource: (source: MessageView) => void;
  openIslandPage: (page: IslandPage) => void;
  pluginPages?: readonly PluginPageId[];
};

export function useIslandFeatures({
  settings,
  clipboardEnabled,
  qqEnabled,
  wechatEnabled,
  qqMail,
  page,
  messageSource,
  setPage,
  setMessageSource,
  openIslandPage,
  pluginPages,
}: IslandFeatureOptions) {
  const unsupported = useUnsupportedFeatures();
  const timer = useTimerPlugin();
  const features = useMemo<IslandFeatures>(() => withoutUnsupported({
    todo: settings.todoEnabled,
    calendar: settings.calendarEnabled,
    music: settings.musicEnabled,
    clipboard: clipboardEnabled,
    shelf: settings.shelfEnabled,
    screenshots: settings.screenshotEnabled,
    timer,
    qq: qqEnabled,
    wechat: wechatEnabled,
    qqMail: settings.mailEnabled,
    agents: settings.agentStatusEnabled,
    translation: settings.translationEnabled && settings.translationTarget === "island",
    pluginPages,
  }, unsupported), [unsupported, timer, pluginPages, clipboardEnabled, qqEnabled, settings.agentStatusEnabled, settings.calendarEnabled, settings.mailEnabled, settings.musicEnabled, settings.screenshotEnabled, settings.shelfEnabled, settings.todoEnabled, settings.translationEnabled, settings.translationTarget, wechatEnabled]);

  useEffect(() => {
    const next = resolveIslandPage(page, features);
    if (next && next !== page) setPage(next);
  }, [features, page, setPage]);

  useEffect(() => {
    const next = resolveMessageSource(messageSource, features);
    if (next !== messageSource) setMessageSource(next);
  }, [features, messageSource, setMessageSource]);

  const mailConfigured = qqMail.anyConfigured;
  const mailReceiving = qqMail.anyReceiving;
  const setMailReceiving = qqMail.setAllEnabled;
  const mailSwitch = settings.mailEnabled;
  const lastMailSwitchRef = useRef(mailSwitch);
  useEffect(() => {
    if (!mailConfigured) return;
    if (!mailSwitch && mailReceiving) {
      void setMailReceiving(false);
    } else if (mailSwitch && !lastMailSwitchRef.current && !mailReceiving) {
      void setMailReceiving(true);
    }
    lastMailSwitchRef.current = mailSwitch;
  }, [mailConfigured, mailReceiving, mailSwitch, setMailReceiving]);

  const openEnabledPage = useCallback((target: IslandPage) => {
    const next = resolveIslandPage(target, features);
    if (next) openIslandPage(next);
  }, [features, openIslandPage]);
  usePluginOpenView(pluginPages ?? NO_PLUGIN_PAGES, openEnabledPage);

  return { features, openEnabledPage };
}
