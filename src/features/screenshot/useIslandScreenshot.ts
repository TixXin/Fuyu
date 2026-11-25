import { useCallback, useEffect } from "react";
import { configureScreenshot, rememberPins, startScreenshot } from "./api";
import { startDelayedScreenshot } from "./delay/api";
import { useScreenshotSettings } from "./useScreenshotSettings";
import { getErrorMessage } from "../../utils/error";

const COLLAPSE_MS = 260;

export function useIslandScreenshot(enabled: boolean, collapseIsland: () => void) {
  const [settings] = useScreenshotSettings();
  useEffect(() => {
    configureScreenshot(enabled, settings).catch((error: unknown) => {
      console.error("Failed to configure screenshots", getErrorMessage(error));
    });
  }, [enabled, settings]);

  const { restorePins } = settings;
  useEffect(() => {
    if (!enabled && restorePins) return;
    rememberPins(restorePins).catch((error: unknown) => console.error("Failed to set up pin restore", getErrorMessage(error)));
  }, [enabled, restorePins]);

  const start = useCallback(() => {
    collapseIsland();
    window.setTimeout(() => {
      startScreenshot("region").catch((error: unknown) => console.error("Failed to start a screenshot", getErrorMessage(error)));
    }, COLLAPSE_MS);
  }, [collapseIsland]);

  const startDelayed = useCallback((seconds?: number) => {
    collapseIsland();
    startDelayedScreenshot(seconds).catch((error: unknown) => console.error("Failed to start a delayed screenshot", getErrorMessage(error)));
  }, [collapseIsland]);

  return { settings, start: enabled ? start : null, startDelayed: enabled ? startDelayed : null };
}
