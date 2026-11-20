import { useMemo } from "react";
import { Puzzle, type LucideIcon } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { BarUsagePage } from "../../../features/plugin-kernel/barUsage";
import { isBuiltinEnabled } from "../../../features/plugin-kernel/builtinSwitches";
import { useBuiltinPlugins } from "../../../features/plugin-kernel/useBuiltinPlugins";
import { useUnsupportedFeatures } from "../../../lib/platform";
import { arrangeIslandPages } from "../../../lib/settings/islandPages";
import type { IslandSettings } from "../../../lib/settings/types";
import { useIslandPages } from "../../../lib/settings/useIslandPages";
import { byShortcut } from "../../island/features";
import { BUILTIN_PAGES } from "./builtinPages";

export type IslandPageRow = { id: string; name: string; icon: LucideIcon; plugin: boolean; off: boolean; hidden: boolean };

export function useIslandPageRows(settings: IslandSettings, pluginPages: readonly BarUsagePage[] | null) {
  const text = useTranslation().settings.islandPages;
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
    const seen = new Set<string>(builtin.map((page) => page.id));
    const external = (pluginPages ?? []).filter((page) => !seen.has(page.id) && Boolean(seen.add(page.id))).map((page) => ({
      id: page.id,
      external: true,
      row: { id: page.id, name: page.name, icon: Puzzle, plugin: true, off: false },
    }));
    const defaults = byShortcut([...builtin, ...external]);
    const order = arrangeIslandPages(defaults.map((page) => page.id), layout.order);
    const byId = new Map(defaults.map((page) => [page.id, page.row]));
    const hidden = new Set(layout.hidden);
    return order.flatMap((id): IslandPageRow[] => {
      const row = byId.get(id);
      return row ? [{ ...row, hidden: hidden.has(id) }] : [];
    });
  }, [layout, pluginPages, plugins, settings, text, unsupported]);

  return { rows, layout, save, pluginsListed: pluginPages !== null };
}
