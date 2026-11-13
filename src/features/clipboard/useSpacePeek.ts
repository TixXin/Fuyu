import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PEEK_HOLD_MS, releaseEndsPeek } from "./popupKeys";

export function useSpacePeek(onRelease: () => void) {
  const downAt = useRef<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [holding, setHolding] = useState(false);

  const cancel = useCallback(() => {
    downAt.current = null;
    window.clearTimeout(timer.current);
    setHolding(false);
  }, []);

  const start = useCallback(() => {
    downAt.current = Date.now();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHolding(true), PEEK_HOLD_MS);
  }, []);

  const keyUp = (event: KeyboardEvent) => {
    if (event.key !== " " || downAt.current === null) return;
    const held = Date.now() - downAt.current;
    cancel();
    if (releaseEndsPeek(held)) onRelease();
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { start, keyUp, cancel, holding };
}
