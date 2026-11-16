import { useEffect, useState } from "react";
import { useSystemDark } from "../../lib/theme/useResolvedTheme";
import { useWindowAccent } from "../../lib/theme/useWindowAccent";
import { getDragGridState, HIDDEN_DRAG_GRID, listenDragGridState, type DragGridState } from "./api";
import { DragGrid } from "./DragGrid";

export function DragGridWindow() {
  const light = !useSystemDark();
  useWindowAccent();
  const [state, setState] = useState<DragGridState>(HIDDEN_DRAG_GRID);

  useEffect(() => {
    document.documentElement.classList.toggle("island-light", light);
  }, [light]);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenDragGridState(setState).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    });
    void getDragGridState()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((error: unknown) => console.error("Failed to read the drag grid state", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return <DragGrid state={state} />;
}
