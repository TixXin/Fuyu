import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PanelTemplateButtons } from "../../../components/island-widget/PanelTemplateButtons";
import { skipAbsentWidgets, useAbsentWidgets } from "../../../features/plugin-kernel/absentWidgets";
import { useTranslation } from "../../../i18n";
import { cellsToPx, fuyuPanel, fuyuPanels, removePanelItem, setPanelMode, type CustomPanel, type PanelItem } from "../../../lib/settings/customPanels";
import { applyPanelTemplate } from "../../../lib/settings/panelTemplates";
import { useCustomPanels } from "../../../lib/settings/useCustomPanels";
import type { WidgetEntrance } from "../../../lib/settings/types";
import { useReducedMotion } from "../../../lib/theme/useReducedMotion";
import { useIslandNotch } from "../notch";
import type { Board } from "./boardDrag";
import { PanelBoard } from "./PanelBoard";
import { PanelDock, type Removed } from "./PanelDock";
import { stripGeometry } from "./stripGeometry";
import { useWheelScrollsSideways } from "./useWheelScrollsSideways";
import { editingPanel, stopPanelEditing, usePanelEditing } from "./panelEditing";
import { useIslandWidgets } from "./useIslandWidgets";
import { useEntranceRun } from "./entrance/useEntranceRun";
import { useHoldToEdit } from "./useHoldToEdit";
import { usePickerDrop } from "./usePickerDrop";
import { DragChip } from "./paging/DragChip";
import { dragHint } from "./paging/dragHint";
import { EdgeHints } from "./paging/EdgeHints";
import { PanelOverview } from "./paging/PanelOverview";
import { usePanelDrag } from "./paging/usePanelDrag";
import { useParkedWidgets } from "./paging/useParkedWidgets";
import { usePointerCarry } from "./paging/usePointerCarry";
import { usePublishPager } from "./paging/usePublishPager";
import "./CustomPanelPage.css";
import "./CustomPanelEdit.css";

const UNDO_MS = 4000;

function useStrip(stored: CustomPanel, editing: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setRoom({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { scale: fit, width, height, panel, pages, pageColumns, pageStepPx } = stripGeometry(stored, room, editing);
  const paged = pages > 0;
  useWheelScrollsSideways(ref, paged ? pageStepPx * fit : null);
  const board: Board = { width, height, page: pageColumns };
  return { ref, room, scale: fit, board, panel, pages, pageStepPx };
}

function useEditingLifetime(panelId: string, editing: boolean) {
  useEffect(() => {
    if (!editing) return;
    window.addEventListener("blur", stopPanelEditing);
    return () => window.removeEventListener("blur", stopPanelEditing);
  }, [editing]);
  useEffect(
    () => () => {
      if (editingPanel() === panelId) stopPanelEditing();
    },
    [panelId],
  );
}

function useUndoableRemoval() {
  const [removed, setRemoved] = useState<Removed | null>(null);
  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [removed]);
  return { removed, remember: setRemoved, forget: () => setRemoved(null) };
}

type CustomPanelPageProps = { panelId: string; entrance?: WidgetEntrance; dataMotion?: boolean; motion?: boolean };

export function CustomPanelPage({ panelId, entrance = "fade", dataMotion = false, motion = true }: CustomPanelPageProps) {
  const t = useTranslation().islandWidgets.panel;
  const { panels, save } = useCustomPanels();
  const library = useIslandWidgets();
  const editing = usePanelEditing() === panelId;
  const sizesOf = skipAbsentWidgets((id: string) => library.find(id)?.sizes ?? null, useAbsentWidgets());
  const { ref, room, scale, board, panel, pages, pageStepPx } = useStrip(fuyuPanel(panels, library.widgets.length > 0 ? sizesOf : undefined), editing);
  const empty = panel.items.length === 0;
  const grid = panel.mode === "grid";
  const reducedMotion = useReducedMotion();
  const notch = useIslandNotch();
  const entranceRun = useEntranceRun(entrance, dataMotion, motion && !reducedMotion && !editing && !empty);
  const gridRef = useRef<HTMLDivElement>(null);
  const { removed, remember, forget } = useUndoableRemoval();
  const { held, taken: heldTaken, onPointerDown } = useHoldToEdit(panelId);
  useEditingLifetime(panelId, editing);

  const change = (next: CustomPanel) => save(fuyuPanels(next));
  const { parked, park, take } = useParkedWidgets(editing, panel, change);
  const viewWidth = board.page ? cellsToPx(board.page) : board.width;
  const drag = usePanelDrag({
    panel,
    board,
    scale,
    pageStepPx,
    viewWidth,
    scroller: ref,
    grid: gridRef,
    editing,
    library,
    reduced: reducedMotion,
    held,
    onHeldTaken: heldTaken,
    onChange: change,
    onSentAway: ({ before, page }) => remember({ before, text: t.paging.movedTo(page + 1), go: page }),
    park,
    take,
  });
  const { carried, paging, pointer } = drag;
  const routed = grid && !empty;
  const carryTray = usePointerCarry<PanelItem>({
    onMove: (carry) => drag.moveOutside(carry ? { source: "tray", item: carry.payload, x: carry.clientX, y: carry.clientY } : null),
    onDrop: () => drag.dropOutside(),
  });
  usePublishPager({
    active: editing && routed,
    placement: notch && !notch.simulated ? "dock" : "header",
    panel: drag.shown ?? panel,
    pageCount: drag.pageCount,
    pageColumns: board.page ?? 1,
    carried: carried?.item.widget ?? null,
    pushed: drag.pushed,
    nav: paging.nav,
    overview: paging.overview,
    hot: drag.hot,
  });

  const picker = usePickerDrop({ panel, board, area: ref, grid: gridRef, routed, onChange: change, moveOutside: drag.moveOutside, dropOutside: drag.dropOutside });
  const remove = (widget: string, name: string) => {
    remember({ before: panel, text: t.removed(name) });
    change(removePanelItem(panel, widget));
  };
  const reset = () => {
    remember({ before: panel, text: t.resetDone });
    change(applyPanelTemplate({ ...panel, mode: "grid", items: [] }, "fuyu", sizesOf));
  };
  const undo = () => {
    if (removed) change(removed.before);
    forget();
  };

  const pageColumns = board.page ?? 1;
  const away = Boolean(carried) && (paging.overview || drag.spot?.kind !== "board");
  const wide = routed ? { ...board, width: Math.max(board.width, cellsToPx(drag.pageCount * pageColumns)) } : board;
  const snaps = editing && routed ? drag.pageCount : pages;
  const carriedWidget = carried ? (library.find(carried.item.widget) ?? null) : null;
  const carriedName = carriedWidget?.name ?? carried?.item.widget ?? "";
  const hint = carried ? dragHint(t.paging, { spot: drag.spot, target: drag.target, edge: drag.edge, page: paging.nav.page, overview: paging.overview, pushed: drag.pushedNames }) : null;

  return (
    <div
      className={editing ? "custom-panel custom-panel--editing" : "custom-panel"}
      data-panel={panelId}
      data-window-drag={editing ? "false" : undefined}
      data-carrying={carried ? true : undefined}
      onPointerDown={editing ? undefined : onPointerDown}
    >
      <div className="custom-panel__stage">
        <div className={pages > 0 ? "custom-panel__scroll custom-panel__scroll--paged" : "custom-panel__scroll"} ref={ref}>
          {empty ? (
            <div className="custom-panel__empty">
              <p>{t.empty}</p>
              {editing ? null : <PanelTemplateButtons onPick={(template) => change(applyPanelTemplate(panel, template, sizesOf))} />}
              <span className="custom-panel__hint">{editing ? t.emptyEditing : t.templateHint}</span>
            </div>
          ) : (
            <div className="custom-panel__zoom" style={{ zoom: scale }}>
              <PanelBoard
                panel={panel}
                shown={drag.shown}
                library={library}
                editing={editing}
                scale={scale}
                board={wide}
                incoming={picker.incoming}
                pending={carried && carried.source !== "board" ? { widget: carried.item.widget, name: carriedName } : null}
                drag={drag.drag}
                away={away}
                pushed={drag.pushed}
                entrance={entranceRun}
                gridRef={gridRef}
                begin={drag.begin}
                onCycleSize={drag.cycleSize}
                onChange={change}
                onRemove={remove}
              />
              {Array.from({ length: snaps }, (_, page) => (
                <span key={page} className="custom-panel__snap" style={{ left: page * pageStepPx }} data-divider={editing && page > 0 ? true : undefined} aria-hidden="true" />
              ))}
            </div>
          )}
        </div>
        {editing ? <EdgeHints edge={drag.edge} continuous={!grid} /> : null}
        {carried && paging.overview && room ? (
          <PanelOverview
            panel={drag.shown ?? panel}
            pageCount={drag.pageCount}
            pageColumns={pageColumns}
            pageStepPx={pageStepPx}
            viewWidth={viewWidth}
            boardHeight={board.height}
            room={room}
            canAdd
            target={drag.target ? { widget: carried.item.widget, page: drag.target.page } : null}
            pushed={drag.pushed}
            library={library}
          />
        ) : null}
      </div>
      {carried && pointer && away ? <DragChip widget={carriedWidget} name={carriedName} x={pointer.x} y={pointer.y} /> : null}
      {editing ? (
        <PanelDock
          panel={panel}
          library={library}
          removed={removed}
          hint={hint}
          tray={routed ? { parked, hot: drag.spot?.kind === "tray", dragging: Boolean(carried), onPress: carryTray } : null}
          onMode={(mode) => change(setPanelMode(panel, mode, true))}
          onReset={reset}
          onUndo={undo}
          onGo={(page) => {
            paging.nav.goPage(page);
            forget();
          }}
          onAdd={picker.add}
          onDrag={picker.drag}
          onDrop={picker.drop}
        />
      ) : null}
    </div>
  );
}
