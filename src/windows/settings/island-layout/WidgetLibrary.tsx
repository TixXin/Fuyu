import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { WidgetGroup } from "../../../features/plugin-kernel/widgetCatalog";
import type { PanelSize } from "../../../lib/settings/customPanels";
import type { LibraryWidget } from "./useWidgetLibrary";

type WidgetLibraryProps = {
  widgets: readonly LibraryWidget[];
  onAdd: (widget: string, size: PanelSize) => void;
  onToggleBar: (widget: string, on: boolean) => void;
};

export function WidgetLibrary({ widgets, onAdd, onToggleBar }: WidgetLibraryProps) {
  const t = useTranslation();
  const text = t.settings.islandPages.panels;
  const { sizes, groups } = t.islandWidgets;
  const [query, setQuery] = useState("");
  const grouped = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const result = new Map<WidgetGroup, LibraryWidget[]>();
    for (const widget of widgets) {
      if (needle && !`${widget.name} ${groups[widget.group]}`.toLocaleLowerCase().includes(needle)) continue;
      result.set(widget.group, [...(result.get(widget.group) ?? []), widget]);
    }
    return [...result];
  }, [groups, query, widgets]);

  return (
    <div className="widget-library">
      <div className="widget-library__head">
        <strong>{text.library}</strong>
        <label className="widget-library__search">
          <Search size={12} strokeWidth={2.2} aria-hidden="true" />
          <input type="search" value={query} placeholder={text.search} aria-label={text.search} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      {grouped.length === 0 ? <p className="settings-section__hint">{text.noMatch}</p> : null}
      {grouped.map(([group, list]) => (
        <div key={group} className="widget-library__group">
          <span className="widget-library__group-name">{groups[group]}</span>
          <ul>
            {list.map((widget) => (
              <li key={widget.id} className="widget-library__item" data-widget={widget.id}>
                <span className="widget-library__name">{widget.name}</span>
                <span className="widget-library__sizes">
                  {widget.bar ? (
                    <button type="button" data-bar aria-pressed={widget.onBar} aria-label={widget.onBar ? text.onBar(widget.name) : text.offBar(widget.name)} title={widget.onBar ? text.onBar(widget.name) : text.offBar(widget.name)} onClick={() => onToggleBar(widget.id, !widget.onBar)}>
                      {sizes.bar}
                    </button>
                  ) : null}
                  {widget.sizes.map((size) => (
                    <button key={size} type="button" aria-label={text.addSize(widget.name, sizes[size])} title={text.addSize(widget.name, sizes[size])} onClick={() => onAdd(widget.id, size)}>
                      {sizes[size]}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
