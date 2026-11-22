import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CirclePlus, RotateCcw } from "lucide-react";
import { PanelTemplateButtons } from "../../../components/island-widget/PanelTemplateButtons";
import { skipAbsentWidgets, useAbsentWidgets } from "../../../features/plugin-kernel/absentWidgets";
import type { LibraryWidget } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import { addPanelItem, defaultWidgetSize, fuyuPanel, fuyuPanels, GRID_UNIT_PX, PANEL_MODES, placeFreeItem, removePanelItem, setPanelMode, stripRightPx, type CustomPanel } from "../../../lib/settings/customPanels";
import { applyPanelTemplate } from "../../../lib/settings/panelTemplates";
import { useCustomPanels } from "../../../lib/settings/useCustomPanels";
import type { WidgetEntrance } from "../../../lib/settings/types";
import { useReducedMotion } from "../../../lib/theme/useReducedMotion";
import { dropIncoming, type Board, type IncomingWidget } from "./boardDrag";
import { PanelBoard, type HeldWidget } from "./PanelBoard";
import { stripGeometry } from "./stripGeometry";
import { useWheelScrollsSideways } from "./useWheelScrollsSideways";
import { editingPanel, startPanelEditing, stopPanelEditing, usePanelEditing } from "./panelEditing";
import { useIslandWidgets } from "./useIslandWidgets";
import { useEntranceRun } from "./entrance/useEntranceRun";
import { useLongPress, type LongPressStart } from "./useLongPress";
import { WidgetPicker, type PickerDrag } from "./WidgetPicker";
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
  return { ref, scale: fit, board, panel, pages, pageStepPx };
}

function boardPoint(grid: HTMLElement | null, area: HTMLElement | null, drag: PickerDrag): { x: number; y: number } | null {
  if (!grid || !area) return null;
  const bounds = area.getBoundingClientRect();
  if (drag.clientX < bounds.left || drag.clientX > bounds.right || drag.clientY < bounds.top || drag.clientY > bounds.bottom) return null;
  const rect = grid.getBoundingClientRect();
  const factor = rect.width > 0 ? grid.offsetWidth / rect.width : 1;
  return { x: (drag.clientX - rect.left) * factor, y: (drag.clientY - rect.top) * factor };
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

type Removed = { before: CustomPanel; text: string };

function useUndoableRemoval() {
  const [removed, setRemoved] = useState<Removed | null>(null);
  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [removed]);
  return { removed, remember: setRemoved, forget: () => setRemoved(null) };
}

const holdable = (target: Element) => !target.closest("button, a, input, textarea, select, [contenteditable], [role='slider']");

type CustomPanelPageProps = { panelId: string; entrance?: WidgetEntrance; dataMotion?: boolean; motion?: boolean };

export function CustomPanelPage({ panelId, entrance = "fade", dataMotion = false, motion = true }: CustomPanelPageProps) {
  const t = useTranslation().islandWidgets.panel;
  const { panels, save } = useCustomPanels();
  const library = useIslandWidgets();
  const editing = usePanelEditing() === panelId;
  const sizesOf = skipAbsentWidgets((id: string) => library.find(id)?.sizes ?? null, useAbsentWidgets());
  const { ref, scale, board, panel, pages, pageStepPx } = useStrip(fuyuPanel(panels, library.widgets.length > 0 ? sizesOf : undefined), editing);
  const empty = panel.items.length === 0;
  const reducedMotion = useReducedMotion();
  const entranceRun = useEntranceRun(entrance, dataMotion, motion && !reducedMotion && !editing && !empty);
  const gridRef = useRef<HTMLDivElement>(null);
  const [incoming, setIncoming] = useState<IncomingWidget | null>(null);
  const { removed, remember, forget } = useUndoableRemoval();
  const [held, setHeld] = useState<HeldWidget | null>(null);
  const hold = useCallback(
    ({ target, ...point }: LongPressStart) => {
      window.getSelection()?.removeAllRanges();
      startPanelEditing(panelId);
      const widget = target.closest<HTMLElement>(".custom-panel__cell[data-widget]")?.dataset.widget;
      if (widget) setHeld({ widget, ...point });
    },
    [panelId],
  );
  const heldTaken = useCallback(() => setHeld(null), []);
  const onPointerDown = useLongPress(hold, holdable);
  useEditingLifetime(panelId, editing);

  const change = (next: CustomPanel) => save(fuyuPanels(next));
  const add = (widget: LibraryWidget) => {
    const size = defaultWidgetSize(widget.sizes);
    if (!size) return;
    const added = addPanelItem(panel, widget.id, size);
    change(panel.mode === "free" ? placeFreeItem(added, widget.id, stripRightPx(panel) / GRID_UNIT_PX + 1, 0, Infinity, Math.floor(board.height / GRID_UNIT_PX)) : added);
  };
  const remove = (widget: string, name: string) => {
    remember({ before: panel, text: t.removed(name) });
    change(removePanelItem(panel, widget));
  };
  const incomingOf = (drag: PickerDrag | null): IncomingWidget | null => {
    const size = drag ? defaultWidgetSize(drag.widget.sizes) : null;
    const point = drag && size ? boardPoint(gridRef.current, ref.current, drag) : null;
    return drag && size && point ? { widget: drag.widget.id, name: drag.widget.name, size, ...point } : null;
  };
  const dropPicked = (drag: PickerDrag) => {
    const incoming = incomingOf(drag);
    if (incoming) change(dropIncoming(panel, incoming, board));
    else if (empty && boardPoint(ref.current, ref.current, drag)) add(drag.widget);
  };
  const reset = () => {
    remember({ before: panel, text: t.resetDone });
    change(applyPanelTemplate({ ...panel, mode: "grid", items: [] }, "fuyu", sizesOf));
  };
  const undo = () => {
    if (removed) change(removed.before);
    forget();
  };

  return (
    <div
      className={editing ? "custom-panel custom-panel--editing" : "custom-panel"}
      data-panel={panelId}
      data-window-drag={editing ? "false" : undefined}
      onPointerDown={editing ? undefined : onPointerDown}
    >
      <div className={pages > 0 ? "custom-panel__scroll custom-panel__scroll--paged" : "custom-panel__scroll"} ref={ref}>
        {empty ? (
          <div className="custom-panel__empty">
            <p>{t.empty}</p>
            {editing ? null : <PanelTemplateButtons onPick={(template) => change(applyPanelTemplate(panel, template, sizesOf))} />}
            <span className="custom-panel__hint">{editing ? t.emptyEditing : t.templateHint}</span>
          </div>
        ) : (
          <div className="custom-panel__zoom" style={{ zoom: scale }}>
            <PanelBoard panel={panel} library={library} editing={editing} scale={scale} board={board} incoming={incoming} held={held} entrance={entranceRun} onHeldTaken={heldTaken} gridRef={gridRef} onChange={change} onRemove={remove} />
            {Array.from({ length: pages }, (_, page) => (
              <span key={page} className="custom-panel__snap" style={{ left: page * pageStepPx }} aria-hidden="true" />
            ))}
          </div>
        )}
      </div>
      {editing ? (
        <div className="custom-panel__dock">
          <div className="custom-panel__dock-head">
            <span className="custom-panel__dock-title">
              <CirclePlus size={14} strokeWidth={2.2} aria-hidden="true" />
              {t.addWidget}
            </span>
            <div className="custom-panel__modes" role="radiogroup" aria-label={t.mode}>
              {PANEL_MODES.map((mode) => (
                <button key={mode} type="button" role="radio" aria-checked={panel.mode === mode} onClick={() => change(setPanelMode(panel, mode, true))}>
                  {t.modes[mode]}
                </button>
              ))}
            </div>
            <button type="button" className="custom-panel__reset" onClick={reset}>
              <RotateCcw size={12} strokeWidth={2.2} aria-hidden="true" />
              {t.reset}
            </button>
            {removed ? (
              <span className="custom-panel__undo" role="status">
                <span>{removed.text}</span>
                <button type="button" onClick={undo}>
                  {t.undo}
                </button>
              </span>
            ) : (
              <span className="custom-panel__hint">{panel.mode === "free" ? t.freeHint : t.gridHint}</span>
            )}
          </div>
          <WidgetPicker panel={panel} library={library} onAdd={add} onDrag={(drag) => setIncoming(incomingOf(drag))} onDrop={dropPicked} />
        </div>
      ) : null}
    </div>
  );
}
