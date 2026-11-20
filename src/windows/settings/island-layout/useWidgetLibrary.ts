import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { isBuiltinEnabled } from "../../../features/plugin-kernel/builtinSwitches";
import type { WidgetGroup } from "../../../features/plugin-kernel/widgetCatalog";
import { useBuiltinPlugins } from "../../../features/plugin-kernel/useBuiltinPlugins";
import { useTranslation } from "../../../i18n";
import { PANEL_SIZES, type PanelSize } from "../../../lib/settings/customPanels";
import { BUILTIN_WIDGETS } from "./builtinWidgets";

export type LibraryWidget = {
  id: string;
  name: string;
  icon: LucideIcon;
  group: WidgetGroup;
  sizes: PanelSize[];
  available: boolean;
};

export type WidgetLibrary = {
  widgets: readonly LibraryWidget[];
  find: (id: string) => LibraryWidget | undefined;
};

export function useWidgetLibrary(): WidgetLibrary {
  const t = useTranslation();
  const plugins = useBuiltinPlugins();
  return useMemo(() => {
    const all = BUILTIN_WIDGETS.map((widget): LibraryWidget => ({
      id: widget.id,
      name: widget.label(t),
      icon: widget.icon,
      group: widget.group,
      sizes: PANEL_SIZES.filter((size) => widget.sizes.includes(size)),
      available: isBuiltinEnabled(plugins, widget.owner),
    })).filter((widget) => widget.sizes.length > 0);
    const byId = new Map(all.map((widget) => [widget.id, widget]));
    return { widgets: all.filter((widget) => widget.available), find: (id: string) => byId.get(id) };
  }, [plugins, t]);
}
