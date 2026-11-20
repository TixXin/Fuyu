import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PANEL_ICON_COMPONENTS } from "../../../components/island-widget/panelIcons";
import { useTranslation } from "../../../i18n";
import { addPanelItem, cleanPanelName, PANEL_ICONS, type CustomPanel } from "../../../lib/settings/customPanels";
import { PanelCanvas } from "./PanelCanvas";
import type { CollapsedLayout } from "./useCollapsedLayout";
import { useWidgetLibrary } from "./useWidgetLibrary";
import { WidgetLibrary } from "./WidgetLibrary";
import "./CustomPanelEditor.css";

type CustomPanelEditorProps = {
  panel: CustomPanel;
  collapsed: CollapsedLayout;
  onChange: (panel: CustomPanel) => void;
  onRemove: () => void;
  onClose: () => void;
};

export function CustomPanelEditor({ panel, collapsed, onChange, onRemove, onClose }: CustomPanelEditorProps) {
  const t = useTranslation();
  const text = t.settings.islandPages.panels;
  const library = useWidgetLibrary(collapsed);
  const [name, setName] = useState(panel.name);
  const [confirming, setConfirming] = useState(false);
  const shownName = panel.name || t.islandWidgets.panel.defaultName;
  const commitName = () => {
    const next = cleanPanelName(name);
    setName(next);
    if (next !== panel.name) onChange({ ...panel, name: next });
  };

  return (
    <section className="panel-editor" aria-label={text.editorTitle(shownName)}>
      <div className="panel-editor__head">
        <label className="panel-editor__field">
          <span>{text.name}</span>
          <input
            className="panel-editor__name"
            value={name}
            maxLength={40}
            placeholder={t.islandWidgets.panel.defaultName}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitName();
            }}
          />
        </label>
        <div className="panel-editor__field">
          <span id={`panel-icon-${panel.id}`}>{text.icon}</span>
          <div className="panel-editor__icons" role="radiogroup" aria-labelledby={`panel-icon-${panel.id}`}>
            {PANEL_ICONS.map((icon) => {
              const Icon = PANEL_ICON_COMPONENTS[icon];
              return (
                <button key={icon} className="panel-editor__icon" type="button" role="radio" aria-checked={panel.icon === icon} aria-label={text.iconNames[icon]} title={text.iconNames[icon]} onClick={() => onChange({ ...panel, icon })}>
                  <Icon size={14} strokeWidth={1.9} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="panel-editor__buttons">
          <button className="collapsed-items__button panel-editor__remove" type="button" data-confirming={confirming || undefined} onBlur={() => setConfirming(false)} onClick={() => (confirming ? onRemove() : setConfirming(true))}>
            <Trash2 size={12} strokeWidth={2.2} aria-hidden="true" />
            {confirming ? text.confirmRemove : text.remove}
          </button>
          <button className="collapsed-items__button" type="button" onClick={onClose}>
            {text.close}
          </button>
        </div>
      </div>
      <PanelCanvas panel={panel} nameOf={library.nameOf} available={library.available} sizesOf={library.sizesOf} onChange={onChange} />
      <p className="settings-section__hint">{panel.items.length === 0 ? text.empty : text.canvasHint}</p>
      <WidgetLibrary widgets={library.widgets} onAdd={(widget, size) => onChange(addPanelItem(panel, widget, size))} onToggleBar={library.toggleBar} />
    </section>
  );
}
