import { useMemo } from "react";
import { Plus, Puzzle, X } from "lucide-react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { groupWidgets } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import { addPanelItem, defaultWidgetSize, PANEL_MODES, removePanelItem, reorderPanelItem, setPanelMode, type CustomPanel } from "../../../lib/settings/customPanels";
import { useChipReorder } from "./useChipReorder";
import type { LibraryWidget, WidgetLibrary } from "./useWidgetLibrary";
import "./PanelEditor.css";

type PanelEditorProps = {
  panel: CustomPanel;
  library: WidgetLibrary;
  selected: string | undefined;
  onSelect: (widget: string) => void;
  onChange: (panel: CustomPanel) => void;
};

function PanelHead({ panel, onChange }: Pick<PanelEditorProps, "panel" | "onChange">) {
  const text = useTranslation().islandWidgets.panel;
  return (
    <div className="panel-head">
      <span className="panel-head__label">{text.mode}</span>
      <div className="panel-head__modes" role="radiogroup" aria-label={text.mode}>
        {PANEL_MODES.map((mode) => (
          <button key={mode} type="button" role="radio" data-mode={mode} aria-checked={panel.mode === mode} onClick={() => onChange(setPanelMode(panel, mode))}>
            {text.modes[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PanelEditor({ panel, library, selected, onSelect, onChange }: PanelEditorProps) {
  const t = useTranslation();
  const text = t.settings.islandPages.panels;
  const ids = panel.items.map((item) => item.widget);
  const { bind } = useChipReorder(ids, (widget, before) => onChange(reorderPanelItem(panel, widget, before)));
  const groups = useMemo(() => {
    const taken = new Set(panel.items.map((item) => item.widget));
    return groupWidgets(library.widgets.filter((widget) => !taken.has(widget.id)));
  }, [library.widgets, panel.items]);

  const add = (widget: LibraryWidget) => {
    const size = defaultWidgetSize(widget.sizes);
    if (!size) return;
    onChange(addPanelItem(panel, widget.id, size));
    onSelect(widget.id);
  };

  return (
    <SettingsGroup title={text.title} footer={text.hint}>
      <PanelHead panel={panel} onChange={onChange} />
      <div className="panel-buckets">
        <section className="panel-bucket" data-bucket="in" aria-label={text.inPanel}>
          <header>
            {text.inPanel} <span>{panel.items.length}</span>
          </header>
          <div className="layout-chips">
            {panel.items.length === 0 ? <span className="panel-bucket__none">{text.none}</span> : null}
            {panel.items.map((item) => {
              const widget = library.find(item.widget);
              const Icon = widget?.icon ?? Puzzle;
              const name = widget?.name ?? item.widget;
              return (
                <div
                  key={item.widget}
                  className="layout-chip"
                  role="button"
                  tabIndex={0}
                  aria-pressed={item.widget === selected}
                  aria-label={text.moveWidget(name)}
                  data-widget={item.widget}
                  data-off={widget?.available ? undefined : true}
                  onClick={() => onSelect(item.widget)}
                  {...bind(item.widget)}
                >
                  <span className="layout-chip__icon" aria-hidden="true">
                    <Icon size={14} strokeWidth={1.9} />
                  </span>
                  <span className="layout-chip__name">{name}</span>
                  <small className="layout-chip__badge">{widget?.available ? t.islandWidgets.sizes[item.size] : text.unavailable}</small>
                  <button
                    className="layout-chip__action"
                    type="button"
                    aria-label={text.removeWidget(name)}
                    title={text.removeWidget(name)}
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange(removePanelItem(panel, item.widget));
                    }}
                  >
                    <X size={13} strokeWidth={2.2} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel-bucket" data-bucket="add" aria-label={text.available}>
          <header>
            {text.available} <span>{groups.reduce((count, [, , list]) => count + list.length, 0)}</span>
          </header>
          {groups.length === 0 ? <span className="panel-bucket__none">{text.allAdded}</span> : null}
          {groups.map(([group, name, list]) => (
            <div key={group} className="panel-bucket__group" data-plugin={list[0]?.plugin || undefined}>
              <span className="panel-bucket__label">
                {name}
                {list[0]?.plugin ? <small className="panel-bucket__tag">{t.islandWidgets.panel.plugin}</small> : null}
              </span>
              <div className="layout-chips">
                {list.map((widget) => {
                  const Icon = widget.icon;
                  return (
                    <button key={widget.id} className="layout-chip layout-chip--add" type="button" data-widget={widget.id} aria-label={text.add(widget.name)} title={text.add(widget.name)} onClick={() => add(widget)}>
                      <span className="layout-chip__plus" aria-hidden="true">
                        <Plus size={14} strokeWidth={2.4} />
                      </span>
                      <span className="layout-chip__icon" aria-hidden="true">
                        <Icon size={14} strokeWidth={1.9} />
                      </span>
                      <span className="layout-chip__name">{widget.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>
    </SettingsGroup>
  );
}
