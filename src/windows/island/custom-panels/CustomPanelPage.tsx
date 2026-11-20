import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, CirclePlus, LayoutDashboard } from "lucide-react";
import { PanelTemplateButtons } from "../../../components/island-widget/PanelTemplateButtons";
import type { LibraryWidget } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import { addPanelItem, boardHeightPx, defaultWidgetSize, dropNewPanelItem, fuyuPanel, fuyuPanels, gridWidthPx, PANEL_MODES, removePanelItem, setPanelMode, type CustomPanel } from "../../../lib/settings/customPanels";
import { applyPanelTemplate } from "../../../lib/settings/panelTemplates";
import { useCustomPanels } from "../../../lib/settings/useCustomPanels";
import { PanelBoard, type HeldWidget, type IncomingWidget } from "./PanelBoard";
import { editingPanel, startPanelEditing, stopPanelEditing, usePanelEditing } from "./panelEditing";
import { useIslandWidgets } from "./useIslandWidgets";
import { useLongPress, type LongPressStart } from "./useLongPress";
import { WidgetPicker, type PickerDrag } from "./WidgetPicker";
import "./CustomPanelPage.css";
import "./CustomPanelEdit.css";

const UNDO_MS = 4000;
const BOARD_MARGIN_PX = 10;

function useFitScale(contentHeight: number) {
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
  const scale = room ? Math.min(1, room.width / gridWidthPx, room.height / (contentHeight + BOARD_MARGIN_PX)) : 1;
  return { ref, scale: scale > 0 ? scale : 1 };
}

function boardPoint(grid: HTMLElement | null, area: HTMLElement | null, drag: PickerDrag): { x: number; y: number } | null {
  if (!grid || !area) return null;
  const bounds = area.getBoundingClientRect();
  if (drag.clientX < bounds.left || drag.clientX > bounds.right || drag.clientY < bounds.top || drag.clientY > bounds.bottom) return null;
  const rect = grid.getBoundingClientRect();
  const factor = rect.width > 0 ? gridWidthPx / rect.width : 1;
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

type Removed = { before: CustomPanel; name: string };

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

export function CustomPanelPage({ panelId }: { panelId: string }) {
  const t = useTranslation().islandWidgets.panel;
  const { panels, save } = useCustomPanels();
  const library = useIslandWidgets();
  const editing = usePanelEditing() === panelId;
  const panel = fuyuPanel(panels);
  const empty = panel.items.length === 0;
  const { ref, scale } = useFitScale(boardHeightPx(panel));
  const gridRef = useRef<HTMLDivElement>(null);
  const [incoming, setIncoming] = useState<IncomingWidget | null>(null);
  const { removed, remember, forget } = useUndoableRemoval();
  const [held, setHeld] = useState<HeldWidget | null>(null);
  const startEditing = useCallback(() => startPanelEditing(panelId), [panelId]);
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
    if (size) change(addPanelItem(panel, widget.id, size));
  };
  const remove = (widget: string, name: string) => {
    remember({ before: panel, name });
    change(removePanelItem(panel, widget));
  };
  const incomingOf = (drag: PickerDrag | null): IncomingWidget | null => {
    const size = drag ? defaultWidgetSize(drag.widget.sizes) : null;
    const point = drag && size ? boardPoint(gridRef.current, ref.current, drag) : null;
    return drag && size && point ? { widget: drag.widget.id, name: drag.widget.name, size, ...point } : null;
  };
  const dropPicked = (drag: PickerDrag) => {
    const incoming = incomingOf(drag);
    if (incoming) change(dropNewPanelItem(panel, incoming.widget, incoming.size, incoming.x, incoming.y));
    else if (empty && boardPoint(ref.current, ref.current, drag)) add(drag.widget);
  };
  const undo = () => {
    if (removed) change(removed.before);
    forget();
  };
  const toggle = editing ? stopPanelEditing : startEditing;

  return (
    <div
      className={editing ? "custom-panel custom-panel--editing" : "custom-panel"}
      data-panel={panelId}
      data-window-drag={editing ? "false" : undefined}
      onPointerDown={editing ? undefined : onPointerDown}
    >
      <div className="custom-panel__bar">
        <button className="custom-panel__edit" type="button" aria-pressed={editing} aria-label={editing ? t.done : t.edit} title={editing ? t.done : t.edit} onClick={toggle}>
          {editing ? <Check size={15} strokeWidth={2.6} aria-hidden="true" /> : <LayoutDashboard size={15} strokeWidth={2} aria-hidden="true" />}
        </button>
      </div>
      <div className="custom-panel__scroll" ref={ref}>
        {empty ? (
          <div className="custom-panel__empty">
            <p>{t.empty}</p>
            {editing ? null : <PanelTemplateButtons onPick={(template) => change(applyPanelTemplate(panel, template, (id) => library.find(id)?.sizes ?? null))} />}
            <span className="custom-panel__hint">{editing ? t.emptyEditing : t.templateHint}</span>
          </div>
        ) : (
          <div className="custom-panel__zoom" style={{ zoom: scale }}>
            <PanelBoard panel={panel} library={library} editing={editing} scale={scale} incoming={incoming} held={held} onHeldTaken={heldTaken} gridRef={gridRef} onChange={change} onRemove={remove} />
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
                <button key={mode} type="button" role="radio" aria-checked={panel.mode === mode} onClick={() => change(setPanelMode(panel, mode))}>
                  {t.modes[mode]}
                </button>
              ))}
            </div>
            {removed ? (
              <span className="custom-panel__undo" role="status">
                <span>{t.removed(removed.name)}</span>
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
