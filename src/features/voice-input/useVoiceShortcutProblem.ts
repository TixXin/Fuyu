import { useEffect, useState } from "react";
import { getVoiceShortcutProblem, listenVoiceShortcutProblem, type VoiceShortcutProblem } from "./api";

export function useVoiceShortcutProblem() {
  const [problem, setProblem] = useState<VoiceShortcutProblem | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    getVoiceShortcutProblem()
      .then((current) => { if (!cancelled) setProblem(current); })
      .catch((error: unknown) => console.error("Failed to read the voice input shortcut", error));
    void listenVoiceShortcutProblem((event) => setProblem(event.payload))
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for the voice input shortcut", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return problem;
}
