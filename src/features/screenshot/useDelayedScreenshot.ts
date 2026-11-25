import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import {
  cancelDelayedScreenshot,
  getDelayedScreenshotStatus,
  listenDelayedScreenshotState,
  type ScreenshotDelayState,
} from "./delay/api";

const IDLE: ScreenshotDelayState = { active: false, remaining: 0, total: 0 };

export function useDelayedScreenshot() {
  const t = useTranslation().screenshot.delay;
  const [state, setState] = useState<ScreenshotDelayState>(IDLE);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenDelayedScreenshotState((event) => {
      if (!cancelled) setState(event.payload);
    }).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    });
    getDelayedScreenshotStatus()
      .then((current) => { if (!cancelled) setState(current); })
      .catch(() => {});
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const cancel = useCallback(() => {
    void cancelDelayedScreenshot().catch(() => {});
  }, []);

  return {
    active: state.active && state.remaining > 0,
    remaining: state.remaining,
    total: state.total,
    text: state.active && state.remaining > 0 ? t.countdown(state.remaining) : "",
    cancel,
  };
}

export type DelayNoticeState = ReturnType<typeof useDelayedScreenshot>;
