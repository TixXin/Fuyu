import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, MoveDiagonal2, X } from "lucide-react";
import { snapPx, useBoxDrag, type BoxDrop, type BoxDragKind } from "../../../components/island-widget/useBoxDrag";
import { SlotView } from "../../../features/plugin-kernel/SlotView";
import type { WidgetLibrary } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import {
  boardHeightPx,
  GRID_UNIT_PX,
  gridWidthPx,
  itemBoxPx,
  nextPanelSize,
  placeFreeItem,
  reorderPanelItem,
  resizePanelItem,
  sizeCells,
  stretchFreeItem,
  type CustomPanel,
  type PanelSize,
} from "../../../lib/settings/customPanels";
import { widgetSlot } from "../slots/widget";

const CELL_PADDING = 10;
const EDIT_ROOM_PX = 64;
const WIGGLE_PERIOD_MS = 135;

function widgetUnder(drop: BoxDrop): string | null {
  for (const element of document.elementsFromPoint(drop.clientX, drop.clientY)) {
    const cell = element.closest<HTMLElement>(".custom-panel__cell[data-widget]");
    if (cell && cell.dataset.widget !== drop.widget) return cell.dataset.widget ?? null;
  }
  return null;
}

function sizeLabel(size: PanelSize) {
  const { cols, rows } = sizeCells(size);
  return `${cols}×${rows}`;
}

type PanelBoardProps = {
  panel: CustomPanel;
  library: WidgetLibrary;
  editing: boolean;
  scale: number;
  onChange: (panel: CustomPanel) => void;
  onRemove: (widget: string, name: string) => void;
};

export function PanelBoard({ panel, library, editing, scale, onChange, onRemove }: PanelBoardProps) {
  const t = useTranslation().islandWidgets.panel;
  const free = panel.mode === "free";
  const [dropped, setDropped] = useState<string | null>(null);
  const cycleSize = (widget: string) => {
    const item = panel.items.find((candidate) => candidate.widget === widget);
    const size = item && !free ? nextPanelSize(library.find(widget)?.sizes ?? [], item.size) : null;
    if (item && size) onChange(resizePanelItem(panel, widget, size));
  };
  const { drag, begin } = useBoxDrag({
    scale,
    onDrop: (drop) => {
      const item = panel.items.find((candidate) => candidate.widget === drop.widget);
      if (!item) return;
      setDropped(drop.widget);
      const dx = Math.round(drop.dx / GRID_UNIT_PX);
      const dy = Math.round(drop.dy / GRID_UNIT_PX);
      if (!free) onChange(reorderPanelItem(panel, drop.widget, widgetUnder(drop)));
      else if (drop.kind === "move") onChange(placeFreeItem(panel, drop.widget, item.x + dx, item.y + dy));
      else onChange(stretchFreeItem(panel, drop.widget, item.w + dx, item.h + dy));
    },
    onTap: cycleSize,
  });
  const grab = (widget: string, kind: BoxDragKind) => (event: ReactPointerEvent<HTMLElement>) => {
    setDropped(null);
    begin(widget, kind)(event);
  };
  const shift = (index: number, delta: -1 | 1) => {
    const item = panel.items[index];
    if (!item) return;
    setDropped(null);
    const before = delta < 0 ? (panel.items[index - 1]?.widget ?? null) : (panel.items[index + 2]?.widget ?? null);
    onChange(reorderPanelItem(panel, item.widget, before));
  };
  const height = boardHeightPx(panel) + (editing ? EDIT_ROOM_PX : 0);
  const last = panel.items.length - 1;

  return (
    <div className="custom-panel__grid" style={{ width: gridWidthPx, height }} data-mode={panel.mode}>
      {panel.items.map((item, index) => {
        const box = itemBoxPx(panel, item);
        const moving = drag?.widget === item.widget ? drag : null;
        const style = { ...box, zIndex: moving ? panel.items.length + 1 : index + 1, "--wiggle-phase": `${(index * 53) % WIGGLE_PERIOD_MS}ms` } as CSSProperties;
        if (moving?.kind === "move") style.transform = `translate(${free ? snapPx(moving.dx, GRID_UNIT_PX) : moving.dx}px, ${free ? snapPx(moving.dy, GRID_UNIT_PX) : moving.dy}px)`;
        if (moving?.kind === "stretch") {
          style.width = Math.max(box.width + snapPx(moving.dx, GRID_UNIT_PX), GRID_UNIT_PX * 4);
          style.height = Math.max(box.height + snapPx(moving.dy, GRID_UNIT_PX), GRID_UNIT_PX * 4);
        }
        const widget = library.find(item.widget);
        const name = widget?.name ?? item.widget;
        const resizable = !free && nextPanelSize(widget?.sizes ?? [], item.size) !== null;
        return (
          <div
            key={item.widget}
            className="custom-panel__cell"
            style={style}
            data-widget={item.widget}
            data-size={item.size}
            data-dragging={moving ? true : undefined}
            data-dropped={dropped === item.widget ? true : undefined}
          >
            <SlotView
              slot={widgetSlot}
              props={{ size: item.size, width: box.width - CELL_PADDING * 2, height: box.height - CELL_PADDING * 2 }}
              select={(items) => items.filter((entry) => entry.id === item.widget && entry.sizes.includes(item.size)).slice(0, 1)}
            />
            {editing ? (
              <>
                <div className="custom-panel__shield" onPointerDown={grab(item.widget, "move")} aria-hidden="true" />
                <div className="custom-panel__strip">
                  {free ? null : (
                    <button type="button" disabled={index === 0} aria-label={t.moveLeft(name)} title={t.moveLeft(name)} onClick={() => shift(index, -1)}>
                      <ChevronLeft size={13} strokeWidth={2.4} />
                    </button>
                  )}
                  <span className="custom-panel__strip-name" title={name}>
                    {name}
                  </span>
                  {free ? null : (
                    <button type="button" disabled={index === last} aria-label={t.moveRight(name)} title={t.moveRight(name)} onClick={() => shift(index, 1)}>
                      <ChevronRight size={13} strokeWidth={2.4} />
                    </button>
                  )}
                  {resizable ? (
                    <button className="custom-panel__size" type="button" aria-label={t.resizeWidget(name)} title={t.resizeWidget(name)} onClick={() => cycleSize(item.widget)}>
                      {sizeLabel(item.size)}
                    </button>
                  ) : null}
                </div>
                <button className="custom-panel__remove" type="button" aria-label={t.removeWidget(name)} title={t.removeWidget(name)} onClick={() => onRemove(item.widget, name)}>
                  <X size={12} strokeWidth={2.8} />
                </button>
                {free ? (
                  <span className="custom-panel__stretch" role="presentation" title={t.stretchWidget(name)} onPointerDown={grab(item.widget, "stretch")}>
                    <MoveDiagonal2 size={12} strokeWidth={2.2} />
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
