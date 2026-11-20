import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import { ChevronLeft, ChevronRight, MoveDiagonal2, X } from "lucide-react";
import { snapPx, useBoxDrag, type BoxDrag, type BoxDragKind } from "../../../components/island-widget/useBoxDrag";
import { SlotView } from "../../../features/plugin-kernel/SlotView";
import type { WidgetLibrary } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import {
  boardHeightPx,
  dropNewPanelItem,
  GRID_UNIT_PX,
  gridWidthPx,
  insertIndexAt,
  itemBoxPx,
  movePanelItemTo,
  nextPanelSize,
  placeFreeItem,
  reorderPanelItem,
  resizePanelItem,
  sizeCells,
  stretchFreeItem,
  type CustomPanel,
  type PanelSize,
} from "../../../lib/settings/customPanels";
import { MOTION_MEDIUM_MS } from "../../../lib/theme/motionTokens";
import { widgetSlot } from "../slots/widget";
import type { LongPressStart } from "./useLongPress";

const CELL_PADDING = 10;
const WIGGLE_PERIOD_MS = 135;

export type IncomingWidget = { widget: string; name: string; size: PanelSize; x: number; y: number };
export type HeldWidget = Omit<LongPressStart, "target"> & { widget: string };
type Settle = { widget: string; x: number; y: number; go: boolean };

function sizeLabel(size: PanelSize) {
  const { cols, rows } = sizeCells(size);
  return `${cols}×${rows}`;
}

function draggedTo(panel: CustomPanel, drag: Pick<BoxDrag, "widget" | "kind" | "dx" | "dy">): CustomPanel {
  const item = panel.items.find((candidate) => candidate.widget === drag.widget);
  if (!item) return panel;
  if (panel.mode === "free") {
    const dx = Math.round(drag.dx / GRID_UNIT_PX);
    const dy = Math.round(drag.dy / GRID_UNIT_PX);
    return drag.kind === "move" ? placeFreeItem(panel, drag.widget, item.x + dx, item.y + dy) : stretchFreeItem(panel, drag.widget, item.w + dx, item.h + dy);
  }
  if (drag.kind !== "move") return panel;
  const box = itemBoxPx(panel, item);
  const index = insertIndexAt(panel, box.left + box.width / 2 + drag.dx, box.top + box.height / 2 + drag.dy, drag.widget);
  return movePanelItemTo(panel, drag.widget, index);
}

export type DragArea = { left: number; top: number; right: number; bottom: number };

function keptInside(panel: CustomPanel, drag: BoxDrag, area: DragArea | null): BoxDrag {
  const item = panel.items.find((candidate) => candidate.widget === drag.widget);
  if (!item) return drag;
  const box = itemBoxPx(panel, item);
  const bounds = area ?? { left: 0, top: 0, right: gridWidthPx, bottom: boardHeightPx(panel) };
  const bottom = Math.max(bounds.bottom, boardHeightPx(panel));
  const within = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));
  if (drag.kind === "stretch") return { ...drag, dx: Math.min(drag.dx, gridWidthPx - box.left - box.width), dy: Math.min(drag.dy, bottom - box.top - box.height) };
  return {
    ...drag,
    dx: within(drag.dx, Math.min(0, bounds.left) - box.left, Math.max(gridWidthPx, bounds.right) - box.left - box.width),
    dy: within(drag.dy, Math.min(0, bounds.top) - box.top, bottom - box.top - box.height),
  };
}

function previewOf(panel: CustomPanel, drag: BoxDrag | null, incoming: IncomingWidget | null): CustomPanel {
  if (incoming) return dropNewPanelItem(panel, incoming.widget, incoming.size, incoming.x, incoming.y);
  return drag ? draggedTo(panel, drag) : panel;
}

function useSettle() {
  const [settle, setSettle] = useState<Settle | null>(null);
  useEffect(() => {
    if (!settle?.go) return;
    const timer = window.setTimeout(() => setSettle(null), MOTION_MEDIUM_MS);
    return () => window.clearTimeout(timer);
  }, [settle]);
  useEffect(() => {
    if (!settle || settle.go) return;
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => setSettle((current) => (current ? { ...current, go: true } : current)));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [settle]);
  return [settle, setSettle] as const;
}

type PanelBoardProps = {
  panel: CustomPanel;
  library: WidgetLibrary;
  editing: boolean;
  scale: number;
  area: DragArea | null;
  incoming: IncomingWidget | null;
  held: HeldWidget | null;
  onHeldTaken: () => void;
  gridRef: Ref<HTMLDivElement>;
  onChange: (panel: CustomPanel) => void;
  onRemove: (widget: string, name: string) => void;
};

export function PanelBoard({ panel, library, editing, scale, area, incoming, held, onHeldTaken, gridRef, onChange, onRemove }: PanelBoardProps) {
  const t = useTranslation().islandWidgets.panel;
  const free = panel.mode === "free";
  const [settle, setSettle] = useSettle();
  const cycleSize = (widget: string) => {
    const item = panel.items.find((candidate) => candidate.widget === widget);
    const size = item && !free ? nextPanelSize(library.find(widget)?.sizes ?? [], item.size) : null;
    if (item && size) onChange(resizePanelItem(panel, widget, size));
  };
  const { drag: rawDrag, begin, beginAt } = useBoxDrag({
    scale,
    onDrop: (released) => {
      const drop = { ...released, ...keptInside(panel, released, area) };
      const item = panel.items.find((candidate) => candidate.widget === drop.widget);
      if (!item) return;
      const next = draggedTo(panel, drop);
      const placed = next.items.find((candidate) => candidate.widget === drop.widget);
      if (drop.kind === "move" && placed) {
        const from = itemBoxPx(panel, item);
        const to = itemBoxPx(next, placed);
        const dx = free ? snapPx(drop.dx, GRID_UNIT_PX) : drop.dx;
        const dy = free ? snapPx(drop.dy, GRID_UNIT_PX) : drop.dy;
        setSettle({ widget: drop.widget, x: from.left + dx - to.left, y: from.top + dy - to.top, go: false });
      }
      onChange(next);
    },
    onTap: cycleSize,
  });
  useEffect(() => {
    if (!editing || !held) return;
    beginAt(held.widget, "move", held);
    onHeldTaken();
  }, [editing, held, beginAt, onHeldTaken]);
  const grab = (widget: string, kind: BoxDragKind) => (event: ReactPointerEvent<HTMLElement>) => {
    setSettle(null);
    begin(widget, kind)(event);
  };
  const shift = (index: number, delta: -1 | 1) => {
    const item = panel.items[index];
    if (!item) return;
    setSettle(null);
    const before = delta < 0 ? (panel.items[index - 1]?.widget ?? null) : (panel.items[index + 2]?.widget ?? null);
    onChange(reorderPanelItem(panel, item.widget, before));
  };
  const drag = rawDrag && keptInside(panel, rawDrag, area);
  const shown = previewOf(panel, drag, incoming);
  const last = panel.items.length - 1;

  return (
    <div className="custom-panel__grid" ref={gridRef} style={{ width: gridWidthPx, height: boardHeightPx(shown) }} data-mode={panel.mode}>
      {shown.items.map((item, order) => {
        const index = panel.items.findIndex((candidate) => candidate.widget === item.widget);
        const moving = drag?.widget === item.widget ? drag : null;
        const original = panel.items[index];
        const box = itemBoxPx(shown, moving && original ? original : item);
        const style = { ...box, zIndex: moving ? shown.items.length + 1 : order + 1, "--wiggle-phase": `${(Math.max(0, index) * 53) % WIGGLE_PERIOD_MS}ms` } as CSSProperties;
        if (moving?.kind === "move") style.transform = `translate(${free ? snapPx(moving.dx, GRID_UNIT_PX) : moving.dx}px, ${free ? snapPx(moving.dy, GRID_UNIT_PX) : moving.dy}px)`;
        if (moving?.kind === "stretch") {
          style.width = Math.max(box.width + snapPx(moving.dx, GRID_UNIT_PX), GRID_UNIT_PX * 4);
          style.height = Math.max(box.height + snapPx(moving.dy, GRID_UNIT_PX), GRID_UNIT_PX * 4);
        }
        const settling = settle?.widget === item.widget ? settle : null;
        if (settling && !settling.go) style.transform = `translate(${settling.x}px, ${settling.y}px)`;
        if (incoming?.widget === item.widget) {
          return (
            <div key={item.widget} className="custom-panel__cell" style={style} data-widget={item.widget} data-size={item.size} data-pending="true">
              <span className="custom-panel__pending-name">{incoming.name}</span>
            </div>
          );
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
            data-settle={settling ? (settling.go ? "go" : "hold") : undefined}
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
