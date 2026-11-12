import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Mirrored by ISLAND_EVENT in src-tauri/src/onboarding_window/overlay.rs. */
const ONBOARDING_ISLAND_EVENT = "onboarding-island";

/** The real island in the overlay's CSS pixels (overlay.rs `IslandRect`). */
export type IslandSpot = { x: number; y: number; width: number; height: number; expanded: boolean };

export type CardRect = { x: number; y: number; width: number; height: number };

/** Opens the first-run guide's overlay, or brings it to the front (onboarding_window/mod.rs). */
export function openOnboardingWindow() {
  void invoke("open_onboarding_window").catch((error) => {
    console.error("Failed to open the onboarding window", error);
  });
}

/** Shows this window, which a fresh open creates hidden until the page has painted. */
export function showOnboardingWindow() {
  return invoke("show_onboarding_window");
}

/** The overlay's cards; the pointer falls through everywhere else (overlay.rs). */
export function setOnboardingCardRects(rects: CardRect[]) {
  return invoke("set_onboarding_card_rects", { rects });
}

/** Where the real island is now, or null while it is hidden; resolves to the unlisten function. */
export function listenOnboardingIsland(handler: (spot: IslandSpot | null) => void) {
  return listen<IslandSpot | null>(ONBOARDING_ISLAND_EVENT, (event) => handler(event.payload));
}
