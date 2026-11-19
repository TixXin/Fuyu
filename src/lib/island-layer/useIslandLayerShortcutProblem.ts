import { useEffect, useState } from "react";
import { getIslandLayerShortcutProblem, listenIslandLayerShortcutProblem, type IslandLayerShortcutProblem } from "./api";

export function useIslandLayerShortcutProblem() {
  const [problem, setProblem] = useState<IslandLayerShortcutProblem | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    getIslandLayerShortcutProblem()
      .then((current) => { if (!cancelled) setProblem(current); })
      .catch((error: unknown) => console.error("Failed to read the island layer shortcut", error));
    void listenIslandLayerShortcutProblem(setProblem)
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for the island layer shortcut", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return problem;
}
