import type { PointerEvent as ReactPointerEvent } from "react";
import { CirclePlus, RotateCcw } from "lucide-react";
import type { LibraryWidget, WidgetLibrary } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import { PANEL_MODES, type CustomPanel, type PanelItem, type PanelMode } from "../../../lib/settings/customPanels";
import { PanelPager } from "./paging/PanelPager";
import { PanelTray } from "./paging/PanelTray";
import { WidgetPicker, type PickerDrag } from "./WidgetPicker";
import "./PanelDock.css";

export type Removed = { before: CustomPanel; text: string; go?: number };

type DockProps = {
  panel: CustomPanel;
  library: WidgetLibrary;
  removed: Removed | null;
  hint: { text: string; warn: string } | null;
  tray: { parked: readonly PanelItem[]; hot: boolean; dragging: boolean; onPress: (item: PanelItem) => (event: ReactPointerEvent<HTMLElement>) => void } | null;
  onMode: (mode: PanelMode) => void;
  onReset: () => void;
  onUndo: () => void;
  onGo: (page: number) => void;
  onAdd: (widget: LibraryWidget) => void;
  onDrag: (drag: PickerDrag | null) => void;
  onDrop: (drag: PickerDrag) => void;
};

export function PanelDock({ panel, library, removed, hint, tray, onMode, onReset, onUndo, onGo, onAdd, onDrag, onDrop }: DockProps) {
  const t = useTranslation().islandWidgets.panel;
  const go = removed?.go;
  return (
    <div className="custom-panel__dock">
      <div className="custom-panel__dock-head">
        <span className="custom-panel__dock-title">
          <CirclePlus size={14} strokeWidth={2.2} aria-hidden="true" />
          {t.addWidget}
        </span>
        <div className="custom-panel__modes" role="radiogroup" aria-label={t.mode}>
          {PANEL_MODES.map((mode) => (
            <button key={mode} type="button" role="radio" aria-checked={panel.mode === mode} onClick={() => onMode(mode)}>
              {t.modes[mode]}
            </button>
          ))}
        </div>
        <button type="button" className="custom-panel__reset" onClick={onReset}>
          <RotateCcw size={12} strokeWidth={2.2} aria-hidden="true" />
          {t.reset}
        </button>
        <PanelPager placement="dock" />
        {removed && !hint ? (
          <span className="custom-panel__undo" role="status">
            <span>{removed.text}</span>
            {go === undefined ? null : (
              <button type="button" onClick={() => onGo(go)}>
                {t.paging.goLook}
              </button>
            )}
            <button type="button" onClick={onUndo}>
              {t.undo}
            </button>
          </span>
        ) : (
          <span className="custom-panel__hint" data-live={hint ? true : undefined} role={hint ? "status" : undefined}>
            {hint ? hint.text : panel.mode === "free" ? t.freeHint : t.gridHint}
            {hint?.warn ? <span className="custom-panel__hint-warn">{hint.warn}</span> : null}
          </span>
        )}
      </div>
      <div className="custom-panel__dock-body">
        {tray ? <PanelTray parked={tray.parked} library={library} hot={tray.hot} dragging={tray.dragging} onPress={tray.onPress} /> : null}
        <WidgetPicker panel={panel} library={library} skip={tray?.parked.map((item) => item.widget)} onAdd={onAdd} onDrag={onDrag} onDrop={onDrop} />
      </div>
    </div>
  );
}
