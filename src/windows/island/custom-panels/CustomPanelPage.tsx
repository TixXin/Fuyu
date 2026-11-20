import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, CirclePlus, LayoutDashboard } from "lucide-react";
import { PanelTemplateButtons } from "../../../components/island-widget/PanelTemplateButtons";
import type { LibraryWidget } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import { addPanelItem, defaultWidgetSize, fuyuPanel, fuyuPanels, gridWidthPx, PANEL_MODES, removePanelItem, setPanelMode, type CustomPanel } from "../../../lib/settings/customPanels";
import { applyPanelTemplate } from "../../../lib/settings/panelTemplates";
import { useCustomPanels } from "../../../lib/settings/useCustomPanels";
import { PanelBoard } from "./PanelBoard";
import { editingPanel, startPanelEditing, stopPanelEditing, usePanelEditing } from "./panelEditing";
import { useIslandWidgets } from "./useIslandWidgets";
import { useLongPress } from "./useLongPress";
import { WidgetPicker } from "./WidgetPicker";
import "./CustomPanelPage.css";
import "./CustomPanelEdit.css";

const UNDO_MS = 4000;

function useFitScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setScale(Math.min(1, element.clientWidth / gridWidthPx) || 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, scale };
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

const emptySpace = (target: Element) => !target.closest(".custom-panel__cell, button, a, input");

export function CustomPanelPage({ panelId }: { panelId: string }) {
  const t = useTranslation().islandWidgets.panel;
  const { panels, save } = useCustomPanels();
  const library = useIslandWidgets();
  const editing = usePanelEditing() === panelId;
  const { ref, scale } = useFitScale();
  const { removed, remember, forget } = useUndoableRemoval();
  const startEditing = useCallback(() => startPanelEditing(panelId), [panelId]);
  const onPointerDown = useLongPress(startEditing, emptySpace);
  useEditingLifetime(panelId, editing);

  const panel = fuyuPanel(panels);
  const change = (next: CustomPanel) => save(fuyuPanels(next));
  const add = (widget: LibraryWidget) => {
    const size = defaultWidgetSize(widget.sizes);
    if (size) change(addPanelItem(panel, widget.id, size));
  };
  const remove = (widget: string, name: string) => {
    remember({ before: panel, name });
    change(removePanelItem(panel, widget));
  };
  const undo = () => {
    if (removed) change(removed.before);
    forget();
  };
  const empty = panel.items.length === 0;
  const toggle = editing ? stopPanelEditing : startEditing;

  return (
    <div
      className={editing ? "custom-panel custom-panel--editing" : "custom-panel"}
      ref={ref}
      data-panel={panelId}
      data-window-drag={editing ? "false" : undefined}
      onPointerDown={editing ? undefined : onPointerDown}
    >
      <div className="custom-panel__bar">
        <button className="custom-panel__edit" type="button" aria-pressed={editing} aria-label={editing ? t.done : t.edit} title={editing ? t.done : t.edit} onClick={toggle}>
          {editing ? <Check size={15} strokeWidth={2.6} aria-hidden="true" /> : <LayoutDashboard size={15} strokeWidth={2} aria-hidden="true" />}
        </button>
      </div>
      <div className="custom-panel__scroll">
        {empty ? (
          <div className="custom-panel__empty">
            <p>{t.empty}</p>
            {editing ? null : <PanelTemplateButtons onPick={(template) => change(applyPanelTemplate(panel, template, (id) => library.find(id)?.sizes ?? null))} />}
            <span className="custom-panel__hint">{editing ? t.emptyEditing : t.templateHint}</span>
          </div>
        ) : (
          <div className="custom-panel__zoom" style={{ zoom: scale }}>
            <PanelBoard panel={panel} library={library} editing={editing} scale={scale} onChange={change} onRemove={remove} />
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
          <WidgetPicker panel={panel} library={library} onAdd={add} />
        </div>
      ) : null}
    </div>
  );
}
