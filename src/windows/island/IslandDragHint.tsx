import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { isTauri } from "@tauri-apps/api/core";
import { throttle } from "../../utils/throttle.ts";
import { listenIslandDragEdgeHint, type DragEdgeHint } from "./api";

const HINT_THROTTLE_MS = 16;

export function IslandDragHint() {
  const [hint, setHint] = useState<DragEdgeHint | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const throttledHint = throttle((next: DragEdgeHint | null) => setHint(next), HINT_THROTTLE_MS);
    void listenIslandDragEdgeHint((next) => {
      if (next === null) {
        throttledHint.cancel();
        setHint(null);
        return;
      }
      throttledHint(next);
    })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error) => console.error("Failed to follow the drag edge hint", error));
    return () => {
      cancelled = true;
      throttledHint.cancel();
      unlisten?.();
    };
  }, []);

  if (!hint) return null;
  return createPortal(
    <span
      className={`island-drag-hint island-drag-hint--${hint.edge}`}
      style={{ "--island-drag-hint-offset": `${hint.offset}px` } as CSSProperties}
      aria-hidden="true"
    />,
    document.body,
  );
}
