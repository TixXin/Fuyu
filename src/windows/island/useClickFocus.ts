import { useEffect, useRef } from "react";
import { takeIslandClickFocus } from "./api";
import { CLICK_FOCUS_MAX_TRIES, CLICK_FOCUS_RETRY_MS, expandedByClick } from "./clickFocus";

function logFocusError(error: unknown) {
  console.error("Failed to focus the island after a click", error);
  return true;
}

export function useClickFocus(expanded: boolean) {
  const pressedAt = useRef<number | null>(null);

  useEffect(() => {
    const note = () => {
      pressedAt.current = performance.now();
    };
    window.addEventListener("pointerdown", note, true);
    return () => window.removeEventListener("pointerdown", note, true);
  }, []);

  useEffect(() => {
    if (!expanded || !expandedByClick(pressedAt.current, performance.now())) return;
    let cancelled = false;
    let timer: number | undefined;
    const run = (triesLeft: number) => {
      void takeIslandClickFocus()
        .catch(logFocusError)
        .then((settled) => {
          if (settled || cancelled || triesLeft <= 1) return;
          timer = window.setTimeout(() => run(triesLeft - 1), CLICK_FOCUS_RETRY_MS);
        });
    };
    run(CLICK_FOCUS_MAX_TRIES);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [expanded]);
}
