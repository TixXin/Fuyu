import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { SIDE_DOCK_LIMITS, type SideDockEdge, type SideDocksSettings } from "../../lib/settings/sideDocks";

const DRAG_THRESHOLD_PX = 6;
const CENTER_SNAP_DELTA = 0.025;

export function useSideDockHandleDrag(
  edge: SideDockEdge,
  sideDocks: SideDocksSettings,
  saveSideDocks: (next: SideDocksSettings) => void,
  onClearTimers: () => void,
  onOpen: () => void,
) {
  const [dragging, setDragging] = useState(false);
  const latestRef = useRef(sideDocks);
  latestRef.current = sideDocks;
  const didDragRef = useRef(false);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      const startY = event.screenY;
      const startAlong = latestRef.current[edge].along;
      const span = Math.max(480, window.screen?.availHeight || 900);
      const [minAlong, maxAlong] = SIDE_DOCK_LIMITS.along;
      didDragRef.current = false;

      const onMove = (moveEvent: PointerEvent) => {
        const deltaY = moveEvent.screenY - startY;
        if (!didDragRef.current && Math.abs(deltaY) < DRAG_THRESHOLD_PX) return;
        if (!didDragRef.current) {
          didDragRef.current = true;
          onClearTimers();
          setDragging(true);
        }
        let nextAlong = Math.max(minAlong, Math.min(maxAlong, startAlong + deltaY / span));
        if (Math.abs(nextAlong - 0.5) < CENTER_SNAP_DELTA) nextAlong = 0.5;
        const rounded = Number(nextAlong.toFixed(3));
        const current = latestRef.current;
        if (Math.abs(current[edge].along - rounded) < 0.002) return;
        saveSideDocks({
          ...current,
          [edge]: { ...current[edge], along: rounded },
        });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (didDragRef.current) {
          setDragging(false);
          window.setTimeout(() => {
            didDragRef.current = false;
          }, 80);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [edge, onClearTimers, saveSideDocks],
  );

  const onClick = useCallback(() => {
    if (didDragRef.current) return;
    onOpen();
  }, [onOpen]);

  return { dragging, onPointerDown, onClick };
}
