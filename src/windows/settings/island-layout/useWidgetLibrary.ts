import { useMemo } from "react";
import { isBuiltinEnabled } from "../../../features/plugin-kernel/builtinSwitches";
import type { WidgetGroup } from "../../../features/plugin-kernel/widgetCatalog";
import { useBuiltinPlugins } from "../../../features/plugin-kernel/useBuiltinPlugins";
import { useTranslation } from "../../../i18n";
import { isCollapsedItemOffBar, setCollapsedItemHidden, setCollapsedItemShelf } from "../../../lib/settings/collapsedItems";
import { PANEL_SIZES, type PanelSize } from "../../../lib/settings/customPanels";
import { BUILTIN_WIDGETS } from "./builtinWidgets";
import type { CollapsedLayout } from "./useCollapsedLayout";

export type LibraryWidget = {
  id: string;
  name: string;
  group: WidgetGroup;
  sizes: PanelSize[];
  bar: boolean;
  onBar: boolean;
};

export function useWidgetLibrary(layout: CollapsedLayout) {
  const t = useTranslation();
  const plugins = useBuiltinPlugins();
  const { names, placements, save } = layout;

  const widgets = useMemo(() => {
    const builtin = BUILTIN_WIDGETS.filter((widget) => isBuiltinEnabled(plugins, widget.owner)).map((widget): LibraryWidget => ({
      id: widget.id,
      name: widget.label(t),
      group: widget.group,
      sizes: PANEL_SIZES.filter((size) => widget.sizes.includes(size)),
      bar: widget.sizes.includes("bar") && names.has(widget.id),
      onBar: false,
    }));
    const covered = new Set(builtin.map((widget) => widget.id));
    const barOnly = [...names].filter(([id]) => !covered.has(id)).map(([id, name]): LibraryWidget => ({ id, name, group: "bar", sizes: [], bar: true, onBar: false }));
    return [...builtin, ...barOnly]
      .filter((widget) => widget.sizes.length > 0 || widget.bar)
      .map((widget) => ({ ...widget, onBar: widget.bar && !isCollapsedItemOffBar(placements, widget.id) }));
  }, [names, placements, plugins, t]);

  const nameOf = useMemo(() => {
    const all = new Map<string, string>(BUILTIN_WIDGETS.map((widget) => [widget.id, widget.label(t)]));
    for (const [id, name] of names) if (!all.has(id)) all.set(id, name);
    return (id: string) => all.get(id) ?? id;
  }, [names, t]);

  const available = useMemo(() => new Set(widgets.filter((widget) => widget.sizes.length > 0).map((widget) => widget.id)), [widgets]);
  const sizesOf = useMemo(() => {
    const byId = new Map(widgets.map((widget) => [widget.id, widget.sizes]));
    return (id: string): readonly PanelSize[] => byId.get(id) ?? [];
  }, [widgets]);

  const toggleBar = (id: string, on: boolean) => save(on ? setCollapsedItemShelf(setCollapsedItemHidden(placements, id, false), id, false) : setCollapsedItemHidden(placements, id, true));

  return { widgets, nameOf, available, sizesOf, toggleBar };
}
