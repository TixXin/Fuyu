import { useEffect, useState } from "react";
import { listenOnboardingIsland, type IslandSpot } from "./api";
import { nextAnchor } from "./placement";

/**
 * Where the real island is on the overlay now (null while it is hidden), and where it was when
 * last closed. Sent by onboarding_window/overlay.rs whenever it moves, grows or shrinks.
 */
export function useIslandSpot() {
  const [state, setState] = useState<{ spot: IslandSpot | null; anchor: IslandSpot | null }>({ spot: null, anchor: null });

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenOnboardingIsland((spot) => setState((current) => ({ spot, anchor: nextAnchor(current.anchor, spot) })))
      .then((stop) => (cancelled ? stop() : (unlisten = stop)))
      .catch((error: unknown) => console.error("Failed to follow the island", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return state;
}
