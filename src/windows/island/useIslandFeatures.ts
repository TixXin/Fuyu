import { useCallback, useEffect, useMemo } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { useUnsupportedFeatures } from "../../lib/platform";
import { builtinConfigBoolean, isBuiltinEnabled } from "../../features/plugin-kernel/builtinSwitches";
import { foldScreenshotsIntoClipboard, resolveIslandPage, withoutUnsupported, type IslandFeatures } from "./features";
import type { IslandPage } from "./types";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";

type IslandFeatureOptions = {
  settings: IslandSettings;
  page: IslandPage;
  setPage: (page: IslandPage) => void;
  openIslandPage: (page: IslandPage) => void;
};

export function useIslandFeatures({
  settings,
  page,
  setPage,
  openIslandPage,
}: IslandFeatureOptions) {
  const unsupported = useUnsupportedFeatures();
  const plugins = useBuiltinPlugins();
  const { pages, settled } = useIslandContributed();
  const features = useMemo<IslandFeatures>(() => {
    const enabled = (id: string, fallback = true) => isBuiltinEnabled(plugins, id, fallback);
    const messagesOn = enabled("messages");
    const mailOn = messagesOn && (builtinConfigBoolean(plugins, "messages", "mail") ?? settings.mailEnabled);
    return foldScreenshotsIntoClipboard(withoutUnsupported({
      todo: enabled("todos", settings.todoEnabled),
      calendar: enabled("calendar", settings.calendarEnabled),
      music: enabled("music", settings.musicEnabled),
      clipboard: enabled("clipboard"),
      shelf: enabled("file-shelf", settings.shelfEnabled),
      screenshots: enabled("screenshot", settings.screenshotEnabled),
      timer: enabled("timer"),
      qq: messagesOn && pages.qq === true,
      wechat: messagesOn && pages.wechat === true,
      qqMail: mailOn,
      agents: enabled("agents", settings.agentStatusEnabled),
      translation: enabled("translation", settings.translationEnabled) && settings.translationTarget === "island",
    }, unsupported));
  }, [
    unsupported,
    plugins,
    pages.qq,
    pages.wechat,
    settings.agentStatusEnabled,
    settings.calendarEnabled,
    settings.mailEnabled,
    settings.musicEnabled,
    settings.screenshotEnabled,
    settings.shelfEnabled,
    settings.todoEnabled,
    settings.translationEnabled,
    settings.translationTarget,
  ]);

  useEffect(() => {
    if (!settled) return;
    const next = resolveIslandPage(page, features);
    if (next && next !== page) setPage(next);
  }, [features, page, setPage, settled]);

  const openEnabledPage = useCallback((target: IslandPage) => {
    const next = resolveIslandPage(target, features);
    if (next) openIslandPage(next);
  }, [features, openIslandPage]);

  return { features, openEnabledPage };
}
