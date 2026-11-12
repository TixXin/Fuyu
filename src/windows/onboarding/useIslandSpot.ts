import { useEffect, useState } from "react";
import { listenOnboardingIsland, type IslandSpot } from "./api";

/**
 * Where the real island is on the overlay now, or null while it is hidden. Sent by
 * onboarding_window/overlay.rs whenever it moves, opens or closes.
 */
export function useIslandSpot() {
  const [spot, setSpot] = useState<IslandSpot | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenOnboardingIsland(setSpot)
      .then((stop) => (cancelled ? stop() : (unlisten = stop)))
      .catch((error: unknown) => console.error("Failed to follow the island", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return spot;
}
