import { useEffect } from "react";
import { configureScreenshot } from "../../features/screenshot/api";
import { getErrorMessage } from "../../utils/error";

/**
 * Hands the screenshot switch to the native side, which registers its shortcuts only while it is
 * on. The island window runs for the whole session, so it owns this; the settings window only
 * saves the switch.
 */
export function useIslandScreenshot(enabled: boolean) {
  useEffect(() => {
    configureScreenshot(enabled).catch((error: unknown) => {
      console.error("Failed to configure screenshots", getErrorMessage(error));
    });
  }, [enabled]);
}
