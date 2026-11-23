import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import { ChevronLeft, ChevronRight, MoveDiagonal2, X } from "lucide-react";
import type { BoxDrag, BoxDragKind } from "../../../components/island-widget/useBoxDrag";
import { SlotView } from "../../../features/plugin-kernel/SlotView";
import type { WidgetLibrary } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import { GRID_CELL_PX, GRID_GAP_PX, itemBoxPx, layoutStrip, nextPanelSize, reorderPanelItem, sizeCells, type CustomPanel, type PanelSize } from "../../../lib/settings/customPanels";
import { MOTION_MEDIUM_MS } from "../../../lib/theme/motionTokens";
import { widgetSlot } from "../slots/widget";
import { freeTarget, keptInside, previewOf, type Board, type IncomingWidget } from "./boardDrag";
import { EntranceGhosts } from "./entrance/EntranceGhosts";
import type { EntranceRun } from "./entrance/useEntranceRun";
import { FUYU_ROWS } from "./panelSize";

const CELL_PADDING_X = 12;
const CELL_PADDING_Y = 11;
const WIGGLE_PERIOD_MS = 135;

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
  shown: CustomPanel | null;
  library: WidgetLibrary;
  editing: boolean;
  board: Board;
  incoming: IncomingWidget | null;
  pending: { widget: string; name: string } | null;
  drag: BoxDrag | null;
  away: boolean;
  pushed: ReadonlySet<string>;
  entrance: EntranceRun | null;
  scale: number;
  gridRef: Ref<HTMLDivElement>;
  begin: (widget: string, kind: BoxDragKind) => (event: ReactPointerEvent<HTMLElement>) => void;
  onCycleSize: (widget: string) => void;
  onChange: (panel: CustomPanel) => void;
  onRemove: (widget: string, name: string) => void;
};

type Landing = { widget: string; left: number; top: number };

function useLanding(drag: BoxDrag | null, shown: CustomPanel, visual: Landing | null, reach: number) {
  const [settle, setSettle] = useSettle();
  const last = useRef<Landing | null>(null);
  useLayoutEffect(() => {
    if (drag || !last.current) return;
    const from = last.current;
    last.current = null;
    const item = shown.items.find((candidate) => candidate.widget === from.widget);
    if (!item) return;
    const to = itemBoxPx(shown, item);
    const x = from.left - to.left;
    const y = from.top - to.top;
    if ((Math.abs(x) > 1 || Math.abs(y) > 1) && Math.abs(x) < reach) setSettle({ widget: from.widget, x, y, go: false });
  }, [drag, shown, setSettle, reach]);
  useLayoutEffect(() => {
    if (drag) last.current = visual;
  });
  return [settle, setSettle] as const;
}

export function PanelBoard({ panel, shown: preview, library, editing, board, incoming, pending, drag: rawDrag, away, pushed, entrance, scale, gridRef, begin, onCycleSize, onChange, onRemove }: PanelBoardProps) {
  const t = useTranslation().islandWidgets.panel;
  const free = panel.mode === "free";
  const drag = rawDrag && keptInside(panel, rawDrag, board);
  const shown = preview ?? layoutStrip(previewOf(panel, drag, incoming, board), board.rows ?? FUYU_ROWS, board.page);
  const target = drag ? freeTarget(panel, drag, board) : null;
  const slotItem = drag && !free && drag.kind === "move" ? shown.items.find((item) => item.widget === drag.widget) : null;
  const slot = slotItem ? itemBoxPx(shown, slotItem) : null;
  const original = drag ? panel.items.find((item) => item.widget === drag.widget) : null;
  const from = original && drag?.kind === "move" && !away ? itemBoxPx(shown, original) : null;
  const visual = from && drag ? (target ? { widget: drag.widget, left: target.left, top: target.top } : { widget: drag.widget, left: from.left + drag.dx, top: from.top + drag.dy }) : null;
  const reach = board.page ? board.page * (GRID_CELL_PX + GRID_GAP_PX) : board.width + 1;
  const [settle, setSettle] = useLanding(rawDrag, shown, visual, reach);
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
  const last = panel.items.length - 1;

  return (
    <div className="custom-panel__grid" ref={gridRef} style={{ width: board.width, height: board.height }} data-mode={panel.mode} data-editing={editing || undefined} data-entrance={entrance?.effect ?? undefined}>
      {entrance ? (
        <EntranceGhosts
          key={entrance.id}
          run={entrance}
          cards={shown.items.map((item) => ({ id: item.widget, ...itemBoxPx(shown, item) }))}
          viewWidth={board.page ? board.page * (GRID_CELL_PX + GRID_GAP_PX) - GRID_GAP_PX : board.width}
          height={board.height}
          step={GRID_CELL_PX + GRID_GAP_PX}
          scale={scale}
        />
      ) : null}
      {editing && !free ? <GridSlots {...board} /> : null}
      {target?.guideX != null ? <span className="custom-panel__guide" data-axis="x" style={{ left: target.guideX }} aria-hidden="true" /> : null}
      {target?.guideY != null ? <span className="custom-panel__guide" data-axis="y" style={{ top: target.guideY }} aria-hidden="true" /> : null}
      {slot ? <span className="custom-panel__target" style={slot} data-away={away || undefined} aria-hidden="true" /> : null}
      {shown.items.map((item, order) => {
        const index = panel.items.findIndex((candidate) => candidate.widget === item.widget);
        const moving = drag?.widget === item.widget ? drag : null;
        const box = itemBoxPx(shown, moving && original ? original : item);
        const style = { ...box, zIndex: moving ? shown.items.length + 1 : order + 1, "--wiggle-phase": `${(Math.max(0, index) * 53) % WIGGLE_PERIOD_MS}ms` } as CSSProperties;
        if (moving?.kind === "move") style.transform = target ? `translate(${target.left - box.left}px, ${target.top - box.top}px)` : `translate(${moving.dx}px, ${moving.dy}px)`;
        if (moving?.kind === "stretch" && target) {
          style.width = target.width;
          style.height = target.height;
        }
        const settling = settle?.widget === item.widget ? settle : null;
        if (settling && !settling.go) style.transform = `translate(${settling.x}px, ${settling.y}px)`;
        const waiting = incoming?.widget === item.widget ? incoming : pending?.widget === item.widget ? pending : null;
        if (waiting) {
          return (
            <div key={item.widget} className="custom-panel__cell" style={style} data-widget={item.widget} data-size={item.size} data-pending="true">
              <span className="custom-panel__pending-name">{waiting.name}</span>
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
            data-away={moving && away ? true : undefined}
            data-pushed={pushed.has(item.widget) || undefined}
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
                    <button className="custom-panel__size" type="button" aria-label={t.resizeWidget(name)} title={t.resizeWidget(name)} onClick={() => onCycleSize(item.widget)}>
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
