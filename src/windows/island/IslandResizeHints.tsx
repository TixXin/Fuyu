import "./IslandResizeHints.css";

const EXPANDED_EDGES = ["left", "right", "bottom", "bottom-left", "bottom-right"] as const;
const COLLAPSED_EDGES = ["left", "right"] as const;

type IslandResizeHintsProps = {
  isExpanded: boolean;
  /** A popup's card only moves (useIslandResize), so it has no lines. */
  popup: boolean;
  /** The size being set by a drag under way, or null. */
  sizeLabel: string | null;
};

/**
 * Accent lines on the edges an Alt + drag resizes (C25): the open panel's sides, bottom and bottom
 * corners, the collapsed island's sides. All show faintly while Alt is held over the island; the
 * one under the cursor, or being dragged, lights up. That is all CSS, from what useModifierWindowDrag
 * puts on <html>. While a drag is under way, the size it sets shows too.
 */
export function IslandResizeHints({ isExpanded, popup, sizeLabel }: IslandResizeHintsProps) {
  const edges = !isExpanded ? COLLAPSED_EDGES : popup ? [] : EXPANDED_EDGES;
  return (
    <div className="island-resize-hints" aria-hidden="true">
      <div className="island-resize-lines">
        {edges.map((edge) => (
          <span key={edge} className={`island-resize-hint island-resize-hint--${edge}`} />
        ))}
      </div>
      {sizeLabel !== null && <span className="island-resize-size">{sizeLabel}</span>}
    </div>
  );
}
