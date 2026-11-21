import type { DragGridState } from "./api";
import "./DragGrid.css";

const LINES = ["v", "h"] as const;

export function DragGrid({ state }: { state: DragGridState }) {
  const className = state.visible ? "drag-grid drag-grid--visible" : "drag-grid";
  return (
    <div className={className} aria-hidden="true">
      {state.lines && LINES.map((line) => <span key={line} className={`drag-grid__line drag-grid__line--${line}`} />)}
      {state.snap && <span className={`drag-grid__snap drag-grid__snap--${state.snap}`} />}
      {state.slot && (
        <span
          className="drag-grid__slot"
          style={{ left: `${state.slot.left * 100}%`, top: `${state.slot.top * 100}%`, width: `${state.slot.width * 100}%`, height: `${state.slot.height * 100}%` }}
        />
      )}
    </div>
  );
}
