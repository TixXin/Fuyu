import { invoke } from "@tauri-apps/api/core";

/** Opens the first-run guide's window, or brings it to the front (onboarding_window/mod.rs). */
export function openOnboardingWindow() {
  void invoke("open_onboarding_window").catch((error) => {
    console.error("Failed to open the onboarding window", error);
  });
}

/**
 * Moves this window over the real island for `durationMs` while the page shrinks into an island
 * shape, then closes it (onboarding_window/fly.rs). Resolves as soon as the flight has started.
 */
export function flyOnboardingToIsland(durationMs: number) {
  return invoke("fly_onboarding_to_island", { durationMs });
}

/** Shows this window, which a fresh open creates hidden until the page has painted. */
export function showOnboardingWindow() {
  return invoke("show_onboarding_window");
}
