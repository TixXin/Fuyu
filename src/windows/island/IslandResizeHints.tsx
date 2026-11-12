import "./IslandResizeHints.css";

const EXPANDED_EDGES = ["left", "right", "bottom", "bottom-left", "bottom-right"] as const;
const COLLAPSED_EDGES = ["left", "right"] as const;

type IslandResizeHintsProps = {
  isExpanded: boolean;
  popup: boolean;
  sizeLabel: string | null;
};

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
