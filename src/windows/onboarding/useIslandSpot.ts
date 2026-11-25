import { useEffect, useState } from "react";
import { listenOnboardingInsets, listenOnboardingIsland, ZERO_SAFE_INSETS, type IslandSpot, type SafeInsets } from "./api";

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

export function useSafeInsets(): SafeInsets {
  const [insets, setInsets] = useState<SafeInsets>(ZERO_SAFE_INSETS);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenOnboardingInsets(setInsets)
      .then((stop) => (cancelled ? stop() : (unlisten = stop)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return insets;
}
