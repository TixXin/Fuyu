import { invoke } from "@tauri-apps/api/core";

/** Opens the first-run guide's window, or brings it to the front (onboarding_window/mod.rs). */
export function openOnboardingWindow() {
  void invoke("open_onboarding_window").catch((error) => {
    console.error("Failed to open the onboarding window", error);
  });
}

/** Shows this window, which a fresh open creates hidden until the page has painted. */
export function showOnboardingWindow() {
  return invoke("show_onboarding_window");
}
