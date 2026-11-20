import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Plus } from "lucide-react";
import type { LibraryWidget, WidgetLibrary } from "../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../i18n";
import type { CustomPanel } from "../../../lib/settings/customPanels";

const DRAG_START_PX = 5;

export type PickerDrag = { widget: LibraryWidget; clientX: number; clientY: number };

type PickerProps = {
  panel: CustomPanel;
  library: WidgetLibrary;
  onAdd: (widget: LibraryWidget) => void;
  onDrag: (drag: PickerDrag | null) => void;
  onDrop: (drag: PickerDrag) => void;
};

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

function useChipDrag({ onAdd, onDrag, onDrop }: Pick<PickerProps, "onAdd" | "onDrag" | "onDrop">) {
  const [ghost, setGhost] = useState<PickerDrag | null>(null);
  const latest = useRef({ onAdd, onDrag, onDrop });
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => {
    latest.current = { onAdd, onDrag, onDrop };
  });
  useEffect(() => () => stop.current?.(), []);

  const press = (widget: LibraryWidget) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    stop.current?.();
    const pointer = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    let dragging = false;
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      if (!dragging && Math.hypot(next.clientX - start.x, next.clientY - start.y) < DRAG_START_PX) return;
      dragging = true;
      const drag = { widget, clientX: next.clientX, clientY: next.clientY };
      setGhost(drag);
      latest.current.onDrag(drag);
    };
    const end = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      stop.current?.();
      setGhost(null);
      latest.current.onDrag(null);
      if (next.type === "pointercancel") return;
      if (dragging) latest.current.onDrop({ widget, clientX: next.clientX, clientY: next.clientY });
      else latest.current.onAdd(widget);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    stop.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      stop.current = null;
    };
  };
  return { ghost, press };
}

export function WidgetPicker({ panel, library, onAdd, onDrag, onDrop }: PickerProps) {
  const t = useTranslation().islandWidgets.panel;
  const ref = useWheelScrollsSideways();
  const { ghost, press } = useChipDrag({ onAdd, onDrag, onDrop });
  const taken = new Set(panel.items.map((item) => item.widget));
  const rest = library.widgets.filter((widget) => !taken.has(widget.id));
  const builtin = rest.filter((widget) => !widget.plugin);
  const plugins = rest.filter((widget) => widget.plugin);
  const chip = (widget: LibraryWidget) => {
    const Icon = widget.icon;
    return (
      <button
        key={widget.id}
        className="custom-panel__chip"
        type="button"
        data-widget={widget.id}
        data-picked={ghost?.widget.id === widget.id ? true : undefined}
        title={t.addThis(widget.name)}
        onPointerDown={press(widget)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onAdd(widget);
          }
        }}
      >
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
