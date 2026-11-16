import { useEffect, useState } from "react";
import { getTimerShortcutProblem, listenTimerShortcutProblem, type TimerShortcutProblem } from "./api";

export function useTimerShortcutProblem() {
  const [problem, setProblem] = useState<TimerShortcutProblem | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    getTimerShortcutProblem()
      .then((current) => { if (!cancelled) setProblem(current); })
      .catch((error: unknown) => console.error("Failed to read the timer shortcut", error));
    void listenTimerShortcutProblem(setProblem)
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for the timer shortcut", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return problem;
}
