import { useMemo, useState } from "react";
import { Plus, Puzzle, Trash2, X } from "lucide-react";
import { PANEL_ICON_COMPONENTS } from "../../../components/island-widget/panelIcons";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import type { WidgetGroup } from "../../../features/plugin-kernel/widgetCatalog";
import { useTranslation } from "../../../i18n";
import { addPanelItem, cleanPanelName, defaultWidgetSize, PANEL_ICONS, removePanelItem, reorderPanelItem, type CustomPanel } from "../../../lib/settings/customPanels";
import { useChipReorder } from "./useChipReorder";
import type { LibraryWidget, WidgetLibrary } from "./useWidgetLibrary";
import "./PanelEditor.css";

type PanelEditorProps = {
  panel: CustomPanel;
  library: WidgetLibrary;
  selected: string | undefined;
  onSelect: (widget: string) => void;
  onChange: (panel: CustomPanel) => void;
  onRemove: () => void;
};

function PanelHead({ panel, onChange, onRemove }: Pick<PanelEditorProps, "panel" | "onChange" | "onRemove">) {
  const t = useTranslation();
  const text = t.settings.islandPages.panels;
  const [name, setName] = useState(panel.name);
  const [confirming, setConfirming] = useState(false);
  const commitName = () => {
    const next = cleanPanelName(name);
    setName(next);
    if (next !== panel.name) onChange({ ...panel, name: next });
  };
  return (
    <div className="panel-head">
      <input
        className="panel-head__name"
        value={name}
        maxLength={40}
        aria-label={text.name}
        placeholder={t.islandWidgets.panel.defaultName}
        onChange={(event) => setName(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitName();
        }}
      />
      <div className="panel-head__icons" role="radiogroup" aria-label={text.icon}>
        {PANEL_ICONS.map((icon) => {
          const Icon = PANEL_ICON_COMPONENTS[icon];
          return (
            <button key={icon} type="button" role="radio" aria-checked={panel.icon === icon} aria-label={text.iconNames[icon]} title={text.iconNames[icon]} onClick={() => onChange({ ...panel, icon })}>
              <Icon size={14} strokeWidth={1.9} />
            </button>
          );
        })}
      </div>
      <button className="panel-head__remove" type="button" data-confirming={confirming || undefined} onBlur={() => setConfirming(false)} onClick={() => (confirming ? onRemove() : setConfirming(true))}>
        <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
        {confirming ? text.confirmRemove : text.remove}
      </button>
    </div>
  );
}

export function PanelEditor({ panel, library, selected, onSelect, onChange, onRemove }: PanelEditorProps) {
  const t = useTranslation();
  const text = t.settings.islandPages.panels;
  const ids = panel.items.map((item) => item.widget);
  const { bind } = useChipReorder(ids, (widget, before) => onChange(reorderPanelItem(panel, widget, before)));
  const groups = useMemo(() => {
    const taken = new Set(panel.items.map((item) => item.widget));
    const result = new Map<WidgetGroup, LibraryWidget[]>();
    for (const widget of library.widgets) if (!taken.has(widget.id)) result.set(widget.group, [...(result.get(widget.group) ?? []), widget]);
    return [...result];
  }, [library.widgets, panel.items]);

  const add = (widget: LibraryWidget) => {
    const size = defaultWidgetSize(widget.sizes);
    if (!size) return;
    onChange(addPanelItem(panel, widget.id, size));
    onSelect(widget.id);
  };

  return (
    <SettingsGroup title={text.title} footer={text.hint}>
      <PanelHead key={panel.id} panel={panel} onChange={onChange} onRemove={onRemove} />
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
            {text.available} <span>{groups.reduce((count, [, list]) => count + list.length, 0)}</span>
          </header>
          {groups.length === 0 ? <span className="panel-bucket__none">{text.allAdded}</span> : null}
          {groups.map(([group, list]) => (
            <div key={group} className="panel-bucket__group">
              <span className="panel-bucket__label">{t.islandWidgets.groups[group]}</span>
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
