import { useEffect, useState } from "react";

/** How long it stays quiet before the waveform goes, so a gap between songs or a soft passage keeps it. */
export const AUDIBLE_HOLD_MS = 2000;

/**
 * Whether the collapsed island shows the music waveform: at once when sound plays (`active`),
 * and until it has been quiet for AUDIBLE_HOLD_MS.
 */
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
