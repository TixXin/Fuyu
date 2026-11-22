import { useMemo } from "react";
import { Puzzle } from "lucide-react";
import { FuyuTextIcon } from "../../../components/island-widget/FuyuTextIcon";
import type { PanelIconComponent } from "../../../components/island-widget/panelIcons";
import { fuyuPageIconName, pageIconComponent } from "../../../components/island-widget/pageIcons";
import { useTranslation } from "../../../i18n";
import type { BarUsagePage } from "../../../features/plugin-kernel/barUsage";
import { isBuiltinEnabled } from "../../../features/plugin-kernel/builtinSwitches";
import { useBuiltinPlugins } from "../../../features/plugin-kernel/useBuiltinPlugins";
import { useUnsupportedFeatures } from "../../../lib/platform";
import { FUYU_PAGE_ID, FUYU_PANEL_ID } from "../../../lib/settings/customPanels";
import { arrangeIslandPages } from "../../../lib/settings/islandPages";
import type { IslandSettings } from "../../../lib/settings/types";
import { useIslandPages } from "../../../lib/settings/useIslandPages";
import { byShortcut } from "../../island/features";
import { BUILTIN_PAGES } from "./builtinPages";

export type IslandPageRow = {
  id: string;
  name: string;
  icon: PanelIconComponent;
  defaultIcon: PanelIconComponent;
  iconName?: string;
  plugin: boolean;
  off: boolean;
  hidden: boolean;
  panel?: string;
};

type BaseRow = Omit<IslandPageRow, "hidden" | "defaultIcon" | "iconName">;

export function useIslandPageRows(settings: IslandSettings, pluginPages: readonly BarUsagePage[] | null) {
  const t = useTranslation();
  const text = t.settings.islandPages;
  const appName = t.island.appName;
  const plugins = useBuiltinPlugins();
  const unsupported = useUnsupportedFeatures();
  const { layout, save } = useIslandPages();

  const rows = useMemo(() => {
    const on = (owner: string, fallback?: (value: IslandSettings) => boolean) => isBuiltinEnabled(plugins, owner, fallback?.(settings) ?? true);
    const folded = on("clipboard") && !unsupported.has("clipboard") && on("screenshot", (value) => value.screenshotEnabled);
    const builtin = BUILTIN_PAGES.filter((page) => !(page.id === "screenshots" && folded)).map((page) => ({
      id: page.id,
      shortcutOrder: page.shortcutOrder,
      headerDot: page.headerDot,
      external: false,
      row: {
        id: page.id,
        name: text.page[page.id],
        icon: page.icon,
        plugin: false,
        off: !on(page.owner, page.fallback) || (page.platform !== undefined && unsupported.has(page.platform)) || page.needs?.(settings) === false,
      },
    }));
    const custom = [{
      id: FUYU_PAGE_ID,
      shortcutOrder: 0,
      headerDot: true,
      external: false,
      row: { id: FUYU_PAGE_ID, name: appName, icon: FuyuTextIcon, plugin: false, off: false, panel: FUYU_PANEL_ID },
    }];
    const seen = new Set<string>([...builtin, ...custom].map((page) => page.id));
    const external = (pluginPages ?? []).filter((page) => !seen.has(page.id) && Boolean(seen.add(page.id))).map((page) => ({
      id: page.id,
      external: true,
      row: { id: page.id, name: page.name, icon: Puzzle, plugin: true, off: false },
    }));
    const defaults = byShortcut<{ id: string; shortcutOrder?: number; headerDot?: boolean; external: boolean; row: BaseRow }>([...builtin, ...custom, ...external]);
    const order = arrangeIslandPages(defaults.map((page) => page.id), layout.order);
    const byId = new Map(defaults.map((page) => [page.id, page.row]));
    const hidden = new Set(layout.hidden);
    return order.flatMap((id): IslandPageRow[] => {
      const row = byId.get(id);
      if (!row) return [];
      const iconName = id === FUYU_PAGE_ID ? fuyuPageIconName(layout.icons, id, settings.fuyuTabIcon) : layout.icons?.[id];
      return [{ ...row, icon: pageIconComponent(iconName) ?? row.icon, defaultIcon: row.icon, iconName, hidden: hidden.has(id) }];
    });
  }, [appName, layout, pluginPages, plugins, settings, text, unsupported]);

  return { rows, layout, save, pluginsListed: pluginPages !== null };
}
