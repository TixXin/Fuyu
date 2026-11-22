import { createPortal } from "react-dom";
import type { LibraryWidget } from "../../../../features/plugin-kernel/widgetLibrary";
import "./DragChip.css";

export function DragChip({ widget, name, x, y }: { widget: LibraryWidget | null; name: string; x: number; y: number }) {
  const Icon = widget?.icon;
  return createPortal(
    <div className="panel-drag-chip" style={{ transform: `translate(${Math.round(x + 12)}px, ${Math.round(y + 10)}px)` }} aria-hidden="true">
      {Icon ? <Icon size={13} strokeWidth={1.9} /> : null}
      <span>{name}</span>
    </div>,
    document.body,
  );
}
