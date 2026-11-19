import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getIslandNotch, listenIslandNotch } from "../island/api";

export function useIslandNotchShown() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenIslandNotch((notch) => setShown(notch !== null))
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
        return getIslandNotch().then((notch) => {
          if (!didCancel) setShown(notch !== null);
        });
      })
      .catch((error) => {
        console.error("Failed to track the island notch", error);
      });
    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);

  return shown;
}
