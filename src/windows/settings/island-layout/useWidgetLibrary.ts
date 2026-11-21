import { useMemo } from "react";
import { Puzzle } from "lucide-react";
import type { BarUsageWidget } from "../../../features/plugin-kernel/barUsage";
import { isBuiltinEnabled } from "../../../features/plugin-kernel/builtinSwitches";
import { useBuiltinPlugins } from "../../../features/plugin-kernel/useBuiltinPlugins";
import { groupName, makeWidgetLibrary, panelSizesOf, type LibraryWidget, type WidgetLibrary } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import { BUILTIN_WIDGETS } from "./builtinWidgets";
import { markupIcon } from "./markupIcon";

export type { LibraryWidget, WidgetLibrary };

export function useWidgetLibrary(pluginWidgets: readonly BarUsageWidget[] = []): WidgetLibrary {
  const t = useTranslation();
  const plugins = useBuiltinPlugins();
  return useMemo(() => {
    const builtin = BUILTIN_WIDGETS.map((widget): LibraryWidget => ({
      id: widget.id,
      name: widget.label(t),
      icon: widget.icon,
      group: widget.group,
      groupName: groupName(widget.group, t),
      plugin: false,
      sizes: panelSizesOf(widget.sizes),
      available: isBuiltinEnabled(plugins, widget.owner),
    }));
    const taken = new Set(builtin.map((widget) => widget.id));
    const external = pluginWidgets
      .filter((widget) => !taken.has(widget.id) && Boolean(taken.add(widget.id)))
      .map((widget): LibraryWidget => ({
        id: widget.id,
        name: widget.name,
        icon: widget.icon ? markupIcon(widget.icon) : Puzzle,
        group: widget.owner,
        groupName: widget.plugin,
        plugin: true,
        sizes: panelSizesOf(widget.sizes),
        available: true,
      }));
    return makeWidgetLibrary([...builtin, ...external].filter((widget) => widget.sizes.length > 0));
  }, [plugins, pluginWidgets, t]);
}
