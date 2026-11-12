import { useEffect } from "react";
import { configureScreenshot } from "../../features/screenshot/api";
import { getErrorMessage } from "../../utils/error";

export function useIslandScreenshot(enabled: boolean) {
  useEffect(() => {
    configureScreenshot(enabled).catch((error: unknown) => {
      console.error("Failed to configure screenshots", getErrorMessage(error));
    });
  }, [enabled]);
}
