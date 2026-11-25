import { useMemo } from "react";
import { useUnsupportedFeatures } from "../../lib/platform";
import type { IslandPagesLayout, EnabledDockSides } from "../../lib/settings/islandPages";
import { pagesForDockZone } from "../../lib/settings/islandPages";
import type { SideDockEdge } from "../../lib/settings/sideDocks";
import type { IslandSettings } from "../../lib/settings/types";
import { builtinConfigBoolean, isBuiltinEnabled } from "../../features/plugin-kernel/builtinSwitches";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useCustomPanelPages } from "../island/custom-panels/useCustomPanelPages";
import { foldScreenshotsIntoClipboard, withPageLayout, withoutUnsupported, type IslandFeatures } from "../island/features";
import { pageSlot } from "../island/slots/pageSlot";

export function useSideDockPages(
  edge: SideDockEdge,
  settings: IslandSettings,
  pageLayout: IslandPagesLayout,
  enabledSides: EnabledDockSides,
) {
  useCustomPanelPages();
  const unsupported = useUnsupportedFeatures();
  const plugins = useBuiltinPlugins();
  const allEntries = useSlotEntries(pageSlot);

  const features = useMemo<IslandFeatures>(() => {
    const enabled = (id: string, fallback = true) => isBuiltinEnabled(plugins, id, fallback);
    const messagesOn = enabled("messages");
    const mailOn = messagesOn && (builtinConfigBoolean(plugins, "messages", "mail") ?? settings.mailEnabled);
    return withPageLayout(
      foldScreenshotsIntoClipboard(
        withoutUnsupported(
          {
            todo: enabled("todos", settings.todoEnabled),
            calendar: enabled("calendar", settings.calendarEnabled),
            music: enabled("music", settings.musicEnabled),
            clipboard: enabled("clipboard"),
            shelf: enabled("file-shelf", settings.shelfEnabled),
            screenshots: enabled("screenshot", settings.screenshotEnabled),
            timer: enabled("timer"),
            qq: messagesOn,
            wechat: messagesOn,
            qqMail: mailOn,
            agents: enabled("agents", settings.agentStatusEnabled),
            translation: enabled("translation", settings.translationEnabled) && settings.translationTarget === "island",
          },
          unsupported,
        ),
      ),
      pageLayout,
      enabledSides,
    );
  }, [enabledSides, pageLayout, plugins, settings, unsupported]);

  const dockPages = useMemo(() => {
    const enabledEntries = allEntries.filter((entry) => {
      if (!entry.enabled) return true;
      try {
        return entry.enabled(features) === true;
      } catch {
        return false;
      }
    });
    return pagesForDockZone(enabledEntries, pageLayout, edge, enabledSides);
  }, [allEntries, edge, enabledSides, features, pageLayout]);

  return { features, dockPages, allEntries };
}
