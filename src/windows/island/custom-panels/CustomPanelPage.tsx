import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import { PanelTemplateButtons } from "../../../components/island-widget/PanelTemplateButtons";
import type { LibraryWidget } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import { addPanelItem, defaultWidgetSize, fuyuPanel, fuyuPanels, gridWidthPx, PANEL_MODES, setPanelMode, type CustomPanel } from "../../../lib/settings/customPanels";
import { applyPanelTemplate } from "../../../lib/settings/panelTemplates";
import { useCustomPanels } from "../../../lib/settings/useCustomPanels";
import { PanelBoard } from "./PanelBoard";
import { editingPanel, startPanelEditing, stopPanelEditing, usePanelEditing } from "./panelEditing";
import { useIslandWidgets } from "./useIslandWidgets";
import { useLongPress } from "./useLongPress";
import { WidgetPicker } from "./WidgetPicker";
import "./CustomPanelPage.css";
import "./CustomPanelEdit.css";

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

const emptySpace = (target: Element) => !target.closest(".custom-panel__cell, button, a, input");

export function CustomPanelPage({ panelId }: { panelId: string }) {
  const t = useTranslation().islandWidgets.panel;
  const { panels, save } = useCustomPanels();
  const library = useIslandWidgets();
  const editingId = usePanelEditing();
  const editing = editingId === panelId;
  const [picking, setPicking] = useState(false);
  const { ref, scale } = useFitScale();
  const startEditing = useCallback(() => startPanelEditing(panelId), [panelId]);
  const onPointerDown = useLongPress(startEditing, emptySpace);
  useEditingLifetime(panelId, editing);
  useEffect(() => {
    if (!editing) setPicking(false);
  }, [editing]);

  const panel = fuyuPanel(panels);
  const change = (next: CustomPanel) => save(fuyuPanels(next));
  const add = (widget: LibraryWidget) => {
    const size = defaultWidgetSize(widget.sizes);
    if (size) change(addPanelItem(panel, widget.id, size));
  };
  const empty = panel.items.length === 0;

  return (
    <div
      className={editing ? "custom-panel custom-panel--editing" : "custom-panel"}
      ref={ref}
      data-panel={panelId}
      data-window-drag={editing ? "false" : undefined}
      onPointerDown={editing ? undefined : onPointerDown}
    >
      <div className="custom-panel__bar">
        {editing ? (
          <>
            <div className="custom-panel__modes" role="radiogroup" aria-label={t.mode}>
              {PANEL_MODES.map((mode) => (
                <button key={mode} type="button" role="radio" aria-checked={panel.mode === mode} onClick={() => change(setPanelMode(panel, mode))}>
                  {t.modes[mode]}
                </button>
              ))}
            </div>
            <span className="custom-panel__hint">{panel.mode === "free" ? t.freeHint : t.gridHint}</span>
          </>
        ) : (
          <button className="custom-panel__edit" type="button" onClick={startEditing}>
            <Pencil size={12} strokeWidth={2.2} aria-hidden="true" />
            {t.edit}
          </button>
        )}
      </div>
      <div className="custom-panel__scroll">
        {empty && !picking ? (
          <div className="custom-panel__empty">
            <p>{t.empty}</p>
            <PanelTemplateButtons onPick={(template) => change(applyPanelTemplate(panel, template, (id) => library.find(id)?.sizes ?? null))} />
            <span className="custom-panel__hint">{t.templateHint}</span>
          </div>
        ) : null}
        {empty ? null : (
          <div className="custom-panel__zoom" style={{ zoom: scale }}>
            <PanelBoard panel={panel} library={library} editing={editing} scale={scale} onChange={change} />
          </div>
        )}
      </div>
      {editing ? (
        <div className="custom-panel__dock">
          {picking ? <WidgetPicker panel={panel} library={library} onAdd={add} /> : null}
          <div className="custom-panel__dock-row">
            <button className="custom-panel__add" type="button" aria-expanded={picking} onClick={() => setPicking((open) => !open)}>
              <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
              {t.addWidget}
            </button>
            <button className="custom-panel__done" type="button" onClick={stopPanelEditing}>
              <Check size={14} strokeWidth={2.4} aria-hidden="true" />
              {t.done}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
