import { useEffect, useState } from "react";
import { getIslandExpandShortcutProblem, listenIslandExpandShortcutProblem, type IslandExpandShortcutProblem } from "./api";

export function useIslandExpandShortcutProblem() {
  const [problem, setProblem] = useState<IslandExpandShortcutProblem | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    getIslandExpandShortcutProblem()
      .then((current) => { if (!cancelled) setProblem(current); })
      .catch((error: unknown) => console.error("Failed to read the island expand shortcut", error));
    void listenIslandExpandShortcutProblem(setProblem)
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for the island expand shortcut", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return problem;
}
