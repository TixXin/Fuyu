import "./IslandResizeHints.css";

const EXPANDED_EDGES = ["left", "right", "bottom", "bottom-left", "bottom-right"] as const;
const COLLAPSED_EDGES = ["left", "right"] as const;

/**
 * Accent lines on the edges an Alt + drag resizes (C25): the open panel's sides, bottom and bottom
 * corners, the collapsed island's sides. All show faintly while Alt is held over the island; the
 * one under the cursor, or being dragged, lights up. That is all CSS, from what useModifierWindowDrag
 * puts on <html>.
 */
export function IslandResizeHints({ isExpanded }: { isExpanded: boolean }) {
  const edges = isExpanded ? EXPANDED_EDGES : COLLAPSED_EDGES;
  return (
    <div className="island-resize-hints" aria-hidden="true">
      {edges.map((edge) => (
        <span key={edge} className={`island-resize-hint island-resize-hint--${edge}`} />
      ))}
    </div>
  );
}
