import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import { ChevronLeft, ChevronRight, MoveDiagonal2, X } from "lucide-react";
import { useBoxDrag, type BoxDragKind } from "../../../components/island-widget/useBoxDrag";
import { SlotView } from "../../../features/plugin-kernel/SlotView";
import type { WidgetLibrary } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import { GRID_CELL_PX, GRID_GAP_PX, itemBoxPx, layoutStrip, nextPanelSize, reorderPanelItem, resizePanelItem, sizeCells, type CustomPanel, type PanelSize } from "../../../lib/settings/customPanels";
import { MOTION_MEDIUM_MS } from "../../../lib/theme/motionTokens";
import { widgetSlot } from "../slots/widget";
import { draggedTo, freeTarget, keptInside, previewOf, type Board, type IncomingWidget } from "./boardDrag";
import { FUYU_ROWS } from "./panelSize";
import type { LongPressStart } from "./useLongPress";

const CELL_PADDING_X = 12;
const CELL_PADDING_Y = 11;
const WIGGLE_PERIOD_MS = 135;

export type HeldWidget = Omit<LongPressStart, "target"> & { widget: string };
type Settle = { widget: string; x: number; y: number; go: boolean };

function sizeLabel(size: PanelSize) {
  const { cols, rows } = sizeCells(size);
  return `${cols}×${rows}`;
}

function GridSlots({ width, height }: Board) {
  const step = GRID_CELL_PX + GRID_GAP_PX;
  const rows = Math.max(1, Math.floor((height + GRID_GAP_PX) / step));
  const columns = Math.max(1, Math.floor((width + GRID_GAP_PX) / step));
  return Array.from({ length: rows * columns }, (_, at) => (
    <span key={at} className="custom-panel__slot" style={{ left: (at % columns) * step, top: Math.floor(at / columns) * step, width: GRID_CELL_PX, height: GRID_CELL_PX }} aria-hidden="true" />
  ));
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
  board: Board;
  incoming: IncomingWidget | null;
  held: HeldWidget | null;
  onHeldTaken: () => void;
  gridRef: Ref<HTMLDivElement>;
  onChange: (panel: CustomPanel) => void;
  onRemove: (widget: string, name: string) => void;
};

export function PanelBoard({ panel, library, editing, scale, board, incoming, held, onHeldTaken, gridRef, onChange, onRemove }: PanelBoardProps) {
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
      const drop = keptInside(panel, released, board);
      const item = panel.items.find((candidate) => candidate.widget === drop.widget);
      if (!item) return;
      const next = layoutStrip(draggedTo(panel, drop, board), FUYU_ROWS, board.page);
      const placed = next.items.find((candidate) => candidate.widget === drop.widget);
      if (drop.kind === "move" && placed) {
        const from = itemBoxPx(panel, item);
        const target = freeTarget(panel, drop, board);
        const to = itemBoxPx(next, placed);
        setSettle({ widget: drop.widget, x: (target ? target.left : from.left + drop.dx) - to.left, y: (target ? target.top : from.top + drop.dy) - to.top, go: false });
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
  const drag = rawDrag && keptInside(panel, rawDrag, board);
  const shown = layoutStrip(previewOf(panel, drag, incoming, board), FUYU_ROWS, board.page);
  const target = drag ? freeTarget(panel, drag, board) : null;
  const last = panel.items.length - 1;

  return (
    <div className="custom-panel__grid" ref={gridRef} style={{ width: board.width, height: board.height }} data-mode={panel.mode} data-editing={editing || undefined}>
      {editing && !free ? <GridSlots {...board} /> : null}
      {target?.guideX != null ? <span className="custom-panel__guide" data-axis="x" style={{ left: target.guideX }} aria-hidden="true" /> : null}
      {target?.guideY != null ? <span className="custom-panel__guide" data-axis="y" style={{ top: target.guideY }} aria-hidden="true" /> : null}
      {shown.items.map((item, order) => {
        const index = panel.items.findIndex((candidate) => candidate.widget === item.widget);
        const moving = drag?.widget === item.widget ? drag : null;
        const original = panel.items[index];
        const box = itemBoxPx(shown, moving && original ? original : item);
        const style = { ...box, zIndex: moving ? shown.items.length + 1 : order + 1, "--wiggle-phase": `${(Math.max(0, index) * 53) % WIGGLE_PERIOD_MS}ms` } as CSSProperties;
        if (moving?.kind === "move") style.transform = target ? `translate(${target.left - box.left}px, ${target.top - box.top}px)` : `translate(${moving.dx}px, ${moving.dy}px)`;
        if (moving?.kind === "stretch" && target) {
          style.width = target.width;
          style.height = target.height;
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
              props={{ size: item.size, width: box.width - CELL_PADDING_X * 2, height: box.height - CELL_PADDING_Y * 2 }}
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
