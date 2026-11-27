import { usePluginNames } from "../../features/plugin-kernel/pluginNames";
import { localizedTitle, packageLabel, type SlotTitle } from "../../features/plugin-kernel/slotTitle";
import { useLocale, useTranslation } from "../../i18n";
import { customPageName } from "../../lib/settings/islandPages";
import { useIslandPages } from "../../lib/settings/useIslandPages";
import type { HeaderDotPage } from "./types";

export type PageLabelItem = { id: string; external: boolean; owner: string; title?: SlotTitle };

export function usePageLabel() {
  const t = useTranslation();
  const { locale } = useLocale();
  const pluginNames = usePluginNames();
  const { layout } = useIslandPages();
  const builtinLabels: Record<HeaderDotPage, string> = {
    todo: t.island.todoList,
    music: t.island.music,
    calendar: t.island.calendar,
    clipboard: t.island.clipboardHistory,
    shelf: t.island.shelf,
    screenshots: t.island.screenshots,
    timer: t.island.timer,
  };
  const pageLabel = (item: PageLabelItem) =>
    customPageName(layout, item.id)
    ?? (item.external ? null : builtinLabels[item.id as HeaderDotPage])
    ?? localizedTitle(item.title, locale)
    ?? localizedTitle(pluginNames.get(item.owner), locale)
    ?? packageLabel(item.owner === "builtin" ? item.id : item.owner);
  return { builtinLabels, pageLabel };
}
