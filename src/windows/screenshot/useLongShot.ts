import { useCallback, useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { endLongShot, listenLongProgress, listenLongStarted, pauseLongShot, type LongEnding, type LongProgress } from "../../features/screenshot/api";
import { saveFolderOf } from "../../features/screenshot/settings";
import { loadScreenshotSettings } from "../../features/screenshot/storage";
import { getErrorMessage } from "../../utils/error";

function ownLabel() {
  try {
    return getCurrentWebviewWindow().label;
  } catch {
    return "";
  }
}

export function useLongShot(sessionId: number | undefined, folderName: string) {
  const [owner, setOwner] = useState<string | null>(null);
  const [progress, setProgress] = useState<LongProgress | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    setOwner(null);
    setProgress(null);
    setPreview(null);
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    void listenLongStarted((event) => setOwner(event.payload)).then(keep);
    void listenLongProgress((event) => {
      setProgress(event.payload);
      if (event.payload.preview) setPreview(event.payload.preview);
    }).then(keep);
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, []);

  const active = sessionId !== undefined && owner !== null;
  const mine = active && owner === ownLabel();
  const paused = progress !== null && progress.state !== "scrolling" && progress.state !== "fast";

  const end = useCallback((action: LongEnding) => {
    const save = action === "save" ? { folder: saveFolderOf(loadScreenshotSettings()), folderName } : undefined;
    endLongShot(action, save).catch((error: unknown) => console.error("Failed to end the long screenshot", getErrorMessage(error)));
  }, [folderName]);

  const togglePause = useCallback(() => {
    pauseLongShot().catch((error: unknown) => console.error("Failed to pause the long screenshot", getErrorMessage(error)));
  }, []);

  useEffect(() => {
    if (!mine) return;
    const onKey = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey;
      if (event.key === " ") togglePause();
      else if (event.key === "Enter" || (ctrl && event.key.toLowerCase() === "c")) end("copy");
      else if (ctrl && event.key.toLowerCase() === "s") end("save");
      else if (event.key === "Escape") end("cancel");
      else return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mine, end, togglePause]);

  return { active, mine, progress, preview, paused, end, togglePause };
}

export type LongShot = ReturnType<typeof useLongShot>;
