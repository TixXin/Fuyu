import { useEffect, useState } from "react";
import { islandRanBefore } from "../../features/appearance/installState";
import { openOnboardingWindow } from "../onboarding/api";

/** Lets the island show on its own for a moment before the guide opens beside it. */
const OPEN_DELAY_MS = 1_200;

// StrictMode runs effects twice; the guide opens once per start.
let opened = false;

/**
 * Opens the first-run guide on a new install. Islands that ran before (their settings are saved,
 * including those copied over from before the rename) never see it; it stays one click away on
 * Settings → About. Must be called during the island's first render, before its settings are saved.
 */
export function useFirstRunGuide() {
  const [firstRun] = useState(() => !islandRanBefore());

  useEffect(() => {
    if (!firstRun || opened) return;
    const timer = window.setTimeout(() => {
      opened = true;
      openOnboardingWindow();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [firstRun]);
}
