import { groupWidgets, type LibraryWidget, type WidgetLibrary } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import type { CustomPanel } from "../../../lib/settings/customPanels";

export function WidgetPicker({ panel, library, onAdd }: { panel: CustomPanel; library: WidgetLibrary; onAdd: (widget: LibraryWidget) => void }) {
  const t = useTranslation().islandWidgets.panel;
  const taken = new Set(panel.items.map((item) => item.widget));
  const groups = groupWidgets(library.widgets.filter((widget) => !taken.has(widget.id)));
  return (
    <div className="custom-panel__picker" role="list" aria-label={t.addWidget}>
      {groups.length === 0 ? <p className="custom-panel__picker-none">{t.allAdded}</p> : null}
      {groups.map(([key, name, widgets]) => (
        <div key={key} className="custom-panel__picker-group" role="listitem">
          <span className="custom-panel__picker-label">
            {name}
            {widgets[0]?.plugin ? <small>{t.plugin}</small> : null}
          </span>
          <div className="custom-panel__picker-items">
            {widgets.map((widget) => {
              const Icon = widget.icon;
              return (
                <button key={widget.id} type="button" data-widget={widget.id} onClick={() => onAdd(widget)}>
                  <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
                  {widget.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
