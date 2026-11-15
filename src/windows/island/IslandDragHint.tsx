import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { isTauri } from "@tauri-apps/api/core";
import { listenIslandDragEdgeHint, type DragEdgeHint } from "./api";

export function IslandDragHint() {
  const [hint, setHint] = useState<DragEdgeHint | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenIslandDragEdgeHint(setHint)
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error) => console.error("Failed to follow the drag edge hint", error));
    return () => {
      cancelled = true;
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
