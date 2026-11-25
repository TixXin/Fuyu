import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getAppVersion } from "../../features/updater/api";
import { showOnboardingWindow } from "./api";
import { endIslandDemo, sendIslandDirectorCommand, writeGuideSeenVersion } from "./storage";

export function closeOnboardingGuide() {
  sendIslandDirectorCommand({ action: "collapse" });
  endIslandDemo();
  void getAppVersion()
    .then(writeGuideSeenVersion)
    .catch(() => undefined);
  void getCurrentWindow().close().catch((error: unknown) => console.error("Failed to close the onboarding window", error));
}

export function useShowWhenPainted() {
  useEffect(() => {
    const show = () => void showOnboardingWindow().catch((error) => console.error("Failed to show the onboarding window", error));
    if (document.visibilityState === "hidden") {
      show();
      return;
    }
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(show);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, []);
}

export function useViewport() {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

export function useOnboardingKeyboard(handlers: {
  qrZoomed: boolean;
  onCloseQr: () => void;
  onCloseGuide: () => void;
  onForward: () => void;
  onBackward: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (handlers.qrZoomed) handlers.onCloseQr();
        else handlers.onCloseGuide();
        return;
      }
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        handlers.onForward();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlers.onBackward();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}
