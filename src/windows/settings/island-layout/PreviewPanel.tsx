import { useState, type CSSProperties } from "react";
import { MoveDiagonal2, Puzzle } from "lucide-react";
import { PanelTemplateButtons } from "../../../components/island-widget/PanelTemplateButtons";
import { snapPx, useBoxDrag } from "../../../components/island-widget/useBoxDrag";
import type { WidgetLibrary } from "../../../features/plugin-kernel/widgetLibrary";
import { skipMissingBattery, useHasBattery } from "../../../features/system-widgets/batteryPresence";
import { useTranslation } from "../../../i18n";
import { GRID_UNIT_PX, itemBoxPx, placeFreeItem, stretchFreeItem, type CustomPanel } from "../../../lib/settings/customPanels";
import { applyPanelTemplate } from "../../../lib/settings/panelTemplates";
import { stripGeometry, type StripRoom } from "../../island/custom-panels/stripGeometry";
import "./PreviewPanel.css";

const SKELETON_BARS = 5;
const units = (px: number) => Math.floor(px / GRID_UNIT_PX);

type PreviewPanelProps = {
  panel: CustomPanel;
  room: StripRoom;
  zoom: number;
  library: WidgetLibrary;
  selected: string | undefined;
  onWidget: (id: string) => void;
  onChange: (panel: CustomPanel) => void;
};

export function PreviewPanel({ panel: stored, room, zoom, library, selected, onWidget, onChange }: PreviewPanelProps) {
  const t = useTranslation();
  const text = t.settings.islandPages;
  const free = stored.mode === "free";
  const { scale, width, height, panel, pages, pageStepPx } = stripGeometry(stored, room, free);
  const sizesOf = skipMissingBattery((id: string) => library.find(id)?.sizes ?? null, useHasBattery());
  const [picked, setPicked] = useState<{ page: number; selected: string | undefined }>({ page: 0, selected });
  const selectedItem = panel.items.find((item) => item.widget === selected);
  const followed = selectedItem ? Math.floor(itemBoxPx(panel, selectedItem).left / pageStepPx) : 0;
  const page = Math.min(Math.max(0, pages - 1), picked.selected === selected ? picked.page : followed);
  const { drag, begin } = useBoxDrag({
    scale: zoom * scale,
    onTap: onWidget,
    onDrop: (drop) => {
      const item = panel.items.find((candidate) => candidate.widget === drop.widget);
      if (!item) return;
      const dx = Math.round(drop.dx / GRID_UNIT_PX);
      const dy = Math.round(drop.dy / GRID_UNIT_PX);
      onWidget(drop.widget);
      onChange(drop.kind === "move"
        ? placeFreeItem(panel, drop.widget, item.x + dx, item.y + dy, units(width), units(height))
        : stretchFreeItem(panel, drop.widget, item.w + dx, item.h + dy, units(width), units(height)));
    },
  });
  if (panel.items.length === 0) {
    return (
      <div className="expanded-preview__empty">
        <p>{text.preview.empty}</p>
        <PanelTemplateButtons onPick={(template) => onChange(applyPanelTemplate(stored, template, sizesOf))} />
      </div>
    );
  }
  const shift: CSSProperties | undefined = pages > 1 ? { transform: `translateX(${-page * pageStepPx}px)` } : undefined;
  return (
    <>
      <div className="expanded-preview__viewport" data-mode={panel.mode} style={{ width: room.width, height: room.height }}>
        <div className="expanded-preview__zoom" style={{ zoom: scale }}>
          <div className="expanded-preview__grid" data-mode={panel.mode} data-pages={pages || undefined} style={{ width, height, ...shift }}>
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
                    <span className="expanded-preview__cell-head">
                      <Icon size={13} strokeWidth={2} aria-hidden="true" />
                      <strong>{name}</strong>
                    </span>
                    <span className="expanded-preview__skeleton" aria-hidden="true">
                      {Array.from({ length: SKELETON_BARS }, (_, bar) => <i key={bar} />)}
                    </span>
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
      </div>
      {pages > 1 ? (
        <div className="expanded-preview__pager">
          {Array.from({ length: pages }, (_, at) => (
            <button key={at} type="button" data-page-index={at} aria-pressed={at === page} aria-label={text.preview.pageOf(at + 1, pages)} title={text.preview.pageOf(at + 1, pages)} onClick={() => setPicked({ page: at, selected })} />
          ))}
        </div>
      ) : null}
    </>
  );
}
