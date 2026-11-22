import type { CSSProperties } from "react";
import { MoveDiagonal2, Puzzle } from "lucide-react";
import { PanelTemplateButtons } from "../../../components/island-widget/PanelTemplateButtons";
import { snapPx, useBoxDrag } from "../../../components/island-widget/useBoxDrag";
import type { WidgetLibrary } from "../../../features/plugin-kernel/widgetLibrary";
import { skipMissingBattery, useHasBattery } from "../../../features/system-widgets/batteryPresence";
import { useTranslation } from "../../../i18n";
import { boardHeightPx, cellsToPx, GRID_UNIT_PX, gridWidthPx, itemBoxPx, placeFreeItem, stretchFreeItem, type CustomPanel } from "../../../lib/settings/customPanels";
import { applyPanelTemplate } from "../../../lib/settings/panelTemplates";
import "./PreviewPanel.css";

const VISIBLE_ROWS = 4;

type PreviewPanelProps = {
  panel: CustomPanel;
  library: WidgetLibrary;
  selected: string | undefined;
  scale: number;
  onWidget: (id: string) => void;
  onChange: (panel: CustomPanel) => void;
};

export function PreviewPanel({ panel, library, selected, scale, onWidget, onChange }: PreviewPanelProps) {
  const t = useTranslation();
  const text = t.settings.islandPages;
  const free = panel.mode === "free";
  const sizesOf = skipMissingBattery((id: string) => library.find(id)?.sizes ?? null, useHasBattery());
  const { drag, begin } = useBoxDrag({
    scale,
    onTap: onWidget,
    onDrop: (drop) => {
      const item = panel.items.find((candidate) => candidate.widget === drop.widget);
      if (!item) return;
      const dx = Math.round(drop.dx / GRID_UNIT_PX);
      const dy = Math.round(drop.dy / GRID_UNIT_PX);
      onWidget(drop.widget);
      onChange(drop.kind === "move" ? placeFreeItem(panel, drop.widget, item.x + dx, item.y + dy) : stretchFreeItem(panel, drop.widget, item.w + dx, item.h + dy));
    },
  });
  if (panel.items.length === 0) {
    return (
      <div className="expanded-preview__empty">
        <p>{text.preview.empty}</p>
        <PanelTemplateButtons onPick={(template) => onChange(applyPanelTemplate(panel, template, sizesOf))} />
      </div>
    );
  }
  return (
    <div className="expanded-preview__scroll" style={{ maxHeight: cellsToPx(VISIBLE_ROWS) }}>
      <div className="expanded-preview__grid" data-mode={panel.mode} style={{ width: gridWidthPx, height: boardHeightPx(panel) + (free ? cellsToPx(1) : 0) }}>
        {panel.items.map((item, index) => {
          const box = itemBoxPx(panel, item);
          const widget = library.find(item.widget);
          const Icon = widget?.icon ?? Puzzle;
          const name = widget?.name ?? item.widget;
          const moving = drag?.widget === item.widget ? drag : null;
          const style: CSSProperties = { ...box, zIndex: moving ? panel.items.length + 1 : index + 1 };
          if (moving?.kind === "move") style.transform = `translate(${snapPx(moving.dx, GRID_UNIT_PX)}px, ${snapPx(moving.dy, GRID_UNIT_PX)}px)`;
          if (moving?.kind === "stretch") {
            style.width = Math.max(box.width + snapPx(moving.dx, GRID_UNIT_PX), GRID_UNIT_PX * 4);
            style.height = Math.max(box.height + snapPx(moving.dy, GRID_UNIT_PX), GRID_UNIT_PX * 4);
          }
          return (
            <div key={item.widget} className="expanded-preview__slot" style={style} data-widget={item.widget} data-dragging={moving ? true : undefined}>
              <button
                className="expanded-preview__cell"
                type="button"
                data-widget={item.widget}
                data-size={item.size}
                data-off={widget?.available ? undefined : true}
                aria-pressed={item.widget === selected}
                onClick={() => onWidget(item.widget)}
                onPointerDown={free ? begin(item.widget, "move") : undefined}
              >
                <Icon size={box.height > 128 || box.width > 128 ? 22 : 18} strokeWidth={1.8} aria-hidden="true" />
                <strong>{name}</strong>
                <small>{widget?.available ? t.islandWidgets.sizes[item.size] : text.panels.unavailable}</small>
              </button>
              {free ? (
                <span className="expanded-preview__stretch" role="presentation" title={t.islandWidgets.panel.stretchWidget(name)} onPointerDown={begin(item.widget, "stretch")}>
                  <MoveDiagonal2 size={12} strokeWidth={2.2} />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
