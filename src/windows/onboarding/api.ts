import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const ONBOARDING_ISLAND_EVENT = "onboarding-island";

export type IslandSpot = { x: number; y: number; width: number; height: number; expanded: boolean };

export type CardRect = { x: number; y: number; width: number; height: number };

function open(clearDesktop: boolean) {
  void invoke("open_onboarding_window", { clearDesktop }).catch((error) => {
    console.error("Failed to open the onboarding window", error);
  });
}

export function openOnboardingWindow() {
  open(false);
}

export function openFirstRunOnboardingWindow() {
  open(true);
}

export function showOnboardingWindow() {
  return invoke("show_onboarding_window");
}

export function setOnboardingCardRects(rects: CardRect[]) {
  return invoke("set_onboarding_card_rects", { rects });
}

export function listenOnboardingIsland(handler: (spot: IslandSpot | null) => void) {
  return listen<IslandSpot | null>(ONBOARDING_ISLAND_EVENT, (event) => handler(event.payload));
}
