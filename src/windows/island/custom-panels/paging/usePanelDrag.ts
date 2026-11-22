import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useBoxDrag } from "../../../../components/island-widget/useBoxDrag";
import type { WidgetLibrary } from "../../../../features/plugin-kernel/widgetLibrary";
import { itemBoxPx, nextPanelSize, resizePanelItem, type CustomPanel, type PanelItem } from "../../../../lib/settings/customPanels";
import { draggedTo, keptInside, type Board } from "../boardDrag";
import { resolveSpot, withinArea } from "./dropSpot";
import { clearStrayBreak, laidOut, liftWidget, pageCountOf, pageOfItem, pushedWidgets, spotTarget, type DropSpot } from "./gridTarget";
import { usePagingInput, usePagingState } from "./usePagingControls";

export type Outside = { source: "picker" | "tray"; item: PanelItem; x: number; y: number };
export type Carried = { source: "board" | "picker" | "tray"; item: PanelItem; rest: CustomPanel };
export type SentAway = { before: CustomPanel; page: number };
export type Held = { widget: string; clientX: number; clientY: number; pointerId: number };

export type PanelDragOptions = {
  panel: CustomPanel;
  board: Board;
  scale: number;
  pageStepPx: number;
  viewWidth: number;
  scroller: RefObject<HTMLDivElement | null>;
  grid: RefObject<HTMLDivElement | null>;
  editing: boolean;
  library: WidgetLibrary;
  reduced: boolean;
  held: Held | null;
  onHeldTaken: () => void;
  onChange: (panel: CustomPanel) => void;
  onSentAway: (sent: SentAway) => void;
  park: (item: PanelItem) => void;
  take: (widget: string) => void;
};

const REACH_PX = 48;

export function usePanelDrag(options: PanelDragOptions) {
  const { panel, board, scale, pageStepPx, viewWidth, scroller, grid: gridRef, editing, library, reduced, held, onHeldTaken, onChange } = options;
  const grid = panel.mode === "grid";
  const pageColumns = board.page ?? 1;
  const [outside, setOutside] = useState<Outside | null>(null);
  const lastSpot = useRef<DropSpot | null>(null);
  const live = useRef<{ carried: Carried | null; spot: DropSpot | null; overview: boolean }>({ carried: null, spot: null, overview: false });
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const cycleSize = (widget: string) => {
    const item = panel.items.find((candidate) => candidate.widget === widget);
    const size = item && grid ? nextPanelSize(library.find(widget)?.sizes ?? [], item.size) : null;
    if (item && size) onChange(resizePanelItem(panel, widget, size));
  };
  const commit = () => {
    const { carried, spot, overview } = live.current;
    const { onChange: save, onSentAway, park, take, panel: before } = latest.current;
    paging.reset();
    lastSpot.current = null;
    if (!carried || !spot) return;
    if (spot.kind === "tray") {
      if (carried.source === "tray") return;
      park(carried.item);
      return save(laidOut(carried.rest, pageColumns));
    }
    const target = spotTarget(carried.rest, carried.item, spot, pageColumns, pageStepPx);
    if (!target) return;
    if (carried.source === "tray") take(carried.item.widget);
    if (carried.source !== "tray" && !overview && target.page !== paging.nav.pageRef.current) onSentAway({ before, page: target.page });
    save(clearStrayBreak(target.panel));
    if (overview) paging.nav.goPage(target.page, 0);
  };
  const { drag, begin, beginAt, cancel } = useBoxDrag({
    scale,
    scroller,
    onTap: cycleSize,
    onDrop: (drop) => {
      if (grid && drop.kind === "move") return commit();
      onChange(draggedTo(panel, keptInside(panel, drop, board), board));
    },
  });

  const moving = drag && grid && drag.kind === "move" ? drag.widget : null;
  const lifted = useMemo(() => (moving ? liftWidget(panel, moving) : null), [panel, moving]);
  const carried: Carried | null = lifted ? { source: "board", ...lifted } : outside && grid ? { source: outside.source, item: outside.item, rest: panel } : null;
  const pointer = drag ? { x: drag.clientX, y: drag.clientY } : outside ? { x: outside.x, y: outside.y } : null;
  const freeMove = !grid && drag?.kind === "move";
  const stepPx = pageStepPx * scale;
  const paging = usePagingState({ scroller, stepPx, enabled: editing && grid, dragging: Boolean(carried), reduced });

  const boardPoint = () => {
    if (!pointer || !withinArea(scroller.current, pointer, REACH_PX)) return null;
    const original = drag ? panel.items.find((item) => item.widget === drag.widget) : null;
    if (drag && original) {
      const at = itemBoxPx(panel, original);
      return { x: at.left + at.width / 2 + drag.dx, y: at.top + at.height / 2 + drag.dy };
    }
    const element = gridRef.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const factor = rect.width > 0 ? element.offsetWidth / rect.width : 1;
    return { x: (pointer.x - rect.left) * factor, y: (pointer.y - rect.top) * factor };
  };
  const restLaid = carried ? laidOut(carried.rest, pageColumns) : panel;
  const basePages = Math.max(pageCountOf(restLaid, pageColumns), paging.floorPages);
  const context = { overview: paging.overview, boardPoint, viewWidth, boardHeight: board.height, pageStepPx, pageCount: basePages, page: paging.nav.page };
  const resolved = carried && pointer ? resolveSpot(pointer, context) : null;
  const spot = carried ? (resolved?.spot ?? lastSpot.current) : null;
  const target = carried && spot ? spotTarget(carried.rest, carried.item, spot, pageColumns, pageStepPx) : null;
  const shown = carried ? (target?.panel ?? restLaid) : null;
  const pageCount = Math.max(pageCountOf(shown ?? panel, pageColumns), paging.floorPages);
  const pushed = target && carried ? pushedWidgets(restLaid, target.panel, pageColumns, carried.item.widget) : [];
  const input = usePagingInput({
    state: paging,
    pointer,
    active: Boolean(carried),
    freeMove,
    hit: resolved?.hit ?? null,
    pageCount,
    scroller,
    stepPx,
    reduced,
    onCancel: () => {
      cancel();
      setOutside(null);
      lastSpot.current = null;
    },
  });

  useEffect(() => {
    live.current = { carried, spot, overview: paging.overview };
    if (resolved?.spot) lastSpot.current = resolved.spot;
  });
  useEffect(() => {
    if (!editing || !held) return;
    beginAt(held.widget, "move", held);
    onHeldTaken();
  }, [editing, held, beginAt, onHeldTaken]);
  useEffect(() => {
    if (!carried && editing && grid && paging.nav.page > pageCount - 1) paging.nav.goPage(pageCount - 1);
  });

  const pushedNames = pushed.map((widget) => {
    const item = target?.panel.items.find((candidate) => candidate.widget === widget);
    return { name: library.find(widget)?.name ?? widget, page: item ? pageOfItem(item, pageColumns) : 0 };
  });

  return {
    drag,
    begin,
    carried,
    spot,
    target,
    shown,
    pageCount,
    pushed: new Set(pushed),
    pushedNames,
    pointer,
    cycleSize,
    paging,
    edge: input.edge,
    hot: input.hot,
    moveOutside: (next: Outside | null) => {
      if (!paging.cancelled()) setOutside(next);
    },
    dropOutside: () => {
      if (!paging.cancelled()) commit();
    },
  };
}
