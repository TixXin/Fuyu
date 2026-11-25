import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { setOnboardingLaunchMode } from "./storage";

export function getGuideAppVersion() {
  return getVersion();
}

const ONBOARDING_ISLAND_EVENT = "onboarding-island";

export type IslandSpot = { x: number; y: number; width: number; height: number; expanded: boolean };

export type CardRect = { x: number; y: number; width: number; height: number };

function open(clearDesktop: boolean) {
  void invoke("open_onboarding_window", { clearDesktop }).catch((error) => {
    console.error("Failed to open the onboarding window", error);
  });
}

export function openOnboardingWindow() {
  setOnboardingLaunchMode("firstRun");
  open(false);
}

export function openFirstRunOnboardingWindow() {
  setOnboardingLaunchMode("firstRun");
  open(true);
}

export function openWhatsNewOnboardingWindow(fromVersion?: string | null) {
  setOnboardingLaunchMode("whatsNew", fromVersion);
  open(false);
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
