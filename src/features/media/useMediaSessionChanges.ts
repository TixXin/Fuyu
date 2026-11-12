import { useEffect } from "react";
import { listenMediaSessionChanges, type MediaSessionChange } from "./api";

export function useMediaSessionChanges(enabled: boolean, onChange: (change: MediaSessionChange) => void) {
  useEffect(() => {
    if (!enabled) return;
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenMediaSessionChanges(onChange)
      .then((nextUnlisten) => {
        if (didCancel) nextUnlisten();
        else unlisten = nextUnlisten;
      })
      .catch((error) => console.error("Failed to watch the media session", error));
    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, [enabled, onChange]);
}
