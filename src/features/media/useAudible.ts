import { useEffect, useState } from "react";

export const AUDIBLE_HOLD_MS = 2000;

export function useAudible(active: boolean) {
  const [held, setHeld] = useState(active);

  useEffect(() => {
    if (active) {
      setHeld(true);
      return;
    }
    const timer = window.setTimeout(() => setHeld(false), AUDIBLE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  return active || held;
}
