import type { CSSProperties } from "react";
import { Check, Puzzle } from "lucide-react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { useTranslation } from "../../../i18n";
import { resizePanelItem, sizeCells, type CustomPanel } from "../../../lib/settings/customPanels";
import type { WidgetLibrary } from "./useWidgetLibrary";

type SizePickerProps = {
  panel: CustomPanel;
  library: WidgetLibrary;
  selected: string | undefined;
  onSelect: (widget: string) => void;
  onChange: (panel: CustomPanel) => void;
};

export function SizePicker({ panel, library, selected, onSelect, onChange }: SizePickerProps) {
  const t = useTranslation();
  const text = t.settings.islandPages.panels;
  const item = panel.items.find((candidate) => candidate.widget === selected);
  if (!item) return null;
  const widget = library.find(item.widget);
  const sizes = widget?.available ? widget.sizes : [];
  const Icon = widget?.icon ?? Puzzle;

  return (
    <SettingsGroup title={text.sizeTitle} footer={sizes.length === 1 ? text.oneSize : sizes.length === 0 ? text.unavailable : text.sizeHint}>
      <div className="size-picker">
        <div className="size-picker__tabs" role="tablist" aria-label={text.sizeTitle}>
          {panel.items.map((entry) => {
            const other = library.find(entry.widget);
            const TabIcon = other?.icon ?? Puzzle;
            return (
              <button key={entry.widget} type="button" role="tab" data-widget={entry.widget} aria-selected={entry.widget === item.widget} onClick={() => onSelect(entry.widget)}>
                <TabIcon size={14} strokeWidth={1.9} aria-hidden="true" />
                {other?.name ?? entry.widget}
              </button>
            );
          })}
        </div>
        <div className="size-picker__cards">
          {sizes.map((size) => {
            const { cols, rows } = sizeCells(size);
            const label = text.sizeCard(t.islandWidgets.sizes[size], cols, rows);
            const shape = { "--cols": cols, "--rows": rows } as CSSProperties;
            return (
              <button key={size} className="size-card" type="button" data-size={size} aria-pressed={size === item.size} aria-label={label} onClick={() => onChange(resizePanelItem(panel, item.widget, size))}>
                <span className="size-card__stage" aria-hidden="true">
                  <span className="size-card__shape" style={shape}>
                    <Icon size={rows > 1 || cols > 1 ? 18 : 14} strokeWidth={1.8} />
                  </span>
                  {size === item.size ? (
                    <span className="size-card__check">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  ) : null}
                </span>
                <span className="size-card__label">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </SettingsGroup>
  );
}
