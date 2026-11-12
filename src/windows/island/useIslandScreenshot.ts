import { useCallback, useEffect } from "react";
import { configureScreenshot, startScreenshot } from "../../features/screenshot/api";
import { useScreenshotSettings } from "../../features/screenshot/useScreenshotSettings";
import { getErrorMessage } from "../../utils/error";

const COLLAPSE_MS = 260;

export function useIslandScreenshot(enabled: boolean, collapseIsland: () => void) {
  const [settings] = useScreenshotSettings();
  useEffect(() => {
    configureScreenshot(enabled, settings).catch((error: unknown) => {
      console.error("Failed to configure screenshots", getErrorMessage(error));
    });
  }, [enabled, settings]);

  const start = useCallback(() => {
    collapseIsland();
    window.setTimeout(() => {
      startScreenshot("region").catch((error: unknown) => console.error("Failed to start a screenshot", getErrorMessage(error)));
    }, COLLAPSE_MS);
  }, [collapseIsland]);

  return { settings, start: enabled ? start : null };
}
