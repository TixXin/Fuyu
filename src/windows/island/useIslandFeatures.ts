import { useCallback, useEffect, useMemo } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { useUnsupportedFeatures } from "../../lib/platform";
import { foldScreenshotsIntoClipboard, resolveIslandPage, withoutUnsupported, type IslandFeatures } from "./features";
import type { IslandPage, PluginPageId } from "./types";
import { usePluginOpenView } from "./usePluginOpenView";
import { useBuiltinEnabled } from "../../features/plugin-kernel/useBuiltinPlugins";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";

const NO_PLUGIN_PAGES: readonly PluginPageId[] = [];

type IslandFeatureOptions = {
  settings: IslandSettings;
  page: IslandPage;
  setPage: (page: IslandPage) => void;
  openIslandPage: (page: IslandPage) => void;
  pluginPages?: readonly PluginPageId[];
};

export function useIslandFeatures({
  settings,
  page,
  setPage,
  openIslandPage,
  pluginPages,
}: IslandFeatureOptions) {
  const unsupported = useUnsupportedFeatures();
  const timer = useBuiltinEnabled("timer");
  const clipboardEnabled = useBuiltinEnabled("clipboard");
  const { pages, settled } = useIslandContributed();
  const qqEnabled = pages.qq === true;
  const wechatEnabled = pages.wechat === true;
  const features = useMemo<IslandFeatures>(() => foldScreenshotsIntoClipboard(withoutUnsupported({
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
  }, unsupported)), [unsupported, timer, pluginPages, clipboardEnabled, qqEnabled, settings.agentStatusEnabled, settings.calendarEnabled, settings.mailEnabled, settings.musicEnabled, settings.screenshotEnabled, settings.shelfEnabled, settings.todoEnabled, settings.translationEnabled, settings.translationTarget, wechatEnabled]);

  useEffect(() => {
    if (!settled) return;
    const next = resolveIslandPage(page, features);
    if (next && next !== page) setPage(next);
  }, [features, page, setPage, settled]);

  const openEnabledPage = useCallback((target: IslandPage) => {
    const next = resolveIslandPage(target, features);
    if (next) openIslandPage(next);
  }, [features, openIslandPage]);
  usePluginOpenView(pluginPages ?? NO_PLUGIN_PAGES, openEnabledPage);

  return { features, openEnabledPage };
}
