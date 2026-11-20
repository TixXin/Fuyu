import type { CSSProperties } from "react";
import { Minus, MoveDiagonal2 } from "lucide-react";
import { snapPx, useBoxDrag, type BoxDrop } from "../../../components/island-widget/useBoxDrag";
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
  removePanelItem,
  reorderPanelItem,
  resizePanelItem,
  stretchFreeItem,
  type CustomPanel,
} from "../../../lib/settings/customPanels";
import { widgetSlot } from "../slots/widget";

const CELL_PADDING = 10;
const EDIT_ROOM_PX = 64;

function widgetUnder(drop: BoxDrop): string | null {
  for (const element of document.elementsFromPoint(drop.clientX, drop.clientY)) {
    const cell = element.closest<HTMLElement>(".custom-panel__cell[data-widget]");
    if (cell && cell.dataset.widget !== drop.widget) return cell.dataset.widget ?? null;
  }
  return null;
}

type PanelBoardProps = {
  panel: CustomPanel;
  library: WidgetLibrary;
  editing: boolean;
  scale: number;
  onChange: (panel: CustomPanel) => void;
};

export function PanelBoard({ panel, library, editing, scale, onChange }: PanelBoardProps) {
  const t = useTranslation().islandWidgets;
  const free = panel.mode === "free";
  const { drag, begin } = useBoxDrag({
    scale,
    onDrop: (drop) => {
      const item = panel.items.find((candidate) => candidate.widget === drop.widget);
      if (!item) return;
      const dx = Math.round(drop.dx / GRID_UNIT_PX);
      const dy = Math.round(drop.dy / GRID_UNIT_PX);
      if (!free) onChange(reorderPanelItem(panel, drop.widget, widgetUnder(drop)));
      else if (drop.kind === "move") onChange(placeFreeItem(panel, drop.widget, item.x + dx, item.y + dy));
      else onChange(stretchFreeItem(panel, drop.widget, item.w + dx, item.h + dy));
    },
    onTap: (widget) => {
      const item = panel.items.find((candidate) => candidate.widget === widget);
      const size = item && !free ? nextPanelSize(library.find(widget)?.sizes ?? [], item.size) : null;
      if (item && size) onChange(resizePanelItem(panel, widget, size));
    },
  });
  const height = boardHeightPx(panel) + (editing ? EDIT_ROOM_PX : 0);

  return (
    <div className="custom-panel__grid" style={{ width: gridWidthPx, height }} data-mode={panel.mode}>
      {panel.items.map((item, index) => {
        const box = itemBoxPx(panel, item);
        const moving = drag?.widget === item.widget ? drag : null;
        const style: CSSProperties = { ...box, zIndex: moving ? panel.items.length + 1 : index + 1 };
        if (moving?.kind === "move") style.transform = `translate(${free ? snapPx(moving.dx, GRID_UNIT_PX) : moving.dx}px, ${free ? snapPx(moving.dy, GRID_UNIT_PX) : moving.dy}px)`;
        if (moving?.kind === "stretch") {
          style.width = Math.max(box.width + snapPx(moving.dx, GRID_UNIT_PX), GRID_UNIT_PX * 4);
          style.height = Math.max(box.height + snapPx(moving.dy, GRID_UNIT_PX), GRID_UNIT_PX * 4);
        }
        const name = library.find(item.widget)?.name ?? item.widget;
        return (
          <div key={item.widget} className="custom-panel__cell" style={style} data-widget={item.widget} data-size={item.size} data-dragging={moving ? true : undefined}>
            <SlotView
              slot={widgetSlot}
              props={{ size: item.size, width: box.width - CELL_PADDING * 2, height: box.height - CELL_PADDING * 2 }}
              select={(items) => items.filter((entry) => entry.id === item.widget && entry.sizes.includes(item.size)).slice(0, 1)}
            />
            {editing ? (
              <>
                <div className="custom-panel__shield" onPointerDown={begin(item.widget, "move")} aria-hidden="true" />
                <button className="custom-panel__remove" type="button" aria-label={t.panel.removeWidget(name)} title={t.panel.removeWidget(name)} onClick={() => onChange(removePanelItem(panel, item.widget))}>
                  <Minus size={12} strokeWidth={3} />
                </button>
                {free ? (
                  <span className="custom-panel__stretch" role="presentation" title={t.panel.stretchWidget(name)} onPointerDown={begin(item.widget, "stretch")}>
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
