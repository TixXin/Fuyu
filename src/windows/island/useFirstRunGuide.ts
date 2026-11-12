import { useEffect, useState } from "react";
import { islandRanBefore } from "../../features/appearance/installState";
import { openOnboardingWindow } from "../onboarding/api";
import { ONBOARDING_WELCOME_STORAGE_KEY, isFreshWelcome } from "../onboarding/storage";

/** Lets the island show on its own for a moment before the guide opens beside it. */
const OPEN_DELAY_MS = 1_200;
/** How long the island says it is ready once the guide has flown into it. */
const WELCOME_MS = 4_500;

// StrictMode runs effects twice; the guide opens once per start.
let opened = false;

/**
 * Opens the first-run guide on a new install, and returns true for a moment after the guide flies
 * into the island, while the collapsed bar greets the user. Islands that ran before (their settings
 * are saved, including those copied over from before the rename) never see the guide; it stays one
 * click away on Settings → About. Must be called during the island's first render, before its
 * settings are saved.
 */
export function useFirstRunGuide(): boolean {
  const [firstRun] = useState(() => !islandRanBefore());
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    if (!firstRun || opened) return;
    const timer = window.setTimeout(() => {
      opened = true;
      openOnboardingWindow();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [firstRun]);

  useEffect(() => {
    const greet = (event: StorageEvent) => {
      if (event.key === ONBOARDING_WELCOME_STORAGE_KEY && isFreshWelcome(event.newValue)) setWelcome(true);
    };
    window.addEventListener("storage", greet);
    return () => window.removeEventListener("storage", greet);
  }, []);

  useEffect(() => {
    if (!welcome) return;
    const timer = window.setTimeout(() => setWelcome(false), WELCOME_MS);
    return () => window.clearTimeout(timer);
  }, [welcome]);

  return welcome;
}
