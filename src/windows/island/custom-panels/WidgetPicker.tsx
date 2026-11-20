import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import type { LibraryWidget, WidgetLibrary } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import type { CustomPanel } from "../../../lib/settings/customPanels";

function useWheelScrollsSideways() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || element.scrollWidth <= element.clientWidth) return;
      element.scrollLeft += event.deltaY;
      event.preventDefault();
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);
  return ref;
}

export function WidgetPicker({ panel, library, onAdd }: { panel: CustomPanel; library: WidgetLibrary; onAdd: (widget: LibraryWidget) => void }) {
  const t = useTranslation().islandWidgets.panel;
  const ref = useWheelScrollsSideways();
  const taken = new Set(panel.items.map((item) => item.widget));
  const rest = library.widgets.filter((widget) => !taken.has(widget.id));
  const builtin = rest.filter((widget) => !widget.plugin);
  const plugins = rest.filter((widget) => widget.plugin);
  const chip = (widget: LibraryWidget) => {
    const Icon = widget.icon;
    return (
      <button key={widget.id} className="custom-panel__chip" type="button" data-widget={widget.id} title={t.addThis(widget.name)} onClick={() => onAdd(widget)}>
        <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
        <span>{widget.name}</span>
        <span className="custom-panel__chip-plus" aria-hidden="true">
          <Plus size={11} strokeWidth={2.6} />
        </span>
      </button>
    );
  };
  return (
    <div className="custom-panel__picker" ref={ref} role="group" aria-label={t.addWidget}>
      {rest.length === 0 ? <p className="custom-panel__picker-none">{t.allAdded}</p> : null}
      {builtin.map(chip)}
      {plugins.length > 0 ? <span className="custom-panel__picker-label">{t.plugin}</span> : null}
      {plugins.map(chip)}
    </div>
  );
}
