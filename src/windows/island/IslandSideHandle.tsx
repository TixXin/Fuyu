import { useWindowDragGesture } from "./useWindowDragGesture";
import "./IslandSideEdge.css";

type IslandSideHandleProps = {
  label: string;
  agentVisualState: string;
  badge: boolean;
  onOpen: () => void;
  onWindowDragStart: () => void;
};

export function IslandSideHandle({ label, agentVisualState, badge, onOpen, onWindowDragStart }: IslandSideHandleProps) {
  const { didDragRef, prepareWindowDrag, handleWindowDragMove, cancelWindowDrag } =
    useWindowDragGesture(false, onWindowDragStart);

  return (
    <div
      role="button"
      tabIndex={0}
      className="island__side-handle"
      aria-label={label}
      onPointerDown={prepareWindowDrag}
      onPointerMove={handleWindowDragMove}
      onPointerUp={cancelWindowDrag}
      onPointerCancel={cancelWindowDrag}
      onClick={() => {
        if (!didDragRef.current) {
          onOpen();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <span className={`island__side-handle-dot island__pulse--agent-${agentVisualState}`} aria-hidden="true" />
      {badge && <span className="island__side-handle-badge" aria-hidden="true" />}
    </div>
  );
}
