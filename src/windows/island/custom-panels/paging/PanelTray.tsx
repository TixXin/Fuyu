import type { PointerEvent as ReactPointerEvent } from "react";
import { Archive } from "lucide-react";
import type { WidgetLibrary } from "../../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../../i18n";
import type { PanelItem } from "../../../../lib/settings/customPanels";
import "./PanelTray.css";

type TrayProps = {
  parked: readonly PanelItem[];
  library: WidgetLibrary;
  hot: boolean;
  dragging: boolean;
  onPress: (item: PanelItem) => (event: ReactPointerEvent<HTMLElement>) => void;
};

export function PanelTray({ parked, library, hot, dragging, onPress }: TrayProps) {
  const t = useTranslation().islandWidgets.panel.paging;
  return (
    <div className="panel-tray" data-panel-drop="tray" data-index={0} data-hot={hot || undefined} data-dragging={dragging || undefined} role="group" aria-label={t.tray}>
      {parked.length === 0 ? (
        <span className="panel-tray__label">
          <Archive size={13} strokeWidth={2} aria-hidden="true" />
          {dragging ? t.trayEmpty : t.tray}
        </span>
      ) : (
        parked.map((item) => {
          const widget = library.find(item.widget);
          const Icon = widget?.icon;
          const name = widget?.name ?? item.widget;
          return (
            <button key={item.widget} type="button" className="panel-tray__chip" title={t.takeOut(name)} aria-label={t.takeOut(name)} onPointerDown={onPress(item)}>
              {Icon ? <Icon size={13} strokeWidth={1.9} aria-hidden="true" /> : null}
              <span>{name}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
