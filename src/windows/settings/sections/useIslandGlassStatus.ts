import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { IslandGlassStatus } from "../../island/glassStatus";
import { listenIslandGlassStatus, requestIslandGlassStatus } from "../api";

export function useIslandGlassStatus() {
  const [status, setStatus] = useState<IslandGlassStatus | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenIslandGlassStatus((next) => setStatus(next))
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
        return requestIslandGlassStatus();
      })
      .catch((error) => {
        console.error("Failed to track the island glass", error);
      });
    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);

  return status;
}
