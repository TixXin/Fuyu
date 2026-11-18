import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";

const SETTLE_AFTER_PAINT_MS = 220;
const EXTENDED_AFTER_SHOW_MS = 180;
const HIDDEN_WAIT_CAP_MS = 420;
const HARD_CAP_MS = 680;

export function useIslandPreparing(isExpanded: boolean) {
  const [isPreparing, setIsPreparing] = useState(isTauri);

  useEffect(() => {
    if (!isPreparing) {
      return;
    }
    if (isExpanded) {
      setIsPreparing(false);
      return;
    }

    let didCancel = false;
    let fontsReady = false;
    let extendedOnce = false;
    let frame: number | null = null;
    let timer: number | null = null;
    let hiddenFallbackTimer: number | null = null;

    const finish = () => {
      if (!didCancel) {
        setIsPreparing(false);
      }
    };

    const clearScheduledFrames = () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const scheduleRasterHold = (holdMs: number) => {
      clearScheduledFrames();
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          frame = null;
          timer = window.setTimeout(finish, holdMs);
        });
      });
    };

    const onWindowShownOrSized = () => {
      if (didCancel || !fontsReady || document.visibilityState === "hidden") {
        return;
      }
      if (hiddenFallbackTimer !== null) {
        window.clearTimeout(hiddenFallbackTimer);
        hiddenFallbackTimer = null;
        scheduleRasterHold(SETTLE_AFTER_PAINT_MS);
        return;
      }
      if (!extendedOnce) {
        extendedOnce = true;
        scheduleRasterHold(EXTENDED_AFTER_SHOW_MS);
      }
    };

    const hardCapTimer = window.setTimeout(finish, HARD_CAP_MS);
    document.addEventListener("visibilitychange", onWindowShownOrSized);
    window.addEventListener("resize", onWindowShownOrSized);

    void document.fonts.ready.then(() => {
      if (didCancel) {
        return;
      }
      fontsReady = true;
      if (document.visibilityState === "hidden") {
        hiddenFallbackTimer = window.setTimeout(() => {
          hiddenFallbackTimer = null;
          scheduleRasterHold(EXTENDED_AFTER_SHOW_MS);
        }, HIDDEN_WAIT_CAP_MS);
        return;
      }
      scheduleRasterHold(SETTLE_AFTER_PAINT_MS);
    });

    return () => {
      didCancel = true;
      clearScheduledFrames();
      if (hiddenFallbackTimer !== null) {
        window.clearTimeout(hiddenFallbackTimer);
      }
      window.clearTimeout(hardCapTimer);
      document.removeEventListener("visibilitychange", onWindowShownOrSized);
      window.removeEventListener("resize", onWindowShownOrSized);
    };
  }, [isExpanded, isPreparing]);

  return isPreparing;
}
